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
│  (AES-256-GCM) · 50 个 Tauri 命令                    │
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

> 设计文档 001–015 已按「序号_主题」命名(见 `docs/design/` 目录),但尚未逐条登记于本表;016–020 已登记。

---

## Rust 后端 (`src-tauri/src/`)

后端按职责拆分为 8 个模块:

| 文件 | 职责 |
|------|------|
| `main.rs` | 二进制入口,注册插件(opener/dialog/fs/shell/window_state/notification/http/prevent_default),系统托盘,窗口事件处理 |
| `lib.rs` | 模块声明 + `invoke_handler()` 函数(注册全部 58 个命令) |
| `config.rs` | `AppConfig` 类型、SQLite 持久化(app_config/ai_config 表)、AES-256-GCM 加密存储 API Key、per-provider API Key 管理、自定义 AI provider 配置(provider=custom 时存 name/base_url/models)、配置相关命令 |
| `xan.rs` | xan.exe 解压与查找、`check_xan_installed` 命令 |
| `pipeline.rs` | `PipelineCommand`/`ExecutionResult` 类型、`execute_xan_pipeline` 核心命令、`set_pipeline_cancelled` 取消执行 |
| `plugins.rs` | 外部 CLI 插件管理: `plugins` 表(plugins.db)持久化、`list_plugins`/`check_plugins` 命令、`command_executable` 按命令名解析可执行文件(插件命令走插件二进制,其余走 xan.exe)。`xan` 与 `pinyin` 默认注册进插件表,列表按 xan 置顶排序。插件二进制按平台编译期嵌入 `src-tauri/resources/plugins/<target>/`(`include_bytes!`)、首启自动解压到平台插件目录,Unix 下 `make_executable` 置 0o755。解压目录: Windows `<exe>/EasyCsv_resources/plugins/`,macOS `~/Library/Application Support/EasyCsv/resources/plugins/`,Linux `~/.local/share/EasyCsv/resources/plugins/`。解析顺序: 路径 → `plugins/` 目录(含 `.exe` 补全)→ `PATH` |
| `csv.rs` | `CsvData` 类型、`read_csv_file`(自动检测分隔符)/`profile_csv`/`diff_csv_files`/`convert_csv_encoding`/`separate_csv`/`probe_csv_file` 命令 |
| `storage.rs` | 历史记录、最近文件、数据概况缓存、版本/血缘存储、窗口标题、开发者工具命令 |
| `ai.rs` | AI 对话代理: `call_ai` 命令,转发到 DeepSeek / Qwen / GLM |
| `ai_memory.rs` | AI 记忆持久化(SQLite): 对话历史、反馈记录、纠正规则的 CRUD + 清除 |
| `session.rs` | 会话快照持久化(SQLite): 标签页快照 + 选中标签的保存/恢复 |
| `build.rs` | Tauri 构建脚本,生成平台特定代码 |

### 各模块职责详解

#### config.rs — 配置管理

| 内容 | 说明 |
|------|------|
| `AppConfig` 结构体 | `default_delimiter`, `no_headers`, `auto_detect_delimiter`(默认 `true`,打开文件时是否自动检测分隔符), `show_execution_notification`, `minimize_to_tray` |
| `load_config()` / `save_config()` | JSON 配置文件读写 |
| `get_resources_dir()` | 资源/数据根目录。Windows: `<exe>/EasyCsv_resources`(不变);macOS: `~/Library/Application Support/EasyCsv`;Linux: `~/.local/share/EasyCsv`。所有 db 数据目录经它派生,插件目录经 `plugins::get_plugin_dir()` 派生 |
| `get/set_default_delimiter` | 默认分隔符配置命令(自动检测关闭时读取文件使用,也是检测失败时的兜底值) |
| `get/set_no_headers` | 无表头配置命令 |
| `get/set_auto_detect_delimiter` | 分隔符自动检测总开关(设置页与输入节点徽标共用同一个值) |
| `get/set_system_notification` | 系统通知配置命令 |
| `get/set_minimize_to_tray` | 最小化到托盘配置命令 |
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
| `reveal_paths` | 在系统文件管理器中定位一个或多个路径(过滤已不存在的路径后交给 `tauri_plugin_opener::reveal_items_in_dir`) |
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

