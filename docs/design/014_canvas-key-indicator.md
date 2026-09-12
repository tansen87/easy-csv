# 画布按键与鼠标指示器（WASD/方向键 + 鼠标键 HUD）

> 基于 `src/components/panel/hooks/useCanvasKeyboardPan.ts`（013 文档落地实现：按键集合存于
> `useRef`，不触发重渲染）、`src/components/panel/FlowPanel.tsx` L1723-1753（Canvas status
> indicator，`absolute bottom-2 left-3 z-50`，`pointer-events-none`）、L1529-1536（外层容器
> 已挂 `onMouseDown/onMouseMove/onMouseUp/onMouseLeave`，鼠标按键处理有现成锚点）确认的现状。
> 与既有文档分工：013 覆盖键盘平移本身；本文覆盖 **平移按键与鼠标按键的可视化指示**。

---

## 1. 现状证据（实测）

| 层 | 现状 | 证据 |
|----|------|------|
| 按键状态 | hook 内 `pressed`（Set<string>）与 `shiftDown` 均为 `useRef`，按键增删**不触发 React 重渲染** | `useCanvasKeyboardPan.ts` L21-22, L68-80 |
| 展示位置锚点 | 左下角状态条：步骤数/保存状态/相对时间，`absolute bottom-2 left-3 z-50`，同级还有一个 `z-20` 的多选浮动条（L1699） | `FlowPanel.tsx` L1723-1725 |
| 鼠标事件锚点 | 外层容器 div 已挂 `onMouseDown={handleCutStart}`、`onMouseUp={handleCutEnd}`、`onMouseLeave`（切刀用），事件能收到 `e.button` | `FlowPanel.tsx` L1529-1536 |
| 鼠标按键语义 | `e.button`: 0=左键（空白处拖拽=框选；Space 按住时=平移）、1=中键（平移）、2=右键（右键菜单/连线）；`e.buttons` 位掩码可在 move 中读取 | `FlowPanel.tsx` L873, L1555 |
| 样式基调 | 状态条用 `text-[11px] text-muted-foreground/60`、`bg-border/40` 分隔线，弱化、不可交互 | `FlowPanel.tsx` L1725, L1732 |
| 文案通道 | FlowPanel 已持有 `t`（i18n 翻译对象），HUD 若需要文字可走既有翻译 | `FlowPanel.tsx` L1736/1741 |

**关键结论**：键盘按键集合目前是"不可观察"的 ref，需要 hook 向外暴露按键变化；鼠标按键
没有集中状态，需要在容器层新增轻量追踪。展示层是一个纯展示的绝对定位小组件，不改
ReactFlow、不改切刀/连线/平移逻辑。

---

## 2. 目标

- 按下 `W/A/S/D`、方向键（或其组合）时，画布左下角、Canvas status indicator **上方**实时显示当前按下的按键；
- `Shift` 按住时显示加速标识；
- **按下鼠标按键（左/中/右）在画布区域内操作时同样显示**（如中键平移、Space+左键平移、左键框选）；按住 `Space` 时也显示 `Space` 键帽，使"Space+左键平移"完整可见；
- 全部松开后隐藏（带淡出，避免闪烁）；
- 不遮挡、不拦截画布交互（与状态条同为 `pointer-events-none`）；
- 平移逻辑本身（013）与切刀/连线/框选行为零变化。

---

## 3. 方案设计

### 3.1 状态暴露：hook 增加 `onChangeKeys` 回调（ref 转发，不重订阅）

在 `useCanvasKeyboardPan` 增加第三参 `onChangeKeys?: (keys: string[], shift: boolean) => void`，
存入 ref（回调身份变化不触发 effect 重订阅），在按键集合发生变化的三个位置调用：

| 位置 | 时机 | `useCanvasKeyboardPan.ts` 行号 |
|------|------|------|
| `onKeyDown` | 新键加入 `pressed` 后 | L70 之后 |
| `onKeyUp` | 键从 `pressed` 移除后 | L80 之后 |
| `onBlur` | `clear()` 与 `shiftDown=false` 后 | L84 之后 |

`Shift` 的按下/松开也通过该回调通知（`shift` 参数），不进 `pressed` 集合。

变更只在 keydown/keyup/blur 时发生（不是每帧），所以 React state 更新频率与按键节奏一致，无性能问题。

### 3.2 FlowPanel 接入

```tsx
// FlowPanel.tsx 内
const [panKeys, setPanKeys] = useState<string[]>([]);
const [panShift, setPanShift] = useState(false);
const handlePanKeysChange = useCallback((keys: string[], shift: boolean) => {
  setPanKeys(keys);
  setPanShift(shift);
}, []);

useCanvasKeyboardPan(reactFlowInstance, true, handlePanKeysChange);
```

### 3.3 展示组件：`panel/overlays/KeyIndicatorOverlay.tsx`（新文件）

定位在状态条正上方，弱化风格对齐状态条：

