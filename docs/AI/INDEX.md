# Easy CSV — 项目模块索引

> 本文档为 AI 辅助开发提供代码结构速查,方便快速定位修改目标。

---

## 项目概述

Easy CSV 是一个基于 **Tauri v2** 的桌面应用,提供可视化界面来构建 [xan](https://github.com/medialab/xan) CSV 命令行工具的处理管道。用户通过拖拽方式将多个 CSV 操作(筛选、排序、去重、连接等)串联成管道,一键执行。

- **技术栈: ** Rust (后端) + React/TypeScript (前端) + xan.exe (内嵌 CLI)

---

## 架构总览

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React + TypeScript)          │
│  src/app/App.tsx · components/ · hooks/ · services/│
│  可视化管道编辑器 (ReactFlow) · CSV 预览表              │
│  命令配置 UI (shadcn) · i18n (中/英)                  │
│  表达式编辑器 (语法高亮 + 自动补全)                     │
│  AI 助手 (自然语言 → xan 命令, RAG 检索)              │
│  图表可视化 (recharts: 折线/散点/柱状/直方图等)         │
│  管道版本控制 · 数据血缘追踪 · 全局命令面板 (Ctrl+K)     │
│  CSV 对比 (Ctrl+D) · 编码转换 · 会话自动保存/恢复       │
│  系统托盘 · 拖拽打开 · 数据概况 · 管道步骤复制粘贴       │
│  通过 @tauri-apps/api invoke() 与后端通信             │
└────────────────────┬───────────────────────────────┘
                     │  IPC (Tauri v2 commands)
┌────────────────────▼────────────────────────────────┐
│               Backend (Rust / Tauri)                │
│  src-tauri/src/                                     │
│  main.rs (入口) · lib.rs (模块声明)                   │
│  config.rs · xan.rs · pipeline.rs · csv.rs          │
│  storage.rs · ai.rs · ai_memory.rs · session.rs     │
│  AI 对话持久化 (ai_memory.db) · AI 配置 (config.db)     │
│  会话快照持久化 (session.db) · API Key 加密存储          │
│  (AES-256-GCM) · 63 个 Tauri 命令                    │
│  CSV 读取 (csv crate) · CSV 对比 · 编码转换            │
│  管道执行 (进程管理 + 取消) · AI 代理 (DeepSeek/       │
│  Qwen/GLM) · AI 记忆持久化 · 数据概况缓存              │
│  版本/血缘存储 · 系统托盘                              │
└────────────────────┬────────────────────────────────┘
                     │  子进程 (stdin/stdout 管道)