### Tauri 命令清单(前端可调用,共 51 个)

| 命令 | 模块 | 功能 |
|------|------|------|
| `read_csv_file` | csv | 读取 CSV 文件,返回表头 + 前51行预览;`delimiter` 为空时自动检测分隔符并回传来源/置信度/列数。设计:`docs/design/018_open-file-delimiter-detection.md` |
| `execute_xan_pipeline` | pipeline | 执行多步骤 xan 管道(核心命令) |
| `set_pipeline_cancelled` | pipeline | 取消正在执行的管道(全局标志 + kill 子进程) |
| `profile_csv` | csv | 调用 `xan stats` 生成数据概况统计 |
| `diff_csv_files` | csv | 对比两个 CSV 文件(Myers diff,分页返回) |
| `convert_csv_encoding` | csv | 转换 CSV 文件编码(64KB 流式转码),返回输出路径/读写字节数/后端耗时 |
| `separate_csv` | 将 CSV 拆分为 good/bad 两文件(共享 `flexible(true)` reader/writer 重新序列化,坏行不丢失;后续连续坏行会连同前一合法行一并进 bad;支持 expected_columns 覆盖 / skiprows / quoting / out_dir / streaming / no_headers;核心为泛型 `separate_stream`,默认内存路径与 `streaming` 流式路径共用同一逻辑)。设计:`docs/design/016_separate-good-bad-rows.md` |
| `probe_csv_file` | csv | 探测文件头部(64 KiB):自动检测分隔符 + 返回第一行列数与表头预览,供拆分对话框显示文件信息。设计:`docs/design/017_separate-dialog-ux.md` |
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
| `list_plugins` | plugins | 列出已注册的 CLI 插件 |
| `check_plugins` | plugins | 检查插件可执行文件是否可用(解析 PATH + 读取 `--version`) |

---

## 测试基础设施

项目使用 **vitest 4.x** + **jsdom** + **@testing-library/jest-dom** 进行前端单元测试。

| 文件 | 职责 |
|------|------|
| `vitest.config.ts` | vitest 配置: jsdom 环境、`@/` 别名、`src/test/setup.ts` 作为 setup |
| `src/test/setup.ts` | Mock 全局 API: `@tauri-apps/api/core` (invoke)、`@tauri-apps/plugin-dialog`、`@tauri-apps/plugin-fs`、localStorage、matchMedia、scrollIntoView |

运行测试: `pnpm test`

### 测试文件 (`src/__tests__/`)

| 文件 | 职责 | 测试数 |
|------|------|--------|
| `commands.test.ts` | **核心测试**: 覆盖全部 59 个 xan 命令的参数构建正确性(命令名、参数名、值、isPositional、默认值) | ~76 |
| `invoke.test.ts` | App.tsx 中所有 invoke 调用模式验证(read_csv_file、配置读写、历史记录、错误处理、历史重建) | ~20 |
| `BatchFilterHooks.test.ts` | Batch Filter 执行逻辑: 文件名清理、正则构建、文本/数值筛选 invoke 形状、频率提取、多值批处理 | ~31 |
| `BatchConvertHooks.test.ts` | 批量格式转换: globToRegex、getBaseName、getOutputDir、CSV↔XLSX↔JSON 转换 invoke 模式 | ~37 |
| `CommandPalette.test.tsx` | 命令面板: 搜索过滤、键盘导航、选中执行、Esc 关闭 | ~11 |
| `CsvEncodingDialog.test.tsx` | 编码转换对话框: 编码选择、invoke 形状、结果摘要 | ~5 |
| `HelpDialog.test.tsx` | 帮助对话框搜索与打开 | ~2 |
| `HelpMarkdown.test.tsx` | 自定义 Markdown 渲染器 | ~3 |
| `layout.test.ts` | 连线布局工具: `resolveHandles` 四方向选择、`handleAnchor`/`getEdgeEndpoints`、`pickStartHandle`、`buildConnectPreviewPath`(贝塞尔预览)、`transformBezierPath` | ~27 |
| `useTabsDelimiter.test.ts` | 打开文件的分隔符解析(设计 018): 自动检测开关的开/关、模式变化后重读当前标签、导入分隔符一次性覆盖、非 CSV 不读 | 6 |
| `delimiterMode.test.ts` | 分隔符单一状态的换算(设计 018 §3.9): 设置 ⇄ 界面值、六种模式往返一致(锁住设置页与输入节点不漂移) | 6 |
| `SettingsDelimiterControl.test.tsx` | 设置页分隔符控件(设计 018 §3.9): auto/锁定两种显示、6 个选项与顺序、选择回调、「恢复默认」复位为 auto | 6 |
| `initialParams.test.ts` | 命令入口预填参数纯函数 `buildCommandInitialParams`(设计 019 §3.1): 各画布入口(筛选/排序/文本/数值/切割/补位/替换/日期)与旧对话框默认输出一致、无列时不猜 | 28 |
| `csv.test.ts` | CSV 工具函数 |  |
| `versionDiff.test.ts` | 版本差异计算 |  |
| `executionHistory.test.ts` | 执行历史持久化 |  |
| `panelDock.test.ts` | 面板停靠状态 |  |
| `params.test.ts` | 参数构造工具 |  |
| `separateHistory.test.ts` | 拆分结果 localStorage |  |
| `SeparateCSVDialog.test.tsx` | 拆分好/坏行对话框(设计 016/017): 流式/无表头选项、探测、上次结果、打开路径 |  |

