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
│  src/App.tsx · components/ · hooks/ · services/     │
│  可视化管道编辑器 (ReactFlow) · CSV 预览表              │
│  命令配置 UI (shadcn) · i18n (中/英)                  │
│  表达式编辑器 (语法高亮 + 自动补全)                     │
│  AI 助手 (自然语言 → xan 命令, RAG 检索)              │
│  图表可视化 (recharts: 折线/散点/柱状/直方图)          │
│  管道版本控制 · 数据血缘追踪                           │
│  系统托盘 · 拖拽打开 · 数据概况 · 管道步骤复制粘贴      │
│  通过 @tauri-apps/api invoke() 与后端通信             │
└────────────────────┬───────────────────────────────┘
                     │  IPC (Tauri v2 commands)
┌────────────────────▼────────────────────────────────┐
│               Backend (Rust / Tauri)                │
│  src-tauri/src/                                     │
│  main.rs (入口) · lib.rs (模块声明)                   │
│  config.rs · xan.rs · pipeline.rs · csv.rs          │
│  storage.rs · ai.rs · ai_memory.rs                   │
│  AI 对话持久化 (ai_memory.db) · AI 配置 (config.db)     │
│  API Key 加密存储 (AES-256-GCM) · 35+ 个 Tauri 命令    │
│  CSV 读取 (csv crate) · 管道执行 (进程管理)            │
│  AI 代理 (DeepSeek/Qwen/GLM) · AI 记忆持久化          │
│  配置/历史持久化 · 数据概况缓存 · 版本/血缘存储         │
│  系统托盘                                             │
└────────────────────┬────────────────────────────────┘
                     │  子进程 (stdin/stdout 管道)
