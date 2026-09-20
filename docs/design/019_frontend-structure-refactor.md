# 前端目录结构与巨型文件重构方案

> 本文回答一个既有文档都没回答的问题:**文件该放在哪里、怎么搬、搬完长什么样**。
> 全部数字为 **2026-09-20 源码实测值**,与 `docs/AI/INDEX.md` 载明的旧值存在漂移,以本文为准。

## 0. 实施状态(2026-09-20 回写)

| 阶段 | 状态 | 说明 |
|------|------|------|
| 阶段 0 安全网 | ✅ 已实施 | `pnpm typecheck` / `pnpm lint`;`eslint.config.js` 启用 `rules-of-hooks`/`exhaustive-deps`/`import/no-cycle`(必须配 `import/parsers`,否则静默漏报)。TS7 与 typescript-eslint 并存:`typescript` alias 到 `@typescript/typescript6`,`@typescript/native` 提供 TS7 的 `tsc` |
| 1.1 类型下沉 | ✅ 已实施 | `types/dialog.ts` 承载 `CommandDialogType`/`CommandDialogState`/`CommandFormProps`/`COMMAND_LABELS` 与画布入口上下文类型;`import/no-cycle` 18 → 0 |
| 1.2 预填纯函数 | ✅ 已实施 | `modules/dialogs/command/lib/initialParams.ts` + `initialParams.test.ts`(28 例)。六个入口(日期/slice/pad/replace/文本/数字)都落到 `map`,context 用 `mapScaffold` 判别 |
| 1.3 收敛双实现 | ✅ 已实施 | HomeView 一个 `openCommandFromContext()`;入口 props `(col, x, y, v)` → `(col, v)`;`ContextMenu` 的 `startsWith("split")` 猜测改为显式映射(顺带修掉纯 `split` 项被判成空串的隐患) |
| 1.4 目录重组 | ✅ 已实施 | `components/dialog/**` → `modules/dialogs/{command,file,app,common}`;`CommandFormWrapper` → `CommandFormShell` |
| 1.5 VariableHint | ✅ 已实施 | → `components/ui/VariableHint.tsx` |
| 1.6 表单一命令一文件 | ✅ 已实施 | 13 个聚合文件(最大 1351 行)→ 61 个 `forms/<命令id>.tsx` + `_shared.tsx`(最大 376 行);61 个命令,非本文档所称 59 |
| 1.7 删除旧文件 | ✅ 已实施 | 11 个旧对话框 + `command/legacy/` 删除;`BatchFilterConfig` 迁往 `types/xan.ts` |
| 2.1 MainMenuHooks | ✅ 已实施 | 拆为 `hooks/execution/`(useExecution + runPipeline + executeBranch + buildBranches/buildPrefixToStep/serializeStepParams/resolveDelimiter)+ `hooks/fileIO/`(useFileOpen/useFileSave/useImportExport + pipelineScript)+ `hooks/charts/processChartData` + `hooks/usePipelineTabs`;纯函数依赖显式化,`buildBranches.test.ts` 新增(线性/分支/环/S1-4);MainMenuHooks.ts 删除,共享类型下沉 `types/execution.ts` |
| 2.2 FlowPanel | 🔶 基本实施 | 抽出 `pipeline/hooks/`:useCanvasSearch、useStepClipboard、useNodeHitTest、useCutTool、useConnectGesture、usePipelineLayout;FlowPanel 1,834 → 999 行( JSX/props/onConnect 留守,≤ 600 目标未达);交互 hook 均经 onStepsChange/onEdgesChange,撤销栈语义不变 |
| 2.3 App.tsx | 🔶 部分实施 | `src/App.tsx` → `src/app/App.tsx`,`src/app/providers/AppProviders.tsx` 收拢 Provider;`useAppBootstrap`(启动初始化/会话恢复/F12·F5/拖拽打开/完成通知/窗口标题)与 `useDialogStack`(Esc 只关最上层,history/templates 两对话框已接入)落地;1,827 → 1,769 行,AppLayout JSX 拆分与 `ui.*` 31 个开关全量迁移未做 |
| 2.4 data/commands | ✅ 已实施 | `data/commands/` 目录,13 个分类文件,聚合出口不变,**`commands.test.ts` 零修改全绿**;校验过分类在原数组中是连续段,命令顺序不变 |
| 2.5 ChartPanel | ⬜ 未实施 | 图表渲染是散在 39 个 return 里的内联 JSX,抽取成 7 个组件需逐段精读 + 人工看渲染结果 |
| 2.6 HomeView Props | ⬜ 未实施 | 实测 54 个字段;分组到 ~13 个顶层字段可行,但分组对象需 `useMemo` 否则破坏 React.memo |
| 2.7 translations | ✅ 已实施 | `translations/{en,zh}/<domain>.ts`(7 域)+ `types.ts` + 聚合出口;`@/i18n/translations` 路径不变,`i18n.test.tsx` 全绿 |
| 3.1/3.2 目录搬迁 | ✅ 已实施 | `components/panel/**` + 3 个裸组件 → `modules/{pipeline,data-preview,ai,variables,logs}`;`panel/utils/` → `pipeline/lib/` |
| 3.3 ui/ 命名 | ✅ 已实施 | 8 个小写 → PascalCase(Windows 上需两步改名) |
| 3.4 hooks/ 命名 | ✅ 已实施 | `useBatchFilter`/`useBatchConvert`/`useKeyboardShortcuts` 已改;`MainMenuHooks` 随 2.1 拆分删除 |
| 3.5–3.7 中型拆分 | ⬜ 未实施 | |
| 3.8 INDEX.md | ✅ 已实施 | 前端章节按新结构重写、移除易漂移行数、补测试清单、修正 8 处失效路径;`pnpm check:index` 校验 |
| 4.1 规则固化 | 🔶 部分实施 | `max-lines`(400/数据与测试 800)与「components 禁引业务代码」已上,均为 `warn`;`modules/` 互引用本地规则 `warn`(HomeView 仍是装配根,待 005 A2) |
| 4.2 CI 门禁 | ✅ 已实施 | `build.yml` 增加 `pnpm lint` / `pnpm typecheck` / `pnpm check:index` |
| 4.3 check-index | ✅ 已实施 | `scripts/check-index.ts`(剥离代码块后校验 99 个路径) |
| 4.4 行数标注 | ✅ 已实施 | 前端章节已移除,标注结构快照日期 |

**验证基线(每次阶段后全跑)**:`tsc --noEmit` 0 错;`vitest` 24 文件 / 359 用例全绿;`vite build` 成功;`eslint` 13 个 error 全为重构前既有;`check:index` 107 路径全通过。

**顺带修复的真 bug**:① `CommandDialog` 在 hooks 之前 `return null`(违反 rules-of-hooks);② `TextTransformDialog` 的 `strip` 在模板字面量里写 `\r\t\n`,JS 展开成裸控制字符塞进生成的正则;③ `ContextMenu` 用 `startsWith("split")` 推 slice 类型,纯 `split` 项被判成空串;④ `TableNode` 分隔符徽标缺 `title`。

**遗留**:`src/hooks/useDraggable.ts` 已无引用,待删。


**与既有设计文档的分工**

| 文档 | 已覆盖 | 本文关系 |
|------|--------|---------|
| `005_architecture-engineering-optimization.md` | 巨型文件拆分(粗粒度)、Props 收敛、懒加载、ESLint/CI、测试盲区 | 承接其 A1,**补齐拆分粒度与目录落点**,不重复其结论 |
| `007_ui-design-optimization.md` | 对话框视觉与交互(D1 统一外壳、D4 Esc/可达性) | 承接其 D1,补齐 **`dialog/` 目录结构与"双实现"消除** |
| `006_feature-expansion-plan.md` | 功能扩展 F1–F6 | 新文件落位以本文目录规范为准 |
| `003_canvas-ux-optimization.md` | 画布内交互 | 不涉及 |

---

## 1. 实测基线

### 1.1 总量

| 指标 | 实测 | 说明 |
|------|------|------|
| `src/` 下 `.ts`/`.tsx` | **153 个** | 不含 `src-tauri/` |
| 总行数 | **51,551 行** | |
| 超 400 行文件 | **36 个** | 占文件数 23.5% |
| 超 800 行文件 | **16 个** | |
| 超 1000 行文件 | **9 个** | |
| 最大文件 | `src/data/commands.ts` **4,187 行** | |
| 测试文件 | `src/__tests__/` **22 个** | INDEX.md 只登记 10~14 个 |
| `lint` / `typecheck` 脚本 | **不存在** | 005 B 项仍未落地 |

### 1.2 目录分布

| 目录 | 文件数 | 行数 | 现状评价 |
|------|-------|------|---------|
| `src/components/dialog/` | **39** | **14,522** | **占 src 总行数 28%**,结构最乱(见 §1.4) |
| `src/components/panel/` | 22 | 9,161 | 画布编辑器 + 7 个辅助面板 + 图表混在一层 |
| `src/hooks/` | 17 | — | 命名两套风格(见 P5) |
| `src/components/`(根级) | 3 | 4,825 | `HomeView` / `CommandList` / `CommandPalette` 悬空 |
| `src/data/` | 3 | — | `commands.ts` 4,187 行是最大单体 |
| `src/components/ui/` | 10 | 701 | 命名两套风格 |
| `src/components/expression/` | 4 | 1,192 | 干净 |
| `src/components/setting/` | 4 | 1,164 | 干净 |
| `src/components/menu/` | 3 | 1,076 | 干净 |
| `src/components/help/` | 4 | 625 | 干净 |
| `src/i18n/` | 2 | 1,773 | `translations.ts` 单文件 1,773 行 |
| `src/services/ai/` | 4 | — | `context.ts` 924 行 |
| `src/utils/` | 12 | — | 散落,无分组 |
| `src/types/` | 1 | 279 | 干净 |

