# 画布键盘平移（WASD + 方向键，8 方向）

> 基于 `src/components/panel/FlowPanel.tsx`（ReactFlow 配置 L1540-1559、既有键盘处理 L1464-1488、
> `reactFlowInstance` L548/L1569）、`src/hooks/KeyboardShortcuts.ts`（全局快捷键冲突排查）、
> `package.json` L42（reactflow ^11.11.4）确认的现状缺口。
> 与既有文档分工：本文只覆盖 **画布视野的键盘平移**，不涉及缩放、节点拖拽、滚轮行为。

---

## 1. 现状证据（实测）

| 层 | 现状 | 证据 |
|----|------|------|
| 平移方式 | 仅两种：鼠标中键拖拽、Space+左键拖拽 | `FlowPanel.tsx` L1551-1554：`panOnDrag={[1]}` + `panActivationKeyCode="Space"` |
| 键盘事件 | 画布已有 window 级 keydown 监听（Delete/Ctrl+C/V），并带输入框守卫 | `FlowPanel.tsx` L1464-1488 |
| 视口控制 | `reactFlowInstance` 已持有实例，具备 `getViewport()/setViewport()/getZoom()` 能力 | `FlowPanel.tsx` L548, L563-567, L1569-1570 |
| 全局快捷键 | WASD/方向键单键均未被占用；冲突风险全部在组合键（Ctrl+D、Alt+A、Shift+S 等） | `KeyboardShortcuts.ts` L60-111 |
| reactflow 版本 | ^11.11.4，`panActivationKeyCode` 只接受**单个键**，无多键/方向键平移内置支持 | `package.json` L42, reactflow v11 API |

**关键结论**：reactflow v11 没有开箱即用的多键平移，需要自己在前端监听按键并用
`setViewport()` 驱动视口移动；后端零改动。

---

## 2. 目标

- 按住 `W/A/S/D` 或 `↑/↓/←/→` 中任意键，画布视野沿对应方向连续平移；
- 支持组合（如 `W+D` → 斜向），即 **8 方向**；
- 平移为屏幕空间等速（不随 zoom 变化手感），`Shift` 加速；
- 焦点在输入框/文本域/可编辑元素内时不触发（复用既有守卫模式）；
- 与现有交互（中键拖拽、Space+拖拽、Shift 框选、双击 fitView、切刀、连线）零冲突。

---

## 3. 方案设计

### 3.1 核心思路：keydown/keyup 记录按键集合 + rAF 循环驱动 `setViewport`

不使用 reactflow 的 `panActivationKeyCode`（单键限制，且 WASD 需 8 键），改为：
监听 window 的 `keydown/keyup`，把按下的方向键放入 `Set`；用
`requestAnimationFrame` 循环按帧位移，全部键松开后停止循环。

```ts
// src/components/panel/hooks/useCanvasKeyboardPan.ts（新文件）
const PAN_KEYS: Record<string, [number, number]> = {
  w: [0, 1], arrowup: [0, 1],
  a: [1, 0], arrowleft: [1, 0],
  s: [0, -1], arrowdown: [0, -1],
  d: [-1, 0], arrowright: [-1, 0],
}; // [dx, dy]，方向为"视野看向"的方向；viewport 平移量取反

const BASE_SPEED = 600;   // px/s，屏幕空间
const BOOST = 2;          // Shift 加速倍率

export function useCanvasKeyboardPan(
  instanceRef: React.MutableRefObject<any>,
  enabled: boolean,
) {
  const pressed = useRef(new Set<string>());
  const rafId = useRef(0);
  const lastTs = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement)?.isContentEditable;

    const tick = (ts: number) => {
      const inst = instanceRef.current;
      if (inst && pressed.current.size > 0) {
        let dx = 0, dy = 0;
        pressed.current.forEach((k) => {
          const [x, y] = PAN_KEYS[k] ?? [0, 0];
          dx += x; dy += y;
        });
        const len = Math.hypot(dx, dy) || 1;
        const speed = BASE_SPEED * (pressedShift() ? BOOST : 1);
        const dt = Math.min((ts - lastTs.current) / 1000, 0.1);
        const vp = inst.getViewport();
        inst.setViewport({
          x: vp.x + (dx / len) * speed * dt,
          y: vp.y + (dy / len) * speed * dt,
          zoom: vp.zoom,
        });
      }
      lastTs.current = ts;
      rafId.current = pressed.current.size > 0
        ? requestAnimationFrame(tick) : 0;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // 与 FlowPanel 既有键盘处理保持同一守卫（FlowPanel.tsx L1467-1472）
      if (isTyping(e)) return;
      // 组合键让位给全局快捷键（Ctrl+D、Alt+A、Shift+S 等）
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (PAN_KEYS[k] && !pressed.current.has(k)) {
        e.preventDefault();          // 阻止方向键滚动嵌套滚动容器
        pressed.current.add(k);
        lastTs.current = performance.now();
        if (!rafId.current) rafId.current = requestAnimationFrame(tick);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      pressed.current.delete(e.key.toLowerCase());
    };
    const onBlur = () => pressed.current.clear();  // 窗口失焦兜底

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [enabled, instanceRef]);
}
```

