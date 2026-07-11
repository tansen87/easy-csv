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
│  src/App.tsx · components/ · hooks/ · data/         │
│  可视化管道编辑器 (ReactFlow) · CSV 预览表              │
│  命令配置 UI (shadcn) · i18n (中/英)                  │
│  表达式编辑器 (语法高亮 + 自动补全)                     │
│  系统托盘 · 拖拽打开 · 数据概况 · 管道步骤复制粘贴      │
│  历史记录上限管理 · 系统主题跟随                          │
│  通过 @tauri-apps/api invoke() 与后端通信             │
└────────────────────┬───────────────────────────────┘
                     │  IPC (Tauri v2 commands)
┌────────────────────▼────────────────────────────────┐
│               Backend (Rust / Tauri)                │
│  src-tauri/src/                                     │
│  main.rs (入口) · lib.rs (模块声明)                   │
│  config.rs · xan.rs · pipeline.rs                   │
│  csv.rs · storage.rs                                │
│  18 个 Tauri 命令处理器                               │
│  CSV 读取 (csv crate) · 管道执行 (进程管理)            │
│  配置/历史/最近文件 持久化 · 数据概况缓存               │
│  内嵌 xan.exe 解压 · 系统托盘 · 窗口状态保存           │
└────────────────────┬────────────────────────────────┘
                     │  子进程 (stdin/stdout 管道)
