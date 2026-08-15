# 右键连线改为贝塞尔曲线预览

## 1. 背景与问题

当前右键连线交互:右键按下选中源节点 → 按住拖动 → 松开到目标节点上完成连线。

拖动过程中,画布上用 `ConnectionVisualization` 渲染一条**自由手绘折线**(`connectPath`,
即鼠标轨迹的点序列),样式为虚线(`strokeDasharray: "8 4"`)加渐变色。

问题反馈:**"软绵绵的"**。具体表现:

- 折线完全跟随鼠标逐点记录,拖动路径稍微绕弯就会出现波浪形、锯齿感;
- 虚线 + 轨迹线,视觉上更像"随手画线",而不是"在拉一条连线";
- 松开后生成的最终边是 React Flow 的 **bezier 默认边**(`type: "default"`),
  与预览的折线形状**不一致**,预览≠结果,体验割裂。

需求:右键拖动连接时改为显示**贝塞尔曲线**,并且预览形状应与最终生成的边一致(WYSIWYG)。

## 2. 现状分析

### 2.1 交互流程(`src/components/panel/FlowPanel.tsx`)

| 函数 | 行号 | 说明 |
|------|------|------|
| 连接状态 | 166–176 | `isConnecting`、`connectSourceNode`、`connectPath: {x,y}[]`、`connectTargetNode` |
| `handleCutStart` | 627 | 右键按在非 table 节点上 → 进入连接态,记录起始点到 `connectPath` |
| `handleCutMove` | 663 | 每帧追加鼠标点到 `connectPath`(最多保留 20 个点),并检测悬停目标节点 |
| `handleCutEnd` | 838 | 松开时若 `connectPath.length > 1` 且命中目标 → `createEdge(source, target)` |
| 渲染 | 1153 | `<ConnectionVisualization connectPath={connectPath} .../>` |

`connectPath` 存的是**wrapper 相对坐标**(`clientX - rect.left`),即与覆盖层 SVG
(绝对定位在 wrapper 左上角)同一坐标系。

### 2.2 预览渲染(`src/components/panel/overlays/ConnectionVisualization.tsx`)

- 把 `connectPath` 的点序列拼成 SVG `path`(`M p0 L p1 L p2 ...`);
- 虚线 `strokeDasharray: "8 4"`、渐变色、3px 圆头;
- 起点画一个实心圆;悬停目标节点时在光标处显示提示文字 `connectionTips`。

### 2.3 最终边(`src/components/panel/utils/layout.ts`)

`createEdgeConfig()`(298 行)与 `getLayoutedElements()` 内部 `createEdge`(195 行)
都生成:

```ts
{ id, source, target, sourceHandle, targetHandle, type: "default", ... }
```

即 React Flow 内置 **bezier 默认边**,几何由 `getBezierPath()` 计算,
`sourcePosition` / `targetPosition` 由 `sourceHandle` / `targetHandle` 的方位
(左/右/上/下)推导。上一轮改造引入的 `resolveHandles()` / `handleAnchor()`
已能给出四方向 handle 及其锚点。

**关键结论**:React Flow 已导出 `getBezierPath`,且最终边就是用它渲染的。
预览只需要"提前"调用同一个函数,就能做到与最终边完全一致。

## 3. 方案设计

### 3.1 推荐方案 A:getBezierPath 实时贝塞尔预览(采用)

把"鼠标轨迹折线"改为"**源节点锚点 → 当前光标(或目标节点锚点)** 的单条三次贝塞尔曲线",
形状与最终 default 边完全一致。

**数据与状态改造**(`FlowPanel.tsx`):

| 现状 | 改为 |
|------|------|
| `connectPath: {x,y}[]` | `connectCursor: {x,y} \| null`(光标,flow 坐标) |
| — | `connectSourceHandle: string \| null`(手势期间源端 handle) |
| — | `connectPreviewD: string \| null`(每次 move 算好的贝塞尔 `d`) |

渲染层(`ConnectionVisualization.tsx`)只负责画 `path d={connectPreviewD}` + 起点圆点 +
目标提示文字,不再自行拼折线。为了在覆盖层坐标系中对齐,`connectPreviewD` 用
`reactFlowInstance.current.flowToScreenPosition(...)` 把 flow 锚点换算到 wrapper
坐标(与现有 cutPath 的 `screenToFlowPosition` 换算保持同一套约定,需实测校验坐标基准)。