### 1.3 超 400 行文件清单(按行数降序)

> 本表为**重构起点基线快照**。阶段 3 目录搬迁后部分路径已变(`FlowPanel.tsx` → `modules/pipeline/`、`HomeView.tsx` → `modules/data-preview/` 等),2.1/2.2/2.3 三个文件的最新实测见 §4.2–4.4;其余行数以 `pnpm lint` 的 `max-lines` warning 为准。

| 行数 | 文件 | 类别 |
|-----:|------|------|
| 4,187 | `data/commands.ts` | 数据 |
| 2,007 | `hooks/MainMenuHooks.ts` | 逻辑 |
| 1,842 | `App.tsx` | 装配 |
| 1,835 | `components/panel/FlowPanel.tsx` | 组件 |
| 1,773 | `i18n/translations.ts` | 数据 |
| 1,404 | `components/panel/ChartPanel.tsx` | 组件 |
| 1,350 | `components/dialog/commands/FormatForms.tsx` | 组件 |
| 1,200 | `components/dialog/commands/ExploreForms.tsx` | 组件 |
| 1,018 | `__tests__/commands.test.ts` | 测试 |
| 956 | `components/dialog/commands/SearchFilterForms.tsx` | 组件 |
| 924 | `services/ai/context.ts` | 逻辑 |
| 903 | `components/HomeView.tsx` | 装配 |
| 874 | `components/dialog/commands/AggregateForms.tsx` | 组件 |
| 825 | `components/dialog/commands/TransformForms.tsx` | 组件 |
| 819 | `components/dialog/commands/CustomForms.tsx` | 组件 |
| 807 | `components/setting/SettingsTabContent.tsx` | 组件 |
| 773 | `components/panel/VersionControlPanel.tsx` | 组件 |
| 702 | `components/dialog/commands/CombineForms.tsx` | 组件 |
| 677 | `hooks/useDataLineage.ts` | 逻辑 |
| 652 | `components/dialog/SeparateCSVDialog.tsx` | 组件 |
| 644 | `components/panel/AIPanel.tsx` | 组件 |
| 634 | `hooks/BatchFilterHooks.ts` | 逻辑 |
| 609 | `components/dialog/CsvDiffDialog.tsx` | 组件 |
| 533 | `components/menu/MainMenu.tsx` | 组件 |
| 526 | `__tests__/BatchFilterHooks.test.ts` | 测试 |
| 506 | `components/panel/LogPanel.tsx` | 组件 |
| 474 | `components/panel/utils/layout.ts` | 逻辑 |
| 451 | `components/menu/ContextMenu.tsx` | 组件 |
| 448 | `components/dialog/FilterDialog.tsx` | 组件 |
| 427 | `components/expression/DuckdbEditor.tsx` | 组件 |
| 422 | `components/panel/DataLineagePanel.tsx` | 组件 |
| 417 | `components/dialog/BatchFilterDialog.tsx` | 组件 |
| 407 | `components/dialog/SplitDialog.tsx` | 组件 |
| 404 | `components/CommandList.tsx` | 组件 |
| 403 | `__tests__/CanvasKeyboardPan.test.tsx` | 测试 |
| 402 | `components/dialog/PivotDialog.tsx` | 组件 |

### 1.4 `src/components/dialog/` 逐文件盘点(重点)

**39 个文件 / 14,522 行**,是所有目录里最乱的一处。分三类:

**A 类:自带浮动外壳的旧对话框(11 个 / 4,162 行)** — 特征 `useDraggable` + `cursor-grab` + 硬编码宽度

| 文件 | 行数 | 硬编码宽度 |
|------|-----:|-----------|
| `FilterDialog.tsx` | 448 | `w-[240px]` |
| `BatchFilterDialog.tsx` | 417 | `w-[280px]` |
| `SplitDialog.tsx` | 407 | — |
| `PivotDialog.tsx` | 402 | `w-[360px] h-[420px]` |
| `WindowDialog.tsx` | 335 | — |
| `TextTransformDialog.tsx` | 278 | — |
| `NumberTransformDialog.tsx` | 278 | — |
| `ReplaceDialog.tsx` | 268 | — |
| `SortDialog.tsx` | 259 | — |
| `DateTransformDialog.tsx` | 234 | — |
| `PadDialog.tsx` | 200 | — |

**B 类:模态对话框(9 个 / 2,976 行)** — 居中 + backdrop,无拖拽

`SeparateCSVDialog`(652)、`CsvDiffDialog`(609)、`CsvEncodingDialog`(359)、`PipelineTemplateDialog`(337)、`ExecutionHistoryDialog`(245)、`CommandDialog`(209)、`UpdateDialog`(180)、`VariableValuesDialog`(135)、`ConfirmDialog`(114)

**C 类:命令表单(`commands/` 子目录,19 个 / 7,384 行)**

| 文件 | 行数 | 导出表单数 | 问题 |
|------|-----:|-----------:|------|
| `FormatForms.tsx` | 1,350 | **11** | 一个文件 11 个表单,最大 |
| `ExploreForms.tsx` | 1,200 | **7** | |
| `SearchFilterForms.tsx` | 956 | **8** | |
| `AggregateForms.tsx` | 874 | **6** | |
| `TransformForms.tsx` | 825 | **9** | |
| `CustomForms.tsx` | 819 | 4 | 含 400+ 行单表单 |
| `CombineForms.tsx` | 702 | 3 | |
| `SortDedupForms.tsx` | 277 | 3 | |
| `PartitionForms.tsx` | 227 | 2 | |
| `ScriptingForms.tsx` | 204 | 2 | |
| `index.ts` | 181 | — | `COMMAND_FORMS` 大映射表 |
| `CommandFormWrapper.tsx` | 147 | 1 | |
| `PluginForms.tsx` | 104 | 2 | |
| `types.ts` | 80 | — | 含 `COMMAND_LABELS`(59 条) |
| `GenerateForms.tsx` | 71 | 1 | |
| `TransposePivotForms.tsx` | 63 | 3 | |
| `helpers.ts` | 47 | — | |
| `parameterDescriptions.ts` | 16 | — | |
| `VariableHint.tsx` | 13 | 1 | **放错位置**(见 P4) |

### 1.5 已确认的五个结构问题

**P1 — 同一命令存在"双实现"(`dialog/` 内最大的结构债)**

`FilterDialog.tsx:158/235`、`SortDialog.tsx:77` 等旧对话框**自己**用 `xanCommands.find(cmd => cmd.id === "search"/"filter"/"sort")` 取命令并手工拼参数;而 `commands/SearchFilterForms.tsx:95/312` 里另有 `SearchForm` / `FilterForm` 走 `COMMAND_FORMS` 映射。即 `search`/`filter`/`sort`/`pivot`/`map` 等命令**有两份参数构建逻辑**,分属两个入口,修改一处不会同步另一处。

- 旧对话框共 **11 个** 走手工拼参,`commands/` 里 **59 个** 表单走映射;
- `FilterDialog` 只从 `commands/` 引入了 `VariableHint`(第 8 行),证明拆分只做了一半;
- 直接后果:005 文档 C 项的 `commands.test.ts`(1,018 行,覆盖 59 命令) **测不到旧对话框的手工拼参路径**。

**P2 — `CommandDialog` ⇄ `commands/` 循环依赖**

```
CommandDialog.tsx:4   → import { COMMAND_FORMS, COMMAND_LABELS } from "@/components/dialog/commands"
commands/index.ts:3   → import { CommandDialogType } from "@/components/dialog/CommandDialog"
commands/types.ts:3-5 → import { CommandDialogState, CommandDialogType } from "@/components/dialog/CommandDialog"
```

`CommandDialogType`(59 个命令的联合类型)和 `CommandDialogState` 定义在**组件文件**里,被表单层反向引用。类型本应下沉到 `types/`,现在导致组件与表单互相咬住,单独搬动任一侧都会连环改动。

**P3 — 目录层级语义混乱,`dialog/` 下混装四种东西**

- 命令参数配置(`FilterDialog`、`commands/` 59 个表单)
- 与命令无关的工具对话框(`CsvDiffDialog`、`CsvEncodingDialog`、`SeparateCSVDialog`、`UpdateDialog`)
- 全局通用对话框(`ConfirmDialog`)
- 文件级功能(`PipelineTemplateDialog`、`ExecutionHistoryDialog`、`VariableValuesDialog`)

四类混在同一层,39 个文件平铺,新增一个对话框要读完全部才能判断放哪。且 `commands/` 已用子目录,其余仍是平铺,**同一目录两套组织方式**。

**P4 — 通用件放错位置**

`VariableHint.tsx`(13 行)在 `dialog/commands/` 下,却被 `FilterDialog.tsx:8`、`ReplaceDialog.tsx:9`、`SplitDialog.tsx:9` 三个**非 commands 体系**的对话框引用。它属于通用 UI,应在 `ui/`。

