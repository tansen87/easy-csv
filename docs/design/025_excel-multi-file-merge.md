# Excel 多文件合并(Merge Excel Workbooks)— 设计文档

> 状态: **已实现(2026-09-29)**;设计前的上游能力实测、内存与并行度实测保留在下文作为决策依据
> 日期: 2026-09-29
> 关联: `docs/design/016_separate-good-bad-rows.md`(文件级切分的同族先例)、`docs/design/017_separate-dialog-ux.md`(探测 + 「上次结果」模式)、`docs/design/020_encoding-conversion-history.md`(选项一并回填的先例)、`docs/design/021_split-lines-by-line-count.md`(**本设计的模板**:对话框骨架 / 历史记录 / 影响面表格)、`docs/design/023_plugin-repository-and-in-app-install.md`(`plugin://progress` 进度事件先例)、`docs/design/024_parquet-duckdb-file-reading.md`(「格式适配交给 DuckDB CLI、不引入新 crate」的决策先例)、`docs/AI/INDEX.md`
> 前置: `xan` 必须可用(本设计全程依赖 `xan from` / `cat rows` / `to xlsx`,见 §2 与 §4)
>
> **本次实测的核心数字**:合并阶段(`cat rows`)131 MB 输入 → 峰值 **8.5 MB**(流式,与输入总量无关);读取阶段(`from`)一 张 80 万行 sheet(解压 179 MB)→ 峰值 **308 MB**,但**按 sheet 计费**,峰值 = max(单个 sheet) 而非总和(§2.5)。两个阶段的 **cpu/wall 均为 0.95~0.98×,即单线程**(§2.6)。
>
> ### 实施记录(2026-09-29,与设计的偏差与补充)
>
> - `tabular.rs::run_capture` 增加了 **`label` 参数**(调用点传 `"duckdb"`),避免 xan 失败时报 `Failed to run duckdb`;
> - `ExcelMergeResult` 增加了 **`warnings` 字段**(合并期不可读的工作簿单独报告,不与 `skipped` 混语义);
> - 部件转换用 **`xan from -o <临时文件>` 直接落盘**(而非捕获 stdout 再写),避免大 sheet 的 CSV 在内存里翻倍;
> - 来源列注入按 csv crate **流式改写**(raw → part),内存常量;`common_ancestor` 为新增纯函数
>   (设计稿的 `source_label` 签名未含 base,实现需要);
> - **取 sheet 三选一下拉**(`Select`),无「按序号」;「指定名称」**不支持手输**(`Select` 只能从选项中选),
>   由「自动触发扫描」替代;留空报错(两项均已确认);
> - `src/components/ui/Select.tsx` 增**可选 prop `ariaLabel`**(向后兼容,修复下拉无可访问名的问题);
> - 测试夹具:`zip` 加入 **dev-dependencies**(`default-features = false`,Stored 条目,与锁内已有版本一致,
>   **不新增任何编译单元**),测试时现场生成最小 xlsx;xan 门控测试把二进制**复制进测试资源插件目录**,
>   走生产解析器同一条路;
> - `MergeExcelDialog.tsx` 约 900 行,触发既有 `max-lines` **警告**(规则为 warn;与 `CsvEncodingDialog` 425 行、
>   `VersionControlPanel` 742 行同类,未做拆分);
> - **对话框主体整体可滚动**(2026-09-29 用户反馈,三轮迭代后的最终实现):对话框高度**固定**
>   `h-[85vh]`(内容驱动的 max-h 让 ScrollArea 拿不到确定高度、不产生滚动——这是「没有滚动条」的根因),
>   主体放进 radix `ScrollArea type="always"`(滚动条常显);预览文件列表另有内层 `ScrollArea`
>   (`max-h-48`,全量文件可滚,不再截断前 5 个);中间过渡用的原生 `overflow-y-auto` 已回退。

---

## 0. 方案速览(先读这一节)

**要解决什么**:把 N 个工作簿(可跨多个文件夹、可递归)里的 sheet,合并成**一张表**。取 sheet 的方式是**三选一**:第 1 个 sheet(默认)/ 所有 sheet / 指定名称(§3.7)。

**为什么现在做不到**:管道是**单输入**契约,无法表达 N 个不相关文件;而 `xan cat rows` **只吃 CSV** —— 喂 xlsx 会把 zip 字节当 CSV 读(§2.2)。

**形态**:新增 File 菜单 →**文件级对话框**(与「拆分好/坏行」「按行拆分」同族),**不是**管道节点。

**后端**:新增 `src-tauri/src/excel_merge.rs` + 两个命令 —— `scan_excel_sources`(先扫描:文件清单 / sheet 名 / 提前暴露问题)与 `merge_excel_sources`(执行合并;请求带 `exclude`,可排除预览里移除的工作簿)。**不提供列名预览**(2026-09-29 用户决定:超大文件的表头预览需整表物化,太慢,已移除)。

**执行链路**(每步都已用真实文件验证):

| 步骤 | 命令 | 说明 |
|------|------|------|
| 1 扫描 | `xan from --list-sheets` | 廉价,不读 sheet 数据(44 MB / 0.09 s) |
| 2 逐 sheet 转临时 CSV | `xan from --sheet-name <s>` | 顺带记录表头;需要来源列时**自己前置首列** |
| 3 写前预检 | `plan_alignment` | 默认并集;并算出 `union_summary` |
| 4 拼接 | `xan cat rows -U --paths <list>` | 流式;清单必须写**绝对路径** |
| 5 输出 | `rename` / **复用 `xan to`** | 原子落盘:目标路径只出现完整文件。`.xlsx` 复用 `xan to xlsx`;**CSV 不需要 `to`** —— CSV 是 xan 的原生格式(`to` 的职责是「从 CSV 转**出**去」,所以没有 `csv` 目标;实测 `xan to csv` 报 `could not export the file to this format!`),CSV 输出就是 `cat rows -o out.csv` + 可选 `xan fmt` |

**已定的核心决策**(每条都有实测依据):

| 决策 | 依据 |
|------|------|
| 列对齐**默认 `--union`** | 列不一致是 Excel 常态;默认严格会让用户一上手就撞报错。代价是「静默加宽」→ **必须**配套 `union_summary` 让加宽可见(§3.5) |
| **保持单线程**,不做并发 | 峰值内存可预测(§2.6);墙钟长用进度反馈解,而不是堆并发 |
| 读取复用 **xan/calamine**,不引第三方读取库 | `xl` 已实测否决:会把数值静默变成日期(§3.4) |
| 拼接**交给 `cat rows`** 而非自研 | 它是流式的,且并集/交集需先看遍所有表头(§3.4) |
| **零新依赖**,不改 capability | 全部来自既有 xan + 标准库(§5) |

**关键边界**:输出恒为**单 sheet**(表名固定 `Sheet1`);峰值内存 ≈ 最大**单个** sheet 的 1.5~2 倍,**与合并多少个文件无关**;`.xlsx` 已实测,`xls`/`xlsb`/`ods` 按 xan 声明支持(§7)。

**状态**:**设计稿,未实现**。P0 无开放问题(§8)。

---

## 1. 背景与目标

### 1.1 现状:为什么今天做不到

easy-csv 目前对 xlsx 只有**逐文件、单输入单输出**的两条路径:

| 已有路径 | 形态 | 覆盖的场景 |
|----------|------|-----------|
| 管道节点 `from` / `to` | 当前标签页的**一个**输入文件 + 一串步骤 | 单个 Excel ↔ CSV 转换(`from` 支持 `--sheet-name` / `--sheet-index` / `--list-sheets`) |
| Batch Convert(`useBatchConvert.ts`) | 前端扫目录 + 逐文件跑 `execute_xan_pipeline` | N 个文件 → **N 个**输出,一进一出 |

两者都**无法**把 N 个文件的多个 sheet 汇成**一张表**。管道的 `cat` 节点虽然带 `--glob` / `--paths` / `--source-column` / `-U` / `-I`,理论上能「扫目录 + 按行拼接」,但它**只吃 CSV**:

```
$ xan cat rows in/a/report_2024_01.xlsx in/a/report_2024_02.xlsx
PK...（zip 二进制被当成 CSV 字节直接吐到 stdout）
xan cat: CSV error: record 4 (byte: 495): found record with 2 fields,
         but the previous record has 1 fields
```

即:**xlsx 不是 `cat` 的合法输入**,管道里也就没有任何节点能表达「多个工作簿的 sheet 合成一张表」。这正是本次要补的洞。

### 1.2 目标

| # | 诉求(来自需求) | 落地位置 |
|---|----------------|----------|
| 1 | 按**特定 sheet 名**合并多个 Excel 为 1 个 sheet | §3.2 `sheet_mode = "name"` + §3.5 |
| 2 | 把**所有 Excel 的所有 sheet** 合并到 1 个 sheet | §3.2 `sheet_mode = "all"` + §3.5 |
| 3 | 合并**多个文件夹内**的 Excel(可递归、可混选文件与目录) | §3.2 `scan_excel_sources` + §3.2 `collect_workbooks` |
| 4 | 列不完全一致时仍可合并(默认**并集**,见 §3.5),且**不静默串列、加宽可见** | §3.5 三种对齐策略 + `union_summary` + §3.6 写前预检 |
| 5 | 合并结果可追溯来源(哪个文件/哪个 sheet) | §3.5 「来源列」 |
| 6 | 与同族文件级功能一致:结果可视、「打开路径」、上次记录 | §3.7 / §3.8 |

### 1.3 非目标

- **不写多 sheet 的 xlsx 输出**(如「每个源文件一个 sheet」)。`xan to xlsx` 没有 sheet 名参数、也没有多 sheet 能力(§2 实测),实现它需要引入 OOXML 写入库或手改 zip 内部结构 —— 与 024「不为了一个格式引入重依赖」的决策相冲突。本期输出恒为**单 sheet**。
- **不实现 `cat cols`(按列拼接)**。按列拼接要求各文件行数对齐,语义与「合并表格」的需求不同,且 `-p/--pad` 的填充行为容易产生用户没预期的空单元格。管道里的 `cat` 节点已覆盖该用法。
- **不取代 Batch Convert**:后者是 N→N,本设计是 N→1,两者并存。
- **不做 sheet 内的数据变换**(筛选/排序/去重)。合并只做「取 sheet → 对齐列 → 顺序追加」;要变换请在结果出来后走正常管道。
- **不解析隐藏 sheet 的可见性**、不处理公式重算(见 §7)。
- **不做并发**:转换阶段保持串行(§2.6 的决定),优先保证「峰值内存 = max(单个 sheet)」这一可预测性;墙钟长用进度反馈缓解,而不是靠堆并发。
- **不自动纠正列名**:并集不会把 `amount` / `Amount` 猜成同一列(只在结果区提示),因为猜错是毁数据、而提示只是让用户多看一眼。

---

## 2. 上游能力实测(xan 0.60.0)