> 全量以 `pnpm test` 为准(当前 24 个文件)。`check:index`(`pnpm check:index`)会校验本文件登记的路径真实存在。

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
| `utils/session.ts` | 会话快照序列化: `stripStepCommand`/`reconstructStep`/`serializeTabSnapshot`/`deserializeTabSnapshot` |
| `utils/format.ts` · `utils/params.ts` · `utils/platform.ts` · `utils/separateHistory.ts` · `utils/executionHistory.ts` · `utils/versionDiff.ts` · `utils/panelDock.ts` · `utils/csv.ts` | 其余纯函数工具(时间格式化、参数构造、平台判断、拆分结果/执行历史持久化、版本差异、面板停靠、CSV 工具) |

### 服务层 (`services/ai/`)

AI 助手前端逻辑,RAG 检索与提示词构建:

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
| `hooks/execution/` | 执行引擎: `useExecution`(装配)+ `runPipeline`/`executeBranch`(依赖显式注入)+ `buildBranches`/`buildPrefixToStep`/`serializeStepParams`/`resolveDelimiter` 纯函数(+`buildBranches.test.ts`) |
| `hooks/fileIO/` | `useFileOpen`/`useFileSave`/`useImportExport` + `pipelineScript.ts`(.sh/.ps1 内容纯函数生成) |
| `hooks/charts/processChartData.ts` | 图表数据后处理纯函数 |
| `useSession.ts` | 会话持久化: 启动恢复标签页、防抖自动保存(800ms)、beforeunload 兜底保存 |
| `useTabs.ts` | 标签页管理: 标签增删改、当前标签、管道状态读写、**文件读取的分隔符解析**: `loadCsvData(tabId, path, forcedDelimiter?)`。设计: `docs/design/018_open-file-delimiter-detection.md` |
| `usePipelineState.ts` | 管道状态: `updateTabPipeline` 单点更新管道+edges,撤销/重做状态管理 |
| `usePipelineVersions.ts` | 管道版本控制: 保存/恢复/删除版本、标签管理、步骤序列化与重建 |
| `usePipelineTemplates.ts` | 管道模板库(F4) |
| `useDataLineage.ts` | 数据血缘: 列类型推断、变换分析、血缘图数据构建与持久化 |
| `useExecutionHistory.ts` | 执行历史(F6) |
| `useAppSettings.ts` | 应用配置: 分隔符、无表头、通知、历史上限、托盘设置 |
| `useCsvProbe.ts` | 拆分对话框的文件探测(防抖 + 过期响应丢弃) |
| `useToast.ts` | Toast 通知 |
| `useLogs.ts` | 执行日志 |
| `useUIState.ts` | UI 状态: 对话框/面板开关(含命令面板、CSV 对比、编码转换) |
| `useBatchFilter.ts` | Batch Filter 执行逻辑(原 `BatchFilterHooks.ts`,019 §5.1 改名): 文件名清理、正则构建、批量筛选执行 |
| `useBatchConvert.ts` | 批量格式转换(原 `BatchConvertHooks.ts`): globToRegex、getBaseName、CSV↔XLSX↔JSON 转换 invoke 调用 |
| `useKeyboardShortcuts.ts` | 全局快捷键(原 `KeyboardShortcuts.ts`): Ctrl+K、Ctrl+D、Ctrl+O/N/S/I/E/Z/Y/R、Alt+C/Q/D/A、Shift+H/C/S |
| `useDraggable.ts` | 通用拖拽 hook — **019 §3.1 后已无引用,待删除** |