```tsx
{visible && (
  <div
    className="absolute bottom-8 left-3 z-50 flex items-center gap-1 select-none pointer-events-none transition-opacity duration-150"
    aria-hidden="true"
  >
    {orderedKeys.map((k) => (
      <kbd key={k} className="min-w-[22px] h-[22px] px-1 flex items-center justify-center
        rounded border border-border/60 bg-card/80 text-[11px] text-muted-foreground
        font-medium shadow-sm">{DISPLAY[k] ?? k.toUpperCase()}</kbd>
    ))}
    {panShift && (
      <kbd className="h-[22px] px-1.5 flex items-center rounded bg-primary/10 text-[10px]
        text-primary font-medium border border-primary/20">×2</kbd>
    )}
  </div>
)}
```

要点：

1. **定位**：`bottom-8`（状态条 `bottom-2` + 单行高度约 22px，留 8px 间距，实测不重叠即可，必要时微调为 `bottom-9`）；`left-3` 与状态条对齐；`z-50` 同级。
2. **顺序稳定**：显示顺序按固定优先级 `W/A/S/D → ↑/←/↓/→` 排列（`PAN_KEYS` 的键序），组合时 `W` 永远在 `D` 前面，不随按下顺序抖动。
3. **显示映射**：`w→W`、`arrowup→↑`、`arrowleft→←` 等（`DISPLAY` 表），其余键原样大写。
4. **淡入淡出**：按键集合非空即 `visible`；用 CSS `transition-opacity` 做 150ms 过渡，卸载延迟由组件内部用 `useEffect` + timeout 处理（集合清空后 150ms 再移除 DOM，或保留 opacity-0 常驻节点，二选一，实现期取更简单者）。
5. **去重显示**：`W` 与 `↑` 同方向但属不同按键，按"实际按下的键"显示，不做方向归并——HUD 的职责是回显按键，不是回显方向。
6. **无障碍**：纯装饰，`aria-hidden="true"`，`pointer-events-none`，不进 tab 序。

### 3.4 鼠标按键追踪：新增 `hooks/useCanvasPointerHud.ts`

鼠标没有集中状态，新建一个轻量 hook 挂在容器层，**不动切刀/连线/ReactFlow 的既有处理**：

```ts
// src/components/panel/hooks/useCanvasPointerHud.ts（新文件）
export function useCanvasPointerHud(
  containerRef: React.RefObject<HTMLElement>,   // FlowPanel 的 reactFlowWrapper
  onChange: (buttons: number[], space: boolean) => void,
) {
  // 内部 useRef 维护 Set<number>（e.button: 0/1/2）与 spaceDown
  // 仅在变化点调用 onChange：mousedown / mouseup / mouseleave / blur / Space keydown+keyup
  // 排序固定为 [左键, 中键, 右键]（0→1→2），与按下顺序无关
}
```

要点：

1. **监听目标**：`containerRef.current` 上注册 `mousedown/mouseup/mouseleave`（普通冒泡阶段，
   不用 capture、不 `preventDefault`/`stopPropagation`，切刀 `handleCutStart`（L1529）与
   右键菜单（L873）不受影响）。`window` 级 `blur` 兜底清空（鼠标在容器外弹起时收不到 mouseup）。
   `mouseleave` 时若仍有按住的键，不清空（ReactFlow 拖拽会 setPointerCapture，帧内移出属正常），
   仅在 `e.buttons === 0` 时同步为空。
2. **Space 键**：同一 hook 里用 window `keydown/keyup` 追踪 `Space`（仅记录布尔，不 preventDefault、
   不干扰 `panActivationKeyCode`）。输入框守卫复用 013 的 `isTyping` 判定。
3. **回调频率**：只在 mousedown/mouseup/blur/Space 变化点触发，与 3.1 的键盘回调同量级，无每帧渲染。
4. **显示映射**：`0→左键`、`1→中键`、`2→右键`（走 i18n，见 3.5）。
5. **与键盘 HUD 合流**：两个回调都写入 FlowPanel 的 state，`KeyIndicatorOverlay` 同时接收
   键盘与鼠标数据，任一非空即显示。

### 3.5 展示组件细节补充（鼠标键帽）

- 鼠标键帽排在键盘键帽之后、`×2` 徽标之前，用 `w-px h-3 bg-border/40` 细分隔线隔开两组；
- Space+左键平移时显示 `左键 · Space`（`Space` 用键帽样式、鼠标用文字胶囊样式，视觉区分输入设备）；
- 右键按下即显示（右键菜单/连线期间 HUD 可见，帮助新手理解当前按键语义）；若实测觉得右键菜单场景过噪，可在实现期改为"仅 0/1 按钮 + Space"，属一行过滤条件，不影响整体结构。

### 3.6 i18n / 文案