实现前把关键行为全部实测过一遍(Windows / Git Bash;夹具为离线生成的多 sheet xlsx:两个工作簿各含 `Q1`/`Q2`,另一个嵌套目录下的工作簿含 `Q1`(列序故意不同:`name,id,amount`)与 `Notes`)。

### 2.1 能力矩阵

| 能力 | 命令 | 结论 |
|------|------|------|
| 枚举 sheet | `xan from --list-sheets <f.xlsx>` | ✅ 每行一个 sheet 名,顺序即工作簿内顺序 |
| 按名取 sheet | `xan from --sheet-name Q1 <f.xlsx>` | ✅ 输出 CSV 到 stdout |
| 按序号取 sheet | `xan from --sheet-index <i>` | ✅ **默认 0**(即不指定时取第一个 sheet) |
| 取全部 sheet | —— | ❌ 无此开关,必须**逐 sheet 各起一次进程** |
| 表头并集对齐 | `xan cat rows -U` | ✅ 按**列名**重排,`name,id,amount` 被正确对齐为 `id,name,amount` |
| 表头交集对齐 | `xan cat rows -I` | ✅ |
| 严格拼接 | `xan cat rows`(默认) | ✅ 表头不一致时**拒绝**并报错(不串列) |
| 来源列 | `xan cat rows --source-column S` | ⚠️ 仅在**默认拼接模式**下生效 |
| 写 xlsx | `xan to xlsx` | ✅ 但恒为**单 sheet,名为 `Sheet1`**,无改名/多 sheet 参数 |
| 清单驱动 | `xan cat rows --paths <list.txt>` | ✅ 规避 argv 长度上限;CRLF 行尾可接受 |

### 2.2 三个必须绕开的陷阱

**陷阱 1 — 严格模式会先吐数据再报错。** 表头不一致时 `cat` 并非先校验后输出:

```
$ xan cat rows work/1.csv work/2.csv work/3.csv
id,name,amount
1,alice,100
2,bob,200
4,dave,400          ← 前两个文件的行已经写进 stdout
xan cat: found inconsistent headers as soon as "work/3.csv"!
Expected: ByteRecord(["id", "name", "amount"])
Got: ByteRecord(["name", "id", "amount"])
```

若实现成「直接 `-o 输出文件`」,失败时会**留下一个半截的输出文件**。→ 因此必须**写前预检**(§3.6):先把各 part 的表头收集齐、判定通过,再执行拼接。

**陷阱 2 — `-U` / `-I` 会让 `--source-column` 静默消失。** 无报错、无列、无警告:

```
$ xan cat rows -U --source-column source work/1.csv work/2.csv work/3.csv
id,name,amount          ← 没有 source 列
```

→ 需要「来源列 + 列对齐」同时成立时,**不能**用 `--source-column`。绕法已验证可行:由我们自己给每个 part 的 CSV **前置一个同名首列**,再交给 `-U` —— 并集重排会保留它:

```
$ xan cat rows -U work/s1.csv work/s3.csv
source,id,name,amount
in/a/report_2024_01.xlsx#Q1,1,alice,100
in/b/sub/report_2024_03.xlsx#Q1,7,gina,700
```

**陷阱 3 — `--paths` 里的相对路径按子进程 cwd 解析。** 清单文件必须写**绝对路径**,否则结果随调用方的 cwd 漂移。

### 2.3 端到端链路已跑通

按 §3 的设计把整条链路(a. 递归扫目录 → b. 逐 sheet `from` 转 CSV 并前置来源列 → c. 写绝对路径清单 → d. `cat rows -U --paths` → e. `to xlsx`)对着夹具跑了一遍真实实现,**输出即需求要的形态**:

```
discovered 3 workbooks (recursive walk)
  in\a\report_2024_01.xlsx      sheets=['Q1', 'Q2']
  in\a\report_2024_02.xlsx      sheets=['Q1', 'Q2']
  in\b\sub\report_2024_03.xlsx  sheets=['Q1', 'Notes']

converted 6 sheet(s) to temp csv
cat rows -U --paths -> rc=0
---- merged (union, all sheets) ----
source,id,name,amount,memo
in/a/report_2024_01.xlsx#Q1,1,alice,100,
in/a/report_2024_01.xlsx#Q1,2,bob,200,
in/a/report_2024_01.xlsx#Q2,3,carol,300,
in/a/report_2024_02.xlsx#Q1,4,dave,400,
in/a/report_2024_02.xlsx#Q2,5,erin,500,
in/a/report_2024_02.xlsx#Q2,6,frank,600,
in/b/sub/report_2024_03.xlsx#Q1,7,gina,700,
in/b/sub/report_2024_03.xlsx#Notes,,,,hello

to xlsx -> rc=0 size=5618
sheet name of output: ['Sheet1']

strict cat rows -> rc=1
  stderr: xan cat: found inconsistent headers as soon as "sim/part_0004.csv"!
```

注意最后一行:**同一组输入在严格模式下会正确地失败**(`Notes` 的列与 `Q1` 不同)—— 对齐策略确实起了作用,而不是默默产出一张错表。

### 2.4 一条关键工程约束:CI 里没有 xan

`src-tauri/.gitignore` 有 `*.exe`,仓库里 `src-tauri/resources/plugins/` **只有 `readme.md`**;`xan.rs` 顶部注释也写明「xan is NOT packaged with the application」,运行期才从 `<数据目录>/plugins/<平台>/` 或 `PATH` 查找。`.github/workflows/build.yml` 跑 `cargo test` 时**不准备任何 xan 二进制**。

→ 因此:**任何直接 shell out 到 xan 的测试在 CI 上必须能优雅跳过**(§6),实现要刻意分成「纯逻辑核心(可在 CI 全量跑)」与「xan 调用薄壳(本地跑 + 跳过门控)」两层。这也是本设计最容易被忽视、但一定会踩的点。

### 2.5 内存实测:合并阶段是常量,读取阶段按 sheet

「合并 N 个 sheet 会不会把内存吃爆」是本设计最需要拿数字回答的问题,因此实测了每个环节的**进程峰值工作集**(用 `psapi!GetProcessMemoryInfo` 轮询子进程,Win11):

| 操作 | 输入 | 峰值 RSS | 观察 |
|------|------|---------|------|
| `xan count` 单个 CSV | 64 MB | 8.6 MB | 基线,流式 |
| `xan cat rows` 两个 CSV | 131 MB | **8.5 MB** | **与输入总量无关** |
| `xan cat rows -U` 两个 CSV | 131 MB | **8.5 MB** | 并集也没变 |
| `xan from --list-sheets` | 17.9 MB xlsx | 44.3 MB | 不读 sheet 数据,0.09s |
| `xan from` 读**空** sheet | 同一 xlsx | 44.5 MB | 与上一条同档 |
| `xan from` 读 80 万行 sheet | 17.9 MB→解压 **179 MB** | **308 MB** | 整表物化,1.35s |

两条结论:

1. **合并阶段(`cat rows`)是完全流式的**:131 MB 输入只占 8.5 MB,且普通/并集/交集同档。→
   **「xan 合并需要把所有 sheet 读进内存」是不成立的**;合并阶段的峰值与输入总量无关(实测输出 200 万行、5 列并集表头均正确)。
2. **读取阶段(`from`)确实整表物化**,峰值约等于**该 sheet 解压体积的 1.7 倍**(calamine 的 `Range<Data>` + 逐 cell 结构与字符串分配)。但关键是**它按 sheet,不按工作簿、更不按整个合并**:
   同一个工作簿里,读空 sheet 44.5 MB、读 80 万行的 sheet 308 MB —— 文件、sheet 数都一样,差别全在**那一个 sheet 的数据量**。因为每个 `xan from` 是独立进程、转完即退出,**N 个 sheet 串行的峰值 = max(单个 sheet),而不是 Σ(所有 sheet)**。

→ 所以 §7 那条限制的准确表述是:**峰值 ≈ 最大单个 sheet 的 1.5~2 倍**,与「合并多少个文件」无关。这是本设计不必为内存做额外架构的原因(也是下文评估 `xl` 混合方案的前提)。

### 2.6 并行度实测:两个阶段都是单线程(并已决定不自建并发)

顺手测了 CPU 时间与墙钟时间的比值(同一脚本,`GetProcessTimes`;比值 ≈1.0 = 单线程,>1.5 = 多线程):

| 操作 | 输入 | wall | cpu | **cpu/wall** |
|------|------|------|-----|-------------|
| `xan from --sheet-name Big` | 17.9 MB xlsx(解压 179 MB) | 1.38 s | 1.34 s | **0.98×** |
| `xan cat rows -U` 四个 CSV | 262 MB | 0.43 s | 0.41 s | **0.95×** |

两条都是 **0.95~0.98×,即单线程**(多核机器上完全没吃满)。结构上也印证:`cat -h` **没有任何 `--parallel` / `--threads` 参数**(那两个只存在于 `join` / `sort` / `aggregate` 等命令;`cat` 只提供 `--preprocess` / `--run` / `--shell-preprocess` 这类委托给 `xan parallel` 的**预处理**钩子,与我们的拼接无关)。

**这直接决定了墙钟时间的形状**:既然单线程,而我们的方案是**逐 sheet 起独立进程**,那么串行执行的墙钟 ≈ Σ(每个 sheet 的转换时间) —— 30 张大 sheet 就是约 40 s。**这里存在本设计唯一可控的性能杠杆:转换阶段的有界并发**(各 part 互不依赖,所以技术上安全)。

#### 决定:不启用并发,保持单线程(2026-09-29)

这个杠杆**明确不用**。理由是它换来的收益不足以抵消四处代价:

1. **峰值内存可预测是本设计最重要的性质**(§2.5:峰值 = max(单个 sheet),与合并多少个文件无关),并发会把它变成 K 倍。
2. **我们无法在转换前预知 sheet 体积**,因此给不出安全的上限 —— `K = min(4, cores)` 是拍出来的数,碰上几个大 sheet 就可能把 1.2 GB 而不是 308 MB 压到用户机器上。对一个「处理用户自己文件」的桌面工具,这个不确定性不值得。
3. **串行让周围一切都简单**:取消是「下一个 part 前检查标志」、失败是「立即停止 + `TempFiles` 清理」、错误定位天然有序;并发就要处理「已启动的 K 个进程怎么收」。P0/P1 的复杂度预算应花在正确性上。
4. 墙钟长的**真实痛点是「没有反馈」而不是「不够快」** —— 用 §8 P1① 的进度事件 + 取消来解,比堆并发更对症,且不引入内存不确定性。

> 注意这**不是**说 xan 不能利用多核(它部分子命令有 `--parallel`,如 `join`/`sort`/`aggregate`),而是本设计的两个阶段本就没有并行空间:`from` 单线程、`cat rows` 既是单线程又必须等全部 part 就绪。真要提速应优先考虑「减少要处理的 sheet」(如取 sheet 时用「指定名称」而不是「全部」)。

> 顺带说明:项目里既有的 `thread::spawn`(如 `pipeline.rs:480`)是用来**抽干子进程 stdout/stderr 管道**的 I/O 线程,`spawn_blocking` 是为了不阻塞 tokio 运行时 —— 两者都不是并行计算,与本节的并发无关。