**P5 — 命名两套风格并存**

| 位置 | 风格 A | 风格 B |
|------|--------|--------|
| `hooks/` | `useTabs.ts`、`useSession.ts`、`useDataLineage.ts`(14 个) | `MainMenuHooks.ts`、`BatchFilterHooks.ts`、`BatchConvertHooks.ts`、`KeyboardShortcuts.ts`(4 个) |
| `ui/` | `button.tsx`、`input.tsx`、`card.tsx`、`tooltip.tsx`、`select.tsx`、`textarea.tsx`、`scroll-area.tsx`、`resize-handle.tsx`(8 个小写) | `MultiValueInput.tsx`、`DelimiterModeSelect.tsx`(2 个帕斯卡) |
| `components/` 根级 | `components/dialog/`、`components/panel/`(目录) | `HomeView.tsx`、`CommandList.tsx`、`CommandPalette.tsx`(3 个裸文件) |

**已排除的疑似问题**:`ui/` 下**不存在** `select.tsx` 与 `Select.tsx` 重名,目录内只有小写 `select.tsx`(导出组件名为 `Select`),全项目引用统一为 `@/components/ui/select`。注意在 Windows 上执行 `ls src/components/ui/Select.tsx` 会返回路径,那是**大小写不敏感文件系统的匹配假象**,并非真有两个文件。故此项仅为**风格不统一**(8 小写 vs 2 帕斯卡),无功能风险。

### 1.6 `docs/AI/INDEX.md` 登记漂移(影响重构定位) —— ✅ 已修正

以下文件**已存在但 INDEX.md 未登记**,重构时按 INDEX.md 找不到入口:

| 未登记文件 | 行数/说明 |
|-----------|----------|
| `components/panel/VariablePanel.tsx` | 变量管理面板(F3) |
| `components/menu/CanvasContextMenu.tsx` | 画布右键菜单 |
| `components/expression/DuckdbEditor.tsx` | 427 行 |
| `data/duckdb.ts` | DuckDB 命令定义 |
| `utils/params.ts` | 参数工具 |
| `utils/platform.ts` | 平台判断 |
| `hooks/usePipelineTemplates.ts` | F4 模板库 |
| `hooks/useExecutionHistory.ts` | F6 执行历史 |
| `components/panel/hooks/useCanvasPointerHud.ts` | 画布指针 HUD |
| `components/panel/nodes/ResultTableNode.tsx` | F1 结果表节点 |

另:INDEX.md 称 `App.tsx` 1290 行、`FlowPanel.tsx` 1241 行、`commands.ts` 4134 行,实测为 1842 / 1835 / 4187;测试文件登记 10 个,实际 22 个。**行数一律以本文 §1.3 为准。**

---

## 2. 目标目录结构

设计原则:**按"使用者视角的功能域"分层,而不是按"文件类型"平铺**;每个目录最多 2 层子目录;通用件下沉到 `ui/`,业务件留在功能域。

> **目录命名决策**:业务代码根目录采用 `modules/`(而非 `features/`)。
> 理由:与 `components/`(纯通用组件)形成"业务模块 / 通用组件"的清晰分工;语义直白,前后端与不同技术背景的成员都无需额外术语解释;`modules/` 之下按功能域再分 `pipeline/`、`dialogs/`、`ai/` 等,层级读法为"业务模块 → 功能域 → 具体文件",无需再引入 `features`/`domains` 这类框架术语。
> 备选已评估:`views/`(语义偏 UI,但本目录含 hooks/lib 等非 UI 逻辑)、`workspaces/`(与产品多标签工作区概念易混)、`domains/`(DDD 术语成本)、`areas/`(区分度不足)。

```
src/
├── app/                          # 【新】应用装配层
│   ├── App.tsx                   #   由 src/App.tsx 迁入
│   ├── providers/                #   ThemeProvider / LanguageProvider 组合
│   │   └── AppProviders.tsx
│   └── AppLayout.tsx             #   由 App.tsx 拆出的骨架布局
│
├── modules/                      # 【新】按功能域组织的业务代码
│   ├── pipeline/                 #   管道画布(原 components/panel/)
│   │   ├── FlowPanel.tsx
│   │   ├── nodes/
│   │   │   ├── TableNode.tsx
│   │   │   ├── PipelineStepNode.tsx
│   │   │   ├── ResultTableNode.tsx
│   │   │   └── index.ts
│   │   ├── overlays/
│   │   │   ├── SearchOverlay.tsx
│   │   │   ├── CutVisualization.tsx
│   │   │   ├── ConnectionVisualization.tsx
│   │   │   └── KeyIndicatorOverlay.tsx
│   │   ├── hooks/                #   useCutTool / useConnectGesture / useCanvasKeyboardPan / useCanvasPointerHud
│   │   ├── lib/                  #   layout.ts / cutGeometry.ts(纯逻辑)
│   │   └── panels/               #   VersionControlPanel / DataLineagePanel / LineageGraph
│   │
│   ├── data-preview/             #   数据查看域
│   │   ├── HomeView.tsx
│   │   ├── DataProfilePanel.tsx
│   │   └── charts/               #   ChartPanel 拆分:LineChart/ScatterChart/... 各一文件
│   │
│   ├── dialogs/                  # 【重点重构】对话框域,见 §3
│   │   ├── command/              #   命令参数配置(统一入口)
│   │   │   ├── CommandDialog.tsx
│   │   │   ├── CommandFormShell.tsx
│   │   │   └── forms/            #   59 个命令表单,按命令一文件
│   │   ├── file/                 #   文件级操作
│   │   │   ├── SeparateCSVDialog.tsx
│   │   │   ├── CsvEncodingDialog.tsx
│   │   │   ├── CsvDiffDialog.tsx
│   │   │   └── PipelineTemplateDialog.tsx
│   │   ├── app/                  #   应用级
│   │   │   ├── SettingsDialog.tsx
│   │   │   ├── UpdateDialog.tsx
│   │   │   ├── ExecutionHistoryDialog.tsx
│   │   │   └── HelpDialog.tsx
│   │   └── common/               #   通用原子
│   │       ├── ConfirmDialog.tsx
│   │       └── VariableValuesDialog.tsx
│   │
│   ├── ai/                       #   AIPanel + 对话/反馈 UI
│   ├── variables/                #   VariablePanel
│   └── logs/                     #   LogPanel / CommandList / CommandPalette
│
├── components/                   # 【保留】纯通用件,零业务语义
│   ├── ui/                       #   shadcn 基础件(统一小写 kebab)
│   └── layout/                   #   ResizeHandle / ScrollArea 等布局件
│
├── hooks/                        # 【保留】跨功能域共享的 hook,统一 use* 命名
├── services/                     # 【保留】ai/ 等外部交互
├── lib/                          # 【保留】cn() 等无依赖工具
├── utils/                        # 【保留】纯函数,按域分子目录
├── types/                        # 【保留】共享类型(新增 dialog.ts / pipeline.ts 拆分)
├── data/                         # 【保留】命令/函数定义数据
├── i18n/                         # 【保留】按域拆 translations
├── generated/                    # 【保留】生成物,禁止手改
└── __tests__/                    # 【保留】或迁移为就近 __tests__
```

**迁移成本控制**:`modules/` 与 `app/` 是新增目录,**不强制一次性迁移**。分阶段搬(§5),每阶段结束 `pnpm test` 必须全绿。别名 `@/*` → `./src/*` 不变,搬动后 import 路径由批量替换脚本处理。

### 2.1 与现状的目录映射

| 现状 | 目标 | 阶段 |
|------|------|------|
| `src/App.tsx` | `src/app/App.tsx` | P1 |
| `src/components/HomeView.tsx` | `src/modules/data-preview/HomeView.tsx` | P2 |
| `src/components/panel/*` | `src/modules/pipeline/*` | P2 |
| `src/components/dialog/**` | `src/modules/dialogs/**` | **P0** |
| `src/components/panel/AIPanel.tsx` | `src/modules/ai/AIPanel.tsx` | P2 |
| `src/components/panel/VariablePanel.tsx` | `src/modules/variables/VariablePanel.tsx` | P2 |
| `src/components/panel/LogPanel.tsx` | `src/modules/logs/LogPanel.tsx` | P2 |
| `src/components/CommandList.tsx`、`CommandPalette.tsx` | `src/modules/logs/`(或 `modules/commands/`) | P2 |
| `src/components/setting/SettingsDialog.tsx` | `src/modules/dialogs/app/SettingsDialog.tsx` | P1 |
| `src/components/setting/Toast.tsx` | `src/components/ui/Toast.tsx` | P1 |
| `src/components/setting/ThemeProvider.tsx` | `src/app/providers/ThemeProvider.tsx` | P1 |
| `src/components/menu/*` | `src/modules/pipeline/menu/` 或保留 | P3(暂缓) |
| `src/components/help/*` | `src/modules/dialogs/app/help/` | P3(暂缓) |
| `src/components/expression/*` | `src/modules/expression/*` | P3(暂缓) |
| `src/components/ui/*` | 不变(仅统一命名) | P1 |

> `menu/`、`help/`、`expression/` 三个目录当前结构已清晰、文件数少、无巨型文件,**不建议为搬迁而搬迁**,留到 P3 视情况处理。重构应把力气花在 `dialog/` 和 5 个巨型文件上。