### 国际化 (`i18n/`)

| 文件 | 职责 |
|------|------|
| `i18n/index.tsx` | 语言上下文 Provider,持久化到 localStorage |
| `i18n/translations/types.ts` | `Language`/`EffectiveLanguage`/`Translations` 接口(504 key 的类型契约) |
| `i18n/translations/{en,zh}/<domain>.ts` | 按域拆分的字符串(019 §4.6): `common`/`pipeline`/`canvas`/`dialog`/`ai`/`settings`/`help`,各域 `satisfies Partial<Translations>` |
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
| `pipeline/nodes/TableNode.tsx` | 输入数据表格节点,支持表头重命名和右键菜单;四方向连接点;表头行的**分隔符徽标**(设计 018) |
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
| `data-preview/charts/ChartPanel.tsx` | 图表面板(recharts),折线/散点/柱状/直方图/饼图/词云/热力图,支持拖拽、最大化/还原、SVG 导出、dark mode |
| `ai/AIPanel.tsx` | **AI 助手面板**: 聊天 UI、命令生成、一键插入管道、👍/👎反馈、意图澄清对话框、对话历史加载 |
| `variables/VariablePanel.tsx` | 变量管理面板(F3 管道参数化) |
| `logs/LogPanel.tsx` | 浮动日志面板,显示执行结果,支持拖拽和复制 |
| `logs/CommandList.tsx` | **命令面板**,可拖拽浮动面板,按分类展示命令,支持搜索和历史记录 |
| `logs/CommandPalette.tsx` | **全局命令面板**(Ctrl/Cmd+K): 可搜索、键盘导航的动作/标签/最近文件/xan 命令列表 |

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
| `file/CsvDiffDialog.tsx` | CSV 双文件对比(Ctrl+D),分页避免卡顿 |
| `file/CsvEncodingDialog.tsx` | CSV 编码转换(auto/BOM 检测、UTF-8、GBK、GB18030、UTF-16 LE/BE、Latin-1);上次记录(完成时间/耗时/编码对/字节数 + 打开路径 + 清除记录 + 输出文件失效提示),打开时回填输入输出路径与源/目标编码。设计:`docs/design/020_encoding-conversion-history.md` |
| `file/PipelineTemplateDialog.tsx` | 管道模板库对话框(F4) |
| `app/ExecutionHistoryDialog.tsx` | 执行历史(F6) |
| `app/UpdateDialog.tsx` | 应用更新通知 |
| `common/ConfirmDialog.tsx` | 通用确认对话框 |
| `common/VariableValuesDialog.tsx` | 管道变量取值对话框(F3) |

### 通用组件 (`components/`)

零业务语义,禁止 import `modules/`、`data/`、`services/`(019 §5.2)。

