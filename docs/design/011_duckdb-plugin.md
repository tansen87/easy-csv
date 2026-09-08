# 011 — DuckDB 作为可选 CLI 插件的设计评估

> 状态：**设计评估（未实施）**
> 原则：DuckDB **不打包进安装包**，仅作为用户可选插件放置在 `plugins/`，本次**不修改任何代码**。
> 本文档回答两个问题：① 是否有必要添加 DuckDB；② 若添加，如何以零代码方式接入现有插件机制。

---

## 1. 背景与动机

Easy CSV 目前的数据处理能力由三部分构成：

| 能力 | 载体 | 说明 |
|------|------|------|
| 59 个 CSV 操作命令 | 内嵌 `xan.exe` | 筛选、排序、聚合、连接、透视等 |
| 插件命令 | `<resources>/plugins/`（当前仅 `pinyin`） | 通过 `plugins.db` 注册，管道内与 xan 命令混排 |
| 内置 Rust 实现 | `csv.rs` | 读取预览、数据概况、双文件对比、编码转换 |

xan 的 moonblade 表达式体系覆盖了大部分行级变换，但在以下场景存在明显边界：

1. **复杂 SQL 分析**：多层 CTE、跨表子查询、`EXCEPT/INTERSECT`、`QUALIFY`、复杂窗口组合。
2. **超大文件性能**：xan 是单线程流式处理；DuckDB 是列式 + 向量化 + 并行 CSV 读取引擎，GB 级文件聚合通常有数量级优势。
3. **超内存数据集**：DuckDB 支持溢写磁盘（`temp_directory`），可以处理大于内存的文件。
4. **动态列透视**：xan `pivot` 需预先知道列值；DuckDB `PIVOT` 可动态展开。
5. **异构格式 IO**：Parquet、JSON、Excel 的直接读写（`read_parquet` / `COPY ... TO ... (FORMAT PARQUET)`）。

## 2. 是否有必要添加（结论先行）

**建议：值得作为"可选进阶插件"补充，但不作为默认依赖，不进一线命令面板。**

理由分正反两面：

### 2.1 支持添加

- **零侵入**：项目已具备完整的外部 CLI 插件机制（`plugins.rs`：`plugins.db` 注册表、`<resources>/plugins/` 目录优先解析、`command_executable` 按命令名路由），接入 DuckDB 不需要改架构。
- **能力互补而非重复**：与 59 个 xan 命令重叠的部分（filter/sort/groupby/join）不必迁移，只把 DuckDB 定位在 xan 表达力之外的"SQL 分析逃生舱"。管道中 `xan 步骤 → duckdb 步骤 → xan 步骤` 可自由混排。
- **用户自主获取**：DuckDB CLI 是单一无依赖可执行文件（Windows 预编译 zip 约 10 MB，解压后约 50 MB），官方 MIT 许可，用户自行下载放入 `plugins/` 即可，不增加安装包体积。
- **对 AI 助手友好**：SQL 是大模型最擅长的 DSL 之一，`duckdb` 步骤未来可作为 AI 生成管道的自然目标（后续阶段）。

### 2.2 反对现在深度集成（为何"不打包、不进 UI"）

- **体积**：解压后约 50 MB，打包进安装包对多数轻量用户是净负担。
- **功能重叠**：日常 CSV 操作 xan 已足够，强行双引擎会造成命令面板、帮助文档、AI 检索索引的维护成本翻倍。
- **探活与版本漂移**：插件管理页已有 `check_plugins`（执行 `--version`）机制，DuckDB CLI 的版本号输出格式与 xan/pinyin 不同，需要验证展示效果。
- **Windows stdin 兼容性未证实**：这是唯一的硬性技术风险，见 §4.1，必须 PoC 后才能承诺"管道一等公民"体验。

因此定位为：**文档先行的可选插件**——高级用户可立即手动接入使用；是否升级为正式功能，取决于 §7 的 PoC 验证结论与用户反馈。

## 3. 现有插件机制如何承载 DuckDB（零代码路径）

以下步骤全部基于现状代码行为，**不需要修改任何源码**：

### 3.1 二进制放置

两种任选：

- **方式 A（推荐）**：将 `duckdb.exe` 放入 `<exe目录>/EasyCsv_resources/plugins/`。`resolve_plugin_executable` 会优先在该目录查找（含 `.exe` 补全），与 `xan.exe`、`pinyin.exe` 同目录。
- **方式 B**：`duckdb` 已在系统 `PATH` 中（如 `winget install DuckDB.cli` 安装）。解析顺序为：路径 → `plugins/` 目录 → `PATH`，两者不冲突（plugins 目录优先）。

