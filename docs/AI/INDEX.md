# Easy CSV — 项目模块索引

> 本文档为 AI 辅助开发提供代码结构速查,方便快速定位修改目标。

---

## 项目概述

Easy CSV 是一个基于 **Tauri v2** 的桌面应用,提供可视化界面来构建 [xan](https://github.com/medialab/xan) CSV 命令行工具的处理管道。用户通过拖拽方式将多个 CSV 操作(筛选、排序、去重、连接等)串联成管道,一键执行。

- **技术栈：** Rust (后端) + React/TypeScript (前端) + xan.exe (内嵌 CLI)

---

## 架构总览

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React + TypeScript)          │
│  src/App.tsx · components/ · hooks/ · data/         │
│  可视化管道编辑器 (ReactFlow) · CSV 预览表              │
│  命令配置 UI (shadcn) · i18n (中/英)                  │
│  通过 @tauri-apps/api invoke() 与后端通信             │
└────────────────────┬───────────────────────────────┘
                     │  IPC (Tauri v2 commands)
┌────────────────────▼────────────────────────────────┐
│               Backend (Rust / Tauri)                │
│  src-tauri/src/lib.rs (743 行,全部后端逻辑)           │
│  14 个 Tauri 命令处理器                               │
│  CSV 读取 (csv crate) · 管道执行 (进程管理)            │
│  配置/历史/最近文件 持久化 · 内嵌 xan.exe 解压           │
└────────────────────┬────────────────────────────────┘
                     │  子进程 (stdin/stdout 管道)
