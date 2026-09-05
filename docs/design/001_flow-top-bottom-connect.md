# 节点连线支持上下(顶部/底部)连接点

## 1. 背景与问题

当前管道画布中,两个节点之间的连线只能通过**左右**两侧的连接点(Handle)连接。
连线方向完全由节点的水平位置(`position.x`)决定:

- 源节点在目标节点左侧 → 源节点 `right-*` → 目标节点 `left-*`
- 源节点在目标节点右侧 → 源节点 `left-*` → 目标节点 `right-*`

当两个节点**垂直排布**(一个在上、一个在下)时,左右连接会迫使连线绕一个大弧线或穿过中间区域,
视觉上非常绕、不直观。例如:

```
[sort]    ← 目标在下方,连到左侧再绕过去,线很长
  |
  |
[filter]  (实际连线从左/右绕,而不是直上直下)
```

需求:为节点新增**顶部(Top)/底部(Bottom)** 连接点,让连线可以根据两个节点的相对位置
自动选择 左右 或 上下 四个方向中最合理的一侧,垂直排布时走上下连接,避免绕线。

## 2. 现状分析

### 2.1 节点 Handle 定义

| 文件 | 现有 Handle |
|------|-------------|
| `src/components/panel/nodes/PipelineStepNode.tsx` | `left-target`、`left-source`、`right-source`、`right-target` |
| `src/components/panel/nodes/TableNode.tsx` | `table-left-source`、`table-left-target`、`table-right-source`、`table-right-target` |

所有 Handle 均为双向(同一侧同时存在 source 与 target),且全部 `opacity: 0`、`pointerEvents: none`,
即连接点不直接可视化/可拖拽,连线只由程序自动生成。

### 2.2 边(Edge)生成逻辑

核心逻辑集中在 `src/components/panel/utils/layout.ts`:

- `getLayoutedElements()`(第 71–109 行 `createEdge`):渲染/重算布局时根据 `position.x`
  决定 `sourceHandle` / `targetHandle`,生成 React Flow Edge。
- `createEdgeConfig()`(第 182–222 行):交互连线(鼠标拖拽 `onConnect`、右键连线、导入历史边)时
  生成 Edge 配置,同样只比较 `position.x`。

两个函数的判断逻辑一致,都是:

```ts
if (sourceX <= targetX) {
  sourceHandle = right-source; targetHandle = left-target;
} else {
  sourceHandle = left-source;  targetHandle = right-target;
}
```

### 2.3 连线交互入口(`src/components/panel/FlowPanel.tsx`)

- `onConnect`(第 995 行):React Flow 原生拖拽连接回调,调用 `createEdgeConfig` 生成边。
- 右键拖拽连线(`handleCutStart` / `handleCutMove` / `handleCutEnd`,第 628 / 664 / 841 行):
  右键按下选中源节点、拖到目标节点松开后调用 `createEdgeConfig`。
- 切割碰撞检测(`detectAndDeleteElements` 第 394 行、`handleCutMove` 内第 664 行):
  把每条边近似为**从源节点右边中点 → 目标节点左边中点**的直线段(第 434–441、718–725 行),
  用于"切刀"切连线。该几何假设目前与左右连接一致,但**上下连接后需要同步更新**。

### 2.4 持久化

`PipelineEdge`(`src/types/xan.ts` 第 47 行)只存 `id / source / target`,**不存** handle id。
所有边在每次布局重算时都会通过 `createEdgeConfig` 根据节点位置重新计算 handle,
因此新增上下连接点**完全向后兼容**,无需改动存储结构、版本历史或会话快照。

## 3. 方案设计

### 3.1 Handle 命名扩展

在每个节点上新增 4 个双向 Handle(保持现有命名风格):

`PipelineStepNode.tsx`:

| 位置 | source | target |
|------|--------|--------|
| Top | `top-source` | `top-target` |
| Bottom | `bottom-source` | `bottom-target` |

`TableNode.tsx`(沿用 `table-` 前缀):

| 位置 | source | target |
|------|--------|--------|
| Top | `table-top-source` | `table-top-target` |
| Bottom | `table-bottom-source` | `table-bottom-target` |

Handle 的 `type` 需同时声明 source 与 target(与左右保持一致),视觉样式沿用
`opacity: 0`、`pointerEvents: none`。

### 3.2 方向选择算法

将 `layout.ts` 中重复的两段 handle 选择逻辑收敛为一个共享函数:

```ts
// 根据两节点的相对位置,选择最合理的连接方向
export function resolveHandles(
  sourceId: string,
  targetId: string,
  sourceNode?: { position: { x: number; y: number }; width?: number; height?: number },
  targetNode?: { position: { x: number; y: number }; width?: number; height?: number },
): { sourceHandle: string; targetHandle: string } {
  // 无位置信息时退回默认:左右连接
  if (!sourceNode || !targetNode) {
    return { sourceHandle: 'right-source', targetHandle: 'left-target' };
  }

  const prefix = (id: string) => (id === 'table-node' ? 'table-' : '');

  const sourceCenterX = sourceNode.position.x + (sourceNode.width ?? 0) / 2;
  const sourceCenterY = sourceNode.position.y + (sourceNode.height ?? 0) / 2;
  const targetCenterX = targetNode.position.x + (targetNode.width ?? 0) / 2;
  const targetCenterY = targetNode.position.y + (targetNode.height ?? 0) / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  // 纵向位移占主导 → 走上下连接,避免绕线
  if (Math.abs(dy) >= Math.abs(dx)) {
    if (dy >= 0) {
      return { sourceHandle: `${prefix(sourceId)}bottom-source`, targetHandle: `${prefix(targetId)}top-target` };
    }
    return { sourceHandle: `${prefix(sourceId)}top-source`, targetHandle: `${prefix(targetId)}bottom-target` };
  }

  // 横向位移占主导 → 保持原有左右连接
  if (dx >= 0) {
    return { sourceHandle: `${prefix(sourceId)}right-source`, targetHandle: `${prefix(targetId)}left-target` };
  }
  return { sourceHandle: `${prefix(sourceId)}left-source`, targetHandle: `${prefix(targetId)}right-target` };
}
```