---

## 3. `src/components/dialog/` 重构(重点)

这是用户明确点名的目录:39 文件 / 14,522 行 / 占 src 总行数 28%。分四步处理。

### 3.1 第一步:消除"双实现"(P0,收益最大) —— ✅ 已实施

**现状**:`FilterDialog`、`SortDialog`、`PivotDialog`、`DateTransformDialog`、`TextTransformDialog`、`NumberTransformDialog`、`SplitDialog`、`PadDialog`、`ReplaceDialog`、`WindowDialog`、`BatchFilterDialog` 共 **11 个**旧对话框,各自 `xanCommands.find(...)` 手工拼参数;`commands/` 下已有对应的 `FilterForm`/`SortForm`/`PivotForm`/… 59 个表单。同一命令两份实现。

**证据**:
- `FilterDialog.tsx:158` `xanCommands.find((cmd) => cmd.id === "search")`、`:235` `cmd.id === "filter"`
- `SortDialog.tsx:77` `xanCommands.find((cmd) => cmd.id === "sort")`
- `commands/SearchFilterForms.tsx:95` `SearchForm`、`:312` `FilterForm`
- `FilterDialog` 仅从 `commands/` 引入 `VariableHint`,拆分只做了一半

**方案**:每个旧对话框收敛为**薄触发层**,只负责"从右键菜单/表格列拿到上下文(列名、坐标、初始值)",然后直接打开 `CommandDialog` 并带上预填参数。

```
右键"筛选" → ContextMenu 传 (col, x, y)
   → openCommandDialog({ type: "filter", initialParameters: { columns: [col] } })
   → CommandDialog → COMMAND_FORMS["filter"] → FilterForm
```

**关键点**:
1. 预填逻辑抽为纯函数 `buildCommandInitialParams(type, context)`,放 `modules/dialogs/command/lib/`,**可单测**(补 `initialParams.test.ts`);
2. 旧对话框保留同名导出作为过渡,内部改为调用 `openCommandDialog`,避免一次性改 HomeView 的 11 处 props 与状态;
3. 过渡期结束(§5 P0 完成)后删除旧文件与 HomeView 中 11 组 `useState`/`closeXxxDialog`。

**收益**:
- 参数构建逻辑从 2 份收敛为 1 份,`commands.test.ts` 的 1,018 行覆盖范围直接扩大到全部入口;
- `dialog/` 减少约 **3,700 行**(11 个旧对话框合计 4,162 行,收敛后每文件约 40 行);
- 顺带完成 007 文档 D1(统一外壳)与 D4(Esc/焦点)两项 P0。

### 3.2 第二步:拆开循环依赖(P0,纯搬运) —— ✅ 已实施

**现状**(P2 问题):

```
CommandDialog.tsx:4    → import { COMMAND_FORMS, COMMAND_LABELS } from "@/components/dialog/commands"
commands/index.ts:3    → import { CommandDialogType } from "@/components/dialog/CommandDialog"
commands/types.ts:3-5  → import { CommandDialogState, CommandDialogType } from "@/components/dialog/CommandDialog"
```

**方案**:类型下沉。

| 现在 | 迁移到 |
|------|--------|
| `CommandDialogType`(59 命令联合类型,`CommandDialog.tsx:6`) | `src/types/dialog.ts` |
| `CommandDialogState`(`CommandDialog.tsx:69`) | `src/types/dialog.ts` |
| `COMMAND_LABELS`(`commands/types.ts:18`) | `src/types/dialog.ts`(纯数据) |
| `CommandFormProps`(`commands/types.ts:7`) | `src/types/dialog.ts` |

迁移后依赖变为单向:`CommandDialog` → `types/dialog` ← `commands/index`。**这是后续所有拆分的前置条件**,必须先做。

### 3.3 第三步:目录重组(P1) —— ✅ 已实施

按"命令配置 / 文件操作 / 应用级 / 通用"四分:

```
src/modules/dialogs/
├── command/
│   ├── CommandDialog.tsx            # 统一入口(原 CommandDialog.tsx)
│   ├── CommandFormShell.tsx         # 原 commands/CommandFormWrapper.tsx
│   ├── lib/
│   │   ├── initialParams.ts         # 【新】buildCommandInitialParams 纯函数
│   │   ├── helpers.ts               # 原 commands/helpers.ts
│   │   └── parameterDescriptions.ts # 原 commands/parameterDescriptions.ts
│   ├── index.ts                     # COMMAND_FORMS 映射
│   └── forms/                       # 59 个表单按命令一文件,见 §3.4
│
├── file/
│   ├── SeparateCSVDialog.tsx        # 652
│   ├── CsvDiffDialog.tsx            # 609
│   ├── CsvEncodingDialog.tsx        # 359
│   └── PipelineTemplateDialog.tsx   # 337
│
├── app/
│   ├── ExecutionHistoryDialog.tsx   # 245
│   ├── UpdateDialog.tsx             # 180
│   └── (SettingsDialog / HelpDialog 后续从 setting/、help/ 迁入)
│
└── common/
    ├── ConfirmDialog.tsx            # 114
    └── VariableValuesDialog.tsx     # 135
```

**同时修正两处错位**:
- `VariableHint.tsx`(13 行)→ `src/components/ui/VariableHint.tsx`,它是通用 UI,被 3 个非 commands 体系对话框引用;
- `UpdateDialog` / `ExecutionHistoryDialog` 与命令参数无关,不再和命令对话框混放。

### 3.4 第四步:命令表单按命令拆文件(P1) —— ✅ 已实施

**现状**:`FormatForms.tsx` 1,350 行装 11 个表单,`ExploreForms.tsx` 1,200 行装 7 个,`SearchFilterForms.tsx` 956 行装 8 个。按 xan 命令分类分组的方式,导致"改 `pivot` 参数要打开 956 行的 `TransposePivotForms`"这种间接定位。

**方案**:改为**一个命令一个文件**,文件名即命令 id:

```
forms/
├── ExploreForms/  (→ 拆为)
│   ├── count.tsx      headers.tsx    view.tsx
│   ├── flatten.tsx    hist.tsx       plot.tsx     chart.tsx
├── search.tsx    filter.tsx   head.tsx    tail.tsx
├── slice.tsx     top.tsx      sample.tsx  bisect.tsx
├── sort.tsx      dedup.tsx    shuffle.tsx
├── frequency.tsx groupby.tsx  stats.tsx   agg.tsx   bins.tsx   window.tsx
├── cat.tsx       join.tsx     merge.tsx
├── select.tsx    drop.tsx     map.tsx     transform.tsx
├── enum.tsx      fill.tsx     complete.tsx blank.tsx  separate.tsx
├── behead.tsx    rename.tsx   input.tsx   fixlengths.tsx
├── fmt.tsx       explode.tsx  implode.tsx from.tsx   to.tsx
├── scrape.tsx    reverse.tsx
├── transpose.tsx pivot.tsx    unpivot.tsx
├── split.tsx     partition.tsx
├── range.tsx     run.tsx      eval.tsx
├── output.tsx    batch-filter.tsx  batch-from.tsx  batch-to.tsx
├── pinyin.tsx    duckdb.tsx
```

**理由**:
- 定位成本从"按分类猜文件"变为"文件名 = 命令 id",与 `data/commands.ts` 的 59 个命令一一对应;
- 每个表单 60~200 行,天然满足单文件行数约束;
- 新增命令只加一个文件 + `index.ts` 一行映射,不会让某个分类文件继续膨胀;
- `ExploreForms`/`FormatForms` 这类"按分类打包"的文件不再成为冲突热点(多人改不同命令不会改同一文件)。

**保留分类索引**:若仍需要按分类浏览,用 `index.ts` 里的注释分组,而不是文件分组。

**迁移手法**:机械搬运,不动逻辑。每个表单函数整体剪切到新文件,补 `import`,原文件删除。**用脚本 + `pnpm test` 逐批验证**,建议每批 5~8 个命令。

### 3.5 `dialog/` 重构后的预期指标 —— 🔶 部分达成

| 指标 | 现状(重构前) | 目标 | 实测(2026-09-20) |
|------|-----:|-----:|-----:|
| 目录文件数 | 39 | 约 70(拆细后) | **76**(`modules/dialogs/` 全目录) |
| 最大单文件 | 1,350(`FormatForms.tsx`) | ≤ 250 | **376**(`forms/plot.tsx`),仍在 400 行组件预算内 |
| 平均单文件 | 372 | ≤ 120 | — |
| 参数构建实现份数 | 2 | 1 | **1** ✅ |
| 循环依赖 | 1 组 | 0 | **0** ✅ |
| 带浮动外壳的对话框 | 11 | 0 | **0** ✅ |

> 目标值是本文档撰写时的估计。实际拆出的表单普遍比预估长:61 个文件各带一份 import 头(合计多出约 300 行),且 `plot`/`batch-from`/`cat` 这类命令参数本身就多 —— 250 行对参数最多的几个命令不现实,以 §5.3 的 400 行组件预算为准。

---

## 4. 巨型文件拆分

005 文档已给出拆分方向(MainMenuHooks / FlowPanel / ChartPanel),本节**补齐具体落点与拆法**,并新增 005 未覆盖的 `App.tsx`、`HomeView.tsx`、`commands.ts`、`translations.ts`、`SettingsTabContent.tsx`、`context.ts`。