┌────────────────────▼────────────────────────────────┐
│              xan.exe (内嵌 CLI 二进制)                │
│  50+ CSV 操作命令 (filter, sort, join, ...)          │
└─────────────────────────────────────────────────────┘
```

---

## Rust 后端 (`src-tauri/src/`)

所有后端逻辑集中在 `lib.rs` 一个文件中(743 行),无内部模块拆分。

| 文件 | 行数 | 职责 |
|------|------|------|
| `main.rs` | 6 | 二进制入口,调用 `easy_csv::run()`。Windows release 模式下隐藏控制台窗口 |
| `lib.rs` | 743 | **全部后端逻辑**,详见下方分解 |
| `build.rs` | 3 | Tauri 构建脚本,生成平台特定代码 |

### lib.rs 内部结构

| 区域 | 行范围 | 职责 |
|------|--------|------|
| 内嵌二进制 | 顶部 | `include_bytes!("../resources/xan.exe")` 编译时嵌入 xan.exe |
| 数据类型 | 15-55 | `AppConfig`, `PipelineCommand`, `CommandParameter`, `ExecutionResult`, `CsvData` |
| Tauri 命令 | 57-87 | 14 个 IPC 命令注册 |
| 管道执行 | 89-516 | `execute_xan_pipeline` — 核心函数(428行),构建 CLI 参数、多进程管道、进程管理 |
| 配置管理 | 518-601 | 配置文件读写、资源目录、xan.exe 解压与查找 |
| 入口函数 | 719-743 | `run()` — 注册插件和命令处理器,启动 Tauri 应用 |

### Tauri 命令清单(前端可调用)

| 命令 | 功能 |
|------|------|
| `read_csv_file` | 读取 CSV 文件,返回表头 + 前51行预览 |
| `execute_xan_pipeline` | 执行多步骤 xan 管道(核心命令) |
| `check_xan_installed` | 检查 xan.exe 是否已解压 |
| `get/set_default_delimiter` | 读写默认分隔符配置 |
| `get/set_no_headers` | 读写无表头配置 |
| `set_window_title` | 设置窗口标题 |
| `save_history` / `load_history` | 管道执行历史持久化 |
| `save_recent_files` / `load_recent_files` | 最近文件列表持久化 |
| `toggle_devtools` | 切换开发者工具面板 |

---

## React 前端 (`src/`)

### 入口与全局

| 文件 | 职责 |
|------|------|
| `main.tsx` | 应用入口,包裹 ThemeProvider 和 LanguageProvider |
| `App.tsx` | **根组件**(877行),管理所有状态：标签页、管道、撤销/重做、日志、配置、历史记录、更新检查 |
| `index.css` | 全局 CSS,定义亮色/暗色主题变量、动画关键帧 |

### 数据与类型 (`data/` · `types/`)

| 文件 | 职责 |
|------|------|
| `data/commands.ts` | **所有 xan 命令定义**(3059行),~50个命令,含参数、分类、中英文描述 |
| `types/xan.ts` | 核心类型：`XanCommand`, `XanParameter`, `PipelineStep`, `PipelineEdge`, `LogEntry`, `PipelineTab`, `HistoricalPipeline` |
| `generated/help-docs.ts` | 自动生成的命令帮助文档(中英文),由 `scripts/generate-help-docs.js` 生成 |

### Hooks (`hooks/`)

| 文件 | 职责 |
|------|------|
| `MainMenuHooks.ts` | 主菜单业务逻辑(612行)：文件打开、保存、导入/导出管道、撤销/重做、执行管道(DFS 构建分支) |
| `KeyboardShortcuts.ts` | 全局快捷键注册：Ctrl+O/N/S/I/E/Z/Y/R, Shift+H/C/S |

### 国际化 (`i18n/`)

| 文件 | 职责 |
|------|------|
| `i18n/index.tsx` | 语言上下文 Provider,持久化到 localStorage |
| `i18n/translations.ts` | 中英文翻译字符串(~50个 key) |

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

### 组件 — 对话框 (`dialog/`)

每个对话框生成对应的 xan 命令参数：

| 文件 | 功能 | 生成的命令 |
|------|------|-----------|
| `CommandDialog.tsx` | 通用命令配置对话框(1200+行),为每种命令类型渲染专属表单 | 各种命令 |
| `FilterDialog.tsx` | 列筛选(文本/数值模式) | `search` / `filter` |
| `SortDialog.tsx` | 多列排序 | `sort` |
| `PivotDialog.tsx` | 透视表构建 | `pivot` / `groupby` / `agg` |
| `DateTransformDialog.tsx` | 日期格式转换(30+格式) | `map` (strftime) |
| `TextTransformDialog.tsx` | 文本变换(Len/Lower/Upper/Trim等) | `map` (字符串方法) |
| `NumberTransformDialog.tsx` | 数值变换(Abs/Floor/Ceil等) | `map` (数学函数) |
| `SplitDialog.tsx` | 字符串切割/分片 | `map` (slice/split) |
| `PadDialog.tsx` | 字符串填充 | `map` (pad) |
| `ReplaceDialog.tsx` | 查找替换(支持正则) | `map` (replace) |
| `WindowDialog.tsx` | 窗口函数(19种：rank/lag/lead/rolling等) | `window` |
| `UpdateDialog.tsx` | 应用更新通知 | — |

### 组件 — 菜单 (`menu/`)

| 文件 | 职责 |
|------|------|
| `MainMenu.tsx` | 顶部工具栏：文件菜单、撤销/重做、执行按钮、帮助/设置 |
| `ContextMenu.tsx` | 表格列右键菜单：快速筛选、替换、透视、日期/文本/数值变换、排序 |

### 组件 — 设置与主题 (`setting/`)

| 文件 | 职责 |
|------|------|
| `ThemeProvider.tsx` | 主题上下文,管理 dark/light/system 模式 |
| `SettingsDialog.tsx` | 设置对话框容器 |
| `SettingsTabContent.tsx` | 设置内容：语言、主题、分隔符、无表头选项 |
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
| `button.tsx` | 按钮(多种变体和尺寸) |
| `card.tsx` | 卡片容器 |
| `input.tsx` | 输入框 |
| `scroll-area.tsx` | 滚动区域 |
| `resize-handle.tsx` | 面板拖拽调整大小手柄 |
| `SearchableSelect.tsx` | 可搜索下拉选择框 |

---

## 快速索引：按修改场景查找

| 我想修改… | 看这些文件 |
|-----------|-----------|
| 新增/修改 xan 命令定义 | `src/data/commands.ts` |
| 新增/修改命令参数类型 | `src/types/xan.ts` |
| 新增对话框 | 参考 `src/components/dialog/FilterDialog.tsx`,并在 `HomeView.tsx` 中注册状态和渲染 |
| 修改管道执行逻辑 | `src-tauri/src/lib.rs` 中的 `execute_xan_pipeline` 函数 |
| 修改 CSV 预览读取 | `src-tauri/src/lib.rs` 中的 `read_csv_file` 函数 |
| 修改管道可视化布局 | `src/components/panel/FlowPanel.tsx`(主逻辑) + `panel/utils/layout.ts`(布局) + `panel/nodes/`(节点样式) |
| 修改菜单/快捷键 | `src/components/menu/MainMenu.tsx` + `src/hooks/KeyboardShortcuts.ts` |
| 修改右键菜单 | `src/components/menu/ContextMenu.tsx` |
| 修改主题/样式 | `src/index.css` + `src/components/setting/ThemeProvider.tsx` |
| 修改国际化文本 | `src/i18n/translations.ts` |
| 修改设置项 | `src/components/setting/SettingsTabContent.tsx` |
| 修改应用配置持久化 | `src-tauri/src/lib.rs` 中的 `load_config`/`save_config` 函数 |
| 修改历史记录 | `src/hooks/MainMenuHooks.ts` + `src-tauri/src/lib.rs` 中的 `save_history`/`load_history` |
| 修改帮助内容 | `src/components/help/HelpContent.ts` (英文) / `HelpContentCn.ts` (中文) |
| 修改命令帮助文档 | 运行 `node scripts/generate-help-docs.js` 重新生成 |
| 修改 Tauri 插件/权限 | `src-tauri/tauri.conf.json` + `src-tauri/capabilities/default.json` |