要点：

1. **方向语义**：`W/↑` = 视野向上看（内容下移），对应 `viewport.y` 增大；`D/→` = `viewport.x` 减小。与地图类应用直觉一致。
2. **对角线归一化**：`W+D` 时按 `√2/2` 归一，斜向速度不快于单键。
3. **屏幕空间等速**：位移直接加在 `viewport.x/y` 上，缩放比例不影响每秒位移像素数；如需"世界空间"手感，可改为 `speed / vp.zoom`，实现期二选一即可。
4. **dt 上限 0.1s**：切后台/卡顿回来时不跳变。
5. **blur 清空**：窗口失焦时keyup 可能丢失，必须清空集合，否则视野漂移不停。

### 3.2 接入点（FlowPanel.tsx）

- `FlowPanel.tsx` 组件内调用：
  `useCanvasKeyboardPan(reactFlowInstance, true)`（L548 的实例 ref 直接复用，L1569 赋值后生效）；
- `ReactFlow` 现有配置（L1551-1554）**不动**：`panOnDrag={[1]}`、`panActivationKeyCode="Space"` 与键盘平移互不干扰。

### 3.3 冲突排查（已核对，均无冲突）

| 按键 | 现有用途 | 是否冲突 |
|------|---------|---------|
| W/A/S/D 单键 | 无占用 | 否 |
| ↑/↓/←/→ 单键 | 无占用（CommandPalette/表达式补全的方向键在 input/textarea 焦点内，被 3.1 守卫挡住） | 否 |
| Shift+WASD | Shift 单独用于框选（`selectionKeyCode="Shift"`，L1555），按住 Shift+W 只加速平移，松开即恢复框选 | 否 |
| Ctrl/Alt/Shift + WASD | Ctrl+D(CSV对比)、Alt+A(AI面板)、Shift+S/H/C(设置/帮助/更新) 等 | 3.1 已用 `ctrlKey/metaKey/altKey` 让位；Shift 组合不 preventDefault 之外的冲突键 |
| Delete/Backspace/Ctrl+C/V | `FlowPanel.tsx` L1475-1484 独立监听 | 否 |

### 3.4 备选方案（不采用）

- **方案 B：`setCenter()` 每帧调用**——语义等价但每次要传 zoom，多一次换算，无收益；
- **方案 C：在 `useReactFlow()` 子组件内实现**——需要新增 ReactFlowProvider 内的子组件来持有 hook；项目现成持有 `reactFlowInstance` ref（L548），直接传 ref 更贴合现状；
- **方案 D：CSS transform 平移容器**——绕过 reactflow 视口模型，会导致 `screenToFlowPosition`（L592 等多处）坐标错位，禁用。

---

## 4. 改动清单

| 文件 | 改动 |
|------|------|
| `src/components/panel/hooks/useCanvasKeyboardPan.ts` | 新增：3.1 的平移 hook |
| `src/components/panel/FlowPanel.tsx` | 导入并调用 hook（一行 + import）；不改 ReactFlow 现有 props |
| `src/components/help/HelpContent.ts` / `HelpContentCn.ts` | 快捷键说明补一条"WASD/方向键平移画布，Shift 加速" |
| `src/__tests__/CanvasKeyboardPan.test.ts` | 新增：见 §5 |

不改后端、不改 i18n key 结构（帮助文案是 Markdown 字符串）。

---

## 5. 测试计划（vitest）

1. **方向映射**：模拟 keydown `w` → 帧循环后 `setViewport` 收到 `y` 增量；`a` → `x` 增量；
2. **组合归一化**：`w+d` 同时按下，位移向量 ≈ 单键的 `(1/√2, 1/√2)`；
3. **守卫**：`keydown` 目标为 input 时 `setViewport` 不被调用；Ctrl+D 按下不触发平移；
4. **停止**：keyup 全部松开后 rAF 取消（`cancelAnimationFrame` 被调用）；
5. **blur 清空**：dispatch window blur 后再 tick，无位移。

mock：`instanceRef.current = { getViewport: () => ({x:0,y:0,zoom:1}), setViewport: vi.fn() }`，
用 `vi.useFakeTimers()` + 手动 `performance.now()` 推进帧。

---

## 6. 验收标准

- [ ] 按住 W/A/S/D 或四个方向键，画布按对应方向连续平滑平移，松开即停；
- [ ] W+D 等斜向组合正常，速度不叠加超过单键；
- [ ] Shift 按住时约 2 倍速；
- [ ] 在命令对话框、表达式编辑器、命令面板等输入场景中按这些键不移动画布；
- [ ] Ctrl+D / Alt+A / Shift+S 等全局快捷键行为不变；
- [ ] 中键拖拽、Space+左键拖拽、Shift 框选、双击 fitView、切刀、右键连线均不受影响；
- [ ] `pnpm test` 全量通过。