### 4.1 拆分优先级 —— 🔶 部分实施(2.4 / 2.7)

| 优先级 | 文件 | 行数 | 理由 |
|--------|-----:|------|------|
| **P0** | `hooks/MainMenuHooks.ts` | **2,007** | 全项目最大逻辑文件,含执行引擎、文件 IO、导入导出、图表处理四类职责 |
| **P0** | `modules/pipeline/FlowPanel.tsx` | **1,834** | 画布核心,切刀/连线/搜索/复制粘贴全在一个组件 |
| **P0** | `App.tsx` | **1,827** | 全应用状态中枢,对话框/面板开关散在 `useUIState` + 本地 state,20+ 回调 |
| **P1** | `data/commands.ts` | **4,187** | 数据文件,但单文件过大影响编辑与 diff |
| **P1** | `components/panel/ChartPanel.tsx` | **1,404** | 7 种图表 + 拖拽 + 导出 + 最大化 |
| **P1** | `components/HomeView.tsx` | **903** | 61 个 props + 11 组对话框 state |
| **P1** | `i18n/translations.ts` | **1,773** | 中英双语 1,700+ key 单文件 |
| **P2** | `setting/SettingsTabContent.tsx` | **807** | 设置页全部页签平铺 |
| **P2** | `services/ai/context.ts` | **924** | 提示词工程,职责 6 类 |
| **P2** | `panel/VersionControlPanel.tsx` | **773** | 列表 + 标签 + 差异对比混装 |
| **P2** | `hooks/useDataLineage.ts` | **677** | 列类型推断 + 变换分析 + 图构建 + 持久化 |
| **P2** | `panel/AIPanel.tsx` | **644** | 聊天 UI + 命令插入 + 反馈 + 澄清 |
| **P2** | `dialog/SeparateCSVDialog.tsx` | **652** | 探测 + 表单 + 结果 + localStorage |
| **P2** | `hooks/BatchFilterHooks.ts` | **634** | 文件名清理 + 正则 + 执行 |

> **豁免**:`data/commands.ts`、`i18n/translations.ts`、`generated/help-docs.ts` 属**数据文件**,可放宽行数约束,但需按 §4.5/§4.6 做结构拆分。

### 4.2 `hooks/MainMenuHooks.ts`(2,007 行) —— ✅ 已实施(2.1)

**现状(2026-09-20 按搬迁后代码回写)**:全文件约 2007 行,结构如下:

| 行段 | 内容 | 性质 |
|------|------|------|
| 1–83 | import + 常量(`MAX_OUTPUT_BYTES` 等) | — |
| 84–143 | `serializeStepParams`(~60 行) | **模块级纯函数,可直接搬** |
| 145–254 | `buildPrefixToStep`(~110 行) | **模块级纯函数,可直接搬** |
| 256–2007 | `export function MainMenuHooks({...})` | **单个约 1750 行的函数**,全部逻辑都在这一个函数体里 |

函数体内部的大块(均为 `useCallback`,行号为实测):

| 行段 | 回调 | 规模 | 职责 |
|------|------|------|------|
| 437–471 | `handleOpenFile` / `handleOpenNewTabWithFile` | ~35 行 | 文件打开 |
| 472–719 | `handleSavePipeline` | **~248 行** | 保存/另存 |
| 720–766 | `handleExportPipeline` | ~47 行 | 管道导出 |
| 767–846 | `handleImportPipeline` | ~80 行 | 管道导入 + 脚本生成 |
| 847–934 | `buildExecutionBranches` | ~88 行 | DFS 分支构建(useCallback 包裹,**需抽成模块级纯函数**) |
| 935–1509 | `runNow` | **~575 行** | 单分支执行编排 + 进程调度 + 日志回填 + 图表后处理,全文件最大块 |
| 1510–1600 | `handleExecute` | ~90 行 | 薄封装,取参数后调 `runNow` |
| 1640–1876 | `processChartData` | **~237 行** | 图表数据后处理 |
| 1877–1962 | `handleSaveIntermediateAsInput` | ~86 行 | 中间结果落盘 |
| 1963–1975 | `handleCancelExecution` | ~13 行 | 取消 |

> 注意:本文初稿称"`handleExecute` 单函数 500+ 行",与实测不符 —— 大块在 `runNow`,见 §0 表 2.1。

**实施结果(2026-09-20)**:目标结构落地为——

```
src/hooks/
├── usePipelineTabs.ts            # getCurrentTab / getCurrentPipeline / resolveRunDelimiter / updateTabPipeline / addNewTab
├── execution/
│   ├── useExecution.ts           # 装配层:run/cancel、变量提示、S6 覆盖门、resultPreview(365 行)
│   ├── runPipeline.ts            # runNow 主体,依赖显式化为 RunPipelineDeps(294 行)
│   ├── executeBranch.ts          # 单分支执行:batch 配对/batch-filter/chart 分派(359 行)
│   ├── runPipelineDeps.ts        # RunPipelineDeps / BranchProgressState / MAX_OUTPUT_BYTES
│   ├── buildBranches.ts          # 【纯函数】由 buildExecutionBranches 抽出
│   ├── buildPrefixToStep.ts      # 【纯函数】
│   ├── serializeStepParams.ts    # 【纯函数】
│   ├── resolveDelimiter.ts       # resolveRunDelimiter 纯函数化(名称/行为不变,018)
│   └── buildBranches.test.ts     # 线性/分支/环/S1-4/fallback,005 C2
├── fileIO/
│   ├── useFileOpen.ts  useFileSave.ts  useImportExport.ts
│   └── pipelineScript.ts         # 【纯函数】CLI 行生成 + ps1/sh 内容生成
└── charts/
    └── processChartData.ts       # 【纯函数】
```

共享类型 `OverwriteConfirm`/`ResultPreview`/`VariablePrompt`/`PendingRun` 下沉 `src/types/execution.ts`。App.tsx 直接组合各 hook(原 17 项返回值逐一对应)。`serializeStepParams` 已是纯函数、`processChartData` 依赖为空,与计划一致;`runNow` 无法做到"无 React 依赖"入参,改为 deps 显式注入(无 hook 调用,仍是可测的普通 async 函数)。

**拆法**:

```
src/hooks/
├── execution/
│   ├── useExecution.ts          # handleExecute / handleCancel(装配层)
│   ├── buildBranches.ts         # 【纯函数】由 buildExecutionBranches 抽出 → 可单测
│   ├── runPipeline.ts           # 【纯函数】由 runNow 主体抽出
│   └── resolveDelimiter.ts      # resolveRunDelimiter
├── fileIO/
│   ├── useFileOpen.ts           # handleOpenFile / handleOpenNewTabWithFile
│   ├── useFileSave.ts           # handleSavePipeline(248 行,独立成 hook 的理由充分)
│   └── useImportExport.ts       # handleExportPipeline + handleImportPipeline
└── charts/
    └── processChartData.ts      # 【纯函数】由 processChartData 抽出
```

**关键约束**:
- `serializeStepParams`、`buildPrefixToStep` 已是模块级纯函数,机械搬运即可,零逻辑风险;
- `buildExecutionBranches`、`runNow` 主体、`processChartData` 目前闭包了大量 state/setter,抽出时需把依赖显式化为参数 —— 这三块是本次拆分的真正工作量所在;
- `buildBranches.ts`、`runPipeline.ts`、`processChartData.ts` **必须是无 React 依赖的纯函数**,补 `execution/buildBranches.test.ts`(线性/分支/环状异常三类用例,对应 005 C2);
- `handleExecute` 实测仅 90 行,拆分后自然满足 ≤ 100 行,主流程不再是风险点;
- `resolveRunDelimiter` 涉及"所见即所跑"语义(设计 018),搬迁时保持导出名与行为不变。

### 4.3 `FlowPanel.tsx`(1,834 行) —— 🔶 已实施(2.2,1,834 → 999 行)

**现状(2026-09-20 回写)**:文件已随 3.1 迁至 `src/modules/pipeline/FlowPanel.tsx`,1,834 行。切刀三段回调、右键连线、搜索、复制粘贴全部内联在组件里,行号段实测如下:

| 行段 | 内容 | 规模 |
|------|------|------|
| 266–272, 368–386 | 搜索 state + Ctrl+F 拦截 + 输入框聚焦 | ~40 行 |
| 540–587 | `searchResults` 计算(useMemo) | ~48 行 |
| 589–645 | 搜索结果跳转与高亮 | ~57 行 |
| 934–969 | `handleCutStart` | ~36 行 |
| 970–1182 | `handleCutMove` | **~213 行** |
| 1183–1347 | `handleCutEnd` | **~165 行** |
| 1348–1480 | `onConnect` 右键连线 | **~133 行** |
| 1481–1548 | `handleCopySelected` / `handlePasteClipboard`(`clipboardRef`) | ~68 行 |

**拆法**(目标路径不变,`modules/pipeline/` 已就位):