#### `ui/` — 基础件(已统一 PascalCase)

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
| `menu/MainMenu.tsx` | 顶部工具栏: 文件菜单、撤销/重做、执行、命令面板、帮助/设置 |
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
| 修改管道执行取消 | `src-tauri/src/pipeline.rs`(`set_pipeline_cancelled` + `wait_with_cancel`) + `src/hooks/execution/useExecution.ts`(`handleCancelExecution`) |
| 修改 CSV 预览读取 | `src-tauri/src/csv.rs` 中的 `read_csv_file` 函数 |
| 修改打开文件的分隔符检测(工作流输入节点) | `src-tauri/src/csv.rs`(`read_csv_file` 的 `resolve_read_delimiter`/`read_csv_sync`)+ `src/hooks/useTabs.ts`(`loadCsvData` + 全局模式重载规则)+ `src/components/ui/DelimiterModeSelect.tsx`(共用控件)+ `src/modules/pipeline/nodes/TableNode.tsx`(徽标)+ `src/modules/pipeline/FlowPanel.tsx`/`src/modules/data-preview/HomeView.tsx`/`src/app/App.tsx`(透传)+ `src/utils/delimiterMode.ts`(设置 ⇄ 界面值换算)+ `src/hooks/execution/resolveDelimiter.ts` + `src/hooks/usePipelineTabs.ts`(`resolveRunDelimiter`,保证执行与预览同源)。设计:`docs/design/018_open-file-delimiter-detection.md` |
| 修改分隔符自动检测总开关 / 默认分隔符(设置页 ⇄ 输入节点同步) | `src-tauri/src/config.rs`(`auto_detect_delimiter` + `get/set_auto_detect_delimiter`、`get/set_default_delimiter`)+ `src/hooks/useAppSettings.ts` + `src/components/setting/SettingsTabContent.tsx`(分隔符区块)+ `src/components/ui/DelimiterModeSelect.tsx` + `src/app/App.tsx`(`delimiterMode`/`onDelimiterModeChange`,含即时落库)。设计:`docs/design/018_open-file-delimiter-detection.md` §3.9 |
| 修改 CSV 对比功能 | `src/modules/dialogs/file/CsvDiffDialog.tsx` + `src-tauri/src/csv.rs`(`diff_csv_files`) |
| 修改 CSV 编码转换 | `src/modules/dialogs/file/CsvEncodingDialog.tsx` + `src-tauri/src/csv.rs`(`convert_csv_encoding`)+ `src/utils/encodingHistory.ts`(上次记录持久化)。设计:`docs/design/020_encoding-conversion-history.md` |
| 修改拆分好/坏行 | `src/modules/dialogs/file/SeparateCSVDialog.tsx` + `src-tauri/src/csv.rs`(`separate_csv`/`separate_stream`/`probe_csv_file`)+ `src/hooks/useCsvProbe.ts` + `src/utils/separateHistory.ts` + `src-tauri/src/storage.rs`(`reveal_paths`) |
| 修改会话保存/恢复 | `src/hooks/useSession.ts` + `src/utils/session.ts` + `src-tauri/src/session.rs` |
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
| 修改命令帮助文档 | 运行 `node scripts/generate-help-docs.js` 重新生成 |
| 修改 Tauri 插件/权限 | `src-tauri/tauri.conf.json` + `src-tauri/capabilities/default.json` |
| 修改系统托盘/窗口行为 | `src-tauri/src/main.rs` 中的 `setup()` 和 `on_window_event` |
| 修改数据概况功能 | `src/modules/data-preview/DataProfilePanel.tsx` + `src-tauri/src/csv.rs` 中的 `profile_csv` + `src-tauri/src/storage.rs` 中的缓存函数 |
| 修改图表功能 | `src/modules/data-preview/charts/ChartPanel.tsx`(图表渲染+拖拽+导出) + `src/modules/dialogs/command/forms/`(ChartForm) + `src/hooks/execution/executeBranch.ts`(chart 分支)+ `src/hooks/charts/processChartData.ts` + `src/types/xan.ts`(ChartConfig等类型) |
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
| 修改测试 mock/setup | `src/test/setup.ts` |
| 修改 vitest 配置 | `vitest.config.ts` |
| 新增/修改 CLI 插件 | `plugins/<name>/`(独立 crate)+ `src/data/commands/index.ts`(命令定义)+ `src/modules/dialogs/command/forms/pinyin.tsx`(表单)+ `src-tauri/src/plugins.rs`(后端注册)+ `src/docs/cmd/<name>.md` 与 `docs/cmd_zh/<name>.md`(帮助文档,改后跑 `pnpm generate-help`) |
| 修改插件管理设置页 | `src/components/setting/SettingsTabContent.tsx`(Plugins 页签)+ `src-tauri/src/plugins.rs` |