**手势逻辑**:

1. `handleCutStart`:记录 `connectSourceNode`;先不显示线(或默认 `right-source`)。
2. `handleCutMove`(每帧):
   - 用 `screenToFlowPosition` 把光标转为 flow 坐标,存入 `connectCursor`。
   - **源端 handle**:由光标相对源节点中心的位移方向决定(与 `resolveHandles` 同一套
     比较逻辑,把光标当作零尺寸伪目标),带 24px **迟滞阈值**防止在斜向拖动时左右/上下
     频繁跳变;光标仍在源节点内部时保持 `right-source`。
   - **目标端**:
     - 悬停到合法目标节点 → 用 `resolveHandles(source, target)` 计算两端 handle,
       锚点吸附到源节点与目标节点的真实边上(此时预览即最终边的形状);
     - 未悬停 → 源端用当前 `connectSourceHandle`,目标锚点=光标点,
       `targetPosition` 取与源端相反方位。
   - 调 `getBezierPath(...)`(curvature 与 default 边一致,默认 0.25),结果存 `connectPreviewD`。
3. `handleCutEnd`:与现状一致,`createEdge(source, target)`,最后清空新状态。

**预览样式**:

- 单条实线(去掉虚线),渐变或主题色,3px 圆头,可加一个与最终边一致的箭头
  (`MarkerType.ArrowClosed`)让方向感更明确;
- 起点保留圆点;悬停目标节点仍显示 `connectionTips` 提示文字。

**新增共享辅助**(`src/components/panel/utils/layout.ts`,可单测):

```ts
// 方位 → reactflow Position
function sideToPosition(handle: string): Position;

// 手势期源端 handle(光标作伪目标 + 迟滞)
export function pickStartHandle(
  sourceId: string,
  sourceRect: { x: number; y: number; width: number; height: number },
  cursor: { x: number; y: number },
  hysteresis?: number,
): string;

// 生成预览贝塞尔 path(端点解析 + getBezierPath,与最终边同一套几何)
export function buildConnectPreviewPath(params: {
  sourceId: string;
  sourceRect: { x: number; y: number; width: number; height: number };
  sourceHandle: string;
  cursor: { x: number; y: number };
  target?: { id: string; rect: { x: number; y: number; width: number; height: number } };
}): { d: string };
```

### 3.2 备选方案 B:平滑化自由轨迹(Catmull-Rom → Bezier)

保留"跟着鼠标画线"的手绘感,把折线换成 Catmull-Rom 样条转贝塞尔段平滑。

- 优点:改动最小(仍渲染轨迹),视觉不再锯齿。
- 缺点:**预览与最终 default 边形状仍不一致**,而且"软绵绵"的手绘感仍在,
  只是变平滑。作为保底选项。

### 3.3 备选方案 C:React Flow 原生连接线

`onConnectStart` / `onConnectEnd` + 自定义 `connectionLineComponent`
(React Flow 自带连接预览)。

- 缺点:React Flow 原生连接必须**从 Handle 拖拽**触发,而当前 Handle 全部
  `pointerEvents: none`,且应用刻意用**右键**在节点上起手连接(左键留给移动节点)。
  改为左键拖 Handle 等于推翻现有交互模型,改动大、学习成本高、与"切水果"右键逻辑冲突。
- 结论:不采用,仅记录。

### 3.4 备选方案 D:直线预览

从源锚点拉一条直线到光标。

- 优点:实现最简。
- 缺点:与最终 bezier 边不一致,拖动中直角转折生硬。
- 结论:不采用。

### 3.5 方案对比

| 方案 | 预览=最终边 | 手绘感 | 实现成本 | 风险 |
|------|:---:|:---:|:---:|------|
| **A. getBezierPath 预览** | ✅ | 弱(干净) | 中 | 低,复用 resolveHandles/getBezierPath |
| B. 轨迹平滑 | ❌ | 强 | 低 | 预览≠结果 |
| C. 原生 connectionLine | ✅ | 中 | 高 | 推翻右键交互,需改 Handle |
| D. 直线预览 | ❌ | 弱 | 最低 | 预览≠结果,生硬 |