```
src/modules/pipeline/
├── FlowPanel.tsx                # 仅保留装配与 props 透传
├── hooks/
│   ├── useCutTool.ts            # handleCutStart/Move/End + 坠落动画(合计 ~415 行)
│   ├── useConnectGesture.ts     # onConnect 右键连线拖拽 + 预览路径(~133 行)
│   ├── useStepClipboard.ts      # handleCopySelected / handlePasteClipboard
│   ├── useCanvasSearch.ts       # 【新】搜索 state + Ctrl+F + 结果跳转(~145 行)
│   ├── useCanvasKeyboardPan.ts  # 已有
│   └── useCanvasPointerHud.ts   # 已有
├── lib/
│   ├── layout.ts                # 已有(474 行)
│   └── cutGeometry.ts           # 已有
```

**关键约束**:
- 交互 hook 不直接改管道,**统一经 `onStepsChange`/`onEdgesChange` 回调**保证撤销栈一致(项目既有约定);
- 几何/算法留在 `lib/`,`layout.test.ts` 用例随路径更新但不断言逻辑变化;
- 拆分后 `FlowPanel.tsx` 目标 ≤ 600 行。

**实施结果(2026-09-20)**:拆出 `modules/pipeline/hooks/` 6 个 hook——

| Hook | 承接内容 | 行数 |
|------|---------|-----:|
| `useCanvasSearch` | 搜索 state + Ctrl+F + searchResults + 跳转高亮 | 157 |
| `useStepClipboard` | `clipboardRef` + 复制/粘贴(经 onStepsChange/onEdgesChange) | 86 |
| `useNodeHitTest` | `getNodeRect` / `getNodeAtPosition`(切刀/连线/右键菜单共用) | 87 |
| `useCutTool` | 切刀三段回调 + 碰撞删除 + 坠落动画 + 切割视觉 effect | 521 |
| `useConnectGesture` | 右键连线 state + 预览路径 + `createEdge` | 192 |
| `usePipelineLayout` | 布局 effect + F1 结果节点注入 + 选中/高亮 effect | ~230 |

FlowPanel 留守:props、装配、右键模式栏、onConnect(环检测 + 拓扑重排)、菜单与 JSX,共 999 行——**≤ 600 目标未达**,缺口主要是 ~470 行 JSX 与 ~150 行 props/上下文菜单,需拆出 AppLayout 式子组件,留待后续。切刀 start/move/end 在 FlowPanel 收敛为三个薄分发器,按 `rightClickMode` 与手势状态分派到对应 hook。

### 4.4 `App.tsx`(1,827 行) —— 🔶 部分实施(2.3,1,827 → 1,769 行)

**现状(2026-09-20 回写)**:`src/App.tsx` 仍 1,827 行(`src/app/` 未创建),管理标签页、管道、撤销/重做、日志、配置、历史、更新检查、拖拽打开、会话恢复、命令面板等,41 个 `handle*`/`useCallback`。

**与本文初稿的差异**:初稿所称「11 组对话框 state + 11 个 close 回调」已随 1.3/1.7 收敛删除(命令对话框统一为 HomeView 的 `commandDialog` 单 state + `openCommandFromContext()`)。当前对话框/面板开关散落两处:

| 位置 | 内容 | 规模 |
|------|------|------|
| `hooks/useUIState.ts` | 面板与对话框开关(`showSettingsDialog`/`showUpdateDialog`/`showRefreshDialog`/`showCsvDiff`/`showCsvEncoding`/`showSeparateCsv`/各面板 show*、进度、图表配置等) | **31 个 `useState`**,113 行 |
| `App.tsx` 本地 | `selectedStep`、`showHistoryDialog`、`isExecuting`、`showVariablePanel`、`pipelineSavedAt`、`aiConfig`、`showTemplateDialog`、`editingTemplate` | 8 个 `useState` |

问题从「state 太多集中一处」变成「同一类开关分裂两处」:`App.tsx` 与 `useUIState` 各管一摊,`Esc` 关闭、互斥(如同时开两个面板)没有统一语义。

**拆法**:

```
src/app/
├── App.tsx                      # 仅组合 provider + layout + 全局 hook
├── AppLayout.tsx                # 骨架(菜单/画布/面板插槽)
├── providers/
│   ├── AppProviders.tsx
│   ├── ThemeProvider.tsx        # 从 setting/ 迁入
│   └── LanguageProvider.tsx     # 从 i18n/index.tsx 迁入
└── hooks/
    ├── useDialogStack.ts        # 【新】统一对话框开关栈
    └── useAppBootstrap.ts       # 会话恢复 + 更新检查 + 拖拽打开
```

**`useDialogStack` 是关键收敛点**(同时解决 007 D4),收敛对象按现状调整为:
- 吸收 `useUIState` 的 31 个开关 + App 本地的 `showHistoryDialog`/`showTemplateDialog` 等对话框类 state(纯面板开关如 `showLogPanel` 可先并入或保留,以互斥/Esc 语义需要为准);
- 用 `Record<DialogKind, DialogState>` 单一 state 替代散落开关;
- 提供 `openDialog(kind, payload)` / `closeDialog(kind)` / `closeTop()` / `closeAll()`;
- 按打开顺序维护栈,`Esc` 只关最上层;
- 对外兼容:保留 `ui.setShowXxx` 同名转发或 `closeXxxDialog` 兼容名,调用方可分批改造。

拆分后 `App.tsx` 目标 ≤ 400 行。

**实施结果(2026-09-20,部分)**:
- `src/App.tsx` → `src/app/App.tsx`(git mv,main.tsx 改走 `@/app/App`);`src/app/providers/AppProviders.tsx` 收拢 ThemeProvider + LanguageProvider,main.tsx 只剩组合;
- `hooks/useAppBootstrap.ts` 落地:启动初始化(check_xan + 设置 + 最近文件)、会话恢复 + markHydrated、tab 切换预热版本、F12/F5、拖拽打开(.xanflow 分流)、完成系统通知、窗口标题,6 个 effect 出走,App 内收敛为一个 hook 调用;
- `hooks/useDialogStack.ts` 落地:`Record<DialogKind, DialogState>` + open/close/closeTop/closeAll + **Esc 只关最上层**(007 D4);执行历史与模板两个 App 本地对话框已接入,`ui.*` 31 个开关按文档"分批改造"原则留待后续;
- 未做:`AppLayout.tsx` JSX 骨架拆分(~700 行 JSX 留在 App.tsx)、`ui.*` 全量迁移,故 1,769 行仍远超 400 行目标——这两项与 2.6(HomeView props 分组,005 A2)耦合,一并后置。

### 4.5 `data/commands.ts`(4,187 行) —— ✅ 已实施

**现状**:59 个命令定义 + 参数 + 中英文描述全在一个文件,单文件 12.3 万字符。

**拆法**:按 xan 命令分类拆目录,**保留 `commands.ts` 作为聚合出口**(不改任何 import):

```
src/data/commands/
├── index.ts           # 汇总导出 xanCommands(保持 @/data/commands 可用)
├── explore.ts         # count/headers/view/flatten/hist/plot/chart
├── searchFilter.ts    # search/filter/head/tail/slice/top/sample/bisect
├── sortDedup.ts       # sort/dedup/shuffle
├── aggregate.ts       # frequency/groupby/stats/agg/bins/window
├── combine.ts         # cat/join/merge
├── transform.ts       # select/drop/map/transform/enum/fill/complete/separate/blank
├── format.ts          # behead/rename/input/fixlengths/fmt/explode/implode/from/to/scrape/reverse
├── transposePivot.ts  # transpose/pivot/unpivot
├── partition.ts       # split/partition
├── generate.ts        # range
├── scripting.ts       # run/eval
├── custom.ts          # output/batch-filter/batch-from/batch-to
└── plugins.ts         # pinyin/duckdb
```

**必须验证**:`commands.test.ts`(1,018 行,覆盖 59 命令)**不改一行且全绿** —— 它只 import `xanCommands`,聚合出口不变即可。这是本次拆分最安全的验证信号。

### 4.6 `i18n/translations.ts`(1,773 行) —— ✅ 已实施

**拆法**:按功能域拆,`index.tsx` 合并:

```
src/i18n/translations/
├── index.ts        # 合并 zh/en 对象并导出
├── zh/  common.ts pipeline.ts dialog.ts ai.ts settings.ts canvas.ts help.ts
└── en/  common.ts pipeline.ts dialog.ts ai.ts settings.ts canvas.ts help.ts
```

**约束**:key 结构不变(仅按顶层前缀分组),`i18n.test.tsx` 必须全绿;中英 key 集合一致性由测试保证。

### 4.7 `ChartPanel.tsx`(1,404 行) —— ⬜ 未实施

**拆法**(对应 005 A1-3):

```
src/modules/data-preview/charts/
├── ChartPanel.tsx        # 容器:拖拽/最大化/导出/切换
├── LineChart.tsx  ScatterChart.tsx  BarChart.tsx  HistogramChart.tsx
├── PieChart.tsx   WordCloudChart.tsx  HeatmapChart.tsx
└── chartTheme.ts         # 亮暗主题色板与 recharts 公共配置
```

**约束**:导出 SVG 与 dark mode 行为不变;7 个图表组件共用 `chartTheme.ts`,消除各自硬编码色值(符合"主题变量而非硬编码色值"约定)。

---

## 5. 命名与依赖规范

### 5.1 命名收敛(解决 P5) —— 🔶 部分实施