要点:

- 用**节点中心**比较(而非左上角),避免宽 Table 节点(500px)与窄步骤节点(220px)
  造成的方向误判;尺寸缺失时退化为仅用左上角坐标比较。
- 比较阈值使用 `|dy| >= |dx|`,对角线排布时优先走上下方向,体验更符合直觉。
  (如希望更保守,可调整为 `|dy| > 1.2 * |dx|`,预留一个常量便于后续调优。)
- `getLayoutedElements()` 与 `createEdgeConfig()` 内部均改调 `resolveHandles`。

React Flow 的默认 bezier 边(`type: "default"`)会根据 `sourceHandle` / `targetHandle`
所在的边自动计算锚点与曲线方向,无需自定义 edge type。

### 3.3 切割碰撞检测同步更新

`FlowPanel.tsx` 中两处把边近似为 `右边中点 → 左边中点` 的线段:

- `detectAndDeleteElements`(第 434–441 行)
- `handleCutMove` 内的实时高亮(第 718–725 行)

需提取一个共享几何辅助函数(可放入 `panel/utils/layout.ts` 或新建 `panel/utils/edgeGeometry.ts`),
根据同一套 `resolveHandles` 结果计算线段端点:

```ts
export function getEdgeEndpoints(
  sourceId: string,
  targetId: string,
  sourceRect: { x: number; y: number; width: number; height: number },
  targetRect: { x: number; y: number; width: number; height: number },
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const { sourceHandle, targetHandle } = resolveHandles(sourceId, targetId, sourceRect, targetRect);
  return {
    start: handleAnchor(sourceRect, sourceHandle),
    end: handleAnchor(targetRect, targetHandle),
  };
}
// handleAnchor: 根据 handle 名返回对应的边中点(左/右/上/下)
```

`handleAnchor` 对四边映射:

| handle 含 `left` | 边中点 (x, y + h/2) |
| handle 含 `right` | 边中点 (x + w, y + h/2) |
| handle 含 `top` | 边中点 (x + w/2, y) |
| handle 含 `bottom` | 边中点 (x + w/2, y + h) |

### 3.4 交互无感说明

- `onConnect` / 右键连线直接透传 `connection.sourceHandle/targetHandle` 不保存,
  仍统一走 `createEdgeConfig` 重算,行为保持一致。
- 拖拽节点改变相对位置后,边会随布局重算自动切换 上下/左右 方向,无需额外状态。

## 4. 涉及文件清单

| 文件 | 改动 |
|------|------|
| `src/components/panel/nodes/PipelineStepNode.tsx` | 新增 `top-source/top-target/bottom-source/bottom-target` 四个 Handle |
| `src/components/panel/nodes/TableNode.tsx` | 新增 `table-top-source/table-top-target/table-bottom-source/table-bottom-target` 四个 Handle |
| `src/components/panel/utils/layout.ts` | 新增 `resolveHandles`,`getLayoutedElements` 与 `createEdgeConfig` 改用它 |
| `src/components/panel/FlowPanel.tsx` | 两处切割碰撞检测改调用共享端点计算函数 |

## 5. 实现步骤

1. 在 `layout.ts` 新增并导出 `resolveHandles`(含 `handleAnchor` 或端点辅助)。
2. 替换 `getLayoutedElements()` 与 `createEdgeConfig()` 中的 handle 选择逻辑。
3. 在 `PipelineStepNode.tsx`、`TableNode.tsx` 添加上下 Handle(与左右样式一致)。
4. 在 `FlowPanel.tsx` 的 `detectAndDeleteElements` 与 `handleCutMove` 中,
   用 `getEdgeEndpoints` 替换硬编码的左右中点线段。
5. 自测与回归测试。

## 6. 边界情况与风险

- **宽窄节点中心偏移**:优先用中心点比较,尺寸未知时回退左上角,行为可接受。
- **对角线(≈45°)**:统一按纵向处理走上下连接;若实测不佳,可引入比例阈值常量调优。
- **Table 节点(Input Data)**:前缀 `table-` 已由 `resolveHandles` 统一处理,行为与步骤节点一致。
- **旧数据兼容**:`PipelineEdge` 不含 handle,历史/版本/会话快照无需迁移。
- **切割切连线**:端点几何与 handle 选择保持一致后,上下连线也能被正确切断。
- **回归风险**:`layout.ts` 与 `FlowPanel.tsx` 均为渲染/交互热点,改动后需回归
  拖拽连接、右键连线、切刀、导入历史管道、执行管道等场景。

## 7. 验证与测试计划

- **手工验证**:
  1. 水平排布两个节点 → 连线仍走左右(无回归)。
  2. 垂直排布两个节点 → 连线走上下,线不再绕。
  3. 拖拽节点改变相对位置 → 连线自动切换方向。
  4. 上下连线时"切刀"能正确切断;导入/保存管道后方向恢复正确。
- **单测(可选)**:
  - 为 `resolveHandles` 增加 vitest 用例:横向/纵向/对角线/无尺寸兜底/Table 前缀
    共 6–8 组断言。
  - 新增测试文件参考 `src/__tests__/` 现有结构与 `src/test/setup.ts`。