### 3.2 注册进 plugins.db

`command_executable` 按命令名查 `plugins` 表路由；未注册的命令名一律回退到 xan.exe（导致 "unknown command duckdb" 错误）。当前**没有** UI 或 Tauri 命令用于新增注册（只有只读的 `list_plugins` / `check_plugins`），因此零代码路径需要用任意 SQLite 工具手动写入一次：

```sql
-- 文件：<exe目录>/EasyCsv_resources/data/plugins.db
INSERT OR REPLACE INTO plugins (name, executable) VALUES ('duckdb', 'duckdb');
```

注册后：

- 设置 → 插件管理页签的 `list_plugins` 会显示 `duckdb`；
- `check_plugins` 会解析并执行 `duckdb --version` 显示版本（见 §4.2 验证项）；
- 管道中出现 `duckdb` 命令名时，`pipeline.rs` 会解析到该二进制，并按**插件规则跳过命令名**（即传给进程的参数不含 `duckdb` 这个子命令词）。

### 3.3 管道中的调用形态

`PipelineCommand` 的 `parameters` 会拼成 CLI 参数（`--name value` 或 positional）。`duckdb` 步骤的推荐参数形态：

```text
命令名: duckdb
参数示例（positional 或固定顺序）:
  -c  "SELECT ... FROM read_csv(...) ..."   ← SQL 主体
  -csv                                      ← 输出模式为 CSV（下游 xan 命令可直接消费）
  -noheader 可选                             ← 需要无表头输出时
```

即最终进程形态：`duckdb -c "<SQL>" -csv`。

**SQL 内如何拿到上游数据**是关键设计点，见 §4。

## 4. 关键技术问题与决策

### 4.1 上游数据的进入方式（P0 风险项）

项目管道在多命令场景下通过 **stdin/stdout** 串联各步骤（`pipeline.rs` 用 pipe 线程搬运上游 stdout 到下游 stdin）。DuckDB 官方文档给出的 stdin 管道用法是：

```bash
cat flights.csv | duckdb -c "SELECT * FROM read_csv('/dev/stdin')"
```

但官方明确以 **Unix 环境**为前提描述该能力（"When in a Unix environment..."），Windows 下 `/dev/stdin` 能否在管道中工作**未经证实**，这是本项目（Windows 优先）最大的可行性风险。

因此设计两个模式，PoC 后择一或并用：

| 模式 | SQL 数据源 | 优点 | 风险/代价 |
|------|-----------|------|-----------|
| **A. stdin 管道** | `read_csv('/dev/stdin')` | 完全融入现有管道数据流，分支/血缘语义不变 | Windows 兼容性未知（V1 验证）；DuckDB CSV sniffer 需要可 seek 的采样，stdin 场景部分版本有已知边界 |
| **B. 文件路径直读** | `read_csv('D:/data/input.csv')` | 跨平台稳定；DuckDB 并行读盘比走管道更快；可利用 glob（`*.csv`）一次读多文件 | SQL 中需引用输入文件路径；当前无 `{{input_file}}` 变量替换机制（F3 变量系统可作为将来的落点），PoC 阶段由用户手写完整路径 |

**决策**：PoC 优先验证模式 A；若 Windows 不可行，则以模式 B 作为 v1 推荐用法，模式 A 标注为 Unix-only 说明。

> 注意：即使模式 A，`duckdb` 步骤也不应在**首命令**位直接读管道尾——现有实现里首命令的 stdin 由 Rust 喂入输入文件字节流，语义上等价于 `cat input.csv | duckdb ...`，行为一致；`cat` 特判、`-d` 分隔符注入、`--no-headers` 注入等首命令逻辑对 `duckdb` 步骤均不适用（这些是 xan 专属语义），文档中需说明 DuckDB 的分隔符/表头应在 `read_csv()` 参数内自行声明。

### 4.2 探活与版本展示

`check_plugins` 对每个插件执行 `<exe> --version` 并取 stdout 首行。DuckDB CLI 的版本参数为 `-version`（单横线，SQLite shell 风格），`--version` 的兼容性需实测（V2 验证项）。若不兼容，插件页会显示空版本但不影响执行——可接受，将来正式接入时在 `check_plugins` 内做 per-plugin 版本参数映射（属于后续代码工作，不在本次范围）。

### 4.3 输出编码与下游兼容

- DuckDB CSV 输出为 UTF-8。下游 xan 命令链路（stdin/stdout 管道）在 Windows 上以字节传递，UTF-8 CSV 与现有 xan→xan 管道行为一致。
- 输入侧：DuckDB CSV reader 原生支持 UTF-8 / UTF-16 / Latin-1；**GBK/GB18030 需先经本项目已有的"编码转换"对话框转 UTF-8**，正好复用现有能力，文档中作为前置步骤说明。