| 对象 | 规范 | 现状处理 |
|------|------|---------|
| Hook 文件 | `useXxx.ts` | `MainMenuHooks.ts`→`useExecution.ts` 等;`BatchFilterHooks.ts`→`useBatchFilter.ts`;`BatchConvertHooks.ts`→`useBatchConvert.ts`;`KeyboardShortcuts.ts`→`useKeyboardShortcuts.ts` |
| Hook 导出 | `useXxx()` | 同上,导出名同步改 |
| 组件文件 | `PascalCase.tsx` | `ui/` 下 8 个小写文件统一改 PascalCase |
| 工具/纯逻辑 | `camelCase.ts` | `layout.ts`、`cutGeometry.ts` 保持 |
| 常量/数据 | `camelCase.ts` | `commands.ts`、`functions.ts` 保持 |
| 类型文件 | `camelCase.ts` | `types/xan.ts` 保持,新增 `types/dialog.ts` |

**命名统一顺序**:先统一 `hooks/`(4 个文件重命名 + 导出名),再统一 `ui/`(8 个小写 → PascalCase)。`ui/` 内**无重名文件**,不存在必须先修的冲突项(详见 §1.5 P5 说明),仅需按 §5.1 表格批量重命名并同步引用。

### 5.2 依赖方向规则 —— 🔶 已固化(部分 warn)

```
app/  →  modules/  →  components/ (ui, layout)
                  ↘  hooks/  →  services/  →  lib/ , utils/ , types/
```

**硬性规则**:
1. `components/`(纯通用件)**禁止** import `modules/`、`data/`、`services/`;
2. `modules/` 之间**禁止**互相 import(需共享则上提到 `hooks/`、`utils/` 或 `types/`);
3. 类型**只**定义在 `types/` 或就近 `lib/`,禁止定义在组件文件里(解决 P2);
4. 每个目录最多 2 层子目录;
5. 每个功能域自带 `index.ts` 作为唯一对外出口,跨域引用走桶文件而非深路径。

> 现状深路径引用统计:`@/components/dialog/commands/types`(16 次)、`helpers`(14 次)、`parameterDescriptions`(13 次)、`CommandFormWrapper`(13 次) —— 这些在 §3.3 重组后应统一改走 `@/modules/dialogs/command` 桶文件。

### 5.3 单文件行数约束 —— 🔶 已固化(warn)

| 类别 | 上限 | 豁免 |
|------|-----:|------|
| 组件 | 400 行 | 无 |
| Hook / 逻辑 | 400 行 | 无 |
| 纯工具 | 300 行 | 无 |
| 数据文件 | 800 行 | `generated/` 下生成物 |
| 测试 | 800 行 | 无 |

超限时先拆纯函数,再拆子组件。

---

## 6. 分阶段迁移计划

**总原则**:每阶段独立可交付、可回滚;每阶段结束 `pnpm test` 全绿;不做一次性大爆炸重构。

### 阶段 0:安全网(必须先做,1 天)

在动任何文件之前建立验证能力:

1. ✅ 补 `package.json` 脚本:
   - `"typecheck": "tsc --noEmit"`
   - `"lint": "eslint src --ext .ts,.tsx"`
2. ✅ 落地 ESLint(005 B 项),至少启用 `react-hooks/exhaustive-deps`、`import/no-cycle`;
   - 实测要点:`import/no-cycle` 必须配 `settings["import/parsers"] = { "@typescript-eslint/parser": [".ts",".tsx"] }`,否则递归解析被引文件时退回 espree、**静默漏报**(实测 0 报错 vs 应有 18);
   - `@/*` 别名用 `eslint-import-resolver-alias`(`map: [["@", "./src"]]`),`eslint-import-resolver-typescript` v4 在本仓库解析不出该别名;
   - TS7 与 typescript-eslint 并存:`typescript` alias 到 `npm:@typescript/typescript6`,`@typescript/native` 提供 TS7 的 `tsc`。
3. ✅ 跑一次全量 `pnpm test` + `typecheck`,记录基线绿/红状态;
   - 基线:`typecheck` 0 错;`vitest` **2 红 / 317 绿**(`TableNodeDelimiter` 的 `title` 断言,后续已修);`eslint` 37 错 47 警(含 18 个 `no-cycle`)。
4. ⬜ 若在 Git 仓库,打 tag 作为回滚点 —— **未执行**,建议先提交当前改动再继续。

> **没有阶段 0 不要开始阶段 1** —— 2,000 行文件的搬迁没有类型检查兜底等于盲搬。

### 阶段 1:`dialog/` 收敛(P0,3~4 天)

| 步骤 | 内容 | 验证 | 状态 |
|------|------|------|------|
| 1.1 | 类型下沉到 `types/dialog.ts`,解除循环依赖 | `tsc --noEmit` 无循环告警 | ✅ `import/no-cycle` 18 → 0;顺带修掉 `CommandDialog` 在 hooks 之前 `return null`(违反 rules-of-hooks) |
| 1.2 | 抽 `buildCommandInitialParams` 纯函数 + 单测 | 新增 `initialParams.test.ts` | ✅ 28 例;六个入口都落到 `map`,context 用 `mapScaffold` 判别;顺带修 `strip` 把 `\r\t\n` 展开成裸控制字符的 bug |
| 1.3 | 11 个旧对话框改为薄触发层,走 `CommandDialog` | `pnpm test` 全绿;手工冒烟 11 个入口 | ✅ 代码层完成;**手工冒烟未做**,交互外观已变(见下) |
| 1.4 | 目录重组为 `dialogs/{command,file,app,common}` | import 全部可解析 | ✅ `CommandFormWrapper` → `CommandFormShell` 同步改名 |
| 1.5 | `VariableHint` 移到 `ui/` | 3 处引用更新 | ✅ |
| 1.6 | 命令表单按命令拆文件(分批 5~8 个) | 每批后 `pnpm test` | ✅ 一次性脚本拆完:13 个聚合文件(最大 1351 行)→ 61 个 `forms/<命令id>.tsx` + `_shared.tsx`(最大 376 行) |
| 1.7 | 删除旧文件与 HomeView 中 11 组 state | 见 §3.1 收益 | ✅ 11 个对话框文件 + `command/legacy/` 删除;`BatchFilterConfig` 迁往 `types/xan.ts` |

> **1.3 的交互变化(需人工冒烟)**:右键入口改为打开统一的居中 `CommandDialog`,浮动小窗的引导式 UI 被命令参数表单取代 —— ① 筛选默认走 `search`(文本),数字筛选需另选 `filter`;② 排序的列多选面板变成 `select` 文本框;③ 透视固定开 `pivot`(旧弹窗按选择分派 `agg`/`groupby`/`pivot`);④ 文本/数值/日期/切割/补位/替换的预填表达式已按各旧弹窗默认值还原,`ContextMenu` 原先用 `startsWith("split")` 猜 slice 类型导致纯 `split` 项被判成空串(靠 `sliceType || "split"` 兜底),已改显式映射。

**阶段 1 是最优先项**:它同时完成 007 文档的 D1(统一外壳)与 D4(Esc/焦点),并消灭"双实现"这个最大结构债。

### 阶段 2:巨型文件拆分(P0,5~7 天)

按 §4.1 优先级,每批 1~2 个文件:

| 批次 | 内容 | 验证 | 状态 |
|------|------|------|------|
| 2.1 | `MainMenuHooks.ts` → `hooks/execution` + `fileIO` + `charts` | `buildBranches.test.ts` 新增;执行/取消/导出冒烟 | ✅ 13 个新文件全 ≤ 400 行;`buildBranches.test.ts` 10 例;MainMenuHooks.ts 删除,共享类型下沉 `types/execution.ts` |
| 2.2 | `FlowPanel.tsx` → 交互 hook 化 | `layout.test.ts` 全绿;切刀/连线/复制粘贴冒烟 | 🔶 6 个 hook 抽出(搜索/剪贴板/命中测试/切刀/连线/布局),1,834 → 999 行;≤ 600 未达(JSX 留守);手工冒烟待做 |
| 2.3 | `App.tsx` → `useDialogStack` + `AppLayout` | 对话框开关行为一致;Esc 只关一层 | 🔶 `src/app/` + AppProviders + useAppBootstrap + useDialogStack(history/templates 接入,Esc 语义生效);AppLayout JSX 拆分与 ui.* 迁移未做,1,769 行 |
| 2.4 | `data/commands.ts` → `data/commands/` 目录 | **`commands.test.ts` 不改一行全绿** | ✅ 13 个分类文件;先断言分类在原数组是连续段,保证命令顺序不变;命令实际 61 个 |
| 2.5 | `ChartPanel.tsx` → `charts/` 7 组件 + `chartTheme` | 7 种图表 + SVG 导出 + dark mode 冒烟 | ⬜ 图表渲染散在 **39 个 return** 的内联 JSX,需逐段精读 + 人工看渲染 |
| 2.6 | `HomeView.tsx` props 分组(005 A2) | `HomeViewProps` ≤ 30 字段 | ⬜ 实测 54 字段,分组到 ~13 个可行;**分组对象必须 `useMemo`**,否则破坏 HomeView 的 React.memo |
| 2.7 | `translations.ts` → `translations/{zh,en}/` | `i18n.test.tsx` 全绿 | ✅ 7 个域文件 + `types.ts`;key 本身是扁平的(无顶层前缀),按源文件既有的 `// 域名注释` 分组;域文件 `satisfies Partial<Translations>`、合并后为 `Translations` → 缺 key 编译报错 |

