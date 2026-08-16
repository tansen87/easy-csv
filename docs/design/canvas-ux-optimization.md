# 画布 UI/UX 优化建议

> 面向 `FlowPanel.tsx` 主画布(ReactFlow 可视化管道编辑器)的 UI/UX 改进建议清单。
> 按 **优先级分组**,每条给出现状、问题、建议方向与涉及文件,供后续迭代立项。

---

## 1. 现状盘点(已实现)

| 能力 | 位置 |
|------|------|
| 四方向连接点 + 自动选方向 | `panel/nodes/*.tsx` + `panel/utils/layout.ts`(`resolveHandles`/`handleAnchor`) |
| 右键贝塞尔连线实时预览(预览=最终边) | `FlowPanel.tsx` + `overlays/ConnectionVisualization.tsx` |
| 右键空白处"切刀"删节点/边 + 坠落动画 | `FlowPanel.tsx`(`handleCutStart/Move/End`) + `overlays/CutVisualization.tsx` + `utils/cutGeometry.ts` |
| 画布搜索 Ctrl+F,跳转 + 高亮 | `overlays/SearchOverlay.tsx` + `FlowPanel.tsx` |
| 自绘坐标网格(主/次网格 + 轴刻度) | `panel/CoordinateGrid.tsx` |
| dagre 自动布局(仅新增节点时用) | `panel/utils/layout.ts`(`getLayoutedElements`) |
| 保存状态指示(步骤数 / 已保存 / 相对时间) | `FlowPanel.tsx` 底部左侧 |
| 节点别名编辑、参数标签展示、悬浮操作按钮 | `panel/nodes/PipelineStepNode.tsx` |
| 输入表节点(表头重命名 + 前 5 行预览 + 重复列警告) | `panel/nodes/TableNode.tsx` |

**缺失/薄弱能力**:缩放控制、多选与框选、Delete 删除、画布右键菜单、
自动整理布局按钮、执行状态反馈、空画布引导、对齐参考线、缩放自适应文本等。

---

## 2. P0 - 高频基础操作

### 2.1 画布缩放控制与状态显示

**建议**:
- 设置页可加"双击画布空白 → fitView"开关。

**涉及**:`FlowPanel.tsx` + `overlays/`(新增 `ZoomControls.tsx`)+ 样式。

### 2.2 多选 + Delete 删除 + 拖拽框选

**现状**:节点只支持单选(`selectedStepId`),没有框选、没有 Delete 快捷键。`handleStepRemove`
支持传入 `string[]`,但入口没有配套 UI。批量删除只能靠"切刀"或逐个删除。

**建议**:
- 启用 ReactFlow 框选(`selectionOnDrag={false}` + `panOnDrag` 与框选共存时需配置 `selectionMode`)。
- `Delete` / `Backspace` 删除当前选中节点(通过 `onSelectionChange` 收集 ids,
  经 `onStepRemove(ids, extraEdgeIds)` 统一走现有删除流程,保证撤销栈一致)。
- 多选后悬浮操作条:删除、复制(Ctrl+D 已被 CSV 对比占用,CSV 对比修改为Ctrl+Shift+D)。

**涉及**:`FlowPanel.tsx` + `KeyboardShortcuts.ts`(留意与现有快捷键冲突)。

### 2.3 画布空白处右键菜单

**现状**:`FlowPanel.tsx:1009-1011` 的 `handlePanelContextMenu` 直接 `preventDefault`,
空白处右键被完全屏蔽;用户只会"切刀",缺少显式操作入口。

**建议**:空白处右键弹出画布菜单:

- 添加步骤(展开命令分类子菜单,与 `CommandList` 共用 `commandIconMap`);
- 自动整理布局(重跑 dagre);
- 适配视图 / 缩放;

**涉及**:`FlowPanel.tsx` + 新增 `CanvasContextMenu.tsx` + `CommandList.tsx`(复用命令数据)。

---

## 3. P1 - 信息密度与可读性

### 3.1 步骤节点执行状态反馈