### 4.4 取消与进程管理

`pipeline.rs` 的 `wait_with_cancel` 通过 kill 子进程支持取消；`duckdb.exe` 作为普通子进程同样被覆盖，无额外设计。大文件场景下 DuckDB 可能产生临时溢写文件（默认在临时目录），kill 后由系统临时目录清理机制兜底，风险低。

### 4.5 与 pinyin 插件的差异对照

| 维度 | pinyin | duckdb（本设计） |
|------|--------|------------------|
| 打包 | 编译期嵌入、首启解压 | **不打包**，用户自行放置 |
| 注册 | 代码内 seed 到 plugins.db | 手动 SQL（PoC）/ 将来 UI |
| 参数语义 | stdin→stdout 行级转换 | `-c <SQL> -csv`，数据源见 §4.1 |
| UI 呈现 | 命令面板有专属定义与表单 | 本次无 UI 定义，仅插件管理页可见 |

## 5. 安全与合规

- SQL 注入面：`duckdb` 步骤的 SQL 由用户（或将来由 AI 生成）自行编写，属于本地数据处理，与现有 `run`/`eval` 脚本命令同级风险；DuckDB 的 `ATTACH`/`httpfs` 扩展可访问网络与本地任意路径，正式接入 UI 时应在帮助文档中提示，并考虑默认禁用 `httpfs` 自动加载（后续阶段议题）。
- 许可：DuckDB 为 MIT 许可，允许随应用分发与单独放置，无合规障碍（不打包则更无问题）。

## 6. 本次交付边界（非目标）

- ❌ 不修改任何 Rust/前端源码
- ❌ 不在 `src/data/commands.ts` 中定义 `duckdb` 命令、不新增表单（`PluginForms.tsx` 不动）
- ❌ 不修改 `INDEX.md`、命令帮助文档、AI 检索索引（待 PoC 通过后的后续阶段处理）
- ❌ 不打包 DuckDB 二进制进 `src-tauri/resources/plugins/`
- ✅ 仅交付本设计文档

## 7. PoC 验证清单（人工执行，全部通过后再讨论是否进入下一阶段）

| # | 验证项 | 命令/操作 | 通过标准 |
|---|--------|-----------|----------|
| V1 | Windows stdin 管道 | `type flights.csv \| duckdb -c "SELECT count(*) FROM read_csv('/dev/stdin')" -csv` | 返回正确行数；若报错则记录错误信息，模式 A 判定为不可用 |
| V2 | `--version` 探活 | `duckdb --version` | 有 stdout 输出（记录实际输出格式） |
| V3 | 插件目录解析 | 将 duckdb.exe 放入 `<resources>/plugins/`，重启应用，查看设置→插件页 | `duckdb` 出现且 found=true |
| V4 | 注册与执行 | 手动 INSERT plugins.db 后，构建 `cat → duckdb → sort`（或单步 duckdb + 模式 B 直读文件）管道执行 | 执行成功、输出 CSV 正确、取消按钮生效 |
| V5 | 大文件冒烟 | 1GB 级 CSV 做 groupby 聚合 | 完成且内存可控（观察任务管理器） |
| V6 | 错误归因 | SQL 故意写错 | stderr 正确显示在日志/节点错误上 |

## 8. 后续阶段（仅在 PoV 通过且用户确认后才启动）

- **P1 文档化**：`docs/plugins/duckdb.md` 使用文档 + 帮助内容（中英双语，遵循 i18n 规范）。
- **P2 正式接入**：`commands.ts` 增加 `duckdb` 命令定义（`plugin: true`）、`PluginForms.tsx` 增加 SQL 编辑表单（复用表达式编辑器做 SQL 高亮为可选增强）、`check_plugins` 版本参数映射。
- **P3 管道脚本导出**：`.sh` / `.ps1` 导出中对 `duckdb` 步骤做等价转译（现为 xan 专属转译逻辑）。
- **P4 可选分发策略**：安装器可选组件或首次使用引导下载（永远不默认打包进主安装包）。

## 9. 参考

- DuckDB CLI 官方文档（单文件可执行、`-csv` 输出、stdin/stdout 管道说明）: https://duckdb.org/docs/current/clients/cli/overview.html
- DuckDB CSV 导入文档（`read_csv` 参数、`/dev/stdin` 示例、编码支持）: https://duckdb.org/docs/current/data/csv/overview
- 本项目插件机制源码：`src-tauri/src/plugins.rs`；管道执行源码：`src-tauri/src/pipeline.rs`