- 鼠标键帽需要文字：`i18n/translations.ts` 新增 `mouseLeft`/`mouseMiddle`/`mouseRight`（中：左键/中键/右键；英：LMB/MMB/RMB）；
- 其余无文字（键帽与 `×2` 徽标），无需新增翻译 key；
- 如后续要加"平移中"标签，走 `t` 补 `panIndicatorActive` 中英文两项。

### 3.7 备选方案（不采用）

- **方案 B：hook 内部维护 state 并渲染**——hook 返回 JSX 违背 hooks 职责，且渲染位置被锁死；
- **方案 C：每帧同步 state**——`tick()` 里 setState 60 次/秒，纯粹为了显示而重渲染整个 FlowPanel，禁用；
- **方案 D：订阅全局事件总线**——当前只有一个消费方，回调 ref 足够，总线属过度设计。

---

## 4. 改动清单

| 文件 | 改动 |
|------|------|
| `src/components/panel/hooks/useCanvasKeyboardPan.ts` | 增加 `onChangeKeys` 参数（ref 转发），在 keydown/keyup/blur 变更点回调 |
| `src/components/panel/hooks/useCanvasPointerHud.ts` | 新增：鼠标按键 + Space 轻量追踪（§3.4） |
| `src/components/panel/overlays/KeyIndicatorOverlay.tsx` | 新增：按键 + 鼠标 HUD 纯展示组件（键盘键帽 + 鼠标胶囊 + `×2`） |
| `src/components/panel/FlowPanel.tsx` | 接线：state + hook 第三参 + `useCanvasPointerHud(reactFlowWrapper, ...)` + 渲染 `<KeyIndicatorOverlay>`（放在 Canvas status indicator 之前，L1723 上方） |
| `src/i18n/translations.ts` | 新增 `mouseLeft`/`mouseMiddle`/`mouseRight` 三个 key（中英文） |
| `src/__tests__/CanvasKeyboardPan.test.tsx` | 补用例：按键变化触发回调（含 Shift 与 blur 清空）；新增鼠标 HUD 用例 |
| `docs/design/013_canvas-keyboard-pan.md` | §4 改动清单补一行 hook 签名变更（本次文档不覆盖 013 正文） |

不改后端、不改 Canvas status indicator 本身、不改切刀/连线/框选/平移行为。

---

## 5. 测试计划（vitest）

1. **回调触发**：keydown `w` → 回调收到 `["w"], false`；追加 keydown `d` → `["w","d"], false`；
2. **Shift**：keydown `Shift` → 回调 `shift=true`；keyup 后 `false`；
3. **blur 清空**：keydown 后 dispatch window `blur` → 回调收到 `[], false`；
4. **不重复触发**：重复 keydown 已按住的键（系统重复触发）不重复回调（`!pressed.has(k)` 守卫已有）；
5. **渲染顺序**（KeyIndicatorOverlay）：`["d","w"]` 输入按 `W`、`D` 顺序渲染键帽；`arrowup` 渲染 `↑`；
6. **鼠标追踪**（useCanvasPointerHud）：容器 mousedown `button=1` → 回调 `[1]`；追加 `button=0` → `[0,1]`（顺序固定，不随按下顺序）；mouseup 逐个移除；`window.blur` 清空；
7. **Space 追踪**：keydown/keyup `Space` → 回调 `space` 布尔翻转；输入框内按 Space 不触发（isTyping 守卫）；
8. **组合显示**：Space+左键按下时 Overlay 同时渲染 `Space` 键帽与 `左键` 胶囊；仅中键时渲染 `中键`；
9. **隐藏**：keys 与 buttons 均为空且 space=false 时不渲染键帽（或 opacity-0）；
10. **不干扰**：mousedown/mouseup 监听不调用 `preventDefault/stopPropagation`，右键 `e.button=2` 场景（L873 菜单）与切刀事件照常到达。

mock 方式复用 013 测试的 instanceRef + fake timers 模式；鼠标用 `fireEvent.mouseDown(container, {button: 1})`。

---

## 6. 验收标准

- [x] 按住 W/A/S/D 或方向键，左下角状态条上方出现对应键帽，顺序稳定不抖动；
- [x] 组合键（如 W+D）同时显示两个键帽；
- [x] Shift 按住时显示 `×2` 加速徽标，松开即消失；
- [x] Space+左键平移时显示 `左键` 与 `Space`；左键框选、右键菜单期间对应鼠标键帽可见；
- [x] 鼠标在容器外弹起、窗口失焦后 HUD 正确清空，无残留、无闪烁；
- [x] 全部松开后 HUD 平滑隐藏；
- [x] HUD 不拦截鼠标事件，不影响中键拖拽、框选、切刀、右键连线；切刀与右键菜单行为不变；
- [x] Canvas status indicator（步骤数/保存状态/时间）显示与位置不变；
- [x] 输入框内打字不触发 HUD；Ctrl/Alt 组合键不触发键盘部分；
- [x] `pnpm test` 全量通过。