---

## 3. 方案

### 3.1 形态选择:为什么是文件级对话框,而不是管道节点

| 方案 | 判定 | 理由 |
|------|------|------|
| 管道节点(新 xan 命令形态) | ❌ | 管道的契约是「**一个**输入文件 + 一串步骤」(`execute_xan_pipeline` 的 `inputFile` 是单数)。N 个**互不相关**的工作簿无法作为「当前输入」表达;而每个 sheet 一次子进程调用也塞不进 `PipelineStep` 的参数模型 |
| 扩展 `cat` 节点让它吃 xlsx | ❌ | `cat` 是 xan 侧的命令,行为由上游决定;我们只能在自己的后端做「格式适配」 |
| **文件级对话框(本方案)** | ✅ | 与 016/017/020/021 完全同族:N→1 的批处理、多文件/目录选择、结果可视、上次记录。管道的单输入契约不受影响 |

结论:新增 **File 菜单 → 文件级操作区** 的对话框,后端新增一个模块,前端复用「上次记录」三件套。

### 3.2 后端模块与两个命令

新增 `src-tauri/src/excel_merge.rs`(不塞进已经很大的 `csv.rs`,也不塞进 `tabular.rs` —— 后者的职责是「把**一个**非 CSV 源接进管道」,本模块是「**N 个**工作簿 → 1 张表」的文件级批处理,职责不同)。