**现状**:执行完管道后,节点无任何状态标记;用户只能从日志面板猜测哪步失败/耗时。

**建议**:

- 为 `PipelineStepNode` 增加 `status: "pending" | "running" | "success" | "error"` 状态,
  节点左侧加状态色条 + 图标(✓ / ✗ / 转圈),失败节点标红并高亮。
- `ExecutionResult`(`pipeline.rs`)已含 per-step 结果,前端 `onLogsChange`/执行流程处映射到节点即可。
- 执行期间正在跑的节点加描边动画,形成"数据流过管道"的直观感。

**涉及**:`types/xan.ts`(Step 类型加可选 status)+ `PipelineStepNode.tsx` + `MainMenuHooks.ts`(执行逻辑回填状态)。

---

## 4. P2 - 导航与效率

### 4.1 搜索增强

**现状**:`SearchOverlay.tsx` 仅精确子串匹配(`FlowPanel.tsx:371-405`),只匹配命令名/别名,
不支持模糊、不显示参数命中,键盘只支持 Enter/Esc。

**建议**:
- ↑/↓ 导航、Enter 选择;匹配关键词高亮(`<mark>`);
- 命中参数值也计入结果(搜索条件如 `filter` + 某列名);
- 结果项显示命令图标 + 所在位置提示;无结果时给出"在命令面板打开"快捷入口。

**涉及**:`SearchOverlay.tsx` + `FlowPanel.tsx`(`searchResults` 计算)。

### 4.2 空画布引导

**现状**:无步骤、无表时画布一片网格,新手不知从何下手。

**建议**:
- 空状态浮层:大图标 + 文案"从左侧命令面板拖入一个步骤开始"(中英文各一套,走 i18n);
- 首次使用可显示一次"右键连节点 / 右键空白切刀"的操作提示 toast;
- 提示可关闭,关闭状态持久化到 config。

**涉及**:`FlowPanel.tsx` + `i18n/translations.ts` + `config.rs`(可选)。

---

## 5. P3 - 体验打磨(低成本高感知)

| 建议 | 说明 |
|------|------|
| 切刀工具可发现性 | 切刀/连线都藏在"右键",但无任何提示。画布角落加一行 `?` 帮助胶囊或首次引导;悬停按钮提示"右键拖拽可连线/切刀"。 |
| 执行中视觉反馈 | 执行时画布顶部加进度条 + 当前步骤高亮;取消按钮位置与执行状态联动。 |
| 相对时间更友好 | `FlowPanel.tsx:50-66` 的 `formatRelativeTime` 只支持英文且粒度粗;接入 i18n,中文"刚刚 / N 分钟前"。 |
| 保存按钮显性化 | 顶部加一个保存按钮(`onSave` 已贯通,`MainMenu` 或画布角标),状态点旁可点击。 |
| 缩放下网格淡出 | 网格线透明度随 zoom 变化(`CoordinateGrid.tsx` 已读 zoom,直接乘系数),避免过密糊成一片。 |

## 6. 通用原则

1. **所有新增 UI 走 i18n**(`i18n/translations.ts` 已有 860 行,中英双语),避免硬编码英文。
2. **颜色一律用主题变量 / CSS 变量**,亮暗模式各验证一遍(注意 `bg-orange-50` 这类硬编码)。
3. **键盘交互冲突提前排查**:`KeyboardShortcuts.ts` 已占用较多组合键(Ctrl+D=CSV 对比、
   Ctrl+O/N/S/I/E/Z/Y/R、Alt+C/Q/D/A),新增快捷键需先查表。
4. **撤销/重做一致性**:所有画布结构变更(删除、布局、连线)都应走 `onStepsChange` /
   `onEdgesChange`,让 `usePipelineState` 的撤销栈自然生效。
5. **几何/算法进 `layout.ts` / `cutGeometry.ts`**:现有项目已有 `src/__tests__/layout.test.ts`
   单测规范,新增坐标换算、吸附、对齐逻辑应同步补单测。