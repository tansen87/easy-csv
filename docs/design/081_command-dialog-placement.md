# 081 · 命令参数：锚定步骤卡的浮层

> 状态: **已实现（2026-11-27，采用原型方案 B）**
> 日期: 2026-11-27（首版 2026-11-26 为 A + D，已按反馈回退）
> 原型: `docs/design/prototypes/081/01-command-dialog-placement.html`（现状 + 四方案对比 + §02.1 拖动性能 + 规则）
> 关联: `031`（表格右键快速操作浮窗）、`071`（日志抽屉）、`073`（菜单栏命令输入）、`074`（命令面板退役）、`076`（ViewDock）、`080`（命令参数面板：命令优先，本稿只换容器）
> 范围: 只换参数表单的容器与位置。字段、校验、参数序列化、帮助文档不动。

---

## 1. 决策

| | 方案 | 结论 |
|---|---|---|
| **B** | 锚定步骤卡的浮层（480 宽，贴卡 12px） | **采用**：唯一入口，短表单自然高度，长表单字段区滚动 |
| A | 右栏参数检查器（真实列，470） | 不采用：画布要让出一整列，工具被推到视线另一侧 |
| C | 底部抽屉 | 不采用：与日志抽屉抢同一块底部 |
| D | 宽分栏对话框（800×600，遮罩 + 居中） | 不采用：对「改一步」这种轻操作太重；第二栏信息用「文档」按钮替代 |

上一版 B 被否掉的原因是**拖动掉帧**（rAF 轮询读卡片矩形 + 每帧重渲染表单），不是位置本身。本次把定位改成「React Flow store 订阅 + 纯数学 + 只写 transform」，拖动、平移、缩放的帧率与不开浮层时一致（§3）。

无卡片可锚时（快速操作「高级参数」新加命令）浮层落在画布中心，同样无遮罩。

## 2. 结构

- `HomeView` 的画布列外包一层 `ReactFlowProvider`，浮层作为列内 `absolute inset-0` 的只读层渲染，与画布同坐标空间。
- `CommandDialog` 从 React Flow store 取 `nodeInternals.get(stepId)` 与 `transform`，用「节点流坐标 × zoom + 视口平移」算出屏幕位置；不调用 `getBoundingClientRect`。
- 画布尺寸由挂在浮层宿主上的 `ResizeObserver` 缓存；浮层自身高度也用 `ResizeObserver` 记录，用于纵向夹取。
- 遮罩、居中模态、右栏检查器、展开/收起状态、标题栏拖动全部删除；`ViewDock` 恢复常驻。

## 3. 拖动掉帧：原因与解法

| | 旧实现 | 现在 |
|---|---|---|
| 触发 | `requestAnimationFrame` 每帧轮询，卡片不动也跑 | React Flow store 的节点与 `transform` 变化才触发 |
| 读数 | 每帧 `getBoundingClientRect()`，强制重算布局 | 全程数字运算（节点坐标 + 视口变换），零布局读取 |
| 更新 | 位置进 React state，每帧重渲染整张表单 | 位置只用于本层 `translate3d`；表单子树 props 不变，React 直接复用 |
| 其他 | — | 画布/浮层尺寸走 `ResizeObserver`，拖动期间不测量 |

结论：拖卡片、Space 平移、滚轮缩放时浮层贴卡跟随，长表单（`search` / `duckdb`）不再掉帧。标题栏仍可拖动：拖动时**卡片与浮层作为一体移动**——拖动量写进步骤节点的位置（与画布上拖卡同一条状态路径），松手按 `persistNodePositions` 保存；浮层因为锚定在节点上而同步跟随。没有卡片可锚（新加命令）时，浮层才按偏移单独移动。

**锚点取卡片盒，不取节点外框**：`layout.ts` 给步骤节点的名义宽度是 240（供 dagre 排版），而卡片实际是 220（`w-[220px]`）。直接用 `node.width` 会让「放在右侧」的间距比左侧多出这 20px。所以打开时用 `PipelineStepNode` 的 `data-step-card` 布局盒测一次（`getBoundingClientRect` 差值 ÷ zoom → 流坐标），之后拖动/缩放复用这份数字，仍不读布局。