┌────────────────────▼────────────────────────────────┐
│              xan.exe (内嵌 CLI 二进制)                │
│  50+ CSV 操作命令 (filter, sort, join, ...)          │
└─────────────────────────────────────────────────────┘
```

---

## Rust 后端 (`src-tauri/src/`)

后端按职责拆分为 6 个模块: 

| 文件 | 职责 |
|------|------|
| `main.rs` | 二进制入口,注册插件/命令,系统托盘,窗口事件处理 |
| `lib.rs` | 模块声明 + `invoke_handler()` 函数(注册所有命令) |
| `config.rs` | `AppConfig` 类型、配置文件读写、配置相关命令 |
| `xan.rs` | xan.exe 解压与查找、`check_xan_installed` 命令 |
| `pipeline.rs` | `PipelineCommand`/`ExecutionResult` 类型、`execute_xan_pipeline` 核心命令 |
| `csv.rs` | `CsvData` 类型、`read_csv_file`/`profile_csv` 命令 |
| `storage.rs` | 历史记录、最近文件、数据概况缓存、窗口标题、开发者工具命令 |
| `build.rs` | Tauri 构建脚本,生成平台特定代码 |

### 各模块职责详解

#### config.rs — 配置管理

| 内容 | 说明 |
|------|------|
| `AppConfig` 结构体 | `default_delimiter`, `no_headers`, `show_execution_notification`, `history_limit` |
| `load_config()` / `save_config()` | JSON 配置文件读写 |
| `get_resources_dir()` | 资源目录路径(可执行文件旁) |
| `get/set_default_delimiter` | 默认分隔符配置命令 |
| `get/set_no_headers` | 无表头配置命令 |
| `get/set_show_execution_notification` | 执行通知配置命令 |
| `get/set_history_limit` | 历史记录条数上限配置命令 |

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
| `set_window_title` | 设置窗口标题 |
| `toggle_devtools` | 切换开发者工具 |

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
| `set_window_title` | storage | 设置窗口标题 |
| `save_history` / `load_history` | storage | 管道执行历史持久化 |
| `save_recent_files` / `load_recent_files` | storage | 最近文件列表持久化 |
| `toggle_devtools` | storage | 切换开发者工具面板 |

---

## React 前端 (`src/`)

### 入口与全局

| 文件 | 职责 |
|------|------|
| `main.tsx` | 应用入口,包裹 ThemeProvider 和 LanguageProvider |
| `App.tsx` | **根组件** 管理所有状态: 标签页、管道、撤销/重做、日志、配置、历史记录、更新检查、拖拽打开、数据概况、历史记录上限 |
| `index.css` | 全局 CSS,定义亮色/暗色主题变量、动画关键帧 |

### 数据与类型 (`data/` · `types/`)

| 文件 | 职责 |
|------|------|
| `data/commands.ts` | **所有 xan 命令定义**(3059行),~51个命令,含参数、分类、中英文描述 |
| `types/xan.ts` | 核心类型: `XanCommand`, `XanParameter`, `PipelineStep`, `PipelineEdge`, `LogEntry`, `PipelineTab`, `HistoricalPipeline` |
| `generated/help-docs.ts` | 自动生成的命令帮助文档(中英文),由 `scripts/generate-help-docs.js` 生成 |

### Hooks (`hooks/`)

| 文件 | 职责 |
|------|------|
| `MainMenuHooks.ts` | 主菜单业务逻辑(887行): 文件打开、保存、导入/导出管道、撤销/重做、执行管道(DFS 构建分支) |
| `BatchFilterHooks.ts` | Batch Filter 执行逻辑: 文件名清理、正则构建、批量筛选执行(直接/带数据) |
| `KeyboardShortcuts.ts` | 全局快捷键注册: Ctrl+O/N/S/I/E/Z/Y/R, Shift+H/C/S |

### 国际化 (`i18n/`)

| 文件 | 职责 |
|------|------|
| `i18n/index.tsx` | 语言上下文 Provider,持久化到 localStorage |
| `i18n/translations.ts` | 中英文翻译字符串(~80个 key) |

### 工具函数 (`lib/`)

| 文件 | 职责 |
|------|------|
| `lib/utils.ts` | `cn()` — 合并 Tailwind CSS 类名 |

### 组件 — 核心视图

| 文件 | 职责 |
|------|------|
| `components/HomeView.tsx` | **主工作区**(550行),管理所有对话框状态、标签页、右键菜单、表格列重命名 |
| `components/CommandList.tsx` | **命令面板**(503行),可拖拽浮动面板,按分类展示命令,支持搜索和历史记录 |

### 组件 — 管道编辑 (`panel/`)

| 文件 | 职责 |
|------|------|
| `panel/FlowPanel.tsx` | **可视化管道编辑器主组件**,组合子组件,管理状态和事件处理 |
| `panel/nodes/TableNode.tsx` | 输入数据表格节点,支持表头重命名和右键菜单 |
| `panel/nodes/PipelineStepNode.tsx` | 管道步骤节点,支持别名编辑、参数展示、切割动画 |
| `panel/nodes/index.ts` | 节点类型注册表(nodeTypes) |
| `panel/utils/cutGeometry.ts` | 切割几何计算:交点检测、clip-path 生成、坠落方向 |
| `panel/utils/layout.ts` | dagre 自动布局算法 + 节点/边生成 |
| `panel/overlays/SearchOverlay.tsx` | 画布搜索框 UI(Ctrl+F) |
| `panel/overlays/CutVisualization.tsx` | 切水果轨迹 SVG 渲染 |
| `panel/overlays/ConnectionVisualization.tsx` | 右键连接线 SVG 渲染 |
| `panel/CoordinateGrid.tsx` | ReactFlow 画布的坐标网格背景 |
| `panel/LogPanel.tsx` | 浮动日志面板,显示执行结果,支持拖拽和复制 |
| `panel/DataProfilePanel.tsx` | 数据概况面板,展示字段统计(计数/空值/极值/均值等),支持搜索 |

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
| `types.ts` | `CommandFormProps` 接口定义 + `COMMAND_LABELS` 标签映射(59个命令) |  |
| `index.ts` | `COMMAND_FORMS` 映射表(命令类型→表单组件),统一导出 | 全部命令 |
| `CommandFormWrapper.tsx` | 可复用表单包装器: ScrollArea + Cancel/Add/Update 按钮 + `handleCommandSubmit` 调用 |  |
| `helpers.ts` | `handleCommandSubmit()` 提交处理 + `updateParam()` 参数更新工具函数 |  |
| `ExploreForms.tsx` | 数据探索表单 | `count`, `headers`, `view`, `flatten`, `hist`, `plot` |
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
| `data/xan-functions.ts` | 200+ xan 函数定义(字符串/数值/数组/日期/聚合/窗口/Web/Fuzzy/IO/Hashing 等分类) |

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
| `SettingsTabContent.tsx` | 设置内容: 语言、主题、分隔符、无表头选项、执行通知开关、历史记录条数上限 |
| `Toast.tsx` | Toast 通知系统 |
| `PersistentNotification.tsx` | 持久通知面板(右上角,可折叠) |

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
| `SearchableSelect.tsx` | 可搜索下拉选择框 |

---

## 快速索引: 按修改场景查找

| 我想修改… | 看这些文件 |
|-----------|-----------|
| 新增/修改 xan 命令定义 | `src/data/commands.ts` |
| 新增/修改命令参数类型 | `src/types/xan.ts` |
| 新增/修改命令表单 | `src/components/dialog/commands/` 目录,按分类选择对应 Form 文件,在 `index.ts` 注册到 `COMMAND_FORMS` |
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
| 修改帮助内容 | `src/components/help/HelpContent.ts` (英文) / `HelpContentCn.ts` (中文) |
| 修改命令帮助文档 | 运行 `node scripts/generate-help-docs.js` 重新生成 |
| 修改 Tauri 插件/权限 | `src-tauri/tauri.conf.json` + `src-tauri/capabilities/default.json` |
| 修改系统托盘/窗口行为 | `src-tauri/src/main.rs` 中的 `setup()` 和 `on_window_event` |
| 修改数据概况功能 | `src/components/panel/DataProfilePanel.tsx` + `src-tauri/src/csv.rs` 中的 `profile_csv` + `src-tauri/src/storage.rs` 中的缓存函数 |
| 管道步骤复制粘贴 | `src/components/panel/FlowPanel.tsx` 中的 `handleCopyStep`/`handlePasteStep` |
| 修改表达式编辑器 | `src/components/expression/` 目录: `ExpressionEditor.tsx`(主组件) + `highlight.ts`(高亮) + `autocomplete.ts`(补全) |
| 修改函数定义/补全列表 | `src/data/xan-functions.ts`(200+函数定义) |
| 修改拖拽交互行为 | `src/components/panel/FlowPanel.tsx`(管道节点拖拽) + `src/components/CommandList.tsx`(命令面板拖拽) |
| 修改右键菜单选项/行为 | `src/components/menu/ContextMenu.tsx` |
| 修改动画/过渡效果 | `src/index.css`(关键帧定义) + 各组件内联动画逻辑 |
| 修改 Toast/通知样式 | `src/components/setting/Toast.tsx` + `src/components/setting/PersistentNotification.tsx` |
| 修改表格列交互(重命名/右键) | `src/components/HomeView.tsx` |
| 修改管道节点样式 | `src/components/panel/nodes/PipelineStepNode.tsx` |
| 修改切割动画效果 | `src/components/panel/utils/cutGeometry.ts` + `src/components/panel/overlays/CutVisualization.tsx` |
| 修改 xan.exe 解压/查找 | `src-tauri/src/xan.rs` |