┌────────────────────▼────────────────────────────────┐
│              xan.exe (内嵌 CLI 二进制)                │
│  59 CSV 操作命令 (filter, sort, join, output, ...)   │
└─────────────────────────────────────────────────────┘
```

### CLI 插件 (`plugins/`)

| 目录 | 职责 |
|------|------|
| `pinyin-cli/` | 独立 Rust CLI(二进制名 `pinyin`):中文转拼音,支持 stdin/stdout,可与 xan 命令组合成管道。参考 `src-tauri/src/plugins.rs`。已接入前端命令面板/命令列表 + 设置中的插件管理页签。实现见 `plugins/pinyin-cli/`(crate 源码) |

前端插件命令定义位于 `src/data/commands/index.ts`(`pinyin`,`plugin: true`,category `Plugins`),表单位于 `src/modules/dialogs/command/forms/pinyin.tsx`。

### 设计文档 (`docs/design/`)

| 文件 | 内容 |
|------|------|
| `docs/design/001_flow-top-bottom-connect.md` | 节点连接点支持上下方向(已实现): `resolveHandles` 四方向选择算法、Handle 命名扩展(`top-*`/`bottom-*`/`table-top-*`)、切割碰撞检测同步更新 |
| `docs/design/002_right-click-connect-bezier.md` | 右键连线改为贝塞尔实时预览(方案 A 已实现): 复用 `getBezierPath` 使预览=最终边、`pickStartHandle`/`buildConnectPreviewPath`、坐标换算与迟滞防抖 |
| `docs/design/015_follow-system-language.md` | 语言设置新增「跟随系统」选项(方案设计): `LanguagePreference` 偏好/生效语言分离、`resolveSystemLanguage()` 基于 `navigator.language`、设置页两段改三段、新用户默认跟随系统 |
| `docs/design/016_separate-good-bad-rows.md` | 拆分好/坏行(已实现): 共享 `flexible(true)` reader/writer 重序列化、坏行向前归并、streaming 常量内存大文件方案 |
| `docs/design/017_separate-dialog-ux.md` | 拆分对话框体验优化(已实现): `probe_csv_file` 首次行列数/表头预览、分隔符检测算法(表头权重 60 > 正文 30)、上次结果 localStorage、`reveal_paths` |
| `docs/design/018_open-file-delimiter-detection.md` | 打开文件的分隔符自动检测 + 自动检测总开关(已实现): `read_csv_file` 支持自动检测并回传 `delimiter_source`、标签页记录解析值、输入节点分隔符徽标、执行侧改用标签页解析值("所见即所跑");设置页与输入节点徽标**共用同一个 `DelimiterModeSelect`**(自动检测 / 5 个分隔符),双向同步 + 即时落库(`auto_detect_delimiter` 配置项) |
| `docs/design/019_frontend-structure-refactor.md` | 前端目录结构与巨型文件重构方案(**阶段 0/1 已实施 + 2.1–2.4/2.7 与 3.1–3.4/3.8 已实施;2.2/2.3 为部分实施,2.5/2.6 与 3.5–3.7 未实施**): 已完成——类型下沉到 `types/dialog.ts` 解除循环依赖、`VariableHint` 移入 `ui/`、11 个旧浮动对话框收敛为 `openCommandFromContext()` → `buildCommandInitialParams()`(纯函数,配单测) → `CommandDialog` 并删除、`components/dialog/**` 四分为 `modules/dialogs/{command,file,app,common}`、命令表单一命令一文件(`forms/<命令id>.tsx`)、`data/commands.ts` 拆为 `data/commands/` 目录、`i18n/translations.ts` 拆为 `{en,zh}/<domain>.ts`、`components/panel/**` 迁往 `modules/{pipeline,data-preview,ai,variables,logs}`、`ui/` 统一 PascalCase、`hooks/` 统一 `useXxx`、ESLint 安全网(`import/no-cycle` + `import/parsers`)。未完成——`FlowPanel` JSX 再拆(≤600 目标未达)、`AppLayout`/`useDialogStack` 全量接入(`App.tsx` 已迁 `src/app/`)、`ChartPanel` 拆分、HomeView Props 收敛、`SettingsTabContent`/`ai/context.ts` 等中型拆分、`setting/` 三个文件迁往 `app/providers` 与 `ui/`、`max-lines`/CI 门禁、`scripts/check-index.ts` |

| `docs/design/020_encoding-conversion-history.md` | CSV 编码转换保留上次记录(已实现): 复用 017 的「上次结果」模式——`easy-csv-encoding-last` 持久化(输出路径/字节数/完成时间/耗时)、打开时回填输入输出路径与源/目标编码、「打开路径」(`reveal_paths`)与「清除记录」、输出文件被删则置灰提示;后端 `CsvEncodingResult` 增加 `elapsed_ms`;`formatElapsed` 由 `utils/separateHistory.ts` 上提到 `utils/format.ts` |
| `docs/design/021_split-lines-by-line-count.md` | 按行拆分(已实现): 移植上游 `split_lines`(来源文件已删除,节选见该设计文档 §2)—— 不解析 CSV 的**原始行**切分(`read_until(b'\n')` 字节保真、常量内存、可处理超大文件),`no_headers` 选项(首行按数据行),输出 `{stem}_part{N}{ext}`(N 从 1、保留扩展名);File 菜单「拆分好/坏行」下方新入口 + `easy-csv-split-lines-last` 上次记录(存输出目录而非全部分片路径) |
| `docs/design/022_github-auto-update-and-admin-free-install.md` | GitHub 自动更新 + **免管理员权限安装**(**P0+P1 已实现**;端到端更新链路待真实发布验证): ①免提权——Windows 收敛为只出 NSIS + `installMode: "currentUser"`(去掉默认要 UAC 的 MSI)、Windows/Linux 数据目录**于 2026-09-27 修订为「安装目录即数据目录」**(安装器强制装进 `<用户选择路径>\EasyCsv`,见该文档文首「修订」)、macOS 需装 `~/Applications`、Linux 限 AppImage;②自动更新——单渠道固定 GitHub Releases,`plugins.updater.endpoints` **配置驱动**(无需后端胶水,前端 `fetch` GitHub API 改为官方 `check()` / `downloadAndInstall()`),仅新增一个 `get_install_form` 命令用于按运行形态禁用一键更新;③签名私钥为单点(丢失不可逆)。**关键结论**:`endpoints` 数组只在非 2XX 时回退,大陆访问 GitHub 的失败是超时,**不要**加 Gitee 地址做兜底;单渠道的代价是国内自动更新成功率不可保证。**2026-09-27 修订**:①安装器强制把程序装进 `<用户选择路径>\EasyCsv`(`NSIS_HOOK_PREINSTALL`,幂等),数据目录即该目录 —— 卸载只会删应用自己的文件夹;②新增 `src-tauri/nsis/hooks.nsh`,修好卸载器里那个一直形同虚设的「删除应用数据」勾选框(模板原本删的是 BUNDLEID 路径 `%LOCALAPPDATA%\com.administrator.easycsv`,对真实数据目录是空操作) |
| `docs/design/023_plugin-repository-and-in-app-install.md` | 插件仓库与应用内下载安装(**设计稿,未实现**): 建独立仓库 `easy-csv-plugins` + **minisign 签名的 `catalog.json`**(钉住各平台资产的 `size`/`sha256`);应用内「取清单 → 下载 → 校验 → 原子替换落盘到 `<数据目录>/plugins/<平台>/`」,新增 `get_plugin_catalog` / `install_plugin` / `uninstall_plugin` 三个命令与 `plugin_catalog.rs` / `plugin_install.rs` 两个模块;设置页插件页签从只读改为可下载/更新/卸载,**并修掉「缺 xan 无任何提示」**(`App.tsx` 里 `check_xan_installed` 的结果原本被丢弃)。**关键事实**:插件二进制目前**一个都没有分发渠道**(`src-tauri/.gitignore` 的 `*.exe` 排除了它们,仓库里只有 `readme.md`);**关键结论**:与 022 的 `endpoints` 不同,本设计的下载循环自己实现,可按超时多源回退;且因哈希来自签名清单,**走镜像/代理不影响完整性** |

| `docs/design/024_parquet-duckdb-file-reading.md` | Parquet / DuckDB 文件读取(**已实现,2026-09-28**): 输入侧从「只能是 CSV」扩展到 `.parquet` 与 `.duckdb`(数据库文件需选表)。**决策: 不引入 arrow/parquet/duckdb crate**(`.duckdb` 存储格式无纯 Rust 读取器,与 011「不打包 DuckDB」冲突),统一用已有的 DuckDB CLI 插件做格式适配;采用**按需物化**——管道首步是 duckdb 步骤则**原生直读**(`read_parquet` / `ATTACH ... (READ_ONLY)` 暴露成虚拟关系 `input`,零转换、类型保真),否则先用 duckdb 把输入导出成临时 CSV 再走今天的两条路径(xan 只吃 CSV)。**多步 duckdb SQL 串联**:**全链都是 duckdb 步骤时单进程执行**(`CREATE TEMP TABLE _step_N AS (sql)` + 重定义 `input` 视图 + `DROP` 旧表,避免视图自引用歧义;错误按脚本行号映射回步骤,零交接文件、1 次进程启动);只有混合链跨进程才用 `COPY (sql) TO tmp.parquet (FORMAT PARQUET)` 交接(不落 CSV、类型不退化),由邻接关系驱动、无需模式开关;链中非最后 duckdb 步必须是单条查询语句,xan 步骤仍可随时插入(边界落一次 CSV)。新增模块 `src-tauri/src/tabular.rs`(`InputFormat`/`SourceRef`/`detect_input_format`/`quote_literal`/`quote_ident`/`source_view_sql`/`materialize_input_to_csv`)与两个命令 `list_duckdb_tables`、`read_tabular_file`(`TabularData` = `CsvData` 超集 + `format`/`source_table`);`execute_xan_pipeline` 增 `input_table` 参数,`pipeline_seq` 的 `current_input` 由 `PathBuf` 改 `SourceRef`。临时文件用 RAII 守卫清理(覆盖取消/报错提前返回),物化的 `-separator` 必须等于 `default_delimiter`(与下游 `-d` 注入对齐)。前端:`src/utils/fileFormat.ts`(新,`isCsvFile` 唯一真相)、`DuckdbTableDialog`(新)、`useTabs.loadCsvData` 单入口 + 分隔符重读 effect 限定 CSV、`TableNode` 非 CSV 隐藏分隔符徽标。**CSV 路径零变化**是回归红线 |

| `docs/design/025_excel-multi-file-merge.md` | Excel 多文件合并(**已实现,2026-09-29**;上游能力/内存/并行度实测与决策依据见文内): 补上「N 个工作簿 → 1 张表」这一空缺 —— 现有对 xlsx 的能力只有「单输入单输出」(管道 `from`/`to` 节点、Batch Convert 的 N→N),而管道 `cat` 节点**只吃 CSV**(实测:`xan cat rows a.xlsx b.xlsx` 会把 zip 字节当 CSV,报 `CSV error: record 4 ... found record with 2 fields`),所以「按 sheet 名/全部 sheet 合并多个 Excel」今天无法表达。实测确认 `xan 0.60.0` 的 `from --list-sheets` / `--sheet-name` / `--sheet-index`(默认 0)与 `cat rows -U/-I`(按列名对齐)可用,但有三个陷阱:①严格 `cat` 表头不一致时**先吐数据再报错**(直接 `-o` 会留半截文件)→ 改为**写前预检 + 临时输出 rename 原子落盘**;②`-U`/`-I` 会让 `--source-column` **静默消失** → 来源列改为**我们自己前置首列**,已验证在 `-U` 下可保留;③`--paths` 清单必须写**绝对路径**(按子进程 cwd 解析);④`to xlsx` 恒为**单 sheet 且名固定 `Sheet1`**,多 sheet 输出列为非目标。**已实现**:后端 `src-tauri/src/excel_merge.rs`(纯函数 `collect_workbooks`/`resolve_parts`/`plan_alignment`/`union_summary`/`is_near_duplicate_column`/`source_label`/`common_ancestor`/`write_paths_list`/`resolve_output_path` + xan 薄壳)与命令 `scan_excel_sources`/`merge_excel_sources`/`read_excel_header`;前端 `src/modules/dialogs/file/MergeExcelDialog.tsx` + `src/utils/excelMergeHistory.ts`;File 菜单「按行拆分」下方入口 + 命令面板 `merge-excel`。**已定策略**:①**列对齐默认 `--union`**(配套 `union_summary` 让「加宽」可见);②**合并全程单线程**(实测 cpu/wall 0.95~0.98×;明确不做并发——峰值内存可预测优先);③取 sheet **三选一下拉**(第 1 个/所有/指定名称,无「按序号」;指定名称必须选、留空报错);④**不引入流式读取库**(`xl` 已实测否决:会把格式码含 `m`/`d` 的数值静默改成日期、值为 60 时 panic、缺 `<dimension>` 时变长行)。**内存实测**:合并阶段 `cat rows` 131 MB 输入峰值仅 **8.5 MB**(流式),读取阶段一张 80 万行 sheet(解压 179 MB)峰值 **308 MB** 但**按 sheet 计费**(峰值 = max(单个 sheet) 而非总和)。⚠️ **CI 关键约束**:`xan` 不随包分发(`.gitignore` 排除 `*.exe`,`resources/plugins/` 只有 `readme.md`),故 `cargo test` 里凡 shell out 到 xan 的用例**必须能优雅跳过**(测试把 xan 复制进测试资源插件目录,走生产解析器同一条路)。 |

| `docs/design/026_excel-merge-output-shapes.md` | Excel 合并输出形态扩展(**已实现 2026-09-29**,文首「实施记录」): 把输出形态从「N→1 单 sheet」扩成三种界面选项 —— A 合并为一表(025 现状)/ **B 按 sheet 名分文件**(`by_sheet`:用户显式勾选 sheet 名,勾几个出几个文件,各簿同名 sheet 合并,如 t1{s1,s2,s3}+t2{s1,s2,s3} → s1/s2/s3.xlsx)/ **C 每簿一 sheet 合成一簿**(`multi_sheet`:输出 sheet 名=来源簿 stem,锁定 xlsx);`split`(单簿拆分)是 B 的别名,共用管道。核心机制:`plan_outputs` 归一输出计划;C 的多 sheet 写出用 **`rust_xlsxwriter`**(开放问题①已定案);`sanitize_filename`(Windows 保留名/末尾点空格)与 `sanitize_sheet_name`(31 字符/非法字符/History)+ `dedup_names` 大小写折叠去重(改名映射进结果区琥珀提示);多输出失败 = 逐输出原子 + fail-fast 不回滚。回归红线:025 既有测试断言零变化(后端 169/前端 464 全绿) |

| `docs/design/027_first-run-onboarding.md` | 首次使用引导(**§4.1/§4.2/§4.3 已实现**;§4.5「常用」分组待定): 诊断「打开文件后画布无任何提示、命令面板/日志/AI/数据概况默认全关、前进路径全是纯图标+Tooltip、置灰的『执行』无解释」等断点;方案分层 —— P0 示例数据+示例管道(`ensure_sample_data` + 内置模板;示例管道**不含导出步骤**且自动执行一次,避免往磁盘写文件的副作用;引导语并进完成 Toast 而不是弹两条)、P0 画布内「第一个步骤」引导(**收敛到命令面板这唯一入口**: 画布空态引导卡(纯文字卡片、非节点样式) + 命令面板内提示条 + 首次高亮工具栏入口图标;已实测添加入口只有命令面板 `Alt+C`/全局 `Ctrl+K`,画布右键菜单无「在此添加操作」`FlowPanel.tsx:744-762`,故不做假节点、不加右键菜单项)、P1 执行完成的**顶部 Toast**(给 `Toast.tsx` 的 `ToastProps` 加可选 `action`,带「查看结果」;不带「打开数据概况」;**日志面板自动打开是现状** `runPipeline.ts:102`,不重复做;**步骤失败红色标记也是现状** `PipelineStepNode.tsx:265-280`(`step.error` → 红框+红字块),**不做「每步成功标记」**(满屏绿点会让工作流看起来更复杂);执行结束无完成提示 `runPipeline.ts:287-290` 才是缺口;不做「结果节点=视觉终点」/fitView 定位/结果节点内嵌按钮)、内置模板库 + 帮助中心「5 分钟上手」、命令面板「常用」分组、连线手势教学卡(只教不改)。**已定三条红线: ① 连线手势一律不改**(不恢复左键连线、不改 Handle 显隐、不加连接点呼吸动画、不调 connectionMode/panOnDrag/selectionOnDrag;已实测右键连线的起手必须是操作节点 `FlowPanel.tsx:441-459` 的 `clickedNode !== "table-node"`,输入节点不能起手);**② 不做自动连线、不做任何「未连接」提示** —— 多分支是刻意设计,新节点默认自成一条分支(`buildExecutionBranches` 对无入边节点各自成支,执行时直接吃原始输入,与「连线后再跑」等价),故 `App.tsx` 的 `autoConnect=false` 是**特性不是 bug**,不得自动首尾相连、不得给孤立节点加警示徽标、不得加「自动连接新步骤」配置项;**③ 不做首启引导屏/「三扇门」式选择页**(原 §4.7 与原型 04 已删除,入门路径统一由空状态的「看看示例」主卡承担)。UI 原型(独立 HTML,不随文档分发): `docs/design/prototypes/027/01-empty-state.html`、`02-first-step-canvas.html`、`03-execute-feedback.html` |

| `docs/design/028_multi-tab-concurrent-execution.md` | 多标签页并发执行(**P0 + P1 已实现;P2 的 #13 并发上限设置项已实现,#12「全部停止」未做**,2026-09-30;文首实施记录): 诊断「执行是全局单例」的三处根因——前端 `isExecuting` 布尔(`App.tsx:289`,所有标签页一起置灰 `MainMenu.tsx`/命令面板/`Ctrl+R`)、后端 `CANCELLATION_FLAG` 进程级开关(`pipeline.rs`,取消误杀所有运行)、一批全局 UI 状态(`branchProgress`/`showProgressBar`/`logs`/chart)。**已实现**:引入 **`runId`(RunSession)** 贯穿前后端;后端取消标志改 **`HashMap<runId, Arc<AtomicBool>>` 注册表 + `cancel_pipeline(run_id)` + `RunGuard` RAII 注销**(**`set_pipeline_cancelled` 直接删除**,它正是「取消 A 后开 B 会擦掉取消」的 bug 源);前端 `isExecuting` → **`runsByTab`**(含 `finishRun` 的 5s 收尾计时,替代 `progressHideTimerRef`),`setTabs` 写回改 `session.tabId`(不再随切页漂移);进度/结果/图表按 tabId 路由;批处理钩子 `useBatchFilter`/`useBatchConvert` 改**每次调用传 `RunContext`**(不再捕获「当前标签页」);变量/覆盖确认对话框单可见槽 + FIFO 排队(按 runId);运行中切页不取消、关页先 `cancelRun`;完成通知改由每个 run 的状态迁移驱动(带标签页名)。**UI 定稿 §5.6 已实现**:「执行」按钮改为**标签页菜单**(当前标签页置顶 + 小横线分隔、点行即切过去执行、运行中的行只给「分支 x/y」+「取消」、行内不设执行按钮),运行中**不加图标、不改按钮尺寸**(仅 `data-busy` + `.exec-busy::after` 底部进度线,见 `src/index.css`),去掉 `▾`,不做「全部取消」;标签栏运行徽标保留;进度 pill 右侧补「另有 N 个标签页在运行」弱提示。原型 `docs/design/prototypes/028/01-execute-tab-menu.html`。**测试**:后端 181 / 前端 520(新增 `ExecuteMenu` 8 / `ExecutionConcurrency` 2 / `LogPanel` 2 / `SettingsConcurrencyControl` 3 例)。**P1 已实现**:并发上限 **4**(超出 `queued` 排队 + 注册表变化时 drain 补位,`isTabExecuting` 把 queued 算占用中;取消排队中的 run = 摘队列不起进程;S6 确认时 `releaseRun` 交回槽位)、日志 `tabId` 经 **`RunContext.log`** 贯通(runPipeline / executeBranch / 两个批处理钩子,`RunPipelineDeps.addLog` 因此删除)+ 日志面板「仅当前标签页 / 全部」切换与每行徽标、跨标签页同一输出文件的独立覆盖确认(`reason: "crossTab"`)、菜单「排队中」行与标签页名 tooltip。**P2**:#13 并发上限可在设置页改(1~16,`max_concurrent_runs` + `get/set_max_concurrent_runs`);duckdb 溢写目录按 run 隔离(`TempDir` RAII,`SET temp_directory` 指向 `EasyCsv_duckdb_spill_<pid>_<runId>`)。**未做**:#12「全部停止」入口;T5/T6/T7 仍未单独补断言。关键事实: 后端本已能并发(独立 `spawn_blocking` + 子进程,临时文件已用 `EasyCsv_duckdb_{pid}_{counter}` 唯一名),唯一阻碍是取消标志与前端全局态 |

| `docs/design/029_chart-readability.md` | 图表可读性优化(**P0 + P1 已实现,2026-10-01;P2 未做**;文首「实施记录」): 把诉求分三层且**按此优先级排序** —— **P0 正确性**(不画出会撒谎的图)、**P1 可读性**(本次主体)、**P2 增强**(未做)。**已实现(全部)**: ① **chart 分支不再在 JS 里切 CSV** —— 后端新增 `csv::parse_csv_text`(复用 `csv` crate、`flexible(true)`、`CHART_MAX_ROWS=50000`,已注册进 `lib.rs`),`executeBranch` 删除 `text.trim().split("\n")` + `line.split(delimiter)` 的手写解析 → 含逗号的引号字段/引号内换行/`""` 转义都正确,**图表与预览表同源**;② 命令回传 `truncated`/`total_rows`,`TabChartState` 带上截断标记 → 面板琥珀提示 + 日志,不再静默画部分数据;③ `parseNumericCell` 把非数值判为 `null`(不再 `\|\| 0`),顺带让千分位 `1,234` 正确解析,折线 `connectNulls={false}` 断线 + 面板「已跳过 N 行非数值」;④ `xIndex === -1` 改返回 `column_not_found` + 可用列列表,面板渲染错误卡(与「文件没数据」区分开);⑤ 导出前把 `text`/`line` 改为深色,始终输出白底深字的文档配色;⑥ 隐藏系列四图统一为**过滤数据**(删掉 `stroke="transparent"` 占位);⑦ 新增 `chartTypeLine`…`chartTypeHeatmap` 等键,面板标题、直方图轴名、热力图 tooltip、表单标签与类型下拉全部走 i18n(不再漏 `line`/`heatmap`)。**P1 八项也全部实现**: 新建 `src/modules/data-preview/charts/ChartPrimitives.tsx`(`ChartLegend` + `ChartTooltip`)—— **单系列图例也渲染**并标注 `(Y 轴)`,热力图给色阶图例、词云给「字号=出现频次」;排序 `defaultSortFor`(柱/饼/热力图默认降序、折线保持原序 + 三态下拉);`formatNumber`(auto/integer/decimal1/decimal2/percent/compact,轴 `compact` + tooltip 完整千分位,修掉热力图 `12.0`);9 处 recharts tooltip 收敛为共享组件(显式文字色 + 值 + 占比);Y 轴标签回退列名 + 长类目名 `angle=-30`/`preserveStartEnd`;`CATEGORY_COLORS` 按索引分配(隐藏不再换色)、`HEAT_RAMP` 渐变;词云改**阿基米德螺线确定性布局**(无 `Math.random()`,按文字宽高碰撞检测);三类空状态分别给原因与下一步。**P2 未做**: 均值线、数据标签、对数轴、可达性、聚合口径、PNG 导出、拆 `ChartPanel.tsx`。**验证**: `cargo test --lib` 188 通过(新增 7 个 `parse_csv_text` 用例)、`chartReadability.test.ts` 20 通过、`ChartPanelRender.test.tsx` 11 通过(服务端渲染断言)、`tsc` 与 `eslint` 0 error。原型(独立 HTML,不随文档分发): `docs/design/prototypes/029/01-readability.html`(改造前/后并排:排序+图例+数值格式、统一 tooltip、热力图色阶图例、词云稳定布局、明暗配色、图-表切换)、`02-edge-states.html`(六个失败模式:引号列错位、非数值归零、列名不存在、2MB 截断、三种「空」、暗色导出) |

> 设计文档 001–015 已按「序号_主题」命名(见 `docs/design/` 目录),但尚未逐条登记于本表;016–029 已登记。

---

## Rust 后端 (`src-tauri/src/`)

后端按职责拆分为 8 个模块:

| 文件 | 职责 |
|------|------|
| `main.rs` | 二进制入口,注册插件(opener/dialog/fs/shell/window_state/notification/http/prevent_default),系统托盘,窗口事件处理 |
| `lib.rs` | 模块声明 + `invoke_handler()` 函数(注册全部 63 个命令) |
| `config.rs` | `AppConfig` 类型、SQLite 持久化(app_config/ai_config 表)、AES-256-GCM 加密存储 API Key、per-provider API Key 管理、自定义 AI provider 配置(provider=custom 时存 name/base_url/models)、配置相关命令 |
| `xan.rs` | xan.exe 解压与查找、`check_xan_installed` 命令 |
| `pipeline.rs` | `PipelineCommand`/`ExecutionResult` 类型、`execute_xan_pipeline` 核心命令(`input_table` 参数 + 入口分派:全链 duckdb → `run_duckdb_chain` 单进程串联;首步 duckdb + 非 CSV → 原生 `SourceRef` 直读 `pipeline_seq`;否则非 CSV 先 `materialize_input_to_csv` + `TempFiles` RAII 清理)、`pipeline_seq`(`current_input` 为 `SourceRef`;**相邻 duckdb 步骤用 `COPY → tmp.parquet` 交接**,duckdb→xan 边界照旧 CSV)、`build_duckdb_args`(按 `next_is_duckdb` 分派)、`cancel_pipeline(run_id)` 取消**单次运行**(`RUN_FLAGS` 注册表 + `RunGuard`,design 028;每个 run 一个 `Arc<AtomicBool>`,替代已删除的全局 `set_pipeline_cancelled`) |
| `plugin_catalog.rs` | 插件清单(设计 023):取 `catalogUrls` + minisign 验签(**支持多把公钥**,轮换不锁死老版本)、`parse_catalog` 形状校验(插件名/文件名白名单、sha256 格式、平台枚举)、12h 磁盘缓存 + 离线回退标 `stale`、`generatedAt` 防回滚;`is_newer` 用 semver 判可更新;按 `PLATFORM_DIR` 选资产 |
| `plugin_install.rs` | 插件下载安装(设计 023):逐 URL 回退下载(边下边算 sha256、超过清单声明大小即中止)、size + sha256 双校验、`.staging/<name>.part` 同盘 `rename` 原子替换、Unix 置 0o755、写安装记录、`plugin://progress` 进度事件;同插件并发安装用进程内 claim 拦截 |
| `plugins.rs` | 外部 CLI 插件管理: `plugins` 表(plugins.db)持久化、`list_plugins`/`check_plugins` 命令、`command_executable` 按命令名解析可执行文件(插件命令走插件二进制,其余走 xan.exe)。`xan` 与 `pinyin`、`duckdb` 默认注册进插件表,列表按 xan 置顶排序。⚠️ **插件二进制不在仓库里**(`src-tauri/.gitignore` 的 `*.exe` 排除了它们,仓库内只有 `readme.md`),用户在 `<数据目录>/plugins/<平台>/` 手工放置(或装到 `PATH`)。解析顺序: 路径 → `plugins/` 目录(含 `.exe` 补全)→ `PATH`,**插件目录优先于 `PATH`**。插件目录: Windows/Linux 为 `<安装目录>/plugins/<平台>/`(安装目录恒为 `<用户选择路径>/EasyCsv`,AppImage 为 `.AppImage` 所在目录下的 `EasyCsv/`),macOS 为 `~/Library/Application Support/EasyCsv/plugins/<平台>/`。应用内下载见 `docs/design/023_plugin-repository-and-in-app-install.md` |
| `csv.rs` | `CsvData` 类型、`read_csv_file`(自动检测分隔符)/`profile_csv`/`diff_csv_files`/`convert_csv_encoding`/`separate_csv`/`probe_csv_file` 命令;`parse_csv_text`(设计 029)按 CSV 文本解析出 `headers`+`rows`,复用同一个 `csv` crate(引号/内嵌换行/`""` 转义都正确),并回传 `truncated`/`total_rows`,供图表分支取数(替代原先在 JS 里 `split("\n")` 的手写解析)。`read_csv_sync` 为 `pub(crate)`,被 `tabular.rs` 的 `read_tabular_file` 复用(024) |
| `tabular.rs` | 非 CSV 表格输入(024):`InputFormat`(`detect_input_format` 按扩展名判 parquet/duckdb/csv,未知一律 Csv)+ `SourceRef`(Csv/Parquet/Duckdb{path,table})+ SQL 转义(`quote_literal`/`quote_ident`/`path_literal`/`qualified_ident`)+ `list_duckdb_tables`(只读 ATTACH 列表)+ `read_tabular_file`(`TabularData` = CsvData 超集 + `format`/`source_table`;CSV 委托 `read_csv_sync`)+ `materialize_input_to_csv`(xan 只吃 CSV,`-separator` 对齐 default_delimiter)+ **`build_duckdb_chain_sql`**(全链 duckdb 单进程脚本:临时表 + 重定义 `input` 视图 + DROP,返回行号→步骤映射)+ `step_for_line`/`first_error_line`(错误归因)。所有 DuckDB 调用走 `plugins::resolve_plugin_executable("duckdb")` |
| `storage.rs` | 历史记录、最近文件、数据概况缓存、版本/血缘存储、窗口标题、开发者工具命令 |
| `ai.rs` | AI 对话代理: `call_ai` 命令,转发到 DeepSeek / Qwen / GLM |
| `ai_memory.rs` | AI 记忆持久化(SQLite): 对话历史、反馈记录、纠正规则的 CRUD + 清除 |
| `session.rs` | 会话快照持久化(SQLite): 标签页快照 + 选中标签的保存/恢复 |
| `build.rs` | Tauri 构建脚本,生成平台特定代码 |

### 各模块职责详解

#### config.rs — 配置管理

| 内容 | 说明 |
|------|------|
| `AppConfig` 结构体 | `default_delimiter`, `no_headers`, `auto_detect_delimiter`(默认 `true`,打开文件时是否自动检测分隔符), `show_execution_notification`, `minimize_to_tray`, `double_click_fit_view`, `auto_check_update`(默认 `true`,启动后静默检查更新) |
| `load_config()` / `save_config()` | JSON 配置文件读写 |
| `get_resources_dir()` | 资源/数据根目录。**2026-09-27 修订:Windows/Linux 为「exe 所在目录」本身**,即 `EasyCsv.exe` 与 `data/` `plugins/` `templates/` `versions/` 平级 —— 前提是安装器强制安装目录为 `<用户选择路径>\EasyCsv`(`nsis/hooks.nsh`,AppImage 无安装器,用 `.AppImage` 所在目录下的 `EasyCsv/`);**macOS 例外**维持 `~/Library/Application Support/EasyCsv`(写进 `.app` 会破坏代码签名)。安装目录**不可写时回退**集中式 `%LOCALAPPDATA%\EasyCsv` / `~/.local/share/EasyCsv`,不再出现「装到 `Program Files` → `get_db()` 静默失败」。用 `data_local_dir()` 而非 `data_dir()` 是因为 Windows 上 Roaming 会同步 SQLite。结果用 `OnceLock` 记忆。所有 db 数据目录经它派生,插件目录经 `plugins::get_plugin_dir()` 派生。设计:`docs/design/022_github-auto-update-and-admin-free-install.md`(文首「修订」) |
| 数据目录布局与一次性迁移 | 数据目录 = exe 所在目录;**仅在还没有 `data/config.db` 时**才尝试迁移,来源优先级 = 集中式 `%LOCALAPPDATA%\EasyCsv`(有库、不是目标本身、无 `.moved-to-exe-dir` 标记)→ `<数据目录>\EasyCsv_resources` / `<数据目录上一级>\EasyCsv_resources`(0.4/0.5 的两处老位置,**只在无集中式目录时**才作数,否则会读进开发机 `target/<profile>/EasyCsv_resources` 的过期残留)。**复制而非移动**,源目录保留;成功后写 `.in-place-layout`,集中式目录写 `.moved-to-exe-dir`;失败则继续用旧位置、下次重试。判断「已有数据」只看 `data/config.db`(`get_db()` 会立即建库)。⚠️ 复制要跳过「包含目标的那一项」(`would_nest_into_itself()`),且只从源根取目录 —— 否则会递归进自己的输出或把 `EasyCsv.exe` 复制进数据目录 |
| `get/set_default_delimiter` | 默认分隔符配置命令(自动检测关闭时读取文件使用,也是检测失败时的兜底值) |
| `get/set_no_headers` | 无表头配置命令 |
| `get/set_auto_detect_delimiter` | 分隔符自动检测总开关(设置页与输入节点徽标共用同一个值) |
| `get/set_system_notification` | 系统通知配置命令 |
| `get/set_minimize_to_tray` | 最小化到托盘配置命令 |
| `get/set_max_concurrent_runs` | 同时执行的管道数上限(默认 4;落库前 clamp 1~16)。设计:`docs/design/028_multi-tab-concurrent-execution.md` §7.1 |
| `get_ai_config()` / `set_ai_config()` | AI 配置读写(provider、model、baseUrl、providerName、models) |
| `save_api_key()` / `load_api_key()` / `delete_api_key()` / `has_api_key()` | Per-provider API Key 加密存储(AES-256-GCM) |

#### xan.rs — xan 可执行文件管理

| 内容 | 说明 |
|------|------|
| `XAN_EXE_BYTES` | 编译时嵌入的 xan.exe 二进制 |
| `extract_xan_executable()` | 解压 xan.exe 到资源目录 |
| `find_xan_executable()` | 查找可用的 xan.exe |
| `check_xan_installed` | 检查命令 |

#### pipeline.rs — 管道执行(核心)

| 内容 | 说明 |
|------|------|
| `PipelineCommand` / `CommandParameter` | 管道步骤类型定义 |
| `ExecutionResult` | 执行结果类型 |
| `execute_xan_pipeline` | 核心函数: 构建 CLI 参数、单/多命令管道、进程管理、错误处理 |
| `set_pipeline_cancelled` | 设置全局取消标志(AtomicBool),执行中轮询并 kill 子进程 |
| `wait_with_cancel()` | 可取消的进程等待轮询(替代阻塞式 `wait_with_output`) |

#### csv.rs — CSV 操作

| 内容 | 说明 |
|------|------|
| `CsvData` | CSV 数据类型(headers + rows + `delimiter`/`delimiter_source`/`delimiter_confidence`/`columns`) |
| `read_csv_file` | 读取 CSV 文件,返回表头 + 前51行预览。`delimiter` 为 `null`/空串时**自动检测分隔符**(只采样 64 KiB),并回传 `delimiter`/`delimiter_source`/`delimiter_confidence`/`columns`,供输入节点展示与执行复用。设计:`docs/design/018_open-file-delimiter-detection.md` |
| `resolve_read_delimiter` / `read_csv_sync` | 内部分隔符决策(强制 → 检测 → 兜底)与可单测的同步读取体;检测复用 `read_head_sample` + `detect_delimiter_with_fallback`(与 `probe_csv_file` 同源) |
| `profile_csv` | 调用 `xan stats` 生成数据概况统计 |
| `diff_csv_files` | 双文件对比(共享内存 Table + 字符串驻留 + Myers diff,`spawn_blocking` 防阻塞) |
| `convert_csv_encoding` | 编码转换(auto/BOM 检测、UTF-8、GBK、GB18030、UTF-16 LE/BE、Latin-1,64KB 分块流式转码) |
| `separate_csv` | 将 CSV 拆分为 good/bad 两文件(共享 `flexible(true)` reader/writer 重新序列化,坏行不丢失;支持 expected_columns 覆盖 / skiprows / quoting / out_dir / streaming / no_headers)。`streaming=true` 走 `separate_stream` + `separate_csv_to_files` 的 `BufReader`/`BufWriter` 单趟常量内存实现(超大文件),默认 false 为整文件读入内存;`no_headers=true` 视为无表头文件:首行按普通数据行分类、两输出均不写表头行(默认 false,首行作为表头复制进两个输出) |
| `CsvProbe` / `DelimiterCandidate` | 文件探测结果(第一行列数、表头预览、实际分隔符、`source`: detected/forced/fallback、`confidence`、各候选得分) |
| `probe_csv_file` | 探测文件头部:只读 64 KiB,自动检测分隔符(`,` `;` `\t` `\|` `^`,表头权重 60 > 正文一致度 30)并返回第一行列数/表头预览;`delimiter=None` 检测、`Some` 强制;检测不出时用 `fallback_delimiter` 且 `confidence="none"` |

#### storage.rs — 持久化存储

| 内容 | 说明 |
|------|------|
| `save_recent_files` / `load_recent_files` | 最近文件列表 |
| `load_profile_cache` / `save_profile_cache` | 数据概况缓存(LRU 淘汰,上限50条) |
| `save_pipeline_versions` / `load_pipeline_versions` | 管道版本持久化 |
| `save_lineage_data` / `load_lineage_data` | 数据血缘持久化 |
| `save_execution_history` / `load_execution_history` / `clear_execution_history` | 执行历史持久化(SQLite `execution_history` 表,只存统计摘要,LRU 保留最近100条) |
| `file_exists` | 文件存在性检查 |
| `reveal_paths` | 在系统文件管理器中定位一个或多个路径(过滤已不存在的路径后交给 `tauri_plugin_opener::reveal_items_in_dir`;**需 capability `opener:default`**,缺失会静默失败并把路径当错误文案弹出) |
| `set_window_title` | 设置窗口标题 |
| `toggle_devtools` | 切换开发者工具 |

#### session.rs — 会话持久化 (SQLite)

| 内容 | 说明 |
|------|------|
| `tab_snapshots` 表 | 标签页快照(tab_id, snapshot, updated_time),每次保存先清空再写入 |
| `session_meta` 表 | 会话元数据(selected_tab_id、panel_states 面板停靠状态) |
| `save_session` | 序列化全部标签页快照 + 选中标签 ID + 面板停靠状态 |
| `load_session` | 恢复标签页快照列表 + 选中标签 ID + 面板停靠状态 |

#### ai.rs — AI 对话代理

| 内容 | 说明 |
|------|------|
| `call_ai` | 核心命令,按 provider 路由到 DeepSeek/Qwen/GLM 或自定义 base URL |
| `call_deepseek` / `call_qwen` / `call_glm` | OpenAI 兼容 Chat Completions 调用(已统一为 `call_openai_compatible`,内置 provider 使用默认 URL,自定义 provider 使用请求中的 base_url) |

#### ai_memory.rs — AI 记忆持久化 (SQLite)

| 内容 | 说明 |
|------|------|
| `ai_conversations` 表 | 对话历史(session_id, role, content) |
| `ai_feedback` 表 | 反馈记录(user_query, ai_response, feedback_type, correction) |
| `ai_corrections` 表 | 纠正规则(pattern, wrong_command, correct_command) |
| `save_conversation` / `load_conversation_history` | 对话历史读写 |
| `save_feedback` | 保存用户反馈(自动清理旧数据,保留最近1000条) |
| `load_feedback_rules` | 从反馈中提取纠正规则 |
| `save_correction` | 保存纠正规则 |
| `clear_conversations` / `clear_feedback` / `clear_corrections` | 清除对应表全部数据 |

### Tauri 命令清单(前端可调用,共 63 个)

| 命令 | 模块 | 功能 |
|------|------|------|
| `read_csv_file` | csv | 读取 CSV 文件,返回表头 + 前51行预览;`delimiter` 为空时自动检测分隔符并回传来源/置信度/列数。设计:`docs/design/018_open-file-delimiter-detection.md` |
| `read_tabular_file` | tabular | 按 `TabularData`(`CsvData` 超集 + `format`/`source_table`)读取任意表格输入(024):CSV 委托 `read_csv_file` 同源逻辑;`.parquet`/`.duckdb` 经 DuckDB CLI `SELECT * … LIMIT` 有界预览,`.duckdb` 需传选中表。设计:`docs/design/024_parquet-duckdb-file-reading.md` |
| `list_duckdb_tables` | tabular | 列出 `.duckdb` 文件的用户表/视图(只读 `ATTACH` + information_schema),供打开时的选表对话框;0 张表报错、1 张自动选中、多张弹 `DuckdbTableDialog`。设计:`docs/design/024_parquet-duckdb-file-reading.md` |
| `execute_xan_pipeline` | pipeline | 执行多步骤 xan 管道(核心命令);`inputTable` 携带 `.duckdb` 输入选中的表。024 分派见 `pipeline.rs` 模块行 |
| `cancel_pipeline` | pipeline | **取消指定的那一次运行**(design 028):`RUN_FLAGS: HashMap<runId, Arc<AtomicBool>>` 注册表 + `RunGuard` RAII 注销,取消只作用于本 runId,不再误杀其它标签页。**取代了已删除的全局 `set_pipeline_cancelled`** |
| `profile_csv` | csv | 调用 `xan stats` 生成数据概况统计 |
| `diff_csv_files` | csv | 对比两个 CSV 文件(Myers diff,分页返回) |
| `convert_csv_encoding` | csv | 转换 CSV 文件编码(64KB 流式转码),返回输出路径/读写字节数/后端耗时 |
| `separate_csv` | 将 CSV 拆分为 good/bad 两文件(共享 `flexible(true)` reader/writer 重新序列化,坏行不丢失;后续连续坏行会连同前一合法行一并进 bad;支持 expected_columns 覆盖 / skiprows / quoting / out_dir / streaming / no_headers;核心为泛型 `separate_stream`,默认内存路径与 `streaming` 流式路径共用同一逻辑)。设计:`docs/design/016_separate-good-bad-rows.md` |
| `split_lines` | 按**原始行**把文本文件切成 `{stem}_part{N}{ext}`(N 从 1、保留输入扩展名;不解析 CSV、不涉及分隔符,`read_until(b'\n')` 字节保真 + 常量内存,可处理超大文件);返回 `SplitLinesResult`(output_dir/output_paths/file_count/lines_per_file/total_rows/header_written/elapsed_ms);`no_headers=true` 时首行按数据行、输出不写表头,默认首行作为表头复制进每一份。核心 `split_lines_stream`(泛型 writer 工厂)、`split_lines_to_files`、`split_part_path`/`split_lines_target`。设计:`docs/design/021_split-lines-by-line-count.md` |
| `scan_excel_sources` | excel_merge | 扫描来源(文件/目录混选、递归可选、扩展名过滤): 列出工作簿 + 各自 sheet 名(`from --list-sheets`)+ sheet 名并集 + warnings;只扫描不转换 |
| `merge_excel_sources` | excel_merge | Excel 多文件合并(设计 025): 逐 sheet `xan from` 转临时 CSV(需要来源列时用 csv crate 自建首列,绕开 `--source-column` 在 `-U` 下静默消失)→ 写前预检(`plan_alignment` + `union_summary`)→ `cat rows [-U\|-I] --paths` 流式拼接 → `to xlsx`/`fmt` 原子落盘;单线程,峰值内存 = max(单个 sheet) |
| `read_excel_header` | excel_merge | 取某工作簿某 sheet 的表头行(对话框列名按需展开用);`sheet_to_csv` + 首行解析,空 sheet 返回空数组 |
| `probe_csv_file` | csv | 探测文件头部(64 KiB):自动检测分隔符 + 返回第一行列数与表头预览,供拆分对话框显示文件信息。设计:`docs/design/017_separate-dialog-ux.md` |
| `parse_csv_text` | csv | 把 CSV **文本**解析为 `headers`+`rows`(设计 029 §3.1):`flexible(true)`、`has_headers` 可选(无表头时合成 `column_N`)、上限 `CHART_MAX_ROWS=50000` 并回传 `truncated`/`total_rows`。图表分支用它替代前端手写 `split`,使图表与预览表同源 |
| `load_profile_cache` / `save_profile_cache` | storage | 数据概况缓存(基于文件 mtime,LRU 淘汰,上限50条) |
| `check_xan_installed` | xan | 检查 xan.exe 是否已解压 |
| `get/set_default_delimiter` | config | 读写默认分隔符配置(检测关闭时使用 / 检测失败时兜底) |
| `get/set_no_headers` | config | 读写无表头配置 |
| `get/set_auto_detect_delimiter` | config | 读写分隔符自动检测总开关。设计:`docs/design/018_open-file-delimiter-detection.md` |
| `get/set_system_notification` | config | 读写系统通知配置 |
| `get/set_minimize_to_tray` | config | 读写最小化到托盘配置 |
| `get/set_ai_config` | config | 读写 AI 配置(provider/model/baseUrl/providerName/models) |
| `save/load/delete/has_api_key` | config | Per-provider API Key 加密存储(AES-256-GCM) |
| `save_session` / `load_session` | session | 会话快照保存/恢复(标签页 + 选中标签 + 面板停靠状态 panel_states) |
| `call_ai` | ai | 调用 AI 大模型代理(DeepSeek/Qwen/GLM) |
| `save_conversation` | ai_memory | 保存对话历史 |
| `load_conversation_history` | ai_memory | 加载对话历史 |
| `save_feedback` | ai_memory | 保存用户反馈 |
| `load_feedback_rules` | ai_memory | 加载纠正规则 |
| `save_correction` | ai_memory | 保存纠正规则 |
| `clear_conversations` | ai_memory | 清除全部对话历史 |
| `clear_feedback` | ai_memory | 清除全部反馈记录 |
| `clear_corrections` | ai_memory | 清除全部纠正规则 |
| `set_window_title` | storage | 设置窗口标题 |
| `save_recent_files` / `load_recent_files` | storage | 最近文件列表持久化 |
| `save_pipeline_versions` / `load_pipeline_versions` | storage | 管道版本持久化 |
| `save_lineage_data` / `load_lineage_data` | storage | 数据血缘持久化 |
| `save_execution_history` / `load_execution_history` / `clear_execution_history` | storage | 执行历史持久化(SQLite,只存摘要,LRU 100条) |
| `file_exists` | storage | 检查文件是否存在 |
| `reveal_paths` | storage | 在系统文件管理器中定位路径(拆分结果「打开路径」按钮用) |
| `toggle_devtools` | storage | 切换开发者工具面板 |
| `plugins::list_plugins` | plugins | 列出已注册的 CLI 插件 |
| `plugins::check_plugins` | plugins | 检查插件可执行文件是否可用(PATH + 读取 `--version`);版本参数现取自缓存清单(新增插件无需改代码) |
| `plugin_catalog::get_plugin_catalog` | plugin_catalog | 取插件清单:验签 → 12h 缓存 → 离线回退旧缓存 → 拒绝回滚;返回各插件在本平台的可用性/大小/已装版本/可更新状态。设计:`docs/design/023_plugin-repository-and-in-app-install.md` |
| `plugin_install::install_plugin` | plugin_install | 下载插件并原子落盘到 `<数据目录>/plugins/<平台>/`:逐 URL 回退、边下边算 sha256、size+sha256 双校验通过才 rename;进度走 `plugin://progress` 事件 |
| `plugin_install::uninstall_plugin` | plugin_install | 删除本应用安装的插件二进制(解析到 PATH 或手工放置的会拒绝删除并说明原因) |
| `get_install_form` | update | 返回运行形态(`InstallForm`)与 `can_self_update`:按 `current_exe()` 路径与 `APPIMAGE` 环境变量判定,用于对 deb / `/Applications` 下的安装**禁用一键更新**。设计:`docs/design/022_github-auto-update-and-admin-free-install.md` |
| `get/set_auto_check_update` | config | 启动后静默检查更新的总开关(默认开;只提示,不自动安装)。设计:`docs/design/022_github-auto-update-and-admin-free-install.md` |
| `get/set_max_concurrent_runs` | config | 同时执行的管道数上限(`max_concurrent_runs`,默认 4,落库前 clamp 1~16),超出排队。设计:`docs/design/028_multi-tab-concurrent-execution.md` §7.1 |

---

## 测试基础设施

项目使用 **vitest 4.x** + **jsdom** + **@testing-library/jest-dom** 进行前端单元测试。

| 文件 | 职责 |
|------|------|
| `vitest.config.ts` | vitest 配置: jsdom 环境、`@/` 别名、`src/test/setup.ts` 作为 setup、**`test.env` 钉住 `NODE_ENV=test`**(见下方「React.act 陷阱」) |
| `src/test/setup.ts` | Mock 全局 API: `@tauri-apps/api/core` (invoke)、`@tauri-apps/plugin-dialog`、`@tauri-apps/plugin-fs`、localStorage、matchMedia、scrollIntoView、**`ResizeObserver` 桩**(jsdom 没有,图表面板等挂载时要用);开头有**守卫**:React 若解析到 production 构建(无 `React.act`)立即抛出可执行报错 |

运行测试: `pnpm test`

### ⚠️ React.act 陷阱(2026-10-01 已修复)

**症状**:大量渲染类用例同时失败,统一报 `TypeError: React.act is not a function`。

**根因**:`@testing-library/react` 依赖 `React.act`,而它**只存在于 React 的开发构建**。当 shell/profile 已导出 `NODE_ENV=production` 时,React 解析到 production 构建,`React.act` 为 `undefined` → 每个基于 `render()` 的用例都炸。

**修复**:`vitest.config.ts` 的 `test.env` 声明 `NODE_ENV: "test"`,使 `pnpm test` 在任何 shell 下行为一致;`src/test/setup.ts` 另加守卫,把同类回归变成一条可执行的报错,而不是几百条相同的失败。

**排查命令**(确认是否被该问题影响):

```bash
NODE_ENV=production node -e "console.log(typeof require('react').act)"  # undefined = 命中该陷阱
NODE_ENV=test       node -e "console.log(typeof require('react').act)"  # function  = 正常
```

**注意**:CI workflow 未设 `NODE_ENV`,本身不受影响;该问题只在**本地 shell 已导出 `NODE_ENV=production`** 时出现(此前记录为 84 个用例失败,修复前已扩大到 205 个)。

### 测试文件 (`src/__tests__/`)

| 文件 | 职责 | 测试数 |
|------|------|--------|
| `commands.test.ts` | **核心测试**: 覆盖全部 59 个 xan 命令的参数构建正确性(命令名、参数名、值、isPositional、默认值) | ~76 |
| `invoke.test.ts` | App.tsx 中所有 invoke 调用模式验证(read_csv_file、read_tabular_file、配置读写、历史记录、错误处理、历史重建) | ~21 |
| `BatchFilterHooks.test.ts` | Batch Filter 执行逻辑: 文件名清理、正则构建、文本/数值筛选 invoke 形状、频率提取、多值批处理 | ~31 |
| `BatchConvertHooks.test.ts` | 批量格式转换: globToRegex、getBaseName、getOutputDir、CSV↔XLSX↔JSON 转换 invoke 模式 | ~37 |
| `CommandPalette.test.tsx` | 命令面板: 搜索过滤、键盘导航、选中执行、Esc 关闭 | ~11 |
| `CsvEncodingDialog.test.tsx` | 编码转换对话框: 编码选择、invoke 形状、结果摘要 | ~5 |
| `HelpDialog.test.tsx` | 帮助对话框搜索与打开 | ~2 |
| `HelpMarkdown.test.tsx` | 自定义 Markdown 渲染器 | ~3 |
| `layout.test.ts` | 连线布局工具: `resolveHandles` 四方向选择、`handleAnchor`/`getEdgeEndpoints`、`pickStartHandle`、`buildConnectPreviewPath`(贝塞尔预览)、`transformBezierPath` | ~27 |
| `useTabsDelimiter.test.ts` | 打开文件的分隔符解析(设计 018)+ 表格格式分派(设计 024): 018 的自动检测开关/模式重读/一次性覆盖/非 CSV 不读;024 的 parquet 无分隔符簿记、非 CSV 不随分隔符重读、duckdb 单表自动选/非 main schema 限定名/多表回调/取消打开/空库报错/**打开失败经 `onOpenError` 可见**(缺插件、parquet 读取失败;用户取消不算错误) | 15 |
| `fileFormat.test.ts` | `detectTabularFormat` 扩展名识别(大小写、`.db` 别名、未知 → null)、`isCsvFile`、`duckdbTableName`(设计 024) | 6 |
| `delimiterMode.test.ts` | 分隔符单一状态的换算(设计 018 §3.9): 设置 ⇄ 界面值、六种模式往返一致(锁住设置页与输入节点不漂移) | 6 |
| `SettingsDelimiterControl.test.tsx` | 设置页分隔符控件(设计 018 §3.9): auto/锁定两种显示、6 个选项与顺序、选择回调、「恢复默认」复位为 auto | 6 |
| `initialParams.test.ts` | 命令入口预填参数纯函数 `buildCommandInitialParams`(设计 019 §3.1): 各画布入口(筛选/排序/文本/数值/切割/补位/替换/日期)与旧对话框默认输出一致、无列时不猜 | 28 |
| `csv.test.ts` | CSV 工具函数 |  |
| `versionDiff.test.ts` | 版本差异计算 |  |
| `chartReadability.test.ts` | 图表可读性纯函数(设计 029): `parseNumericCell` 区分「缺失」与真 0、千分位解析、`processChartDataWithIssues` 三类 issue(列不存在/无数据/无可用数值)、null 不归零、`defaultSortFor` 与三态排序、饼图重复类目聚合、`colorForIndex` 颜色稳定、`formatNumber` 各模式与 em dash | 20 |
| `ChartPanelRender.test.tsx` | 图表面板渲染(设计 029): 单系列也出 Y 轴图例、图表类型显示中文而非 `heatmap` 原始 id、缺列渲染错误卡并列出可用列、数据表视图入口、跳行/截断提示、词云字号说明、热力图色阶图例与整数单元格;数据表用 `ScrollArea`(断言 Radix viewport + 两向 `overflow:scroll` + sticky 表头);**「actually draws a chart」用例组** —— 5 种 recharts 图各断言 `.recharts-surface`/`.recharts-wrapper` 存在,专防「图例在、图没了」这类回归(见 029 修复记录);**「图例单行滚动 + 分类筛选」用例组**(多分类图例不折行、`筛选 n/m` 计数、取消全选→提示并保留筛选入口、全选→恢复、复选框与图例同步);另含 `ChartLegend`/`ChartTooltip` 单测 | 27 |
| `SampleFileChart.test.tsx` | 内置示例文件端到端(设计 029): 以 `src-tauri/samples/easy-csv-sample-sales.csv`(经 Vite `?raw` 导入)驱动真实塑形 + 渲染,断言中文表头(`日期,地区,品类,金额,数量`)、219 行、`地区 vs 金额` 成单系列且 `droppedRows=4`(该文件 4 行金额为空)、渲染出 `.recharts-wrapper`/`.recharts-surface` 且有柱体、7 种图不崩;即用户报障「x=地区/y=金额 无图像」的回归防线 | 4 |
| `executionHistory.test.ts` | 执行历史持久化 |  |
| `panelDock.test.ts` | 面板停靠状态 |  |
| `params.test.ts` | 参数构造工具 |  |
| `separateHistory.test.ts` | 拆分结果 localStorage |  |
| `SeparateCSVDialog.test.tsx` | 拆分好/坏行对话框(设计 016/017): 流式/无表头选项、探测、上次结果、打开路径 |  |
| `splitLinesHistory.test.ts` | 按行拆分结果 localStorage(设计 021): 往返、坏 JSON / 缺选项字段 / 类型不符、超长跳过、清除 | 6 |
| `SplitLinesDialog.test.tsx` | 按行拆分对话框(设计 021): 行数/无表头/输出目录选项、校验拦截、上次记录回填与展示、打开路径、目录失效 | 9 |
| `excelMergeHistory.test.ts` | Excel 合并结果 localStorage(设计 025): 往返、坏 JSON / 缺选项字段 / 类型不符 / 未知枚举值 / 摘要结构错误、超长跳过、清除 | 9 |
| `MergeExcelDialog.test.tsx` | Excel 合并对话框(设计 025): 默认 payload(union/first/无 sheetIndex)、三模式互斥与按需渲染、名称留空拦截、扫描预览且不预取列名、按需展开、严格报错透传、并集加宽提示、xlsx 单 sheet 提示、打开路径、输出失效 | 12 |
| `UpdateDialog.test.tsx` | 更新对话框: 进度条落在标题栏(不在可滚动正文里)、字节数展示、未安装时无进度、安装中 Esc 与遮罩点击均不关闭 | 6 |
| `ExecuteMenu.test.tsx` | 「执行」标签页菜单(设计 028 §5.6 / §9.2 T9+T10): 两种状态下按钮 DOM 结构一致(不加图标,只有 `data-busy`)、当前标签页置顶 + 其后紧跟小横线、切换当前标签页后重排、运行中的行只有「取消」+ 分支进度且点行仅切换、排队中的行同理、空闲行点整行 = `onRunTab`、`待确认` 行不给执行入口;另含**检查更新期间「帮助」按钮的进行中反馈**(设计 022 §5.4:`data-checking` + `.update-busy`、**检查中仍可点击且不置灰**、菜单三行入口仍在(查看示例 + 帮助中心 + 检查更新)、空闲时不带该标记、且不占用执行按钮的 `data-busy`),以及**工具栏「设置」入口**(图标化 + `aria-label`、位于右侧按钮组末尾即 AI 右侧、点击调 `onShowSettings`、**对话框打开期间高亮 + 与三个面板开关完全相同的小横线**、关闭时不渲染横线、`aria-expanded`) | 19 |
| `ExecutionConcurrency.test.tsx` | 并发上限(设计 028 §7.1,上限 4): 第 5 个标签页进入 `queued` 而不是起第 5 条进程链、`runPipeline` 只被调 4 次;`queued` 也算「占用中」;取消排队中的 run 直接从队列摘除、不起后端进程(mock `runPipeline` 永不 settle) | 2 |
| `LogPanel.test.tsx` | 日志按标签页(设计 028 §5.4): 每行带标签页徽标、默认全部可见、「仅当前标签页」只留该标签页的行(无标签的 app 级日志一并隐藏)、切回「全部」恢复、未选标签页时不过滤 | 2 |
| `SettingsConcurrencyControl.test.tsx` | 设置页并发上限(设计 028 §7.1): 回显存储值(含 min/max)、编辑后上报新值、越界输入就地 clamp(99→16、0→1) | 3 |

> 全量以 `pnpm test` 为准(当前 42 个文件)。`check:index`(`pnpm check:index`)会校验本文件登记的路径真实存在。

---

## React 前端 (`src/`)

> **019 重构后**目录按「业务模块 `modules/` / 通用件 `components/`」分层;业务代码进 `src/modules/<功能域>/`,零业务语义的基础件留在 `src/components/ui/`,跨域共享类型放 `src/types/`。
> 行数标注已移除(易漂移,见 019 §4.4);**结构快照:2026-09-20**。验证命令:`pnpm typecheck` / `pnpm lint` / `pnpm test`。

### 业务模块总览 (`modules/`)

| 目录 | 职责 |
|------|------|
| `modules/pipeline/` | 管道画布域: `FlowPanel`、`nodes/`、`overlays/`、`hooks/`、`lib/`(布局/切割几何)、`panels/`(版本控制/血缘) |
| `modules/data-preview/` | 数据查看域: `HomeView`(主工作区)、`DataProfilePanel`、`charts/ChartPanel` |
| `modules/dialogs/` | 对话框域,四分: `command/`(统一命令入口 + 61 个表单)、`file/`、`app/`、`common/` |
| `modules/ai/` | AI 助手面板 |
| `modules/variables/` | 变量管理面板 |
| `modules/logs/` | 日志面板、命令列表、全局命令面板 |
| `modules/plugins/` | 插件管理域(设计 023): `PluginManager`(设置页页签)、`PluginRow`(单条:状态/版本/来源/下载/更新/卸载/进度/取消)、`PluginSetupDialog`(启动引导缺 xan)、`DownloadPrefixSetting`(下载加速前缀输入框) |

### 入口与全局

| 文件 | 职责 |
|------|------|
| `main.tsx` | 应用入口,包裹 ThemeProvider 和 LanguageProvider |
| `App.tsx` | **根组件**,管理所有状态: 标签页、管道、撤销/重做、日志、配置、历史记录、更新检查、拖拽打开、数据概况、历史记录上限、AI 面板、版本控制、数据血缘、会话恢复、命令面板、CSV 对比/编码转换 |
| `index.css` | 全局 CSS,定义亮色/暗色主题变量、动画关键帧 |

### 数据与类型 (`data/` · `types/` · `utils/`)

| 文件 | 职责 |
|------|------|
| `data/commands/index.ts` | **聚合出口** `xanCommands`(61 个命令)+ `commandCategories`;13 个分类文件(`explore`/`searchFilter`/`sortDedup`/`aggregate`/`combine`/`transform`/`format`/`transposePivot`/`partition`/`generate`/`scripting`/`custom`/`plugins`)按 019 §4.5 拆出,`commands.test.ts` 经此出口覆盖全部命令 |
| `data/functions.ts` | xan 表达式函数定义(200+),含分类、关键字、运算符,供表达式编辑器补全和高亮使用 |
| `types/xan.ts` | 核心类型: `XanCommand`, `XanParameter`, `PipelineStep`, `PipelineEdge`, `LogEntry`, `PipelineTab`, `PipelineVersion`, `DelimiterSource`, `DelimiterMode`, `CsvReadResult`, `ChartType`, `ChartConfig`, **`BatchFilterConfig` 及其运算符类型**(019 §1.7 从被删的 BatchFilterDialog 迁入) |
| `types/dialog.ts` | **对话框共享类型**(019 §3.2 下沉,解除 `CommandDialog` ⇄ `commands/` 循环依赖): `CommandDialogType`(61 个命令联合类型)、`CommandDialogState`、`CommandFormProps`、`COMMAND_LABELS`;以及画布入口上下文 `CommandEntryContext` 与 `TextTransformKind`/`NumberTransformKind`/`SliceKind`/`PadKind`/`MapScaffold` |
| `generated/help-docs.ts` | 自动生成的命令帮助文档(中英文),由 `scripts/generate-help-docs.js` 生成,**禁止手改** |
| `utils/delimiterMode.ts` | 分隔符单一状态的两个换算: `delimiterModeFromSettings(autoDetect, delimiter)`(设置 → 界面值)与 `settingsPatchForMode(mode)`(界面值 → 要落库的设置) |
| `utils/fileFormat.ts` | 表格输入格式的唯一真相(024): `detectTabularFormat`(csv/parquet/duckdb,未知 → null)、`isCsvFile`、`duckdbTableName`(非 main schema 补限定名)、`listDuckdbTables`(invoke `list_duckdb_tables`) |
| `utils/session.ts` | 会话快照序列化: `stripStepCommand`/`reconstructStep`/`serializeTabSnapshot`/`deserializeTabSnapshot` |
| `utils/format.ts` | `formatDateTime` / `formatElapsed` / `formatBytes`(后两者由 020、022 从业务文件上提复用) |
| `utils/params.ts` · `utils/platform.ts` · `utils/separateHistory.ts` · `utils/executionHistory.ts` · `utils/versionDiff.ts` · `utils/panelDock.ts` · `utils/csv.ts` | 其余纯函数工具(参数构造、平台判断、拆分结果/执行历史持久化、版本差异、面板停靠、CSV 工具) |

### 服务层 (`services/`)

**`services/update/index.ts`** — 自动更新(设计 `docs/design/022_github-auto-update-and-admin-free-install.md`)。唯一直接 import `@tauri-apps/plugin-updater` / `plugin-process` 的地方:

| 导出 | 职责 |
|------|------|
| `checkForUpdate()` | 调官方 `check({ timeout: 30_000 })`,返回 `UpdateSession`(`available` / `version` / `currentVersion` / `notes` / `date` / `update` 句柄);无更新不是错误 |
| `installUpdate(session, onProgress)` | 下载并安装,把插件事件归一成 `UpdateProgress`(started / downloading / installing) |
| `getInstallForm()` | 调后端 `get_install_form`,拿到运行形态与 `canSelfUpdate` |
| `relaunchApp()` | 安装后重启(`plugin-process` 的 `relaunch`) |
| `RELEASES_PAGE_URL` | 手动下载兜底页地址 |

更新源固定为 GitHub Releases(端点在 `tauri.conf.json` 的 `plugins.updater.endpoints`),**不做渠道切换**。

**`services/plugins/index.ts`** — 插件清单与应用内安装(设计 `docs/design/023_plugin-repository-and-in-app-install.md`)。唯一直接 invoke 插件命令、唯一订阅 `plugin://progress` 的地方:

| 导出 | 职责 |
|------|------|
| `getPluginCatalog(refresh?)` | 调后端 `get_plugin_catalog`,返回 `CatalogView`(`entries` / `plugin_dir` / `platform` / `stale`);离线时后端给缓存并置 `stale` |
| `installPlugin(name)` · `uninstallPlugin(name)` | 下载安装 / 卸载,返回卸载后的 `PluginStatus` |
| `cancelPluginInstall(name)` · `isInstallCancelled(error)` | 请后端停止下载(后端逐 chunk 检查);后者判断失败是否为用户取消而非真故障 |
| `getPluginDownloadPrefix()` · `setPluginDownloadPrefix(prefix)` | 读取/保存「下载加速前缀」(传 `null` 即清除);后端校验必须是 `https://` |
| `checkPlugins()` · `listPlugins()` | 探测可执行文件是否可用 / 只列注册表(不启动子进程) |
| `isXanInstalled()` | `check_xan_installed`,用于启动引导 |
| `onPluginProgress(handler)` | 订阅 `plugin://progress`,事件按插件名路由到各自行;`phase` 有 `downloading`/`verifying`/`done`/`cancelled`/`failed` |
| `revealPaths(paths)` | `reveal_paths`,打开插件目录或定位二进制 |
| `describePluginError(error)` | 归一化 `invoke` 的拒绝(`Err(String)` / `Error` / 其他),避免渲染 `[object Object]` |
| `progressPercent(progress)` | 进度百分比(总长未知时返回 `null`) |

⚠️ `CatalogEntry` / `CatalogView` 的字段名是 **snake_case**(`latest_version` / `installed_path` / `update_available` / `fetched_at` / `plugin_dir`)—— Rust 侧 derive `Serialize` 未加 `rename`,写成 camelCase 会编译通过但运行时读到 `undefined`。

AI 助手前端逻辑,RAG 检索与提示词构建(`services/ai/`):

| 文件 | 职责 |
|------|------|
| `services/ai/index.ts` | `sendAIMessage()` 入口: 校验 API Key、加载纠正规则、澄清检测、构建消息、调用 `callAI`; 对话历史/反馈/纠正规则 CRUD; Per-provider API Key 管理 |
| `services/ai/context.ts` | **提示词工程核心**: 意图路由(含同义词)、命令索引、RAG 检索、模糊匹配、纠正规则加权、意图澄清检测、对话历史上下文注入 |
| `services/ai/api.ts` | `callAI()` 各 provider 调用 + `parseJSONBlock()` 多行编号JSON解析器 |
| `services/ai/types.ts` | `AIConfig`/`AIMessage`/`AIResponse`/`AICommand`/`AIFeedback`/`CorrectionRule` 类型 + provider/模型常量 |

### Hooks (`hooks/`)

跨功能域共享的 hook,统一 `useXxx` 命名(019 §5.1):

| 文件 | 职责 |
|------|------|
| `usePipelineTabs.ts` | 原 `MainMenuHooks.ts`(019 §4.2 已拆分删除)的标签页/管道状态助手: getCurrentTab、getCurrentPipeline、resolveRunDelimiter、updateTabPipeline、addNewTab |
| `hooks/execution/` | 执行引擎(design 028 起按**执行会话**隔离): `useExecution`(**`runsByTab` 注册表**:`runTab` / `cancelRun(tabId)` / `handleTabClosed` / 按 runId 的对话框 FIFO 排队 + `finishRun` 的 5s 收尾计时 + **并发上限 4**(`MAX_CONCURRENT_RUNS`,超出进 `queued`,`activeRunsRef`/`runQueueRef` + drain effect 补位))+ `runPipeline` / `executeBranch`(依赖显式注入,**一律经 `RunContext`(runId + tabId + inputFile + delimiter + isCancelled + log)寻址,不再读「当前标签页」**)+ `buildBranches` / `buildPrefixToStep` / `serializeStepParams` / `resolveDelimiter` 纯函数(+`buildBranches.test.ts`)。设计: `docs/design/028_multi-tab-concurrent-execution.md` |
| `hooks/fileIO/` | `useFileOpen`/`useFileSave`/`useImportExport` + `pipelineScript.ts`(.sh/.ps1 内容纯函数生成) |
| `hooks/charts/processChartData.ts` | 图表数据后处理纯函数 |
| `useSession.ts` | 会话持久化: 启动恢复标签页、防抖自动保存(800ms)、beforeunload 兜底保存;导出 `flushSession()`(跳过防抖,更新安装前调用) |
| `useTabs.ts` | 标签页管理: 标签增删改、当前标签、管道状态读写、**文件读取的格式分派**: `loadCsvData(tabId, path, forcedDelimiter?)` 经 `read_tabular_file` 统一读 CSV/parquet/duckdb(024),分隔符簿记与重读 effect 仅限 CSV;`.duckdb` 走 `list_duckdb_tables` → 单表自动选 / 多表经注入式 `requestTableSelection` 回调弹 `DuckdbTableDialog`。设计: `docs/design/018_open-file-delimiter-detection.md` + `docs/design/024_parquet-duckdb-file-reading.md` |
| `usePipelineState.ts` | 管道状态: `updateTabPipeline` 单点更新管道+edges,撤销/重做状态管理 |
| `usePipelineVersions.ts` | 管道版本控制: 保存/恢复/删除版本、标签管理、步骤序列化与重建 |
| `usePipelineTemplates.ts` | 管道模板库(F4) |
| `useDataLineage.ts` | 数据血缘: 列类型推断、变换分析、血缘图数据构建与持久化 |
| `useExecutionHistory.ts` | 执行历史(F6) |
| `useUpdater.ts` | 自动更新状态机: 静默/交互检查、下载进度、安装交接(`beforeInstall` 先落盘会话)、错误态;对话框可见性留在调用方(静默检查不得自己弹窗)。设计: `docs/design/022_github-auto-update-and-admin-free-install.md` |
| `usePluginCatalog.ts` | 插件清单状态: 加载/强制刷新、按插件名路由的安装进度、失败回读权威清单;另导出 `useRequiredPluginCheck`(启动延迟 1.2s 探测 xan,只对"确定缺失"返回 true)。设计: `docs/design/023_plugin-repository-and-in-app-install.md` |
| `useAppSettings.ts` | 应用配置: 分隔符、无表头、通知、历史上限、托盘设置 |
| `useCsvProbe.ts` | 拆分对话框的文件探测(防抖 + 过期响应丢弃) |
| `useOnboarding.ts` | 首次使用引导状态(027): localStorage `easy-csv-onboarding-v1` 单个标记 + 复位;读写均 try/catch 降级(存储不可用时视为「已看过」,避免每次打开都弹)。另导出 `useAutoDismissOnboarding`(用户自己加了第一个步骤即标记已看过) |
| `useToast.ts` | Toast 通知;`showToast(msg, type, { action, duration })` 支持可选的**动作按钮**(027 §4.3 完成提示的「查看结果」) |
| `useLogs.ts` | 执行日志(design 028): `addLog(type, message, tabId?)` —— 每行标记来源标签页,供日志面板按标签页过滤 |
| `useUIState.ts` | UI 状态: 对话框/面板开关(含命令面板、CSV 对比、编码转换) |
| `useBatchFilter.ts` | Batch Filter 执行逻辑(原 `BatchFilterHooks.ts`,019 §5.1 改名): 文件名清理、正则构建、批量筛选执行 |
| `useBatchConvert.ts` | 批量格式转换(原 `BatchConvertHooks.ts`): globToRegex、getBaseName、CSV↔XLSX↔JSON 转换 invoke 调用 |
| `useKeyboardShortcuts.ts` | 全局快捷键(原 `KeyboardShortcuts.ts`): Ctrl+K、Ctrl+D、Ctrl+O/N/S/I/E/Z/Y/R、Alt+C/Q/D/A、Shift+H/C/S |
| `useDraggable.ts` | 通用拖拽 hook — **019 §3.1 后已无引用,待删除** |

### 国际化 (`i18n/`)

| 文件 | 职责 |
|------|------|
| `i18n/index.tsx` | 语言上下文 Provider,持久化到 localStorage |
| `i18n/translations/types.ts` | `Language`/`EffectiveLanguage`/`Translations` 接口(**807 key** 的类型契约,2026-10-01 实测(`Object.keys(translations.zh|en)` 各 807,两语言数量一致);最近新增的是图表可读性(029)的类型名/图例/排序/数值格式/空状态文案) |
| `i18n/translations/{en,zh}/<domain>.ts` | 按域拆分的字符串(019 §4.6): `common`/`pipeline`/`canvas`/`dialog`/`ai`/`settings`/`help`/`update`/`plugins`/`onboarding`,各域 `satisfies Partial<Translations>` |
| `i18n/translations/{en,zh}/index.ts` | 合并回一个扁平对象,类型为 `Translations`(缺 key 直接编译报错) |
| `i18n/translations/index.ts` | `translations` 聚合出口,`@/i18n/translations` 路径不变 |

### 工具函数 (`lib/`)

| 文件 | 职责 |
|------|------|
| `lib/utils.ts` | `cn()` — 合并 Tailwind CSS 类名 |

### 业务模块 — 管道画布 (`modules/pipeline/`)

| 文件 | 职责 |
|------|------|
| `pipeline/FlowPanel.tsx` | **可视化管道编辑器主组件**,组合子组件,管理状态和事件处理;右键拖拽连线(贝塞尔实时预览)、切刀、节点拖拽 |
| `pipeline/nodes/TableNode.tsx` | 输入数据表格节点,支持表头重命名和右键菜单;四方向连接点;表头行的**分隔符徽标**(设计 018);非 CSV 输入(parquet/duckdb)改为只读格式徽标、不显示分隔符控件(设计 024) |
| `pipeline/nodes/PipelineStepNode.tsx` | 管道步骤节点,支持别名编辑、参数展示、切割动画 |
| `pipeline/nodes/ResultTableNode.tsx` | 结果表节点(F1) |
| `pipeline/nodes/index.ts` | 节点类型注册表(nodeTypes) |
| `pipeline/lib/layout.ts` | dagre 自动布局 + 节点/边生成与连接方向解析(`getLayoutedElements`/`createEdgeConfig`/`resolveHandles`/`handleAnchor`/`pickStartHandle`/`buildConnectPreviewPath`/`transformBezierPath`) |
| `pipeline/lib/cutGeometry.ts` | 切割几何计算: 交点检测、clip-path 生成、坠落方向 |
| `pipeline/hooks/useCanvasKeyboardPan.ts` | 画布键盘平移 |
| `pipeline/hooks/useCanvasPointerHud.ts` | 画布指针 HUD |
| `pipeline/overlays/SearchOverlay.tsx` | 画布搜索框 UI(Ctrl+F) |
| `pipeline/overlays/CutVisualization.tsx` | 切刀轨迹 SVG 渲染 |
| `pipeline/overlays/ConnectionVisualization.tsx` | 右键连线贝塞尔实时预览 SVG |
| `pipeline/overlays/KeyIndicatorOverlay.tsx` | 关键指标浮层 |
| `pipeline/CoordinateGrid.tsx` | ReactFlow 画布坐标网格背景 |
| `pipeline/panels/VersionControlPanel.tsx` | 管道版本控制面板: 版本列表、保存/恢复/删除、标签管理 |
| `pipeline/panels/DataLineagePanel.tsx` | 数据血缘面板: 列级血缘追踪、变换类型图标、保存血缘 |
| `pipeline/panels/LineageGraph.tsx` | 血缘关系图渲染: ReactFlow 列节点、类型配色、高亮/置灰联动 |

### 业务模块 — 其他域 (`modules/`)

| 文件 | 职责 |
|------|------|
| `data-preview/HomeView.tsx` | **主工作区**,管理命令对话框状态、标签页、右键菜单、表格列重命名 |
| `data-preview/DataProfilePanel.tsx` | 数据概况右侧栏,展示字段统计,支持固定搜索框 |
| `data-preview/charts/ChartPanel.tsx` | 图表面板(recharts),折线/散点/柱状/直方图/饼图/词云/热力图,支持拖拽、最大化/还原、SVG 导出、dark mode。**029 起**:统一图例(单系列也显示)、排序三态、数值格式(轴向缩写/tooltip 完整值)、数据表视图(**表体用共享 `ScrollArea`**;`min-w-full` 以保留横向滚动)+ 复制 CSV;**图例为单行横向 `ScrollArea`**(分类多时不折行、不挤占图表区)+**分类多选筛选下拉**(`CategoryFilter`,含全选/取消全选,与图例共用 `hiddenSeries`)、截断与跳行提示、按原因区分的空/错状态;隐藏系列统一为过滤数据;导出走白底深色的「文档配色」;图表类型名走 i18n |
| `ai/AIPanel.tsx` | **AI 助手面板**: 聊天 UI、命令生成、一键插入管道、👍/👎反馈、意图澄清对话框、对话历史加载 |
| `variables/VariablePanel.tsx` | 变量管理面板(F3 管道参数化) |
| `logs/LogPanel.tsx` | 浮动日志面板,显示执行结果,支持拖拽和复制;**按标签页过滤**(design 028 §5.4):「仅当前标签页 / 全部」切换 + 每行标签页徽标(与按级别的 chips 叠加) |
| `logs/CommandList.tsx` | **命令面板**,可拖拽浮动面板,按分类展示命令,支持搜索和历史记录 |
| `logs/CommandPalette.tsx` | **全局命令面板**(Ctrl/Cmd+K): 可搜索、键盘导航的动作/标签/最近文件/xan 命令列表 |
| `modules/plugins/PluginManager.tsx` | 设置页「插件」页签: 清单加载/刷新、离线缓存提示、安装与卸载(带确认)、打开插件目录;失败保留列表只出横幅 |
| `modules/plugins/PluginRow.tsx` | 单个插件的行: 已装/缺失徽标、必需徽标、可更新徽标、来源标签(registry/manual/path)、大小、二进制路径、下载/更新/卸载/主页/定位按钮、下载进度条 + 进度条旁的「取消」按钮 |
| `modules/plugins/PluginSetupDialog.tsx` | 启动时缺 xan 的引导: 一键下载安装 + 打开插件目录的手动兜底;不走 `usePluginCatalog`(只管一个插件) |
| `modules/plugins/DownloadPrefixSetting.tsx` | 「下载加速前缀」输入框(设计 023 §6): 读/存 `get_/set_plugin_download_prefix`,保存后回读后端规范化结果,清除时发 `null`;校验失败由后端文案透出 |
### 业务模块 — 对话框 (`modules/dialogs/`)

按 019 §3.3 四分:**命令参数配置 / 文件级操作 / 应用级 / 通用原子**。

#### `command/` — 统一命令入口

| 文件 | 职责 |
|------|------|
| `command/CommandDialog.tsx` | **统一入口**: 居中外壳 + Esc/焦点圈闭,按 `commandDialog.type` 从 `COMMAND_FORMS` 取表单渲染 |
| `command/CommandFormShell.tsx` | 可复用表单包装器(原 `CommandFormWrapper.tsx`): ScrollArea + Cancel/Add/Update 按钮 + `handleCommandSubmit` |
| `command/index.ts` | `COMMAND_FORMS` 映射表(命令 id → 表单组件)+ 桶文件导出 |
| `command/lib/initialParams.ts` | **`buildCommandInitialParams()` 纯函数**(019 §3.1): 把右键菜单上下文换算成预填参数,消除 11 个旧对话框的手工拼参(双实现);配 `__tests__/initialParams.test.ts` |
| `command/lib/helpers.ts` | `handleCommandSubmit()` 提交处理 + `updateParam()` |
| `command/lib/parameterDescriptions.ts` | `getParameterDescription()` 参数描述查询,支持中英文 |
| `command/forms/<命令 id>.tsx` | **61 个命令表单,一个命令一个文件**(019 §3.4),文件名即命令 id;`_shared.tsx` 收纳 `SearchForm` 专用的 `Checkbox`/`TextField`/`PatternListInput` |

> 019 §3.1 后,画布右键的筛选/排序/透视/日期/文本/数值/切割/补位/替换/窗口/批量筛选入口全部经 `HomeView.openCommandFromContext()` → `buildCommandInitialParams()` → `CommandDialog`,**每个命令只有一处参数构建实现**;原有的 11 个浮动小窗已删除。

#### `file/` · `app/` · `common/`

| 文件 | 职责 |
|------|------|
| `file/SeparateCSVDialog.tsx` | 拆分好/坏行: 输入探测、分隔符自动检测/手选/设为默认、期望列数/跳过行/引号/无表头/流式、上次结果(localStorage)+ 打开路径 |
| `file/SplitLinesDialog.tsx` | 按行拆分(设计 021): 输入文件、输出目录、每个文件行数、无表头、上次记录(回填选项 + 打开输出目录 + 清除记录 + 目录失效提示);不解析 CSV,故无分隔符/探测选项 |
| `file/MergeExcelDialog.tsx` | Excel 多文件合并(设计 025): 来源(文件/目录混选可多条)+ 递归 + 扩展名多选 + 取 sheet 三选一(第 1 个/所有/指定名称)+ 列对齐(默认并集)+ 来源列 + 输出格式(csv/xlsx);扫描预览(sheet 名常显、列名按需展开)、并集加宽/疑似同列琥珀提示、xlsx 单 sheet 说明、上次记录(选项回填 + 打开路径 + 清除记录 + 输出失效提示) |
| `file/DuckdbTableDialog.tsx` | `.duckdb` 选表对话框(设计 024): 打开多表数据库时由 `useTabs` 的注入式回调唤起,列出 `schema.table` + 类型;单表库自动选中不经此对话框,Esc/遮罩取消 = 放弃打开 |
| `file/CsvDiffDialog.tsx` | CSV 双文件对比(Ctrl+D),分页避免卡顿 |
| `file/CsvEncodingDialog.tsx` | CSV 编码转换(auto/BOM 检测、UTF-8、GBK、GB18030、UTF-16 LE/BE、Latin-1);上次记录(完成时间/耗时/编码对/字节数 + 打开路径 + 清除记录 + 输出文件失效提示),打开时回填输入输出路径与源/目标编码。设计:`docs/design/020_encoding-conversion-history.md` |
| `file/PipelineTemplateDialog.tsx` | 管道模板库对话框(F4) |
| `app/ExecutionHistoryDialog.tsx` | 执行历史(F6) |
| `app/UpdateDialog.tsx` | 应用更新通知。**进度条在标题栏正中**(左右各一个 `flex-1` 槽位实现真正居中),不放在可滚动正文里 —— release notes 再长也不会把进度挤出视野;字节数在标题栏放不下,窄窗口下由 `hidden sm:inline` 收起、始终可用 tooltip 查看;**安装中 Esc 与遮罩点击都不关闭**(仅禁用 X 挡不住,关掉就没进度可看了) |
| `common/ConfirmDialog.tsx` | 通用确认对话框 |
| `common/VariableValuesDialog.tsx` | 管道变量取值对话框(F3) |

### 通用组件 (`components/`)

零业务语义,禁止 import `modules/`、`data/`、`services/`(019 §5.2)。

#### `ui/` — 基础件(已统一 PascalCase)

> ⚠️ **文件名必须与 import 的大小写完全一致。** Windows 文件系统不区分大小写,两者不一致时本地照样能解析、`vite build` 也照常通过,但 **`tsc` 会报 `TS1261 Already included file name ... differs ... only in casing`,而 Linux/macOS 上会直接找不到模块**。2026-09-26 这 6 个 shadcn 来源的文件(`button`/`card`/`input`/`select`/`textarea`/`tooltip`)在 git 里是小写、导入却写 PascalCase(且 git 在 Windows 上看不出大小写差异),导致 `pnpm build` 失败;已用 `git mv` 全部对齐为 PascalCase。**改这类文件前先确认 `git ls-files` 记录的名字。**

| 文件 | 职责 |
|------|------|
| `Button.tsx` | 按钮 |
| `Card.tsx` | 卡片容器 |
| `Input.tsx` | 输入框 |
| `Textarea.tsx` | 多行文本域 |
| `ScrollArea.tsx` | 滚动区域 |
| `ResizeHandle.tsx` | 面板拖拽调整大小手柄 |
| `Tooltip.tsx` | Tooltip 提示组件 |
| `Select.tsx` | 可搜索下拉选择框 |
| `MultiValueInput.tsx` | 多值输入(标签式) |
| `DelimiterModeSelect.tsx` | 分隔符控件(6 项: 自动检测 + `, ; \t \| ^`),**设置页与输入节点徽标共用**(设计 018 §3.9) |
| `VariableHint.tsx` | `{{var}}` 提示(019 §3.3 从 `commands/` 迁入,属通用 UI) |

#### `expression/` · `menu/` · `setting/` · `help/`

| 文件 | 职责 |
|------|------|
| `expression/ExpressionEditor.tsx` | 主组件: textarea + 同步高亮层 + 自动补全下拉 |
| `expression/highlight.ts` · `autocomplete.ts` | 语法高亮分词器 / 补全引擎 |
| `menu/MainMenu.tsx` | 顶部工具栏: **文件菜单**、撤销/重做、**工具菜单**、执行、命令面板、帮助、**设置**。菜单栏顺序为 文件 / 编辑 / 查看 / 工具 / 帮助。**「工具」菜单承载一次性文件工具**(CSV 对比、CSV 编码转换、拆分好/坏行、按行拆分、合并 Excel 文件),它们只开对话框 + 调一个后端命令、不进画布也不参与管道生命周期,故与「文件」菜单的打开/新建标签/模板/保存/导入/导出分开。**帮助菜单第一行为「查看示例」**(调用 `onLoadDemo` → `App.tsx` 的 `handleLoadDemo`,与空状态「看看示例」同一个 action,design 027 §4.1),其后依次是「帮助中心」「检查更新」。运行中的「执行」按钮挂 `data-busy` + `.exec-busy`(设计 028 §5.6.1);**检查更新期间「帮助」按钮挂 `data-checking` + `.update-busy`**(设计 022 §5.4,复用同一条底部横条;标记刻意不复用 `data-busy`,见 `ExecuteMenu.test.tsx` 的定位方式)。**「帮助」按钮任何状态都可点击**(横条是纯叠加,不置灰、不 `disabled`、不 `cursor-not-allowed`),慢检查不得把「帮助中心」锁在门外。**「设置」入口在右侧按钮组末尾(AI 右侧)、只出图标 + tooltip**(`aria-label` 承载可访问名);**对话框打开期间用 `commandButtonClass(true)` 高亮 + 同款 12px 底部小横线**(与命令面板/日志/AI 三个面板开关的激活态完全一致:同底色、同横线类名,另配 `aria-expanded`) |
| `menu/ContextMenu.tsx` | 表格列右键菜单: 快速筛选、替换、透视、变换、排序(019 §3.1 后只**报告**上下文,不再自己拼参数) |
| `menu/CanvasContextMenu.tsx` | 画布空白处右键菜单 |
| `setting/ThemeProvider.tsx` | 主题上下文(dark/light/system)— 019 §2.1 计划迁往 `app/providers/` |
| `setting/SettingsDialog.tsx` | 设置对话框容器 — 019 §2.1 计划迁往 `modules/dialogs/app/` |
| `setting/SettingsTabContent.tsx` | 设置内容: 语言、主题、分隔符(自动检测总开关)、无表头、通知、历史上限、AI 配置、AI 学习数据管理 |
| `setting/Toast.tsx` | Toast 通知系统 — 019 §2.1 计划迁往 `components/ui/` |
| `help/HelpContent.ts` · `HelpContentCn.ts` | 英文/中文帮助内容(Markdown) |
| `help/HelpDialog.tsx` | 帮助对话框,支持 Ctrl+F 搜索 |
| `help/HelpMarkdown.tsx` | 自定义 Markdown 渲染器,支持搜索高亮 |

> `setting/` 的三个文件按 019 §2.1 属 P1 迁移项,与 `app/` 装配层(§4.4 `App.tsx` 拆分)一并落地。

---

## 快速索引: 按修改场景查找

| 我想修改… | 看这些文件 |
|-----------|-----------|
| 新增/修改 xan 命令定义 | `src/data/commands/index.ts` |
| 新增/修改命令参数类型 | `src/types/xan.ts` |
| 新增/修改命令表单 | `src/modules/dialogs/command/` 目录,按分类选择对应 Form 文件,在 `index.ts` 注册到 `COMMAND_FORMS` |
| 修改命令参数描述 | `src/modules/dialogs/command/lib/parameterDescriptions.ts` + `src/data/commands/index.ts`(参数 description 字段) |
| 新增对话框 | 参考 `src/modules/dialogs/command/CommandDialog.tsx`,并在 `HomeView.tsx` 中注册状态和渲染 |
| 修改管道执行逻辑 | `src-tauri/src/pipeline.rs` 中的 `execute_xan_pipeline` 函数 |
| 修改管道执行取消 | `src-tauri/src/pipeline.rs`(`RUN_FLAGS` 注册表 + `cancel_pipeline(run_id)` + `RunGuard`;`execute_xan_pipeline` 收 `run_id`,**无全局取消标志**) + `src/hooks/execution/useExecution.ts`(`cancelRun(tabId)` → `invoke("cancel_pipeline", { runId })`,前端 per-run 标志) + `src/hooks/execution/runPipelineDeps.ts`(`RunContext.isCancelled`)。设计:`docs/design/028_multi-tab-concurrent-execution.md` |
| 修改 CSV 预览读取 | `src-tauri/src/csv.rs` 中的 `read_csv_file` 函数 |
| 修改打开文件的分隔符检测(工作流输入节点) | `src-tauri/src/csv.rs`(`read_csv_file` 的 `resolve_read_delimiter`/`read_csv_sync`)+ `src/hooks/useTabs.ts`(`loadCsvData` + 全局模式重载规则)+ `src/components/ui/DelimiterModeSelect.tsx`(共用控件)+ `src/modules/pipeline/nodes/TableNode.tsx`(徽标)+ `src/modules/pipeline/FlowPanel.tsx`/`src/modules/data-preview/HomeView.tsx`/`src/app/App.tsx`(透传)+ `src/utils/delimiterMode.ts`(设置 ⇄ 界面值换算)+ `src/hooks/execution/resolveDelimiter.ts` + `src/hooks/usePipelineTabs.ts`(`resolveRunDelimiter`,保证执行与预览同源)。设计:`docs/design/018_open-file-delimiter-detection.md` |
| 修改分隔符自动检测总开关 / 默认分隔符(设置页 ⇄ 输入节点同步) | `src-tauri/src/config.rs`(`auto_detect_delimiter` + `get/set_auto_detect_delimiter`、`get/set_default_delimiter`)+ `src/hooks/useAppSettings.ts` + `src/components/setting/SettingsTabContent.tsx`(分隔符区块)+ `src/components/ui/DelimiterModeSelect.tsx` + `src/app/App.tsx`(`delimiterMode`/`onDelimiterModeChange`,含即时落库)。设计:`docs/design/018_open-file-delimiter-detection.md` §3.9 |
| 修改 Parquet / DuckDB 文件读取(打开/预览/选表) | `src-tauri/src/tabular.rs`(`detect_input_format`/`read_tabular_file`/`list_duckdb_tables`)+ `src/utils/fileFormat.ts` + `src/hooks/useTabs.ts`(`loadCsvData` + 注入式选表回调)+ `src/modules/dialogs/file/DuckdbTableDialog.tsx` + `src/modules/pipeline/nodes/TableNode.tsx`(格式徽标)+ `src/hooks/fileIO/useFileOpen.ts`(DuckDB filter)+ `src/app/App.tsx`(回调装配与对话框渲染)+ `src/utils/session.ts`(`inputFormat`/`sourceTable` 快照)。设计:`docs/design/024_parquet-duckdb-file-reading.md` |
| 修改 duckdb SQL 串联 / 管道输入物化 | `src-tauri/src/pipeline.rs`(`execute_xan_pipeline` 入口分派 + `run_duckdb_chain`/`build_duckdb_args`/`pipeline_seq` 的 `SourceRef` 与 parquet 交接)+ `src-tauri/src/tabular.rs`(`build_duckdb_chain_sql`/`materialize_input_to_csv`/`source_view_sql`/`chain_query_sql`)+ `src/hooks/execution/executeBranch.ts`(`inputTable`)。设计:`docs/design/024_parquet-duckdb-file-reading.md` |
| 修改 CSV 对比功能 | `src/modules/dialogs/file/CsvDiffDialog.tsx` + `src-tauri/src/csv.rs`(`diff_csv_files`) |
| 修改 CSV 编码转换 | `src/modules/dialogs/file/CsvEncodingDialog.tsx` + `src-tauri/src/csv.rs`(`convert_csv_encoding`)+ `src/utils/encodingHistory.ts`(上次记录持久化)。设计:`docs/design/020_encoding-conversion-history.md` |
| 修改拆分好/坏行 | `src/modules/dialogs/file/SeparateCSVDialog.tsx` + `src-tauri/src/csv.rs`(`separate_csv`/`separate_stream`/`probe_csv_file`)+ `src/hooks/useCsvProbe.ts` + `src/utils/separateHistory.ts` + `src-tauri/src/storage.rs`(`reveal_paths`) |
| 修改按行拆分(按行数切成多份) | `src/modules/dialogs/file/SplitLinesDialog.tsx` + `src-tauri/src/csv.rs`(`split_lines`/`split_lines_stream`/`split_lines_to_files`)+ `src/utils/splitLinesHistory.ts` + `src/components/menu/MainMenu.tsx`(工具菜单入口)+ `src-tauri/src/storage.rs`(`reveal_paths`)。设计:`docs/design/021_split-lines-by-line-count.md` |
| 修改 Excel 多文件合并(多工作簿/sheet 合成一张表) | `src/modules/dialogs/file/MergeExcelDialog.tsx` + `src-tauri/src/excel_merge.rs`(`scan_excel_sources`/`merge_excel_sources`/`read_excel_header`)+ `src/utils/excelMergeHistory.ts` + `src/components/menu/MainMenu.tsx`(工具菜单入口)+ `src/components/ui/Select.tsx`(可选 `ariaLabel`)。设计:`docs/design/025_excel-multi-file-merge.md` |
| 修改会话保存/恢复 | `src/hooks/useSession.ts` + `src/utils/session.ts` + `src-tauri/src/session.rs` |
| 修改自动更新 / 免提权安装 | `src-tauri/tauri.conf.json`(`bundle.targets`/`installMode`/`createUpdaterArtifacts`/`plugins.updater`)+ `src-tauri/src/update.rs`(`get_install_form`)+ `src-tauri/src/config.rs`(`get_resources_dir` 的就地布局、不可写回退与反向迁移)+ `src-tauri/nsis/hooks.nsh`(装入 `<用户选择路径>\EasyCsv` + 卸载时按「删除应用数据」勾选框删除该目录,配合 `bundle.windows.nsis.installerHooks`)+ `src/services/update/index.ts` + `src/hooks/useUpdater.ts` + `src/modules/dialogs/app/UpdateDialog.tsx` + `src/hooks/useSession.ts`(`flushSession`)+ `.github/workflows/release.yml`。设计:`docs/design/022_github-auto-update-and-admin-free-install.md` |
| 修改首次使用引导 / 示例数据(027 §4.1/§4.2, **P0 已实现**) | 后端: `src-tauri/src/samples.rs`(`ensure_sample_data`,幂等写入 `<数据目录>/samples/`)+ `src-tauri/samples/easy-csv-sample-sales.csv`(嵌入的示例数据,**LF 字节由 `.gitattributes` 钉住**)+ `src-tauri/src/lib.rs`(注册命令)。前端: `src/hooks/useOnboarding.ts` + `src/components/onboarding/FirstStepGuide.tsx`(画布空态引导卡 + 手势卡,覆盖层,`pointer-events-none`)+ `src/data/templates/builtin.ts`(5 个内置模板,文案走 i18n)+ `src/hooks/usePipelineTemplates.ts`(内置与用户模板合并)+ `src/modules/data-preview/HomeView.tsx`(「看看示例」卡 + 三步流程条 + 渲染引导层)+ `src/app/App.tsx`(`handleLoadDemo` + 示例自动执行一次 + `showOnboardingGuide`)+ `src/modules/logs/CommandList.tsx`(首个操作提示条)+ `src/components/menu/MainMenu.tsx`(置灰「执行」的 Tooltip、入口图标高亮、**帮助菜单第一行「查看示例」**)+ `src/components/setting/SettingsTabContent.tsx`(重新显示引导)。设计: `docs/design/027_first-run-onboarding.md` |
| 修改执行完成提示(027 §4.3, **P1 已实现**) | `src/components/setting/Toast.tsx`(`ToastProps.action` + 关闭按钮 + `pointer-events-auto`)+ `src/hooks/useToast.ts`(透传 action/duration)+ `src/hooks/execution/runPipeline.ts`(`finally` 里按 `pipelineFailed`/`wasCancelled` 发成功/失败 Toast;**不改**既有的 `setShowLogPanel(true)` 与进度条行为)+ `src/hooks/execution/runPipelineDeps.ts`(labels)。**不做**结果节点高亮/fitView 定位/每步成功标记(失败红框是现状 `PipelineStepNode.tsx:265-280`) |
| 修改命令面板 | `src/modules/logs/CommandPalette.tsx` + `src/hooks/useUIState.ts` + `src/hooks/useKeyboardShortcuts.ts`(Ctrl+K) |
| 修改管道可视化布局 | `src/modules/pipeline/FlowPanel.tsx`(主逻辑) + `pipeline/lib/layout.ts`(布局) + `pipeline/nodes/`(节点样式) |
| 修改连线方向/锚点(上下/左右连接点) | `src/modules/pipeline/lib/layout.ts`(`resolveHandles`/`handleAnchor`) + `pipeline/nodes/`(Handle 定义) |
| 修改右键连线交互/预览 | `src/modules/pipeline/FlowPanel.tsx`(`handleCutStart`/`handleCutMove`/`handleCutEnd`) + `pipeline/overlays/ConnectionVisualization.tsx`(贝塞尔渲染) + `layout.ts`(`pickStartHandle`/`buildConnectPreviewPath`/`transformBezierPath`) |
| 修改菜单/快捷键 | `src/components/menu/MainMenu.tsx` + `src/hooks/useKeyboardShortcuts.ts` |
| 修改右键菜单 | `src/components/menu/ContextMenu.tsx` |
| 修改主题/样式 | `src/index.css` + `src/components/setting/ThemeProvider.tsx` |
| 修改设置选择器样式 | `src/components/setting/SettingsTabContent.tsx` |
| 修改国际化文本 | `src/i18n/translations/` |
| 修改设置项 | `src/components/setting/SettingsTabContent.tsx` |
| 修改应用配置持久化 | `src-tauri/src/config.rs` 中的 `load_config`/`save_config` 函数 |
| 修改 Batch Filter 功能 | `src/hooks/useBatchFilter.ts` + `src/modules/dialogs/command/forms/batch-filter.tsx` + `src/data/commands/index.ts` |
| 修改 Batch Convert 功能 | `src/hooks/useBatchConvert.ts` + `src/hooks/execution/`(deps 注入 `executeBatchConvert`) |
| 修改导出管道脚本 (.sh/.ps1) | `src/hooks/fileIO/useFileSave.ts` + `src/hooks/fileIO/pipelineScript.ts`(脚本内容纯函数) |
| 修改 AI 面板 UI/交互 | `src/modules/ai/AIPanel.tsx` |
| 修改 AI 反馈/澄清逻辑 | `src/modules/ai/AIPanel.tsx` + `src/services/ai/index.ts` |
| 修改 AI 提示词/意图路由 | `src/services/ai/context.ts`(`INTENT_ROUTES`/`retrieveRelevantCommands`/`buildSystemPrompt`) |
| 修改 AI 模糊匹配/同义词 | `src/services/ai/context.ts`(`fuzzyMatch`/`expandWithSynonyms`) |
| 修改 AI 纠正规则逻辑 | `src/services/ai/context.ts` + `src/services/ai/index.ts` + `src-tauri/src/ai_memory.rs` |
| 修改 AI 意图澄清逻辑 | `src/services/ai/context.ts`(`detectClarificationNeed`/`CLARIFICATION_PATTERNS`) |
| 修改 AI 大模型调用/代理 | `src-tauri/src/ai.rs`(后端代理) + `src/services/ai/api.ts`(前端调用) |
| 修改 AI 多行JSON解析 | `src/services/ai/api.ts`(`parseJSONBlock`) |
| 修改 AI 记忆持久化 | `src-tauri/src/ai_memory.rs` + `src/services/ai/index.ts` |
| 修改 AI 配置(provider/model/key) | `src/services/ai/types.ts`(常量) + `src/components/setting/SettingsTabContent.tsx`(UI) + `src-tauri/src/config.rs`(持久化) |
| 修改自定义 AI provider 配置 | `src/components/setting/SettingsTabContent.tsx`(provider 选 custom 时显示 name/baseUrl/models) + `src/services/ai/index.ts`(配置读写) + `src-tauri/src/config.rs`(ai_config 表持久化) |
| 修改 AI 学习数据管理 | `src/components/setting/SettingsTabContent.tsx` + `src-tauri/src/ai_memory.rs` |
| 修改命令使用文档 | `docs/AI_usage/*.md`(生成源: `scripts/generate-ai-usage-docs.ts`) / 合并版: `docs/AI/USAGE.md` |
| 修改命令帮助文档(英文) | `src/docs/cmd/*.md` |
| 修改命令帮助文档(中文) | `docs/cmd_zh/*.md` |
| 修改管道版本控制 | `src/hooks/usePipelineVersions.ts` + `src/modules/pipeline/panels/VersionControlPanel.tsx` + `src-tauri/src/storage.rs` |
| 修改数据血缘 | `src/hooks/useDataLineage.ts` + `src/modules/pipeline/panels/DataLineagePanel.tsx` + `src/modules/pipeline/panels/LineageGraph.tsx` + `src-tauri/src/storage.rs` |
| 修改血缘图渲染 | `src/modules/pipeline/panels/LineageGraph.tsx` |
| 修改帮助内容 | `src/components/help/HelpContent.ts` (英文) / `HelpContentCn.ts` (中文) |
| 修改帮助菜单入口(查看示例 / 帮助中心 / 检查更新) | `src/components/menu/MainMenu.tsx`(Help 菜单,第一行为「查看示例」`onLoadDemo`)+ `src/app/App.tsx`(`onLoadDemo={handleLoadDemo}` → `openSampleTemplate(getBuiltinDemoTemplate(t))`)+ `src/data/templates/builtin.ts`+ `src/i18n/translations/{zh,en}/pipeline.ts`(`viewSample`)+ `src/__tests__/ExecuteMenu.test.tsx`(帮助菜单入口数量)。设计: `docs/design/027_first-run-onboarding.md` §4.1 |
| 修改命令帮助文档 | 运行 `node scripts/generate-help-docs.js` 重新生成 |
| 修改 Tauri 插件/权限 | `src-tauri/tauri.conf.json` + `src-tauri/capabilities/default.json` |
| 修改系统托盘/窗口行为 | `src-tauri/src/main.rs` 中的 `setup()` 和 `on_window_event` |
| 修改数据概况功能 | `src/modules/data-preview/DataProfilePanel.tsx` + `src-tauri/src/csv.rs` 中的 `profile_csv` + `src-tauri/src/storage.rs` 中的缓存函数 |
| 修改图表功能 | `src/modules/data-preview/charts/ChartPanel.tsx`(图表渲染+拖拽+导出+图例/排序/表视图) + `src/modules/data-preview/charts/ChartPrimitives.tsx`(共享 `ChartLegend`/`ChartTooltip`) + `src/hooks/charts/processChartData.ts`(纯函数塑形 + `ChartDataIssue` 诊断 + `defaultSortFor`) + `src/hooks/execution/executeBranch.ts`(chart 分支取数,经后端 `parse_csv_text`) + `src-tauri/src/csv.rs`(`parse_csv_text`) + `src/utils/format.ts`(`formatNumber`) + `src/types/execution.ts`(`TabChartState`) + `src/modules/dialogs/command/forms/chart.tsx`(ChartForm) + `src/types/xan.ts`(ChartConfig 等类型)。设计与验收: `docs/design/029_chart-readability.md` |
| 修改图表命令文档 | `src/docs/cmd/chart.md`(英文) / `docs/cmd_zh/chart.md`(中文) |
| 管道步骤复制粘贴 | `src/modules/pipeline/FlowPanel.tsx` 中的 `handleCopyStep`/`handlePasteStep` |
| 管道步骤自动连线 | `src/app/App.tsx` 中的 `handleCommandClick`(仅 AI 添加时 `autoConnect=true` 自动连线) |
| 修改表达式编辑器 | `src/components/expression/` 目录: `ExpressionEditor.tsx`(主组件) + `highlight.ts`(高亮) + `autocomplete.ts`(补全) |
| 修改函数定义/补全列表 | `src/data/functions.ts`(200+函数定义) |
| 修改拖拽交互行为 | `src/modules/pipeline/FlowPanel.tsx`(管道节点拖拽) + `src/modules/logs/CommandList.tsx`(命令面板拖拽) + `src/hooks/useDraggable.ts`(通用拖拽逻辑) |
| 修改右键菜单选项/行为 | `src/components/menu/ContextMenu.tsx` |
| 修改动画/过渡效果 | `src/index.css`(关键帧定义) + 各组件内联动画逻辑 |
| 修改 Toast/通知样式 | `src/components/setting/Toast.tsx` |
| 修改 Tooltip 组件 | `src/components/ui/Tooltip.tsx` |
| 修改表格列交互(重命名/右键) | `src/modules/data-preview/HomeView.tsx` |
| 修改管道节点样式 | `src/modules/pipeline/nodes/PipelineStepNode.tsx` |
| 修改切割动画效果 | `src/modules/pipeline/lib/cutGeometry.ts` + `src/modules/pipeline/overlays/CutVisualization.tsx` |
| 修改 xan.exe 解压/查找 | `src-tauri/src/xan.rs` |
| 新增/修改前端测试 | `src/__tests__/` 目录 + `vitest.config.ts` + `src/test/setup.ts` |
| 测试 xan 命令参数正确性 | `src/__tests__/commands.test.ts` |
| 测试 Tauri invoke 调用模式 | `src/__tests__/invoke.test.ts` |
| 测试 Batch Filter 逻辑 | `src/__tests__/BatchFilterHooks.test.ts` |
| 测试 Batch Convert 逻辑 | `src/__tests__/BatchConvertHooks.test.ts` |
| 测试命令面板 | `src/__tests__/CommandPalette.test.tsx` |
| 测试 CSV 对比对话框 | `src/__tests__/initialParams.test.ts` |
| 测试编码转换对话框 | `src/__tests__/CsvEncodingDialog.test.tsx` |
| 测试插件管理页签 | `src/__tests__/PluginManager.test.tsx` |
| 修改测试 mock/setup | `src/test/setup.ts` |
| 修改 vitest 配置 | `vitest.config.ts` |
| 新增/修改 CLI 插件 | `plugins/<name>/`(独立 crate)+ `src/data/commands/index.ts`(命令定义)+ `src/modules/dialogs/command/forms/pinyin.tsx`(表单)+ `src-tauri/src/plugins.rs`(后端注册)+ `src/docs/cmd/<name>.md` 与 `docs/cmd_zh/<name>.md`(帮助文档,改后跑 `pnpm generate-help`)。若要让用户能**应用内下载**它,还要:插件仓库 `easy-csv-plugins` 的 `catalog.json` 加条目 + `plugin_catalog.rs`/`plugin_install.rs`(设计 `docs/design/023_plugin-repository-and-in-app-install.md`) |
| 修改插件仓库 / 应用内插件下载(**P0 + P1 已实现**;设计 `docs/design/023_plugin-repository-and-in-app-install.md`) | 后端:`src-tauri/src/plugin_catalog.rs`(取清单 + 验签 + 12h 缓存 + 防回滚 + **逐源回退**)+ `src-tauri/src/plugin_install.rs`(下载 + 校验 + 原子落盘 + 进度事件 + **取消**)+ `src-tauri/src/config.rs`(下载加速前缀的读写与校验)+ `src-tauri/plugin-signing.pub`(验签公钥,**支持多把**)+ `src-tauri/src/plugins.rs`(`plugins` 表新增四列)。前端:`src/services/plugins/index.ts` + `src/hooks/usePluginCatalog.ts` + `src/modules/plugins/`。**清单源有两条**:GitHub release(权威)+ jsDelivr `@main`(镜像,靠 CI 把 `catalog.json` 提交回 main 才成立) |
| 修改插件管理设置页 | `src/components/setting/SettingsTabContent.tsx`(plugins 页签 → `<PluginManager showToast>`)+ `src/modules/plugins/`(前端)+ `src-tauri/src/{plugin_catalog,plugin_install,plugins,config}.rs`(后端)。已支持下载/更新/卸载/打开目录/**取消下载**/**下载加速前缀**;设计: `docs/design/023_plugin-repository-and-in-app-install.md` |