**结论**:采用方案 A。它与上一轮的"上下连接点"改造天然衔接——目标端吸附正好复用
`resolveHandles` 的四方向选择,预览与最终边严格一致。

## 4. 涉及文件清单

| 文件 | 改动 |
|------|------|
| `src/components/panel/utils/layout.ts` | 新增 `pickStartHandle`、`sideToPosition`、`buildConnectPreviewPath`(内部用 `handleAnchor` + `getBezierPath`) |
| `src/components/panel/FlowPanel.tsx` | 连接态状态改为 `connectCursor` / `connectSourceHandle` / `connectPreviewD`;`handleCutStart/Move/End` 重写;坐标换算用 `screenToFlowPosition` / `flowToScreenPosition` |
| `src/components/panel/overlays/ConnectionVisualization.tsx` | 只渲染 `connectPreviewD` 的贝塞尔 path(实线 + 可选箭头)+ 起点圆点 + 提示文字;移除折线/虚线逻辑 |
| `src/__tests__/layout.test.ts` | 新增 `pickStartHandle` / `buildConnectPreviewPath` 用例 |

## 5. 实现步骤

1. `layout.ts` 新增 `sideToPosition` / `pickStartHandle` / `buildConnectPreviewPath`,
   并导出;`getBezierPath` 从 `reactflow` 导入。
2. `FlowPanel.tsx` 替换状态:删 `connectPath`,加 `connectCursor` / `connectSourceHandle`
   / `connectPreviewD`。
3. 重写 `handleCutMove`:换算光标 flow 坐标 → 算源端 handle(迟滞)→ 算目标端(节点吸附
   或自由光标)→ `buildConnectPreviewPath` 产出 `d`。
4. `handleCutStart` 记录源端初始 handle;`handleCutEnd` 完成后清空新状态。
5. 改 `ConnectionVisualization` 接收并渲染 `connectPreviewD`;去掉折线与虚线。
6. 单测 + 手工回归(见 §7)。

## 6. 边界情况与风险

- **坐标基准**:预览覆盖层为 wrapper 坐标,节点锚点为 flow 坐标,必须经
  `flowToScreenPosition` 换算;`screenToFlowPosition` 输入基准需按 React Flow 11.11.4
  实际行为校准(参照现有 cutPath 的 `p.x + rect.left` 写法)。
- **迟滞抖动**:斜向拖动时源端 handle 可能在 上下/左右 间跳变,用 24px 阈值 + 状态保持,
  阈值设为常量便于调优。
- **目标吸附切换**:悬停合法目标时源端 handle 由 `resolveHandles` 重新决定(可能与手势
  起始 handle 不同),以"预览=最终边"为准;非法目标(自身/table 节点按现状不可连)不吸附。
- **缩放平移**:缩放/平移画布时预览需随坐标系实时换算,避免与节点错位。
- **切水果不受影响**:切割模式(`isCutting`)状态与路径不变,仅连接模式的预览变化。
- **回归点**:右键起手位置在节点边缘时,光标可能先落在源节点内部,需默认 `right-source`
  直至光标移出节点边界。

## 7. 验证与测试计划

- **手工验证**:
  1. 右键在步骤节点上拖动 → 看到一条平滑贝塞尔曲线实时跟随,不再有折线/虚线/波浪感。
  2. 悬停到目标节点 → 预览吸附到两端真实锚点,形状与松开后生成的边完全一致(水平/垂直/斜向各测一组)。
  3. 缩放/平移画布后重复 1–2,预览始终与节点对齐。
  4. 目标节点高亮与提示文字(connectionTips)仍正常;松开正确建边,重复建边被去重。
  5. 切水果(空白处右键拖动切边/节点)无回归。
- **单测**(`src/__tests__/layout.test.ts`):
  - `pickStartHandle`:光标在源节点 右/左/下/上 及内部/迟滞边界各一组。
  - `buildConnectPreviewPath`:无目标(自由光标)与有目标(四方向吸附)各一组,
    断言返回的 `d` 以 `M x y C ...` 开头且两端点与 `handleAnchor` 一致。