┌────────────────────▼────────────────────────────────┐
│              xan.exe (内嵌 CLI 二进制)                │
│  58 CSV 操作命令 (filter, sort, join, output, ...)   │
└─────────────────────────────────────────────────────┘
```

---

## Rust 后端 (`src-tauri/src/`)

后端按职责拆分为 8 个模块:

| 文件 | 职责 |
|------|------|
| `main.rs` | 二进制入口,注册插件/命令,系统托盘,窗口事件处理 |
| `lib.rs` | 模块声明 + `invoke_handler()` 函数(注册所有命令) |
| `config.rs` | `AppConfig` 类型、SQLite 持久化(app_config/ai_config 表)、AES-256-GCM 加密存储 API Key、per-provider API Key 管理、配置相关命令 |
| `xan.rs` | xan.exe 解压与查找、`check_xan_installed` 命令 |
| `pipeline.rs` | `PipelineCommand`/`ExecutionResult` 类型、`execute_xan_pipeline` 核心命令 |
| `csv.rs` | `CsvData` 类型、`read_csv_file`/`profile_csv` 命令 |
| `storage.rs` | 历史记录、最近文件、数据概况缓存、版本/血缘存储、窗口标题、开发者工具命令 |
| `ai.rs` | AI 对话代理: `call_ai` 命令,转发到 DeepSeek / Qwen / GLM |
| `ai_memory.rs` | AI 记忆持久化(SQLite): 对话历史、反馈记录、纠正规则的 CRUD + 清除 |
| `build.rs` | Tauri 构建脚本,生成平台特定代码 |

### 各模块职责详解

#### config.rs — 配置管理

| 内容 | 说明 |
|------|------|
| `AppConfig` 结构体 | `default_delimiter`, `no_headers`, `show_execution_notification`, `history_limit`, `minimize_to_tray` |
| `load_config()` / `save_config()` | JSON 配置文件读写 |
| `get_resources_dir()` | 资源目录路径(可执行文件旁) |
| `get/set_default_delimiter` | 默认分隔符配置命令 |
| `get/set_no_headers` | 无表头配置命令 |
| `get/set_show_execution_notification` | 执行通知配置命令 |
| `get/set_history_limit` | 历史记录条数上限配置命令 |
| `get/set_minimize_to_tray` | 最小化到托盘配置命令 |
| `get_ai_config()` / `set_ai_config()` | AI 配置读写(provider、model) |
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

#### csv.rs — CSV 操作

| 内容 | 说明 |
|------|------|
| `CsvData` | CSV 数据类型(headers + rows) |
| `read_csv_file` | 读取 CSV 文件,返回表头 + 前51行预览 |
| `profile_csv` | 调用 `xan stats` 生成数据概况统计 |

#### storage.rs — 持久化存储

| 内容 | 说明 |
|------|------|
| `save_history` / `load_history` | 管道执行历史 |
| `save_recent_files` / `load_recent_files` | 最近文件列表 |
| `load_profile_cache` / `save_profile_cache` | 数据概况缓存(LRU 淘汰,上限50条) |
| `save_pipeline_versions` / `load_pipeline_versions` | 管道版本持久化 |
| `save_lineage_data` / `load_lineage_data` | 数据血缘持久化 |
| `file_exists` | 文件存在性检查 |
| `set_window_title` | 设置窗口标题 |
| `toggle_devtools` | 切换开发者工具 |

#### ai.rs — AI 对话代理

| 内容 | 说明 |
|------|------|
| `call_ai` | 核心命令,按 provider 路由到 DeepSeek/Qwen/GLM |
| `call_deepseek` / `call_qwen` | OpenAI 兼容 Chat Completions 调用 |

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

### Tauri 命令清单(前端可调用)

| 命令 | 模块 | 功能 |
|------|------|------|
| `read_csv_file` | csv | 读取 CSV 文件,返回表头 + 前51行预览 |
| `execute_xan_pipeline` | pipeline | 执行多步骤 xan 管道(核心命令) |
| `profile_csv` | csv | 调用 `xan stats` 生成数据概况统计 |
| `load_profile_cache` / `save_profile_cache` | storage | 数据概况缓存(基于文件 mtime,LRU 淘汰,上限50条) |
| `check_xan_installed` | xan | 检查 xan.exe 是否已解压 |
| `get/set_default_delimiter` | config | 读写默认分隔符配置 |
| `get/set_no_headers` | config | 读写无表头配置 |
| `get/set_show_execution_notification` | config | 读写执行通知配置 |
| `get/set_history_limit` | config | 读写历史记录条数上限配置 |
| `get/set_minimize_to_tray` | config | 读写最小化到托盘配置 |
| `get/set_ai_config` | config | 读写 AI 配置(provider/model) |
| `save/load/delete/has_api_key` | config | Per-provider API Key 加密存储(AES-256-GCM) |
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
| `save_history` / `load_history` | storage | 管道执行历史持久化 |
| `save_recent_files` / `load_recent_files` | storage | 最近文件列表持久化 |
| `save_pipeline_versions` / `load_pipeline_versions` | storage | 管道版本持久化 |
| `save_lineage_data` / `load_lineage_data` | storage | 数据血缘持久化 |
| `file_exists` | storage | 检查文件是否存在 |
| `toggle_devtools` | storage | 切换开发者工具面板 |

---

## 测试基础设施

项目使用 **vitest 4.x** + **jsdom** + **@testing-library/jest-dom** 进行前端单元测试。

| 文件 | 职责 |
|------|------|
| `vitest.config.ts` | vitest 配置: jsdom 环境、`@/` 别名、`src/test/setup.ts` 作为 setup |
| `src/test/setup.ts` | Mock 全局 API: `@tauri-apps/api/core` (invoke)、`@tauri-apps/plugin-dialog`、`@tauri-apps/plugin-fs`、localStorage、matchMedia |

运行测试: `pnpm test`

### 测试文件 (`src/__tests__/`)

| 文件 | 职责 | 测试数 |
|------|------|--------|
| `commands.test.ts` | **核心测试**: 覆盖全部 58 个 xan 命令的参数构建正确性(命令名、参数名、值、isPositional、默认值) | ~76 |
| `invoke.test.ts` | App.tsx 中所有 invoke 调用模式验证(read_csv_file、配置读写、历史记录、错误处理、历史重建) | ~25 |
| `BatchFilterHooks.test.ts` | Batch Filter 执行逻辑: 文件名清理、正则构建、文本/数值筛选 invoke 形状、频率提取、多值批处理 | ~31 |
| `BatchConvertHooks.test.ts` | 批量格式转换: globToRegex、getBaseName、getOutputDir、CSV↔XLSX↔JSON 转换 invoke 模式 | ~23 |

---

## React 前端 (`src/`)

### 入口与全局

| 文件 | 职责 |
|------|------|
| `main.tsx` | 应用入口,包裹 ThemeProvider 和 LanguageProvider |
| `App.tsx` | **根组件**(948行) 管理所有状态: 标签页、管道、撤销/重做、日志、配置、历史记录、更新检查、拖拽打开、数据概况、历史记录上限、AI 面板、版本控制、数据血缘 |
| `index.css` | 全局 CSS,定义亮色/暗色主题变量、动画关键帧 |

### 数据与类型 (`data/` · `types/` · `utils/`)

| 文件 | 职责 |
|------|------|
| `data/commands.ts` | **所有 xan 命令定义**(3794行),58个命令,含参数、分类、中英文描述 |
| `data/functions.ts` | xan 表达式函数定义(200+,321行),含分类(string/number/array/date/aggregation/window/web/fuzzy/io/hashing)、关键字、运算符,供表达式编辑器补全和高亮使用 |
| `types/xan.ts` | 核心类型: `XanCommand`, `XanParameter`, `PipelineStep`, `PipelineEdge`, `LogEntry`, `PipelineTab`, `HistoricalPipeline`, `PipelineVersion`, `StepLineage`, `ColumnSchema`, `Transformation`, `StoredPipelineStep`, `ChartType`, `ChartConfig`, `ChartDataPoint`, `ChartSeries` |
| `generated/help-docs.ts` | 自动生成的命令帮助文档(中英文),由 `scripts/generate-help-docs.js` 生成 |
| `utils/format.ts` | `formatDateTime()` 时间格式化工具 |

### 服务层 (`services/ai/`)

AI 助手前端逻辑,RAG 检索与提示词构建:

| 文件 | 职责 |
|------|------|
| `services/ai/index.ts` | `sendAIMessage()` 入口: 校验 API Key、加载纠正规则、澄清检测、构建消息、调用 `callAI`; 对话历史/反馈/纠正规则 CRUD; Per-provider API Key 管理 |
| `services/ai/context.ts` | **提示词工程核心**(800+行): 意图路由(含同义词)、命令索引、RAG 检索、模糊匹配、纠正规则加权、意图澄清检测、对话历史上下文注入 |
| `services/ai/api.ts` | `callAI()` 各 provider 调用 + `parseJSONBlock()` 多行编号JSON解析器 |
| `services/ai/types.ts` | `AIConfig`/`AIMessage`/`AIResponse`/`AICommand`/`AIFeedback`/`CorrectionRule` 类型 + provider/模型常量 |

### Hooks (`hooks/`)

状态管理已从 App.tsx 拆分为多个 hook:

| 文件 | 职责 |
|------|------|
| `MainMenuHooks.ts` | 主菜单业务逻辑(911行): 文件打开、保存、导入/导出管道、撤销/重做、执行管道(DFS 构建分支) |
| `useTabs.ts` | 标签页管理(219行): 标签增删改、当前标签、管道状态读写(`getCurrentPipeline`/`getCurrentTab`/`setTabs`) |
| `usePipelineState.ts` | 管道状态(194行): `updateTabPipeline` 单点更新管道+edges,撤销/重做状态管理 |
| `usePipelineVersions.ts` | 管道版本控制(260行): 保存/恢复/删除版本、标签管理、步骤序列化与重建 |
| `useDataLineage.ts` | 数据血缘(467行): 列类型推断、变换分析、血缘图数据构建与持久化 |
| `useAppSettings.ts` | 应用配置(101行): 分隔符、无表头、通知、历史上限、托盘设置 |
| `useToast.ts` | Toast 通知(29行) |
| `useLogs.ts` | 执行日志(22行) |
| `useUIState.ts` | UI 状态(84行): 对话框/面板开关 |
| `BatchFilterHooks.ts` | Batch Filter 执行逻辑(621行): 文件名清理、正则构建、批量筛选执行(直接/带数据) |
| `BatchConvertHooks.ts` | 批量格式转换(305行): globToRegex、getBaseName、getOutputDir、CSV↔XLSX↔JSON 转换 invoke 调用 |
| `useDraggable.ts` | 通用拖拽 hook(91行): 管理拖拽位置、边界约束,用于命令面板和日志面板 |
| `KeyboardShortcuts.ts` | 全局快捷键注册(105行): Ctrl+O/N/S/I/E/Z/Y/R, Shift+H/C/S |

### 国际化 (`i18n/`)

| 文件 | 职责 |
|------|------|
| `i18n/index.tsx` | 语言上下文 Provider,持久化到 localStorage |
| `i18n/translations.ts` | 中英文翻译字符串(520+行,含 AI 面板、反馈、澄清、版本控制、血缘相关 key) |

### 工具函数 (`lib/`)

| 文件 | 职责 |
|------|------|
| `lib/utils.ts` | `cn()` — 合并 Tailwind CSS 类名 |

### 组件 — 核心视图

| 文件 | 职责 |
|------|------|
| `components/HomeView.tsx` | **主工作区**(844行),管理所有对话框状态、标签页、右键菜单、表格列重命名 |
| `components/CommandList.tsx` | **命令面板**(553行),可拖拽浮动面板,按分类展示命令,支持搜索和历史记录 |

### 组件 — 管道编辑 (`panel/`)

| 文件 | 职责 |
|------|------|
| `panel/FlowPanel.tsx` | **可视化管道编辑器主组件**(1164行),组合子组件,管理状态和事件处理 |
| `panel/AIPanel.tsx` | **AI 助手面板**(600+行): 聊天 UI、命令生成、一键插入管道、👍/👎反馈(可切换)、意图澄清对话框、对话历史加载 |
| `panel/VersionControlPanel.tsx` | 管道版本控制面板(256行): 版本列表、保存/恢复/删除、标签管理 |
| `panel/DataLineagePanel.tsx` | 数据血缘面板(298行): 列级血缘追踪、变换类型图标、保存血缘 |
| `panel/nodes/TableNode.tsx` | 输入数据表格节点,支持表头重命名和右键菜单 |
| `panel/nodes/PipelineStepNode.tsx` | 管道步骤节点,支持别名编辑、参数展示、切割动画 |
| `panel/nodes/index.ts` | 节点类型注册表(nodeTypes) |
| `panel/utils/cutGeometry.ts` | 切割几何计算:交点检测、clip-path 生成、坠落方向 |
| `panel/utils/layout.ts` | dagre 自动布局算法 + 节点/边生成(`getLayoutedElements`/`createEdgeConfig`) |
| `panel/overlays/SearchOverlay.tsx` | 画布搜索框 UI(Ctrl+F) |
| `panel/overlays/CutVisualization.tsx` | 切水果轨迹 SVG 渲染 |
| `panel/overlays/ConnectionVisualization.tsx` | 右键连接线 SVG 渲染 |
| `panel/CoordinateGrid.tsx` | ReactFlow 画布的坐标网格背景 |
| `panel/LogPanel.tsx` | 浮动日志面板,显示执行结果,支持拖拽和复制 |
| `panel/DataProfilePanel.tsx` | 数据概况面板,展示字段统计(计数/空值/极值/均值等),支持搜索 |
| `panel/ChartPanel.tsx` | 图表面板(recharts),支持折线/散点/柱状/直方图,支持拖拽、最大化/还原、SVG导出、dark mode |

### 组件 — 对话框 (`dialog/`)

每个对话框生成对应的 xan 命令参数: 

| 文件 | 功能 | 生成的命令 |
|------|------|-----------|
| `CommandDialog.tsx` | 通用命令配置对话框,薄包装器: 渲染标题栏+可拖拽容器,委托 `commands/` 目录下的表单组件 | 各种命令 |
| `FilterDialog.tsx` | 列筛选(文本/数值模式) | `search` / `filter` |
| `SortDialog.tsx` | 多列排序 | `sort` |
| `PivotDialog.tsx` | 透视表构建 | `pivot` / `groupby` / `agg` |
| `DateTransformDialog.tsx` | 日期格式转换(30+格式) | `map` (strftime) |
| `TextTransformDialog.tsx` | 文本变换(Len/Lower/Upper/Trim等) | `map` (字符串方法) |
| `NumberTransformDialog.tsx` | 数值变换(Abs/Floor/Ceil等) | `map` (数学函数) |
| `SplitDialog.tsx` | 字符串切割/分片 | `map` (slice/split) |
| `PadDialog.tsx` | 字符串填充 | `map` (pad) |
| `ReplaceDialog.tsx` | 查找替换(支持正则) | `map` (replace) |
| `WindowDialog.tsx` | 窗口函数(19种: rank/lag/lead/rolling等) | `window` |
| `BatchFilterDialog.tsx` | 批量筛选(按列值拆分为多个文件) | `batch-filter` |
| `UpdateDialog.tsx` | 应用更新通知 |  |
| `ConfirmDialog.tsx` | 通用确认对话框(F5 刷新等场景) |  |

#### 命令表单组件 (`dialog/commands/`)

所有命令类型的专属表单从 `CommandDialog.tsx` 拆分到独立目录,按 xan 命令分类组织: 

| 文件 | 职责 | 包含的命令 |
|------|------|-----------|
| `types.ts` | `CommandFormProps` 接口定义 + `COMMAND_LABELS` 标签映射(58个命令) |  |
| `index.ts` | `COMMAND_FORMS` 映射表(命令类型→表单组件),统一导出 | 全部命令 |
| `CommandFormWrapper.tsx` | 可复用表单包装器: ScrollArea + Cancel/Add/Update 按钮 + `handleCommandSubmit` 调用 |  |
| `helpers.ts` | `handleCommandSubmit()` 提交处理 + `updateParam()` 参数更新工具函数 |  |
| `parameterDescriptions.ts` | `getParameterDescription()` 参数描述查询,支持中英文 |  |
| `ExploreForms.tsx` | 数据探索表单 | `count`, `headers`, `view`, `flatten`, `hist`, `plot`, `chart` |
| `SearchFilterForms.tsx` | 搜索筛选表单 | `search`, `filter`, `head`, `tail`, `slice`, `top`, `sample`, `bisect` |
| `SortDedupForms.tsx` | 排序去重表单 | `sort`, `dedup`, `shuffle` |
| `AggregateForms.tsx` | 聚合统计表单 | `frequency`, `groupby`, `stats`, `agg`, `bins`, `window` |
| `CombineForms.tsx` | 多文件合并表单 | `cat`, `join`, `merge` |
| `TransformForms.tsx` | 列变换表单 | `select`, `drop`, `map`, `transform`, `enum`, `fill`, `complete`, `separate`, `blank` |
| `FormatForms.tsx` | 格式转换表单 | `behead`, `rename`, `input`, `fixlengths`, `fmt`, `explode`, `implode`, `from`, `to`, `scrape`, `reverse` |
| `TransposePivotForms.tsx` | 转置透视表单 | `transpose`, `pivot`, `unpivot` |
| `PartitionForms.tsx` | 分割拆分表单 | `split`, `partition` |
| `GenerateForms.tsx` | 生成 CSV 表单 | `range` |
| `ScriptingForms.tsx` | 脚本执行表单 | `run`, `eval` |
| `CustomForms.tsx` | 自定义扩展表单 | `output`, `batch-filter`, `batch-from`, `batch-to` |

### 组件 — 表达式编辑器 (`expression/`)

为 xan moonblade 表达式提供语法高亮和自动补全: 

| 文件 | 职责 |
|------|------|
| `ExpressionEditor.tsx` | 主组件: textarea + 同步高亮层 + 自动补全下拉,用于 map/filter/agg 等命令 |
| `highlight.ts` | 表达式语法高亮: 分词器(tokenizer) + HTML 生成,支持关键字/函数/字符串/数字/运算符/列引用/注释 |
| `autocomplete.ts` | 自动补全引擎: 函数/关键字/列名/运算符建议,支持键盘导航(↑↓/Enter/Tab/Esc) |
| `data/functions.ts` | 200+ xan 函数定义(字符串/数值/数组/日期/聚合/窗口/Web/Fuzzy/IO/Hashing 等分类) |

### 组件 — 菜单 (`menu/`)

| 文件 | 职责 |
|------|------|
| `MainMenu.tsx` | 顶部工具栏: 文件菜单、撤销/重做、执行按钮、帮助/设置 |
| `ContextMenu.tsx` | 表格列右键菜单: 快速筛选、替换、透视、日期/文本/数值变换、排序 |

### 组件 — 设置与主题 (`setting/`)

| 文件 | 职责 |
|------|------|
| `ThemeProvider.tsx` | 主题上下文,管理 dark/light/system 模式 |
| `SettingsDialog.tsx` | 设置对话框容器 |
| `SettingsTabContent.tsx` | 设置内容: 语言、主题、分隔符、无表头选项、执行通知开关、历史记录条数上限、AI 配置(provider/model/apiKey)、AI 学习数据管理(清除对话/反馈/纠正规则) |
| `Toast.tsx` | Toast 通知系统 |


### 组件 — 帮助 (`help/`)

| 文件 | 职责 |
|------|------|
| `HelpContent.ts` | 英文帮助内容(Markdown) |
| `HelpContentCn.ts` | 中文帮助内容 |
| `HelpDialog.tsx` | 帮助对话框,支持 Ctrl+F 搜索 |
| `HelpMarkdown.tsx` | 自定义 Markdown 渲染器,支持搜索高亮 |

### 组件 — UI 基础组件 (`ui/`)

| 文件 | 职责 |
|------|------|
| `button.tsx` | 按钮 |
| `card.tsx` | 卡片容器 |
| `input.tsx` | 输入框 |
| `scroll-area.tsx` | 滚动区域 |
| `resize-handle.tsx` | 面板拖拽调整大小手柄 |
| `tooltip.tsx` | Tooltip 提示组件,支持 top/bottom/left/right 定位 |
| `SearchableSelect.tsx` | 可搜索下拉选择框 |

---

## 快速索引: 按修改场景查找

| 我想修改… | 看这些文件 |
|-----------|-----------|
| 新增/修改 xan 命令定义 | `src/data/commands.ts` |
| 新增/修改命令参数类型 | `src/types/xan.ts` |
| 新增/修改命令表单 | `src/components/dialog/commands/` 目录,按分类选择对应 Form 文件,在 `index.ts` 注册到 `COMMAND_FORMS` |
| 修改命令参数描述 | `src/components/dialog/commands/parameterDescriptions.ts` + `src/data/commands.ts`(参数 description 字段) |
| 新增对话框 | 参考 `src/components/dialog/FilterDialog.tsx`,并在 `HomeView.tsx` 中注册状态和渲染 |
| 修改管道执行逻辑 | `src-tauri/src/pipeline.rs` 中的 `execute_xan_pipeline` 函数 |
| 修改 CSV 预览读取 | `src-tauri/src/csv.rs` 中的 `read_csv_file` 函数 |
| 修改管道可视化布局 | `src/components/panel/FlowPanel.tsx`(主逻辑) + `panel/utils/layout.ts`(布局) + `panel/nodes/`(节点样式) |
| 修改菜单/快捷键 | `src/components/menu/MainMenu.tsx` + `src/hooks/KeyboardShortcuts.ts` |
| 修改右键菜单 | `src/components/menu/ContextMenu.tsx` |
| 修改主题/样式 | `src/index.css` + `src/components/setting/ThemeProvider.tsx` |
| 修改设置选择器样式 | `src/components/setting/SettingsTabContent.tsx` |
| 修改国际化文本 | `src/i18n/translations.ts` |
| 修改设置项 | `src/components/setting/SettingsTabContent.tsx` |
| 修改应用配置持久化 | `src-tauri/src/config.rs` 中的 `load_config`/`save_config` 函数 |
| 修改历史记录 | `src/hooks/MainMenuHooks.ts` + `src-tauri/src/storage.rs` 中的 `save_history`/`load_history` |
| 修改历史记录上限 | `src-tauri/src/config.rs` + `src-tauri/src/storage.rs` + `src/components/setting/SettingsTabContent.tsx` |
| 修改 Batch Filter 功能 | `src/hooks/BatchFilterHooks.ts` + `src/components/dialog/BatchFilterDialog.tsx` + `src/data/commands.ts` |
| 修改 Batch Convert 功能 | `src/hooks/BatchConvertHooks.ts` + `src/hooks/MainMenuHooks.ts` |
| 修改 AI 面板 UI/交互 | `src/components/panel/AIPanel.tsx` |
| 修改 AI 反馈/澄清逻辑 | `src/components/panel/AIPanel.tsx` + `src/services/ai/index.ts` |
| 修改 AI 提示词/意图路由 | `src/services/ai/context.ts`(`INTENT_ROUTES`/`retrieveRelevantCommands`/`buildSystemPrompt`) |
| 修改 AI 模糊匹配/同义词 | `src/services/ai/context.ts`(`fuzzyMatch`/`expandWithSynonyms`) |
| 修改 AI 纠正规则逻辑 | `src/services/ai/context.ts` + `src/services/ai/index.ts` + `src-tauri/src/ai_memory.rs` |
| 修改 AI 意图澄清逻辑 | `src/services/ai/context.ts`(`detectClarificationNeed`/`CLARIFICATION_PATTERNS`) |
| 修改 AI 大模型调用/代理 | `src-tauri/src/ai.rs`(后端代理) + `src/services/ai/api.ts`(前端调用) |
| 修改 AI 多行JSON解析 | `src/services/ai/api.ts`(`parseJSONBlock`) |
| 修改 AI 记忆持久化 | `src-tauri/src/ai_memory.rs` + `src/services/ai/index.ts` |
| 修改 AI 配置(provider/model/key) | `src/services/ai/types.ts`(常量) + `src/components/setting/SettingsTabContent.tsx`(UI) + `src-tauri/src/config.rs`(持久化) |
| 修改 AI 学习数据管理 | `src/components/setting/SettingsTabContent.tsx` + `src-tauri/src/ai_memory.rs` |
| 修改命令使用文档 | `docs/AI_usage/*.md`(生成源: `scripts/generate-ai-usage-docs.ts`) / 合并版: `docs/AI/USAGE.md` |
| 修改命令帮助文档(英文) | `src/docs/cmd/*.md` |
| 修改命令帮助文档(中文) | `docs/cmd_zh/*.md` |
| 修改管道版本控制 | `src/hooks/usePipelineVersions.ts` + `src/components/panel/VersionControlPanel.tsx` + `src-tauri/src/storage.rs` |
| 修改数据血缘 | `src/hooks/useDataLineage.ts` + `src/components/panel/DataLineagePanel.tsx` + `src-tauri/src/storage.rs` |
| 修改帮助内容 | `src/components/help/HelpContent.ts` (英文) / `HelpContentCn.ts` (中文) |
| 修改命令帮助文档 | 运行 `node scripts/generate-help-docs.js` 重新生成 |
| 修改 Tauri 插件/权限 | `src-tauri/tauri.conf.json` + `src-tauri/capabilities/default.json` |
| 修改系统托盘/窗口行为 | `src-tauri/src/main.rs` 中的 `setup()` 和 `on_window_event` |
| 修改数据概况功能 | `src/components/panel/DataProfilePanel.tsx` + `src-tauri/src/csv.rs` 中的 `profile_csv` + `src-tauri/src/storage.rs` 中的缓存函数 |
| 修改图表功能 | `src/components/panel/ChartPanel.tsx`(图表渲染+拖拽+导出) + `src/components/dialog/commands/ExploreForms.tsx`(ChartForm) + `src/hooks/MainMenuHooks.ts`(chart执行逻辑) + `src/types/xan.ts`(ChartConfig等类型) |
| 修改图表命令文档 | `src/docs/cmd/chart.md`(英文) / `docs/cmd_zh/chart.md`(中文) |
| 管道步骤复制粘贴 | `src/components/panel/FlowPanel.tsx` 中的 `handleCopyStep`/`handlePasteStep` |
| 管道步骤自动连线 | `src/App.tsx` 中的 `handleCommandClick`(仅 AI 添加时 `autoConnect=true` 自动连线) |
| 修改表达式编辑器 | `src/components/expression/` 目录: `ExpressionEditor.tsx`(主组件) + `highlight.ts`(高亮) + `autocomplete.ts`(补全) |
| 修改函数定义/补全列表 | `src/data/functions.ts`(200+函数定义) |
| 修改拖拽交互行为 | `src/components/panel/FlowPanel.tsx`(管道节点拖拽) + `src/components/CommandList.tsx`(命令面板拖拽) + `src/hooks/useDraggable.ts`(通用拖拽逻辑) |
| 修改右键菜单选项/行为 | `src/components/menu/ContextMenu.tsx` |
| 修改动画/过渡效果 | `src/index.css`(关键帧定义) + 各组件内联动画逻辑 |
| 修改 Toast/通知样式 | `src/components/setting/Toast.tsx` |
| 修改 Tooltip 组件 | `src/components/ui/tooltip.tsx` |
| 修改表格列交互(重命名/右键) | `src/components/HomeView.tsx` |
| 修改管道节点样式 | `src/components/panel/nodes/PipelineStepNode.tsx` |
| 修改切割动画效果 | `src/components/panel/utils/cutGeometry.ts` + `src/components/panel/overlays/CutVisualization.tsx` |
| 修改 xan.exe 解压/查找 | `src-tauri/src/xan.rs` |
| 新增/修改前端测试 | `src/__tests__/` 目录 + `vitest.config.ts` + `src/test/setup.ts` |
| 测试 xan 命令参数正确性 | `src/__tests__/commands.test.ts` |
| 测试 Tauri invoke 调用模式 | `src/__tests__/invoke.test.ts` |
| 测试 Batch Filter 逻辑 | `src/__tests__/BatchFilterHooks.test.ts` |
| 测试 Batch Convert 逻辑 | `src/__tests__/BatchConvertHooks.test.ts` |
| 修改测试 mock/setup | `src/test/setup.ts` |
| 修改 vitest 配置 | `vitest.config.ts` |