### 阶段 3:目录搬迁与收尾(P1,3~4 天)

| 步骤 | 内容 | 状态 |
|------|------|------|
| 3.1 | `components/panel/` → `modules/pipeline/` + `modules/data-preview/` | ✅ `panel/utils/` → `pipeline/lib/`,`panels/` 收纳版本控制/血缘 |
| 3.2 | `HomeView.tsx`、`CommandList`、`CommandPalette` → `modules/` | ✅ 分别落 `data-preview/`、`logs/` |
| 3.3 | `ui/` 命名统一(8 个小写 → PascalCase) | ✅ Windows 大小写不敏感,需两步改名 |
| 3.4 | `hooks/` 命名统一为 `useXxx` | ✅ 2.1 随拆分完成:`MainMenuHooks.ts` 删除,职责落 `usePipelineTabs`/`useExecution` 等 use* 文件 |
| 3.5 | `SettingsTabContent.tsx` 按页签拆 | ⬜ |
| 3.6 | `services/ai/context.ts` 按职责拆 | ⬜ |
| 3.7 | `VersionControlPanel`、`useDataLineage`、`AIPanel`、`SeparateCSVDialog`、`BatchFilterHooks` 拆分 | ⬜ |
| 3.8 | 更新 `docs/AI/INDEX.md`:登记 §1.6 全部未登记文件、修正行数、补测试清单 | ✅ 前端章节按新结构重写、移除行数、补全 23 个测试文件;`check:index` 抓出并修正 8 处失效路径(设计文档名缺序号前缀、`src/pinyin.rs` 已并入 plugins.rs、`CsvDiffDialog.test.tsx` 不存在等) |

### 阶段 4:防回流(P2)

1. 🔶 ESLint 规则固化:单文件行数(`max-lines`)、`import/no-cycle`、禁止 `modules/` 互相引用
   - `max-lines`:组件/hook 400、数据与测试 800,`warn`(阶段 2 未做完前设 error 会卡住待拆文件;当前 20 个文件超预算,正是阶段 2 的精确待办清单);
   - `import/no-cycle`:**error**,已生效;
   - 禁止 `modules/` 互相引用:本地自定义规则 `no-cross-module-imports`,**warn**(`no-restricted-imports` 表达不了「除自己以外的域」;HomeView 仍是装配根,待 005 A2);
   - `components/` 禁引 `modules|data|services`:**error**(`expression/`、`setting/` 是 §2.1 P3 已知例外,降级 warn)。
2. ✅ CI 门禁:`lint` + `typecheck` + `check:index` + `test` + `build`(005 B 项,加进 `.github/workflows/build.yml`);
3. ✅ `scripts/check-index.ts`:CI 校验 INDEX.md 登记的文件路径真实存在(不校验行数,对应 005 F2)。**须先剥离 ``` 代码块再提取行内反引号路径**,否则 ASCII 架构图会把 span 撑到跨行;已加 `pnpm check:index`,当前校验 99 个路径;
4. ✅ INDEX.md 移除易漂移的行数标注,并加"结构快照日期"。

---

## 7. 验收清单

### 7.1 `dialog/` 专项

- [x] 无循环依赖(`CommandDialog` 与 `commands/` 单向) —— `import/no-cycle` 0 报错
- [x] 每个 xan 命令**只有一处**参数构建实现 —— 11 个旧对话框的手工拼参已删,`dialogs/` 内仅剩 `lib/helpers.ts`(查命令对象)、`lib/parameterDescriptions.ts`(查参数说明)两处合理 `xanCommands.find`
- [x] 无自带浮动外壳的对话框(11 → 0) —— `useDraggable` 随之失去全部引用(待删)
- [x] `VariableHint` 位于 `ui/`
- [x] 命令表单文件名 = 命令 id
- [ ] 最大单文件 ≤ 250 行 —— **未达**:实际 376(`forms/plot.tsx`),仍在 §5.3 的 400 行组件预算内

### 7.2 全局

- [ ] 单文件 ≤ 400 行(数据文件 ≤ 800,`generated/` 豁免) —— **20 个文件超预算**,见 `pnpm lint` 的 `max-lines` warning
- [ ] `App.tsx` ≤ 400 行、`FlowPanel.tsx` ≤ 600 行、`MainMenuHooks` 拆分后无单文件 > 400 行 —— 2.1 完成(MainMenuHooks 已拆尽,新文件均 ≤ 400);2.2/2.3 部分:FlowPanel 999、App.tsx 1,769,JSX 拆分后置
- [ ] `modules/` 之间无互相 import —— 现有 7 处(`data-preview/HomeView` → `pipeline|dialogs`、`pipeline/panels/VersionControlPanel` → `dialogs`、`variables/VariablePanel` → `dialogs`),HomeView 仍是装配根,待 005 A2
- [x] `components/` 无业务依赖 —— 已固化为 error;`expression/`、`setting/` 为 §2.1 P3 已知例外(warn)
- [x] Hook 全部 `useXxx` 命名,组件全部 PascalCase —— `MainMenuHooks.ts` 已随 2.1 拆分删除
- [x] `ui/` 无大小写重名文件 —— 已统一 PascalCase
- [x] 每目录 ≤ 2 层子目录

### 7.3 功能无回归(每阶段必过)

- [x] `pnpm test` 全绿(23 个测试文件 / 347 用例,重构前 22 文件 319 用例,新增 `initialParams.test.ts` 28 例并修好 2 例既有失败)
- [x] `pnpm typecheck` 零错误
- [x] `pnpm build` 成功
- [ ] 手工冒烟:打开文件 → 拖入命令 → 连线 → 执行 → 取消 → 撤销/重做 → 导出脚本
- [ ] **手工冒烟:11 个旧对话框入口(右键菜单 + 表格列)** —— 入口已改为统一 `CommandDialog`,交互外观变化见 §6 阶段 1 说明
- [ ] 手工冒烟:AI 面板、图表、数据概况、版本控制、血缘、会话恢复
- [ ] **中英文各过一遍**(英文文案更长,防溢出)
- [ ] **亮暗主题各过一遍**

> 以上 [ ] 项均为**只有人能验**的部分:前 4 项是交互/视觉冒烟,最后 2 项是主题与文案。自动化验证(tsc / vitest / build / lint / check:index)已全部通过。

---

## 8. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 无 ESLint/typecheck 就搬迁 | 2,000 行文件盲搬,错误静默 | **阶段 0 必须先完成** |
| 一次改 39 个 dialog 文件 | 无法定位回归来源 | 分批:类型下沉 → 单函数抽取 → 逐文件改;每批 `pnpm test` |
| 类型下沉引发大范围 import 改动 | 编译错误集中爆发 | 先在 `types/dialog.ts` 定义并 re-export,旧路径加 `export type { } from`,再逐步切换 |
| `commands.test.ts` 因拆分失败 | 59 命令契约失去保障 | 保持 `@/data/commands` 聚合出口不变,测试文件**零修改** |
| 交互 hook 化破坏撤销栈 | 撤销/重做失效 | 严格经 `onStepsChange`/`onEdgesChange`,禁止 hook 内直接 setTabs |
| 分隔符"所见即所跑"语义被破坏 | 预览与执行不一致(设计 018 回归) | `resolveRunDelimiter`/`loadCsvData` 搬迁时保持导出名与行为,`useTabsDelimiter.test.ts` + `delimiterMode.test.ts` 必须全绿 |
| 搬迁与功能开发并行冲突 | 合并冲突频发 | 每个阶段选低活跃窗口;阶段内一次性完成该目录搬迁 |
| INDEX.md 漂移加剧 | AI 辅助开发定位失败 | 每阶段结束同步更新 INDEX.md(阶段 3.8) |

---

## 9. 建议排期

| 批次 | 内容 | 工期 | 依赖 |
|------|------|------|------|
| 第一批 | 阶段 0(安全网) | 1 天 | 无 |
| 第二批 | 阶段 1(`dialog/` 收敛) | 3~4 天 | 第一批 |
| 第三批 | 阶段 2.1~2.3(三大巨型文件) | 3~4 天 | 第二批 |
| 第四批 | 阶段 2.4~2.7(数据/图表/i18n/Props) | 2~3 天 | 第三批 |
| 第五批 | 阶段 3(目录搬迁 + INDEX 更新) | 3~4 天 | 第四批 |
| 第六批 | 阶段 4(防回流 + CI) | 1~2 天 | 第五批 |

**合计约 13~18 天**。若排期紧张,可只做**第一批 + 第二批**:仅 `dialog/` 收敛就能消除 28% 代码量所在目录的双实现与循环依赖,是投入产出比最高的一段。

---

## 10. 附:本次未覆盖项

以下问题已被既有文档覆盖,本文不重复,仅标注承接关系:

| 问题 | 归属文档 |
|------|---------|
| Props 钻透的 Context 化评估 | 005 A2 |
| 懒加载与代码分割 | 005 A3 |
| CSP、ErrorBoundary、capabilities 细分 | 005 E |
| 测试盲区(含 Rust 侧) | 005 C |
| 对话框视觉统一、Esc/焦点、token 收敛 | 007 D1/D3/D4 |
| 浮动面板停靠与位置持久化 | 007 D2 |
| CSV 表格统一组件 | 007 D6 |
| `INDEX.md` 行数漂移修正 | 005 F + 本文 §1.6、阶段 3.8 |