## 4. 尺寸与规则

| 项 | 规则 |
|---|---|
| 宽 | 480；窄画布时取 `画布宽 − 16`，不横向溢出 |
| 高 | 最高 560，且不超过 `画布高 − 16`；字段区滚动，页脚固定 |
| 间距 | 贴卡 12；四周留 8。右侧放不下翻到左侧，仍放不下就夹在画布内 |
| 头部 | 40px：步骤名（或命令名）· 等宽命令名 · 文档 · 关闭；整条可拖（`cursor-grab`） |
| 拖动 | 有卡片：拖动量作用于步骤节点，卡片与浮层一起走，松手持久化位置；无卡片：浮层加偏移。两种情况都夹在画布内 |
| 表单滚动 | `bodyMaxHeight = calc(上限 − 96px)`，沿用 `CommandFormShell` / `ParamSheet` 现有页脚 |
| 关闭 | × / Esc / 取消 / 提交；无遮罩，点画布不关闭 |

## 5. 实现

| 文件 | 内容 |
|---|---|
| `command/CommandDialog.tsx` | 重写为锚定浮层：store 订阅、纯数学定位、`translate3d`、标题栏拖动（有卡片时移动卡片）、首个字段聚焦、Esc 关闭 |
| `pipeline/FlowPanel.tsx` | 新增 `stepMoveApiRef`：浮层拖动调用 `move`/`commit`，走与画布拖卡相同的节点状态与 `persistNodePositions` |
| `data-preview/HomeView.tsx` | 画布列包 `ReactFlowProvider`；浮层在列内渲染；移除检查器与展开状态 |
| `app/App.tsx` | 移除 `commandInspectorOpen`；`ViewDock` 常驻；日志抽屉 / 图表胶囊右侧偏移恢复 |
| `command/CommandFormBody.tsx` | 保留：统一表单挂载点（ParamSheet 或 `COMMAND_FORMS`） |
| `command/CommandFormShell.tsx` / `ParamSheet.tsx` | 移除只为右栏加的 `fill`，回到 `bodyMaxHeight` 单一滚动上限 |
| `types/dialog.ts` | 移除 `fill`；`bodyMaxHeight` 注释改为浮层上限 |
| `i18n` | 移除 `commandExpand` / `commandCollapse` / `commandDocsSection` / `commandInputColumns` / `commandNoInputColumns` |
| `command/CommandInspector.tsx` | 删除（右栏检查器不再存在） |

## 6. 行为

| 场景 | 行为 |
|---|---|
| 点步骤卡片 | 浮层出现在该卡右侧，标题为「命令 · 步骤名」；再点另一张卡直接换过去 |
| 拖卡片 / 平移 / 缩放画布 | 浮层跟随，位置由 React Flow 坐标算出 |
| 拖浮层标题栏 | 卡片与浮层一起移动（节点位置逐帧更新、松手保存）；未移动的点击不写位置；无卡片时浮层单独移动 |
| 新加操作（快速操作「高级参数」） | 无卡片可锚 → 浮层落在画布中心，标题为命令名，按钮为「添加步骤」 |
| 点画布空白 | 不关闭（避免误触丢草稿） |
| 提交 / 取消 | 与旧对话框一致，走 `handleCommandSubmit` |
| 窗口缩小 | 浮层宽高随画布收紧；尺寸变化由 `ResizeObserver` 触发重算 |

## 7. 已知限制

- 浮层遮住卡片右侧的节点（局部遮挡，原型已接受）；需要看完整画布时关掉浮层即可。
- 浮层不随节点层级裁剪：节点被拖出画布后浮层会一起移出可视区，属预期。
- 极窄画布（< 300）下表单字段本身会拥挤，但不会横向溢出。

## 8. 验证

- `pnpm typecheck`、`pnpm eslint` 通过。
- `pnpm test` 全量通过；`ParamSheet` 19 例仍覆盖表单渲染与提交。
