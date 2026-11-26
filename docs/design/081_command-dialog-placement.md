# 081 · 命令参数：右栏检查器 + 宽分栏对话框

> 状态: **已实现（2026-11-26，采用原型方案 A + D）**
> 日期: 2026-11-26
> 原型: `docs/design/prototypes/081/01-command-dialog-placement.html`（现状 + 四方案对比 + 规则）
> 关联: `031`（表格右键快速操作浮窗）、`040`（设置对话框）、`071`（日志抽屉）、`073`（菜单栏命令输入）、`074`（命令面板退役）、`076`（ViewDock）、`080`（命令参数面板：命令优先，本稿只换容器）
> 范围: 只换参数表单的容器与位置。字段、校验、参数序列化、帮助文档不动。

---

## 1. 决策

| | 方案 | 结论 |
|---|---|---|
| A | 右栏参数检查器（真实列，470） | **日常入口** |
| D | 宽分栏对话框（800×600，左参数 / 右说明与输入列） | **按需展开** |
| B | 锚定步骤卡的浮层 | 不采用：跟随卡片需要持续读矩形，拖动/平移时明显卡顿；388–560 也装不下 `search` / `duckdb` / `batch-*` |
| C | 底部抽屉 | 不采用：与日志抽屉抢同一块底部 |

流程：点步骤卡片（或快速操作「高级参数」）→ **右栏**显示参数；右栏顶部「展开」→ **D** 的宽分栏；D 顶部「收起」回到右栏。画布在 A 中让出 470 列，在 D 中恢复并在模态后面。

## 2. 结构

- `HomeView` 从 `relative` 根改为 `flex`：左侧画布列（`relative min-w-0 flex-1`，所有画布浮层仍在其中），右侧 `CommandInspector`（打开时渲染）。
- 检查器打开时 App **不渲染 ViewDock**（`onCommandInspectorChange` 经 `useLayoutEffect` 上报，换列发生在首帧之前）；`activePanel` 状态保留，关闭后原来的面板回来。日志抽屉与图表胶囊的 `rightInset` 在检查器打开时按 0 计算。
- D 是 `fixed inset-0` 的模态（800×600、20% 遮罩），由 `HomeView` 在 `expanded` 时渲染；展开时检查器卸载，画布扩回原宽。

## 3. 尺寸与规则

| 项 | 规则 |
|---|---|
| 检查器宽 | 470，`max-w-[55vw]` |
| 检查器结构 | 44px 头（步骤名 · 命令名 + 展开 / 文档 / 关闭）、表单区填满、表单自带页脚 |
| D 尺寸 | `min(800px, 100vw−32)` × `min(80vh, 600px)`；左参数 532、右说明 268 |
| D 右栏 | 命令说明（当前语言）+ 输入列 chip；窗口 < 860 时隐藏右栏，只留参数 |
| 表单滚动 | A：`fill`，表单区自适应列高、页脚固定；D：`bodyMaxHeight = calc(min(80vh,600px) − 104px)` |
| 关闭 | × / Esc / 取消 / 提交；D 的背景遮罩点击 = 关闭 |

## 4. 实现

| 文件 | 内容 |
|---|---|
| `command/CommandFormBody.tsx` | 新增。两侧共用的表单挂载点（ParamSheet 或 `COMMAND_FORMS`），保证 A/D 渲染完全一致 |
| `command/CommandInspector.tsx` | 新增。右栏检查器：头部、展开、Esc、首个字段聚焦 |
| `command/CommandDialog.tsx` | 重写为 D：居中 800×600、左参数右说明、`onCollapse` 回到 A；删除锚点定位与跟随轮询 |
| `CommandFormShell.tsx` / `ParamSheet.tsx` | 新增 `fill`：填满父列、页脚贴底；非 fill 仍用 `bodyMaxHeight` |
| `types/dialog.ts` | `CommandDialogState` 去掉 `anchorStepId`、保留 `stepLabel`；`CommandFormProps` 加 `fill` |
| `data-preview/HomeView.tsx` | 画布列 + 检查器；`expanded` 状态；打开/关闭时通知壳层 |
| `app/App.tsx` | 检查器打开时隐藏 ViewDock；修正日志/图表右侧偏移 |

## 5. 行为

| 场景 | 行为 |
|---|---|
| 点另一张步骤卡 | 检查器直接切到该步骤参数（草稿不保留，与旧行为一致） |
| 点画布空白 | 不关闭 |
| 展开 / 收起 | 参数状态保存在 `commandDialog.params`，A ↔ D 切换不丢改动；ParamSheet 的局部展开项会重置 |
| 提交 / 取消 | 与旧对话框一致，走 `handleCommandSubmit` |
| 窄窗口 | 检查器 `max-w-[55vw]`；D 右栏在 < 860 隐藏 |

## 6. 已知限制

- 检查器暂不支持拖宽（原型里的 420–560 可拖留待后续；当前固定 470）。
- A 与 D 之间切换会重挂表单，ParamSheet 的「当前编辑的 token」等局部状态重置，参数值不受影响。

## 7. 验证

- `pnpm typecheck`、`pnpm eslint` 通过。
- 全量测试 73 文件全部通过（`ParamSheet` 19 例覆盖表单渲染与提交）。