```rust
/// 只扫描、不写文件;供对话框「列出文件 / 提供 sheet 名候选 / 提前暴露问题」。
#[tauri::command]
pub async fn scan_excel_sources(
  roots: Vec<String>,        // 用户选的文件与/或目录,可混选
  recursive: bool,
  extensions: Vec<String>,   // 如 ["xlsx","xls"],空 = 默认 ["xlsx"]
) -> Result<ExcelScanResult, String>;

#[tauri::command]
pub async fn merge_excel_sources(
  request: ExcelMergeRequest,
) -> Result<ExcelMergeResult, String>;

```

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ExcelSourceFile {
  pub path: String,
  pub sheets: Vec<String>,   // 工作簿内顺序(来自 --list-sheets)
  pub ok: bool,
  pub error: Option<String>, // 单文件读不了时只标记,不中断整体扫描
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExcelScanResult {
  pub files: Vec<ExcelSourceFile>,
  pub file_count: usize,
  pub sheet_names: Vec<String>, // 所有文件 sheet 名的并集(去重,保序)→ 对话框的候选下拉
  pub warnings: Vec<String>,    // 不可读的子目录 / 无 sheet 的文件等
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExcelMergeRequest {
  pub roots: Vec<String>,
  pub recursive: bool,
  pub extensions: Vec<String>,
  pub sheet_mode: String,          // "first"(默认) | "name" | "all" —— 三选一,没有"按序号"
  pub sheet_name: Option<String>,  // sheet_mode = "name" 时必填
  pub missing_sheet: String,       // "error"(默认) | "skip"
  pub align: String,               // "union"(默认) | "strict" | "intersection"
  pub source_column: String,       // "none" | "file" | "file_sheet"
  pub source_column_name: Option<String>, // 默认 "source"
  pub output_path: String,
  pub output_format: String,       // "csv" | "xlsx"
  pub out_delimiter: Option<String>, // CSV 输出用;None = 用应用默认分隔符
  /// 预览中用 × 移除的工作簿(display 路径;大小写不敏感匹配)
  #[serde(default)]
  pub exclude: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExcelMergeResult {
  pub output_path: String,
  pub output_format: String,
  pub source_file_count: usize,
  pub sheet_count: usize,          // 实际参与合并的 sheet 数
  pub total_rows: usize,           // 数据行数(不含表头)
  pub header: Vec<String>,         // 合并后的最终表头(供结果区展示)
  pub skipped: Vec<String>,        // 被跳过的 "文件#sheet"(空 sheet / missing_sheet=skip)
  pub union_summary: Option<UnionSummary>, // 仅 align = union:让「加宽」可见(§3.5)
  pub elapsed_ms: u64,             // 只统计合并本身,不含 IPC/渲染
}
```

参数命名沿用 Tauri v2 约定(Rust `snake_case` ⇄ 前端 `camelCase`),命令包在 `tokio::task::spawn_blocking` 里(同 `separate_csv` / `split_lines`)。`lib.rs` 注册两个命令。

**先扫描、再合并**是刻意的两段式,带来三个具体好处:

1. 对话框能在动手**之前**告诉用户「选到 12 个工作簿、共 30 个 sheet、其中 3 个没有 `Q1`」;
2. sheet 名候选项来自**真实数据**,用户不必手打(打错时的报错见 §2.2);
3. 严格模式可在合并前就报出「哪些文件的表头不一致」。

> 若把扫描并进合并命令,上面三件事都得等到写完输出才知道 —— 就是 §2.2 陷阱 1 的翻版。

### 3.3 纯逻辑核心(可在 CI 全量单测)

刻意把不依赖 xan 的部分抽成纯函数,让 CI(无 xan)也能覆盖大部分逻辑 —— 与 021 把 `split_lines_stream` 写成泛型以便用内存 sink 测试是同一手法:

```rust
/// 递归收集工作簿:去重(canonical path)、跳过符号链接目录(防环)、
/// 忽略不可读子目录但记 warning、路径排序保证结果确定。
fn collect_workbooks(roots: &[String], recursive: bool, extensions: &[String])
  -> (Vec<PathBuf>, Vec<String> /*warnings*/);

/// 把 (文件, 可用 sheet 列表) + 请求 解析成「待转换的 part 清单」。
/// 负责三种取 sheet 策略(first / name / all)与 missing_sheet 策略。
/// 注意:三种策略**互斥**,由前端单选保证;后端只接受其中一个值,不处理组合。
fn resolve_parts(files: &[ExcelSourceFile], req: &ExcelMergeRequest)
  -> Result<(Vec<(PathBuf, String /*sheet*/)>, Vec<String> /*skipped*/), String>;

/// 对齐策略的**写前预检**:给定各 part 的表头,判定能否合并 + 计算最终表头。
/// strict 返回 Err(列出前几个冲突的文件与差异列);union/intersection 返回最终表头。
fn plan_alignment(headers: &[Vec<String>], align: Align) -> Result<Vec<String>, String>;

/// 来源列的取值格式:"file" → 相对路径;"file_sheet" → "相对路径#sheet 名"。
fn source_label(path: &Path, sheet: &str, mode: SourceColumnMode) -> String;

/// 写出 --paths 清单:每行一个**绝对**路径,UTF-8,忽略/裁剪 CRLF。
fn write_paths_list(dest: &Path, parts: &[PathBuf]) -> Result<(), String>;

/// 输出路径解析(默认 = 第一个输入所在目录 / {stem}_merged{ext})与重名处理。
fn resolve_output_path(output_path: &str, first_input: &Path, format: &str) -> PathBuf;

/// 并集的实际落点(§3.5):最终列序、哪些列并非每个 part 都有、哪些列名仅大小写/空白不同。
/// 默认并集下这是「让加宽可见」的唯一手段,因此它是纯函数、必须在 CI 可测。
fn union_summary(headers: &[Vec<String>]) -> UnionSummary;

/// 仅按「大小写折叠 + 首尾空白裁剪」比较两个列名是否疑似同一列(供 union_summary 使用)。
fn is_near_duplicate_column(a: &str, b: &str) -> bool;
```

### 3.4 xan 调用层

复用既有约定,不新造轮子:

- 可执行文件查找走 `xan::find_xan_executable()`(内部已做「数据目录 `plugins/<平台>/` 优先 → `PATH` 兜底」);找不到时报专有文案,前端引导去插件页签安装(设计 023)。
- 进程调用复用 `tabular.rs` 的 `run_capture`(**目前是私有函数**):把它的可见性提为 `pub(crate)` 直接复用,而不是复制一份。错误包装同样复用 `duckdb_error` 的思路 —— 新增 `xan_error(stderr)` 把 stderr 归一成单行可读文案。
- 临时目录 `TempFiles` RAII 守卫**目前也是私有的**(`pipeline.rs:857`):同样提为 `pub(crate)` 复用,保证**取消/报错/提前返回**都删干净中间 CSV(与 024 的做法一致)。

#### 决策:为什么中间的「拼接」也交给 xan,而不是用已在依赖里的 `csv` crate 自己做

先划清哪些环节**没有选择**:读 xlsx(枚举 sheet、取某个 sheet)与写 xlsx 目前只能由 xan 完成 —— 在**不新增依赖**的前提下,应用里没有第二个能读/写 Excel 的东西(这也是 024 的既有结论)。「读」这一侧在原理上可以用 Rust crate 替换,因此单独评估过,结论见下一小节。所以真正可讨论的只有中间一步:「算最终列顺序 → 按映射重排 → 追加写出」。

| | 方案 A(本设计) | 方案 B(自己实现) |
|---|---|---|
| 拼接与列对齐 | `xan cat rows [-U|-I] --paths` | Rust + 既有 `csv = "^1.4"` 依赖 |
| 中间产物 | N 个临时 CSV + 1 个 paths 清单 | 无(直接读 `from` 的 stdout) |
| 进程数 | N 次 `from` + 1 次 `cat` | N 次 `from`(理想情况) |

选 A 的实质理由,**不是**「和 024 保持一致」这类口号,而是:

1. **并集/交集模式必须先看遍所有表头才能确定最终列顺序**,而 `from` 是「一次调用只读一个 sheet」的不可重入操作。方案 B 若要保持常量内存,就得对每个文件**再起一次 `from` 只读表头** → **2N 次进程**;若为了省这次进程把表头连同行数据缓冲在内存,大合并就会爆内存。A 把「统计所有表头 → 定序 → 重排 → 追加」压进 `cat` 的**一次进程内流式完成**,内存是常量级。
2. **CSV 的边角不重写**:列对齐是按 header 名做的,自己实现要处理重复列名、空表头、大小写、BOM、内嵌换行等歧义。这类「看着简单、边角很多」的逻辑正是本项目吃过亏的地方(整表错位是**静默**的,不会报错)。
3. 与 024 的取向一致:能用既有二进制做的格式适配就不自研,避免出现「两套 CSV 语义」。

选 A 的代价(诚实列出):

1. 必须落 N 个临时 CSV + 1 个清单 → `TempFiles` RAII 从「锦上添花」变成**必需品**;
2. 正是 `--source-column` 在 `-U` 下失效,才逼出「自己前置首列」的绕法(§2.2 陷阱 2)—— 即这一步其实已经**半自研**了;
3. 失败原子性要靠「写前预检 + 临时输出 rename」兜底(§3.6);
4. 每个 part 多一次磁盘往返(写临时 + 再读)。

**将来该改选 B 的触发条件**(便于重新评估,不必推翻整体设计):若要让「**xan 未安装时仍能合并 CSV**」成立 —— 输入本来就是 CSV 时拼接完全不需要 xan,此时 B 是唯一路径。这与 §8 的 P1「允许 CSV/TSV 作为输入」直接相关:**若 P1 只做「允许 CSV 输入」而不改拼接归属,该能力仍依赖 xan**;只有同时改走 B,才真正得到「无 xan 也能合并 CSV」。另一个触发条件是实测发现临时文件往返成为瓶颈(上千个 sheet 量级)。

#### 已评估并否决:`xl`(xlcat)的流式读取(含「只读表头」变体)— 附实测证据

候选:[`xl`](https://github.com/xlprotips/xl)(MIT,crates.io 最新 **0.1.7**,约 1.4k SLoC)。它用 `quick-xml` 对 zip 里的 `sheetN.xml` 做 **pull 解析**,定位是「像 cat 一样流式看超大 xlsx」,核心卖点是**不必把整个 sheet 读进内存**。这正好触及 §7 记的那条限制,因此值得认真评一次,而不是凭印象否掉。

**先说成立的部分**(实测,Windows,夹具见附录):

- 确实是**真流式**:`RowIter` 直接驱动 `quick_xml::Reader` 逐个事件推进,`for row in ws.rows(&mut wb).take(n)` 读到第 n 行就停,不会读完整个 sheet。
- 枚举 sheet 可用:`wb.sheets().by_name()` → `Vec<&str>`(实测 `["Q1","Q2"]` 正确、保持工作簿内顺序);`sheet.rows()` 也支持 inlineStr。
- 因而「只读前 n 行而不全量读取」这个判断**是对的**。

**但实测出三个会毁掉合并结果的缺陷**,与 xan(calamine)逐项对照(同一夹具、同一 sheet):

| 夹具 | `xl` 输出 | `xan from`(calamine) | 性质 |
|------|-----------|----------------------|------|
| 数值 7,格式码 `0" m"` | `1900-01-07` ❌ | `7` ✅ | **静默篡改** |
| 数值 90,格式码 `#,##0" days"` | `1900-03-30` ❌ | `90` ✅ | **静默篡改** |
| 数值 42,格式码 `General`(对照) | `42` ✅ | `42` ✅ | 一致 |
| 数值 60,格式码 `0" m"` | **panic**(exit 101) ❌ | `60` ✅ | **进程崩溃** |
| 无 `<dimension>`,首行 1 列、次行 3 列 | `1` 换行 `1,2,3` ❌ | `1,,` 换行 `1,2,3` ✅ | **变长行** |

根因(读源码确认,非猜测):

1. `ws.rs::is_date()` 用**字符串包含**判断日期:`style.contains('d')` / `contains('m')` / `contains('y')`(外加一个绕开字面量 `Red` 的特例)。而 `style` 存的是**数字格式代码文本**,于是 `0" m"`、`#,##0" days"`、`#,##0.00" credit"` 这类**把字母写在引号里的字面量**全部命中,普通数字被当成序列号送进 `excel_number_to_date`。对数据工具而言「7 变成 1900-01-07」是最坏的一类失败:它**不报错**,用户会拿着错值做决策。
2. `utils.rs:70` 对 1900 系统的序列号 60(Excel 的历史闰年 bug)直接 `panic!`,而不是返回 `Err`。在 Tauri 的 `spawn_blocking` 里 panic 得到的是 JoinError 而非可读错误;且实测 **panic 发生在已经吐出行之后**(前文表格里它已输出表头),与 §2.2 陷阱 1 同类的「半截产物」风险。
3. `RowIter` 把行**补齐到「目前为止见过的最宽行」**,不是全局最宽;`<dimension>` 缺失时(部分导出器不写)就会产出变长行。合并的前提是各 part 列对齐,变长行会直接把列推错。

另有两条非正确性、但同样构成否决理由的成本:

- **依赖重复**:实测 `cargo build` 拉进来的是 `quick-xml 0.22.0`、`zip 0.5.13`、`time 0.1.45`、`bzip2-sys`、`winapi 0.3.9`;而本仓库**已经是** **quick-xml 0.41.0 + zip 4.6.1**。`^0.22` / `^0.5` 是 0.x 的 caret,不会升级到已在大版本上收敛的那两份,于是**同一 crate 两份并存**;`cargo` 还会对 `quick-xml 0.22.0` 报 future-incompat。应用是 `opt-level="z"` + `strip=true`,对这个体积开销是有所谓的。
- **成熟度**:0.1.x;README 自陈「This API will likely change in the future」;`usage()` 里还写着 `xlcat 0.1.6`(与包版本 0.1.7 不一致)。仓库近期确有提交(2026-07 还在修 sharedStrings 富文本拼接),但**发布的 crate 仍停在这些修复之前的依赖组合上**。仅支持 xlsx(不含本设计列的 `xls`/`xlsb`/`ods`),引入后会形成「xlsx 走一条路、其余格式走 xan」的**双读取器**,同一文件两种真相。

**结论:不作为合并的读取引擎。** 理由不是「多一个依赖」,而是**它会让合并结果静默出错**(实测可复现),而 xan 的现有路径在这一组夹具上是正确的。要重新采纳,前提是先让它通过上面这 5 个夹具(以及补充的 sharedStrings 索引越界、缺失 `workbook.xml` 等 panic 路径),否则「流式」换来的内存收益远小于错值代价。

##### 变体评估:「`xl` 只读前 n 行拿表头,合并仍交给 xan」

这是更克制的一种用法(把 `xl` 限制在「只读表头」),单看动机是合理的 —— 因为 §2.5 已确认 `from` 读一张 sheet 是整表物化(179 MB 解压 → 308 MB),而表头只需要第一行。但实测数据把这条路堵掉了,原因有三条,按重要性排序:

1. **它省不掉峰值。** 峰值由「读 sheet **数据**」那一步决定,而这一步是合并**必需、无法避免**的(不然拿不到行)。用 `xl` 读表头只省掉「读表头那一遍」——而在现有设计里**这一遍根本不存在**:§3.6 的表头是在**同一次转换里顺带记录**的,不额外解析(§3.4 末的澄清)。所以这是为一个已经免费的信息,额外引入一次读取。
2. **两个读取器对同一个单元格会给出不同结果 —— 而这恰好出现在「列名」上,后果比错值更重。** 实测:格式码为 `0" m"` 的数值,`xl` 读成 `1900-01-07`,calamine 读成 `7`。如果**表头单元格**恰好是日期格式化的数字(工作表里把月份/日期当列名很常见),那么我们就会**用 `xl` 的表头去决定对齐方案,而 `cat rows` 实际看到的是 calamine 转换出的另一套表头** → 对齐计划与实际数据不匹配;严重时正是 §2.2 陷阱 1 的「`found inconsistent headers`」在写前预检**之后**才炸出来。**对齐决策必须与执行合并的读取器同源**,这是硬约束。
3. **`xl` 自身要过同一套正确性夹具**,而它现在过不了(上表)。「只用它读表头所以风险小」并不成立:上一条已说明表头正是它的失效面之一。

**那流式读取就完全没有用武之地吗?有,但在「预览」而不是「合并」:** 若要做「秒开超大 xlsx 只看前几行」的预览(用户不想为看一眼等待 1.35s、也不想付 308 MB),`xl` 的 `.take(n)` 是真省 —— 它读到第 n 行就停。但前提仍是先修掉那三个缺陷(预览里把数值显示成 `1900-01-07` 同样是 bug),并且**只用于展示,绝不参与对齐决策**。这件事属于独立特性,不在本设计的 P0/P1 范围。

> ⚠️ **后续(2026-09-29)**:上述「按需展开列名」已按用户要求**整体移除** —— 实测后确认即便是「只取首行」,`from` 也要为该 sheet 付出整表物化的代价(179 MB 解压 / 1.35 s),对超大工作簿就是一次实打实的卡顿,而列名信息对合并并非必需(严格/并集的对齐在临时 CSV 上进行,不依赖预览)。`read_excel_header` 命令随之删除;扫描只保留廉价的 `--list-sheets`。

**这个方向仍然值得留意**:如果将来真要做「**秒开超大 xlsx 只看前几行**」的预览功能(用户不必等完整解析),那才是流式读取的正当用武之地 —— 但**必须用同一套夹具筛**;在预览里把 7 显示成 1900-01-07 同样是 bug。另外两个候选是直接依赖 `calamine`(成熟但与 xan 重复,且**本身也是全量加载,Range 常驻内存**,不解决内存诉求)与 `rust_xlsx_reader`(标称流式,仍在开发中)—— 若要评估,一律先过正确性夹具。

> 顺带澄清一处容易被误读的地方:**现有设计的峰值内存已经是「一张 sheet」而不是「一个工作簿」或「整个合并」**(每个 `xan from` 是独立进程、转完即退出,`cat rows` 顺序流式拼接),且 §3.6 的表头是在**同一次转换里顺带记录**的,预检**不会**额外再解析一遍。所以 §7 那条「xlsx 不可流式」限制的真实影响面比字面看起来小得多。

调用序列:

```rust
// 1) 枚举 sheet
xan from --list-sheets <abs.xlsx>
// 2) 每个待转换 sheet → 临时 CSV(前置来源列时由我们自己注入)
xan from --sheet-name <sheet> <abs.xlsx>            // stdout 即 CSV
// 3) 拼接(严格 / -U / -I 三选一;--paths 必须绝对路径)
xan cat rows [--union|--intersection] --paths <list.txt> -o <merged.csv>
// 4) 仅 xlsx 输出:复用 xan to 转格式
xan to xlsx <merged.csv> -o <out.xlsx>
// 5) 仅当 out_delimiter 非 "," 时:CSV 输出换分隔符
xan fmt --out-delimiter <d> <merged.csv> -o <out.csv>
```

关于第 4 / 5 步(为什么输出侧的分工是这样):

- **`to` 只负责「从 CSV 转出去」**,而 **CSV 是 xan 的原生格式** —— 各命令默认读 CSV、写 CSV,所以 `to` 的格式清单里**没有 `csv`**(实测 `xan to csv` 报 `could not export the file to this format!`)。因此 **CSV 输出不需要 `to`**,第 2 步的 `cat rows -o` 产出即是结果;`to xlsx` 只在目标格式不是 CSV 时才追加。
- 第 5 步用 `fmt`(而非 `to`)换分隔符,正是因为分隔符调整属于「CSV → CSV」,`fmt` 才是管这件事的命令(`to` 管的是换**格式**)。
- **这个分工顺带带来一个廉价扩展**:`to` 已支持 `html` / `json` / `jsonl` / `md` / `ndjson` / `npy` / `txt` / `xlsx` —— 若将来想把输出格式扩到这些,只需放开 §3.7 的输出格式下拉,后端逻辑一行不用改(已列入 §8 P2)。

关于第 5 步的默认值:CSV 输出沿用**应用默认分隔符**,与 018「所见即所跑」(执行侧复用界面上的分隔符)保持同一取向;`out_delimiter` 为空或 `,` 时跳过这一步,不为默认情况多起一个进程。

### 3.5 列对齐与「来源列」

**三种对齐策略**(直接映射到 `cat` 的能力,不自研对齐算法):

| 策略 | 底层 | 语义 | 适用 |
|------|------|------|------|
| **并集(默认)** | `cat rows -U` | 按**列名**对齐,任一侧缺失填空;最终列序见下 | 列有增减 / 顺序不一致是 Excel 的常态 → 适合做默认 |
| 严格 | `cat rows`(无 flag) | 所有 part 表头必须**完全一致**(名字与顺序),否则报错终止 | 需要「列结构完全同构」的强保证时 |
| 交集 | `cat rows -I` | 只保留所有 part 共有的列 | 只要公共字段,不想要稀疏的宽表 |

**默认选并集是刻意的(2026-09-29 决定)**:实践中「多个 Excel 的列不完全一致」是**常态而非例外** —— §2.3 的夹具里同一批工作簿就同时出现了「列序不同」(`03` 的 `Q1` 是 `name,id,amount`)与「列集完全不同」(`Notes`)两种情形。若默认严格,用户第一次用几乎必然撞上 `found inconsistent headers`(§2.2 陷阱 1 的文案),得先读懂报错、再回头改策略 —— 这是「默认值与真实数据分布不匹配」。

但必须同时承认:并集把「列不一致」从**报错**变成了**静默加宽**,而这正是本项目最警惕的一类失败(不报错、结果错)。因此**默认并集必须配套「让加宽可见」的机制**(见下),否则只是用一个静默失败换掉另一个。

**最终列序(实测)**:先按**第一个 part 的列序**输出,其余 part 中**首次出现的新列按出现顺序追加**。实测 `f1=a,b` + `f2=b,z` + `f3=b,m` → **`a,b,z,m`**(注意**不是**字母序);另一个实测 `id,name,amount,pad` + `name,id,extra,pad` → `id,name,amount,pad,extra`。

**并集摘要(默认并集下的必备物)**:转换完成、拼接之前我们已经掌握**全部 part 的表头**,所以在这一层就能算出加宽的量化信息,并放进结果:

```rust
/// 纯函数,输入是各 part 的表头,输出供结果区展示;不依赖 xan,可 CI 全量测。
fn union_summary(headers: &[Vec<String>]) -> UnionSummary;

pub struct UnionSummary {
  pub final_columns: Vec<String>,
  /// 并非每个 part 都有的列 + 「出现在几个 / 共几个 part」—— 这就是「加宽」的量化。
  /// 典型触发:某个工作簿把列名写错(`amout`),于是并集多出一列且有一半为空。
  pub not_in_all_parts: Vec<ColumnCoverage>,   // { column, present_in, total }
  /// 仅**大小写或首尾空白**不同的列名对(如 `amount` / `Amount`、`id` / `id `)。
  /// 这类几乎总是同一列被写歪,并集会把它拆成两列且各缺一半 —— 必须显式提醒。
  pub near_duplicate_columns: Vec<(String, String)>,
}
```

结果区在 `not_in_all_parts` / `near_duplicate_columns` 非空时用**琥珀色**显著展示(但**不阻断** —— 合并已完成且数据是对的,用户需要的是知情而不是被拦下)。

**来源列**三档:`file_sheet`(默认)/ `file`(相对路径)/ `none`。实现**不用** `--source-column`,而是按 §2.2 陷阱 2 的验证结论**自己给每个 part 前置首列** —— ⚠️ 注意:因为现在**默认就是并集**,而 `--source-column` 恰好在 `-U` 下静默消失,所以这个「自建首列」不再是可选技巧,而是**默认路径上唯一可行的做法**(已验证在 `-U` 下能够保留)。⚠️ 默认值调整(2026-09-29 用户决定):来源列**默认开启**且为 `file_sheet`(文件名 + sheet 名),让合并结果默认可追溯。

> 为什么来源列值得做:模式 `all` 的典型输入是「每个工作簿都有同名 `Q1`/`Q2`」,合并后**只有来源列能回答某一行来自哪**。它也是「合并结果可复核」的唯一凭据,成本只是拼 CSV 时多一列。

### 3.6 写前预检(保证失败不留半截文件)

严格执行顺序,确保**任何失败都不产生输出文件**:

1. 扫描 + 解析 part 清单;
2. 逐个 part 转临时 CSV,同时**记录其表头**(转完即已知,不需要重读);
3. `plan_alignment(headers, align)`:
   - `union`(**默认**)→ 得到最终列序,并顺带算出 `union_summary`(§3.5);**不因列不一致而中止**;
   - `strict` 且存在差异 → **立即报错并终止**,错误文案列出前 3 个冲突来源与差异列(把 xan 的原始文案提升成可行动的信息);
   - `intersection` → 得到公共列,继续;
4. 写清单 → `cat rows -o <临时输出>`;
5. 校验 `cat` 的退出码;成功后**才**把临时输出 rename 成目标路径(`output_format = csv`),或再经 `to xlsx` 转换后 rename(`xlsx`);
6. `TempFiles` 在 Drop 中清理全部中间文件(含第 4 步的临时输出)。

即:目标路径上**只会出现完整文件**(rename 是原子的),彻底消除 §2.2 陷阱 1 的半截文件问题。

> ⚠️ **默认并集下第 3 步不再承担「拦住不一致」的职责**,因此「加宽可见」的责任全落在 `union_summary` + 结果区展示上(§3.5)。这是换掉默认策略后必须配套的东西,不是可选项。
>
> **为什么预检不额外读一遍**:第 2 步转换是每张 sheet 唯一一次全量读取,表头是在这次读取里顺带拿到的;峰值内存也由这一次决定(§2.5)。因此预检是「免费的」—— 这也是不用流式读取器单独读表头的理由(§3.4 变体评估)。
>
> **这个「先全部转完、再拼接」的两段式结构**还使「失败不留半截文件」成立(输出只在最后一步 rename),并让各 part 之间互不依赖 —— 虽然 §2.6 已决定**不做并发**(保持峰值内存可预测),但这个结构本身不该被破坏,否则将来任何并发设想都要重排流程。

### 3.7 前端对话框 `src/modules/dialogs/file/MergeExcelDialog.tsx`

| 控件 | 默认 | 说明 |
|------|------|------|
| 来源(文件/文件夹,可混选,可多个) | 调用方传入的当前标签页文件,否则空 | `open({ multiple: true })` 与 `open({ directory: true })` 两个按钮,结果合并进同一个列表(多选文件在本项目尚无先例,`plugin-dialog` 支持,capability 无需改动) |
| 递归子目录 | 关闭 | checkbox;开启后深入所有层级 |
| 包含扩展名 | `xlsx` | 多选:`xlsx` / `xls` / `xlsb` / `ods` —— **即 `from -h` 声明支持的 Excel/表格格式全集**(不含 `xlsm`,见 §7);`.xlsx` 已实测,其余见 §7 |
| 取哪些 sheet | **第 1 个 sheet** | **`Select` 下拉**(`@/components/ui/Select`,项目既有组件)三项:**第 1 个 sheet** / **所有 sheet** / **指定名称**。⚠️ **没有「按序号」**(2026-09-29 决定:第 N 个的需求不存在,留着只会让人猜「第一个和序号有什么区别」) |
| 指定名称 | 空(**必选**) | **仅在选中「指定名称」时渲染**(不相关就不出现,而不是禁用置灰);同为一个 `Select`,选项 = 扫描结果里的 sheet 名并集。⚠️ **必须选一个**:留空则报错、不发请求(见下) |
| 指定名称缺失时 | 报错 | 同样**仅在「指定名称」下渲染**:报错 / 跳过该工作簿 |
| 列对齐 | **并集** | `Select` 三项(**并集**为默认);**选中项下方一行说明随选项变化**(§3.5 的语义)—— 下拉省纵向空间,说明用动态文案补回 |
| 插入来源列 | **文件名+sheet 名** | `Select` 三项:无 / 文件名 / 文件名+sheet 名;选中后两项时显示「列名」输入(默认 `source`) |
| 输出文件 | 空 | 文本输入 + 「选择」按钮;空 = 与第一个输入同目录的 `{stem}_merged.{ext}` |
| 输出格式 | xlsx | `Select`(csv / xlsx;§8 P2 计划扩到 `to` 支持的完整清单) |

**对话框主体整体可滚动**(2026-09-29 用户反馈,最终实现):**对话框高度固定为 `h-[85vh]`**(替换 `max-h-[85vh] min-h-[420px]` —— 内容驱动的 max-h 高度让 `ScrollArea` 拿不到确定高度,实测不产生滚动),整个主体(选项 + 错误条 + 预览 + 结果卡)放进一个 radix **`ScrollArea type="always"`**(`flex-1 min-h-0`,滚动条**常显**)。**工作簿列表为内层 `ScrollArea type="always" className="h-44"`** —— 全部文件可滚动查看、不再截断前 5 个,滚动条常显。⚠️ 两条 radix 经验:**ScrollArea 的 Root 必须有确定高度**(对话框 `h-[85vh]`、列表 `h-44`),`max-h-*` 配内容驱动高度实测不产生滚动;`type="always"` 解决「滚动条看不见」的观感问题(项目内既有先例:`DataLineagePanel` 的 `h-[120px]`、`VersionControlPanel` 的 `h-60`)。

**统一用 `Select` 的理由**:项目既有的同族对话框(`CsvEncodingDialog` / `SeparateCSVDialog` / `CsvDiffDialog`)的枚举选项**都用 `Select`**,这里跟着走既省纵向空间、也不再自造一套单选样式。`Select` 的实际能力(读源码确认):`options: {label, value}[]`、单选、**内置搜索过滤**、渲染为 `input[role=combobox]` + 列表 `role=listbox`/`role=option`(测试可据此定位)。

**「指定名称」不支持手输 —— 已决定(2026-09-29)**:`Select` **不接受自由文本** —— 用户键入的内容只用于**过滤选项**,不能作为值提交(只有点选/回车命中某个 option 才会 `onChange`)。这个限制**接受**,不额外做一个文本输入:

- 扫描结果对「可参与合并的文件」是**完备的**(读不出的文件本来就被排除在合并之外),所以候选列表不会有遗漏,手输没有存在必要;
- 手输的主要价值是「扫描还没跑时先填上」,这由**自动触发扫描**替代 —— 选中「指定名称」时若尚无扫描结果就自动扫一次(下拉显示加载态、`aria-busy`);
- 手输还会多出一类失败(拼错 → `could not find the "X" sheet`),去掉它反而更稳。

**「指定名称」留空 = 报错,不落回第 1 个 sheet —— 已决定(2026-09-29)**:前端**拦截报错、不发请求**(文案 `mergeExcelSheetNameEmpty`,如「请选择一个 sheet 名称」)。理由:静默落回第 1 个 sheet 会让用户以为按名称合并了、实际合的是第一张表 —— 与本设计一贯反对的「静默降级」同类。**这一条与 §3.5「默认并集」的处理哲学一致:可以宽松,但必须让用户看见实际发生了什么。**


**三种模式与 §3.2 `sheet_mode` 的对应**(下拉本身即互斥,后端只接受其中一个值,不处理组合):

| 界面选项 | `sheet_mode` | 实际调用 | 备注 |
|---|---|---|---|
| 第 1 个 sheet(**默认**) | `first` | `xan from <f>` **不传 sheet 参数**(`--sheet-index` 默认就是 0,§2.1) | 与「每个工作簿结构相同」的常见场景吻合 |
| 指定名称 | `name` | `xan from --sheet-name <名称> <f>` | 名称在部分工作簿缺失时按 `missing_sheet` 处理 |
| 所有 sheet | `all` | 对每个 sheet 各调一次 `from` | 各工作簿的 sheet 数**可以不同**;合并的是所有工作簿的所有 sheet |

> **可访问名与测试定位**:`Select` 内部是 `<input role="combobox">`,但项目既有用法是旁边放一个**没有 `htmlFor` 关联**的 `<label>`,于是这些下拉**没有可编程的标签**(`getByLabelText` 取不到)。本设计为此给调用处传一个可选 `ariaLabel`,并在 `Select` 上加同名可选 prop(转发到内部 input 的 `aria-label`)—— 一行、向后兼容,顺带修好既有三个对话框里同类下拉的可访问名。若不想动共享组件,退路是测试用 `getAllByRole("combobox")[n]` 定位,但那样**无障碍名依然缺失**(与项目此前「图标按钮漏 `aria-label` 导致测试与无障碍同时失效」是同一类问题)。

**预览列表:全量滚动 + 逐行可排除**(2026-09-29 用户要求):文件列表放进独立的 `ScrollArea`(`max-h-48`),不再截断为前 5 个;每行一个 **×** 按钮,把该工作簿**移除出本次合并**(请求带 `exclude`,后端按 display 路径大小写不敏感匹配,并跳过其 `--list-sheets` 调用)。被移除的行**保留在列表里**但置灰 + 删除线 + 「已排除」徽标,× 变为 ↩(可恢复)—— 移除是可逆且可见的,不搞隐藏状态。

对话框中段的**扫描预览区**(点「扫描」按钮后填充,或选项变更时防抖触发,守卫方式同 `useCsvProbe` 的过期响应丢弃):

```
✓ 已找到 12 个工作簿 · 共 30 个 sheet
  sheet 名: Q1(12) · Q2(12) · Notes(6)
  报告_2024_01.xlsx   [Q1, Q2]                    ← 默认只列 sheet 名(廉价:--list-sheets)
  报告_2024_02.xlsx   [Q1, Q2]  ▸ 展开            ← 点开才取列名,见下
  …(前 5 个)+ 共 12 个
⚠ sub/old/report.xlsx 读取失败:…    ← warnings 逐条展示
```

**列名预览已移除**(见上):扫描只给出工作簿、sheet 名与 warnings;列结构由合并时的写前预检掌握并经 `union_summary` 报告,界面上不再展示每个 sheet 的列。

- 展开请求同样要丢弃过期响应(用户在结果回来前点了别的文件),守卫方式同 `useCsvProbe`。
- 取列名失败(文件损坏等)时在该行内联显示错误,不影响其余文件。

结论区(与 016/017/020/021 同构):

```
✓ 已完成 / 上次合并 Excel · 完成时间 2026-09-29 09:12:33 · 耗时 1 240 ms
来源文件: 12 · 合并 sheet: 30 · 数据行: 8 421 · 输出格式: xlsx
列: source, id, name, amount, memo
⚠ 并集加宽: memo 仅出现在 6/30 个 sheet        ← 琥珀色,不阻断
⚠ 疑似同列被写歪: amount / Amount              ← 仅大小写不同,已拆成两列
D:/data/merged.xlsx
[打开路径] [清除记录]
```

- 结果 = 一个 `lastResult` 状态(兼作本次结果)+ `isStaleResult`(编辑任一选项置 true,标题从「已完成」变「上次合并 Excel」)+ `clearFeedback()`(只清 error)。**不复用 `t.lastResult`**(zh 是「上次拆分」,021 已定此约定)。
- **并集摘要必须显著展示**(§3.5):`not_in_all_parts` 与 `near_duplicate_columns` 非空时用琥珀色列出,但**不阻断、不弹窗**。因为默认策略已从「报错」改为「加宽」,这里是用户唯一能察觉「某列只在一半文件里」或「同一列被拆成两列」的地方 —— 没有它,默认并集就是静默失败。
- 「打开路径」调用既有 `reveal_paths(paths: [outputPath])`;输出文件被删则追加琥珀色提示并置灰按钮(`file_exists`)。
- 输出格式为 xlsx 时,结果区补一句提示「输出表名为 `Sheet1`(Excel 写出能力所限,见设计 025 §7)」,避免用户以为是 bug。

### 3.8 上次记录 `src/utils/excelMergeHistory.ts`

镜像 `splitLinesHistory.ts`(021)/ `separateHistory.ts`(017):localStorage key `easy-csv-excel-merge-last`、类型守卫(所有选项字段必填,同 020/021—— 这些值会被直接回填进表单)、2048 字节上限、`try/catch` 静默降级、load/save/clear 三件套。

存的**结果**字段:输出路径(单一文件,故直接存它,不像 021 要存目录)、来源文件数、合并 sheet 数、数据行数、最终表头、`finishedAt`、`elapsedMs`、`outputFormat`。
存的**选项**字段:来源列表、递归、扩展名集合、sheet 模式与取值、缺失策略、对齐、来源列、输出格式。

**回填策略**取 021 的做法(**选项回填而非复位**):「同一批文件夹再合一次」是重复操作,选项里除「来源」外都是用户习惯;来源列表以**调用方传入的当前文件**优先,其次才用记录里的。

### 3.9 入口接线

| 位置 | 改动 |
|------|------|
| `src/components/menu/MainMenu.tsx` | File 菜单在「按行拆分」(`t.splitLines`)下方新增「合并 Excel 文件」(`onOpenMergeExcel`),与文件级操作区同段 |
| `src/hooks/useUIState.ts` | 新增 `showMergeExcel` / `mergeExcelInitialInput` |
| `src/app/App.tsx` | 菜单回调(带入当前标签页文件)+ 命令面板动作 `merge-excel`(+ 英文别名映射 `actionEnKey`)+ 渲染 `<MergeExcelDialog>` |
| `src-tauri/src/lib.rs` | 注册 `excel_merge::scan_excel_sources` / `excel_merge::merge_excel_sources` |
| `src-tauri/src/tabular.rs` · `pipeline.rs` | 仅改可见性:`run_capture` / `TempFiles` 提为 `pub(crate)`,`xan_error` 新增 |

命令面板措辞与「拆分」两项区分清楚:`merge-excel` 描述用新 key(`t.mergeExcelHint`,如「把多个 Excel 的 sheet 合并为一张表」)。

### 3.10 i18n

新增 key(`i18n/translations/types.ts` + `{en,zh}/dialog.ts`,同一顺序):

`mergeExcel`、`mergeExcelHint`、`mergeExcelSources`、`mergeExcelAddFiles`、`mergeExcelAddFolder`、`mergeExcelRecursive`、`mergeExcelSheetMode`、`mergeExcelSheetFirst`、`mergeExcelSheetByName`、`mergeExcelSheetAll`、`mergeExcelSheetNameEmpty`(选中「指定名称」但为空时的拦截文案)、`mergeExcelMissingSheet`、`mergeExcelMissingError`、`mergeExcelMissingSkip`、`mergeExcelAlign`、`mergeExcelAlignStrict`、`mergeExcelAlignUnion`、`mergeExcelAlignIntersection`、`mergeExcelAlignHintStrict`、`mergeExcelAlignHintUnion`、`mergeExcelAlignHintIntersection`(选中项下方那一行动态说明,§3.7)、`mergeExcelSourceColumn`、`mergeExcelSourceNone`、`mergeExcelSourceFile`、`mergeExcelSourceFileSheet`、`mergeExcelSourceColumnName`、`mergeExcelScan`、`mergeExcelScanning`、`mergeExcelFound`、`mergeExcelStart`、`mergeExcelRunning`、`mergeExcelLastResult`、`mergeExcelFileCount`、`mergeExcelSheetCount`、`mergeExcelRowCount`、`mergeExcelNoSources`、`mergeExcelNoOutput`、`mergeExcelXanMissing`、`mergeExcelOutputSheetNote`、`mergeExcelInconsistentHeaders`、`mergeExcelExclude`(移除该工作簿)、`mergeExcelRestore`(恢复合并)、`mergeExcelExcluded`(已排除徽标)、`mergeExcelUnionWidened`(并集加宽提示)、`mergeExcelUnionColumnNotInAll`(「`{column}` 仅出现在 `{n}/{total}` 个 sheet」)、`mergeExcelUnionNearDuplicate`(「疑似同列被写歪:`{a}` / `{b}`」)。

> 已移除(2026-09-29 取消「按序号」):`mergeExcelSheetByIndex`、`mergeExcelSheetIndex`。

复用既有 key:`inputFile`、`open`、`outputPath`、`outputPathLeaveEmpty`、`finishedAt`、`elapsed`、`openPath`、`clearRecord`、`lastResultNoOutput`、`noHeaders`(不适用则不引)。

---

## 4. 边界与失败行为汇总

| 场景 | 行为 |
|------|------|
| 未选任何来源 | 报错 `mergeExcelNoSources`,不发请求 |
| 来源扫不到任何工作簿(扩展名不符 / 目录为空) | 扫描返回 0 文件,按钮置灰并提示;不发合并请求 |
| 某个子目录不可读 | 记入 `warnings`,继续扫描(不整体失败) |
| 某个工作簿读不了(损坏/加密) | 记入 `warnings` 并标 `ok=false`,其余照常;合并时排除 |
| 同一文件被重复选中(文件 + 它的父目录同时选中) | 按 canonical path **去重**,只合并一次 |
| 目录存在符号链接环 | 不跟随符号链接目录(防无限递归) |
| 指定 sheet 名在部分工作簿缺失 | `missing_sheet = "error"`(默认)在**扫描后、转换前**报错并列出缺失的文件;`"skip"` 则跳过并记入 `skipped` |
| 选中「指定名称」但名称为空 | 前端拦截报错,**不发请求**(不静默落回「第 1 个 sheet」,§3.7) |
| sheet 为空(无任何行) | 跳过该 part,记入 `skipped`,不算失败 |
| 严格模式下表头不一致 | **写前**报错 `mergeExcelInconsistentHeaders`,列出前 3 个冲突来源与差异列;**不产生任何输出文件**(注:严格**不是**默认,见 §3.5) |
| 并集(默认)下某些 part 缺列 | 正常合并,缺的位置留空;并在结果区**列出该列出现在几个/共几个 part**(`union_summary.not_in_all_parts`) |
| 并集(默认)下出现仅大小写/空白不同的列名 | 仍按 `-U` 拆成两列(不擅自合并 —— 猜错了会毁数据),但结果区**显著提示疑似同列被写歪**(`near_duplicate_columns`) |
| 并集(默认)下最终列序 | 第一个 part 的列序 + 其余新列按首次出现顺序追加(实测,§3.5);结果区把最终列序列出 |
| 用户以为默认是「必须表头一致」 | 结果区在 `union_summary` 非空时给琥珀色说明;对齐控件默认选中「并集」且三项各有语义说明(§3.7) |
| `xan` 未安装 | 报错 `mergeExcelXanMissing`,文案指向前端插件页签安装(设计 023) |
| `xan` 中途失败(磁盘满、进程被杀) | 临时文件由 `TempFiles` 清理;目标路径**不出现**半截文件 |
| 输出路径已存在 | 直接覆盖(rename 语义);不做备份 —— 与 021 覆盖同名分片的取向一致 |
| 输出目录不存在 | 自动 `create_dir_all` |
| `--source-column` 与 `-U` 组合(内部实现细节) | 不适用:来源列由我们自己注入(§2.2 陷阱 2),已被 §2.3 端到端验证覆盖 |
| 记录存在但 localStorage 被清 / 字段不符 / 超限 | 等价于无记录,不报错 |
| 记录里的输出文件被删 | 显示「输出文件已不存在」,「打开路径」置灰 |

---

## 5. 影响面

| 文件 | 改动 |
|------|------|
| `src-tauri/src/excel_merge.rs` | **新增**:`ExcelSourceFile` / `ExcelScanResult` / `ExcelMergeRequest` / `ExcelMergeResult` / `UnionSummary` / `ColumnCoverage` 类型;纯函数 `collect_workbooks` / `resolve_parts` / `plan_alignment` / `union_summary` / `is_near_duplicate_column` / `source_label` / `write_paths_list` / `resolve_output_path`;xan 薄壳 `list_workbook_sheets` / `sheet_to_csv` / `concat_rows` / `csv_to_xlsx` / `xan_error`;**两个命令** + 单测 |
| `src-tauri/src/lib.rs` | 注册 `excel_merge::scan_excel_sources`、`excel_merge::merge_excel_sources` |
| `src-tauri/src/tabular.rs` | `run_capture` 可见性提为 `pub(crate)`(复用,不复制) |
| `src-tauri/src/pipeline.rs` | `TempFiles` 可见性提为 `pub(crate)`(复用,不复制) |
| `src/utils/excelMergeHistory.ts` | 新增:`easy-csv-excel-merge-last` 读写/清除 + 严格类型守卫 |
| `src/modules/dialogs/file/MergeExcelDialog.tsx` | 新增:来源选择 + 递归/扩展名 + **取 sheet 方式/对齐/来源列/输出格式均为 `Select` 下拉**(默认第 1 个 sheet、并集)+ **「指定名称」相关控件按需渲染** + 输出 + 扫描预览(全量文件列表 `ScrollArea` 滚动,每行可 × 排除/恢复)+ 结果区(含并集加宽提示) |
| `src/components/ui/Select.tsx` | 可选小改:**新增可选 prop `ariaLabel`**(转发到内部 `input` 的 `aria-label`)。一行、**向后兼容、不传即现状**;动机见 §3.7 的可访问名/测试定位。若决定不动共享组件,改为测试用 `getAllByRole("combobox")[n]` 定位 |
| `src/components/menu/MainMenu.tsx` | File 菜单「按行拆分」下方新增「合并 Excel 文件」 |
| `src/hooks/useUIState.ts` | `showMergeExcel` / `mergeExcelInitialInput` |
| `src/app/App.tsx` | 命令面板动作 `merge-excel` + 英文别名 + 菜单回调 + 渲染对话框 |
| `src/i18n/translations/types.ts` · `{en,zh}/dialog.ts` | 新增 §3.10 的 key |
| `src/__tests__/excelMergeHistory.test.ts` · `src/__tests__/MergeExcelDialog.test.tsx` | 新增用例(§6) |
| `src-tauri/capabilities/default.json` | **无需改动**(`fs:allow-read-dir` 与 `dialog:default` 已具备;目录/多选文件都由前端 `plugin-dialog` 完成) |
| `package.json` / `Cargo.toml` | **无需新增依赖**(全部能力来自既有 `xan` + 标准库) |
| `docs/AI/INDEX.md` | 登记本设计文档、后端模块与三个命令、前端文件、测试,并补速查行 |

---

## 6. 测试计划

### 后端 `cargo test --lib excel_merge`(CI 可全量跑,不依赖 xan)

- `collect_workbooks`:递归 vs 非递归、扩展名白名单(大小写不敏感)、**重复路径去重**(文件与其父目录同时选中)、不可读子目录记 warning 且不中断、排序确定性;
- `resolve_parts`:三种策略 `first` / `name` / `all`;**`missing_sheet` = error 与 skip 的分叉**;空 sheet 进 `skipped`;`name` 模式在**全部**工作簿都缺失时返回 Err(而不是产出空合并结果);`all` 模式下各工作簿 sheet 数不同也能正确展开;
- `plan_alignment`:`strict` 对「顺序不同」与「列集合不同」都报错且错误里含冲突来源;`union` 得到最终列序(用实测场景断言:`a,b` + `b,z` + `b,m` → **`a,b,z,m`**,即首 part 列序 + 新列按出现顺序追加,**非字母序**;以及 `id,name,amount,pad` + `name,id,extra,pad` → `id,name,amount,pad,extra`);`intersection` 只留公共列;
- `union_summary` / `is_near_duplicate_column`(**新增,默认并集后的关键防线**):`not_in_all_parts` 的 `present_in` / `total` 计数正确(某列只出现在 1/3 个 part);`final_columns` 与 `plan_alignment` 的 union 结果一致;`amount`/`Amount`、`id`/`id ` 被判为疑似同列,而 `amount`/`total` 不误报;**单个 part** 与**全部 part 表头相同**两种退化情形都返回空摘要(不产生噪音提示);
- `source_label`:`file` / `file_sheet` 两种格式,含相对路径归一(Windows 反斜杠 → 正斜杠);
- `write_paths_list`:内容为绝对路径、行尾 `\n`、含空格与中文的路径不被破坏;
- `resolve_output_path`:默认命名 `{stem}_merged.{ext}`、显式路径优先、扩展名跟随 `output_format`。

### 后端(依赖 xan,本地跑;CI 上**跳过**)

用一个门控 helper(`fn xan_for_test() -> Option<PathBuf>`,`find_xan_executable()` 为 `None` 时 `return` 让用例变绿 —— 这是 §2.4 约束的落地方式),覆盖:

- `list_workbook_sheets` 对一个多 sheet 夹具返回预期 sheet 名与顺序;
- `sheet_to_csv` 对「列序不同的 sheet」返回其原始列序(证明 `-U` 的对齐确实由 xan 完成);
- **排除工作簿**:`exclude` 命中(大小写不敏感、正反斜杠等效)的工作簿不参与合并,其余照常;全部被排除时报 `No sheets selected to merge`;
- 端到端:同一组夹具在 `align = strict` 时**返回 Err 且目标路径不存在**(锁住「失败不留半截文件」),在 `union` 时输出与 §2.3 的期望 CSV 逐字节一致。

> 夹具生成:仓库内**不放**二进制 xlsx。用 `tests/fixtures/` 下的最小 OOXML 构造器(纯 `zip` + 字符串模板,无需新依赖)在测试时现场生成,或直接复用 §2.3 的离线生成脚本改写为 Rust 版。**不要**把 §2.3 用的 Python 脚本当作实现依赖。

### 前端(`vitest`)

- `excelMergeHistory.test.ts`:往返、无记录、坏 JSON / 缺选项字段 / 类型不符、超长跳过、清除(镜像 `splitLinesHistory.test.ts`);
- `MergeExcelDialog.test.tsx`:默认值(**并集** / **第 1 个 sheet** / 无来源列 / xlsx)→ `invoke` 形状里 `align: "union"`、`sheetMode: "first"` 且**不含** `sheetIndex`;切换对齐与来源列后请求参数随之变化并落库;**sheet 方式用 `getByRole("combobox")` + `getByRole("option", { name })` 驱动**(`Select` 的内部结构,见 §3.7),断言切到「所有 sheet」/「指定名称」后 `sheetMode` 随之改变;**「指定名称」相关控件按需渲染**(模式非 `name` 时 `queryByLabelText(名称/缺失策略)` 为 `null`,切到 `name` 后出现;并断言此时若无扫描结果会**自动发起一次扫描**);**选中「指定名称」但名称为空 → 拦截报错且不发请求**;未选来源与未填输出的拦截(不发请求);扫描后展示文件数与 sheet 名并集;**预览列表全量滚动展示、每行 × 可排除**(排除后行置灰 + 出现 ↩ 恢复按钮,合并 payload 含 `exclude`);严格模式表头冲突的后端错误原样透出;**并集摘要非空时展示琥珀色加宽提示与疑似同列提示、摘要为空时不出现任何提示**(锁住 §3.5 的「让加宽可见」);成功后展示来源文件数/sheet 数/行数/表头/**xlsx 单 sheet 提示**;编辑选项后标题转为「上次合并 Excel」;清除记录;`reveal_paths(['out'])`;输出缺失时置灰。
  - 按项目约定:`beforeEach` 里 `window.localStorage.clear()` + **显式重置 invoke mock**(`vi.clearAllMocks()` 不清 implementation,会串味);`src/test/setup.ts` 已全局 mock `@tauri-apps/api/core`,用 `vi.mocked(invoke)`。

### 回归红线

- `npx tsc --noEmit` / `npx vitest run` / `npx eslint src --ext .ts,.tsx` / `pnpm check:index` 全绿;
- `cargo test --lib` 在**没有 xan 的机器上**也必须全绿(§2.4);
- 现有 CSV 路径零变化(`read_csv_file` / `separate_csv` / `split_lines` / 管道执行的行为不受影响)。

---

## 7. 已知限制

- **输出恒为单 sheet**,且表名固定 `Sheet1`(`xan to xlsx` 无相关参数,§2.1)。想自定义表名/多 sheet 输出需要自己改 OOXML(`zip` 内部 `xl/workbook.xml`),脆弱且价值有限,本期不做;界面用一句提示说明。
- **`.xlsx` 之外只按 xan 的声明支持**:`from -h` 列出 `xls` / `xlsb` / `xlsx` / `ods`,但本次**只实测了 `.xlsx`**;启用其余扩展名时,若该工作簿读不出 sheet 会体现在 `warnings` 里。⚠️ **`.xlsm`(带宏)不在 `from` 的声明清单里**,因此不列入界面选项 —— 底层 calamine 大概率能读(与 xlsx 同构),但**未验证不进界面**,否则就是把不确定性推给用户。
- **xlsx 不可流式,但影响面有限**:`from -h` 明确 xlsx 需整文件入内存。实测(§2.5):读一张 80 万行 sheet(解压 179 MB)峰值 308 MB(≈ 1.7×),而**合并阶段 `cat rows` 是常量 8.5 MB**(131 MB 输入)。因为每个 `xan from` 独立进程、转完即退,**峰值 = max(单个 sheet)** 而非 Σ(所有 sheet),预检也不额外解析(§3.6)。准确表述:**峰值 ≈ 最大单个 sheet 解压体积的 1.5~2 倍,与合并多少个文件无关**。真正的约束是「最大的那一张 sheet 必须能被内存容纳」;超大工作簿建议先在 Excel 侧拆分。若要彻底摆脱这一点需要换流式读取器,已评估并否决,见 §3.4。
- **N × M 次子进程,且串行**:每个待合并 sheet 起一次 `xan from`(加扫描期的 `--list-sheets`)。因为**保持单线程**(§2.6 的决定),墙钟 ≈ Σ(每个 sheet),上百个 sheet 时启动开销可感知;P0 **无进度反馈、不可取消**(与 `separate_csv` / `convert_csv_encoding` / `split_lines` 一致),这是 P1 要补的。
- **默认并集会加宽表**:列不一致时按列名并集对齐、缺失处留空,因此结果可能比预期**列更多、更稀疏**(尤其「全部 sheet」模式下混入 `Notes` 这类 sheet 时)。这是**默认行为**(§3.5),不是 bug;结果区的 `union_summary` 会量化告知「哪些列不是每个 sheet 都有」。要「只要公共列」请切换为交集。
- **并集不猜「两个列名是否同一列」**:`amount` 与 `Amount`、`amout` 与 `amount` 会各自成为一列(前者会被 `near_duplicate_columns` 提示,后者不会)。**不自动合并/纠正列名**是有意的 —— 猜错的代价是毁数据,而一次提示的代价只是用户多看一眼。
- **公式取的是缓存值**:单元格公式若在保存时没有缓存结果,读出来是空(取决于 Excel 写出行为,非本应用可控);合并不会重算公式。
- **不合并配色/格式/多表头行**:只搬数据与首行表头;多行表头的表(前两行都算表头)需要先在 Excel 侧规整。
- **「全部 sheet」会混入非数据 sheet**:如 `Notes`、`说明` 这类 sheet 会被一并合并(§2.3 的 `Notes` 正是如此)。用来源列可追溯,或在对话框改用「指定名称」。不做 sheet 名的自动过滤 —— 猜错了删数据的代价更大。
- **行序 = 文件路径排序 × 工作簿内 sheet 顺序**,是确定性的但不等于用户在资源管理器里看到的顺序;需要别的顺序请在合并后用管道排序。
- **不做 zip 炸弹 / 超长单元格等恶意输入防护**:输入是用户自己选的本地文件,与既有文件级功能同一威胁模型。

---

## 8. 分期

| 期 | 内容 |
|----|------|
| **P0** | 两个后端命令 + 纯函数核心 + `xan` 薄壳;对话框(来源/递归/扩展名/三种 sheet 策略三选一/三种对齐/来源列/输出格式);扫描预览(全量滚动 + 逐行排除);写前预检与原子落盘;上次记录;File 菜单与命令面板入口;i18n;上述测试 |
| **P1** | ①**进度事件 + 取消**(`excel://merge-progress`,形态照 `plugin://progress`;取消用全局 `AtomicBool` 照 `set_pipeline_cancelled`)—— 串行的墙钟 ≈ Σ(每个 sheet)(§2.6),上百个 sheet 时「看着像卡死」是真实体验问题,**这才是墙钟长的对症解法**(不动并发,见 §2.6 的决定);②允许 **CSV/TSV 作为输入**(跳过 `from` 一步,复用同一套对齐与来源列逻辑,使本对话框成为「文件级 N→1 合并」的统一入口)。⚠️ 但**只做②并不解除 xan 依赖** —— 拼接仍走 `cat rows`;要真正做到「**无 xan 也能合并 CSV**」必须同时按 §3.4 的决策改走方案 B(自己实现拼接),两者应一并评估 |
| **P2** | ①自定义输出 sheet 名 / 多 sheet 输出(需自研 OOXML 写入,或评估引入轻量写入库);②「每个源文件一个 sheet」的另一种合并语义(同样受限于 ①);③保存/复用合并方案(文件夹组合 + 选项),避免每次重选;④**输出格式扩到 `to` 已支持的其它格式**(`html` / `json` / `jsonl` / `md` / `ndjson` / `npy` / `txt` / `xlsx`)—— 复用同一个 `to` 调用,**后端零改动**,只需放开 §3.7 的下拉并补 i18n |
| **明确不做** | ①**转换阶段的并发**(§2.6 已决定:保持单线程,峰值内存可预测优先);②引入流式读取库(§3.4:已实测否决 `xl`,`calamine` / `rust_xlsx_reader` 同理需先过同一套夹具);③`cat cols` 按列拼接(§1.3 非目标);④自动清理上一轮遗留的中间/输出文件 |

---

## 附:本次实测的可复现步骤

夹具与验证脚本在临时目录(`%TEMP%/easycsv-xlmerge/`)离线生成,未进入仓库:

1. `make_xlsx.py` —— 纯 `zipfile` + XML 模板生成多 sheet 夹具(xlsx 即 zip;用 `inlineStr` 免去 sharedStrings 部件,无需 openpyxl,可离线复现);
2. `simulate_merge.py` —— 按 §3 的设计跑完整链路(递归扫目录 → 逐 sheet 转 CSV 并注入来源列 → 写绝对路径清单 → `cat rows -U` → `to xlsx`),并顺带验证严格模式的失败行为。

命令级验证(§2.1 / §2.2 每条结论的出处):

```bash
xan --version                                     # 0.60.0
xan from --list-sheets  in/a/report_2024_01.xlsx   # Q1 / Q2
xan from --sheet-name Q1 in/a/report_2024_01.xlsx  # id,name,amount + 2 行
xan from --sheet-name Q1 in/b/sub/report_2024_03.xlsx  # name,id,amount(列序不同)
xan from --sheet-name NOPE in/a/report_2024_01.xlsx    # 报错并列可用 sheet
xan cat rows in/a/*.xlsx                          # ❌ zip 字节被当 CSV,报 CSV error
xan cat rows work/1.csv work/2.csv work/3.csv     # ❌ 先吐 4 行再报 headers 不一致
xan cat rows -U work/1.csv work/2.csv work/3.csv  # ✅ 按列名对齐
xan cat rows -U --source-column source work/*.csv # ⚠️ source 列静默消失
xan to xlsx work/merged.csv -o work/merged.xlsx   # ✅ 回读 sheet 名为 Sheet1
```

### `xl` 否决所用的对抗性夹具与复现步骤(§3.4)

夹具与脚本同样在 `%TEMP%/easycsv-xlmerge/`,离线生成、未进入仓库:

1. `make_adversarial.py` —— 在 `make_xlsx.py` 基础上补出 `xl/styles.xml`(两个自定义 `numFmt`:164 = `0" m"`、165 = `#,##0" days"`;`cellXfs` 三项),生成三个夹具:
   - `adv/misdetect.xlsx`:数值 7 配格式 `0" m"`、数值 90 配 `#,##0" days"`、数值 42 配 `General`(**对照项**);
   - `adv/panic60.xlsx`:数值 60 配日期类格式(命中 1900 闰年分支);
   - `adv/ragged.xlsx`:**不写** `<dimension>`,首行 1 列、次行 3 列。
2. 一个只依赖 `xl = "0.1.7"` 的临时 crate(`%TEMP%/xltest/`),程序做三件事:`wb.sheets().by_name()` 打印 sheet 名 → `sheets.get(name).rows(&mut wb).take(n)` 打印前 n 行 → 只依赖公开 API。

```bash
# 基准:calamine(xan)在同一组夹具上是对的
xan from --sheet-name Data adv/misdetect.xlsx   # meters,7 / elapsed,90 / plain,42
xan from --sheet-name Data adv/panic60.xlsx     # sixy,60
xan from --sheet-name Data adv/ragged.xlsx      # 1,,  然后 1,2,3

# xl 的表现
xltest adv/misdetect.xlsx Data 5   # meters,1900-01-07 / elapsed,1900-03-30 ❌ 静默篡改
xltest adv/panic60.xlsx  Data 5    # panic: Bad date in Excel file - 2/29/1900 not valid(exit 101)
xltest adv/ragged.xlsx   Data 5    # ROW1: 1   ROW2: 1,2,3 ❌ 变长行
```

> 这三个夹具建议在**任何**针对 xlsx 的新读取路径被引入时复用(包括将来的流式预览);它们已经按「最小可复现」写清,重新生成成本很低。

### §2.5 内存实测的复现步骤

脚本同在 `%TEMP%/easycsv-xlmerge/`:

1. `make_big.py` —— 生成 4 个约 **64~67 MB** 的 CSV(`same_a/same_b` 同表头、`diff_a/diff_b` 列序不同且多一列),各 100 万行;
2. `make_big_xlsx.py` —— 生成一个 **17.9 MB** 的 xlsx,内含 `Big`(80 万行,sheet XML 解压后 **179 MB**)与 `Small`(空 sheet)两个 sheet —— 「同一文件、不同数据量」正是用来分离「按 sheet 计费」与「按工作簿计费」的;
3. `measure_mem.py` —— 通过 `ctypes` 调 `psapi!GetProcessMemoryInfo` 轮询子进程的 `PeakWorkingSetSize`(该值由 OS 维护,轮询取到即为真实峰值),并用 `GetProcessTimes` 取 CPU 时间,输出 `peak RSS / wall / cpu / cpu·wall⁻¹`(后者即 §2.6 的单线程判据),用法:
   `python measure_mem.py "<标签>" <被测命令...>`

```bash
# 合并阶段是常量:131 MB 输入 → 8.5 MB 峰值
python measure_mem.py "cat rows plain"   <xan> cat rows    big/same_a.csv big/same_b.csv -o big/out_plain.csv
python measure_mem.py "cat rows -U"      <xan> cat rows -U big/diff_a.csv  big/diff_b.csv  -o big/out_union.csv
# 读取阶段按 sheet:同一个 xlsx,空 sheet 44.5 MB vs 80 万行 sheet 308 MB
python measure_mem.py "list-sheets"      <xan> from --list-sheets big/big.xlsx
python measure_mem.py "small sheet"      <xan> from --sheet-name Small big/big.xlsx -o big/small.csv
python measure_mem.py "big sheet"        <xan> from --sheet-name Big   big/big.xlsx -o big/big.csv
# §2.6 并行度:两个阶段都应给出 cpu/wall ≈ 1.0(单线程)
python measure_mem.py "from cpu/wall"    <xan> from --sheet-name Big big/big.xlsx -o big/big2.csv
python measure_mem.py "cat -U cpu/wall"  <xan> cat rows -U big/diff_a.csv big/diff_b.csv big/same_a.csv big/same_b.csv -o big/out4.csv
```

> 依赖解释器:`ctypes` 是标准库,`psapi` 走 `ctypes.windll`,**不需要 psutil**(本机 pip 无网络,见下)。
