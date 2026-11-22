# 无边框窗口（Windows）排错手册

> 适用：043 自绘标题栏 —— 窗口 `decorations: false` + `transparent: true` + 圆角由 CSS 画。
> 涉及文件：`src-tauri/tauri.conf.json`、`src-tauri/src/main.rs`、`src/index.css`、`src/lib/platform.ts`、`src/main.tsx`。
>
> 本文记录的是**实测结论**（Windows 10 Pro 19045 / 1920×1080 / 任务栏 40px），不是从文档抄来的行为描述。
> 凡是标了"实测"的数字，都可以按第 3 节的手法复现。

---

## 0. 这套窗口现在是怎么搭的

```jsonc
// tauri.conf.json → app.windows[0]
{
  "visible": false,      // 先隐藏，避免首帧露出原生边框
  "decorations": false,  // 创建时就没有 caption（不是 show 之后再摘）
  "transparent": true,   // 圆角靠透明露出桌面
  "shadow": false        // 不要 DWM 阴影，否则客户区会被内缩
                         // resizable 不写在这里：见下方 setup，Windows 单独关
}
```

```rust
// main.rs → setup()
let _ = window.set_shadow(false);
let _ = window.set_resizable(false);  // 仅 Windows：把外圈让给前端手柄
let _ = window.set_decorations(false);
let _ = window.show();
// 之后：hide_system_frame(hwnd) + clamp_maximized_to_work_area(hwnd)
// 再 150ms 由后台线程补一次，并挂到 Focused(true) | Resized(ev)
```

```css
/* index.css */
html[data-custom-chrome="true"],
html[data-custom-chrome="true"] body { background-color: transparent; }

.app-window {
  background-color: var(--background);
  transform: translateZ(0);   /* 必须：否则 fixed 弹层逃出圆角裁切 */
}

html[data-custom-chrome="true"][data-window-maximized="false"] .app-window {
  border-radius: 8px;
}
```

三条硬约束，改动前必须先看：

1. **窗口 style 里不能留任何 frame 位**（`WS_CAPTION` / `WS_THICKFRAME` / `WS_BORDER` / `WS_DLGFRAME`）。
   留了任意一个，DWM 就会画那 1px 边框。
2. **`shadow` 必须是 `false`**。tao 给 undecorated 窗口留的阴影会把客户区四边内缩。
3. **最大化必须自己收回工作区**。无边框窗口最大化后铺满整个显示器，任务栏会失去点击响应。
4. **Windows 上必须 `set_resizable(false)`**（运行时，不是配置项），缩放改由前端手柄驱动。
   留着 `RESIZABLE` 的话 tao 会把外圈 8px 判成非客户区，边缘事件进不了 webview，
   那块区域既不缩放也点不动。macOS/Linux 保留原生边框与原生缩放。

---

## 1. 症状速查

| 症状 | 根因 | 处理 |
|---|---|---|
| 四边一圈蓝线（`#0078D7`） | Win10 给带 frame 的窗口画强调色边框；`DWMWA_BORDER_COLOR` 是 Win11 才有 | 剥 frame 位，见 2.1 |
| 蓝线外面还多一圈白/透明带 | tao 的 undecorated 阴影把客户区四边内缩约 9px | `shadow: false`，见 2.2 |
| 启动瞬闪一条原生标题栏 | `set_decorations` 是异步投递，`show()` 先执行 | 配置里 `decorations: false`，见 2.3 |
| 最大化后任务栏看得见但点不动 | 窗口铺满显示器，Windows 判定为全屏应用 | 最大化钳制到 work area，见 2.4 |
| 四个角上有浅色 L 形线 | 保留 `WS_THICKFRAME` 时 DWM 仍画边框，直边被内容盖住、只有圆角处露出来 | 全剥 frame 位，见 2.5 |
| 四角有白色小弧，改背景色无效 | 见 2.6 —— 多半是 2.5 的误判 | 先按 2.5 处理 |
| 拖四边/四角改不了窗口大小 | tao 把外圈判成非客户区 + 无 `WS_THICKFRAME` 时系统不 resize | 前端手柄自己设几何,见 2.7 |
| 双击标题栏不最大化 | 只有品牌区是拖拽区;且第一次按下已被 `start_dragging` 吃掉 | 整条 header 标 `deep` + 时间戳双击,见 2.8 |
| 启动仍闪一条原生标题栏(做了 2.3 之后) | setup 里 `set_shadow`/`set_resizable` 是 flag 变更,tao 重算 style 时把 `WS_CAPTION` 加回来,而剥 frame 的 `hide_system_frame` 在 `show()` 之后才跑 | 顺序修正:flag 变更 → 剥 frame → `show()`,见 2.9 |
| 首帧/刷新后顶部一度不是圆角 | CSS 圆角只认 `[data-window-maximized="false"]`,而该属性由 `WindowControls` 异步 `isMaximized()` 写入,写入前整窗直角 | 渲染前同步写默认值 `"false"`,见 2.9 |
| 双击标题栏后窗口变成「全宽 × 残高」的怪形状(首运/上次最大化时必现) | 对最大化窗口 `SetWindowPos` 钳制工作区时,Windows 记住的**还原矩形**被改写;双击走的是「取消最大化」,落到畸形矩形 | 钳制时快照并回写 `WINDOWPLACEMENT`,见 2.10 |
| 首次打开,四角的圆角缺口里有**白色小块**(最大化→还原后才变圆) | WebView2 惰性合成:webview 层默认白底在首帧后被缓存,静态页面不重绘,`set_background_color` 事后才生效 | config 补 `backgroundColor` + 强制重合成(±1px 微调),见 2.11 |

---

## 2. 逐条说明

### 2.1 四边一圈蓝线

**现象**：窗口四边贴着内容有 1px 的 `#0078D7`。

**根因**：
- 系统「在标题栏和窗口边框上显示强调色」开着（`HKCU\SOFTWARE\Microsoft\Windows\DWM` → `ColorPrevalence = 1`），Windows 会给每个带 frame 的顶层窗口画一圈强调色边框。
- Windows 11（22000+）提供了 `DWMWA_BORDER_COLOR(34) = DWMWA_COLOR_NONE(0xFFFFFFFE)` 可以关掉它；**Windows 10 没有这个属性**，`DwmSetWindowAttribute` 直接返回 `0x80070057`（`E_INVALIDARG`）。

**关键事实**：tao 的 `set_decorations(false)` 并没有真的去掉 frame 位 —— 它只置 `MARKER_DECORATIONS`，靠 `WM_NCCALCSIZE` 返回 0 把非客户区并进客户区。style 实测仍是 `0x14CF0000`（`WS_CAPTION | WS_THICKFRAME | WS_BORDER | WS_DLGFRAME` 全在），所以 DWM 认为"这窗口有边框"，照画不误。

**处理**：`hide_system_frame()` 里在 DWM 调用失败（Win10）时回退到剥 style：

```rust
const FRAME_STYLES: u32 = 0x00C0_0000 | 0x0004_0000; // WS_CAPTION | WS_THICKFRAME
let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
if style & FRAME_STYLES != 0 {
    SetWindowLongW(hwnd, GWL_STYLE, (style & !FRAME_STYLES) as i32);
    SetWindowPos(hwnd, 0, 0, 0, 0, 0, SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
}
```

`WS_CAPTION` 本身就等于 `WS_BORDER | WS_DLGFRAME`，所以两个常量已经覆盖四个位。

**为什么要在三个时机都调**：tao 每次 `set_window_flags` 都会用 `to_window_styles()` 重算 style，而那个函数**无条件**加回 `WS_CAPTION`（只有 child 窗口会去掉）。所以必须在 `show` 之后调一次、并在 `Focused(true) | Resized` 时重放（另有一次 150ms 延迟补调，覆盖 tao 事件线程的滞后）。判断 `style & FRAME_STYLES != 0` 保证幂等，不重复 `SetWindowStyle`。

### 2.2 蓝线消失后，外面多出一圈

**现象**：蓝线没了，但窗口右侧/下方有一条约 9px 的带，浅色壁纸下像白边，深色下像一条透明缝。

**根因**：Tauri 的 `shadow` 默认 `true`，tao 据此保留 `MARKER_UNDECORATED_SHADOW`。`WM_NCCALCSIZE` 走 `calculate_window_insets()` 分支，把**客户区**内缩，给 DWM 的投影留位置。窗口外框尺寸不变、客户区缩了，而窗口是透明的 —— 缩掉的部分直接透出后面的窗口或桌面。实测内缩量：右侧 9px、下方 9px，左侧与顶部为 0。

**处理**：`"shadow": false` + `window.set_shadow(false)`（配置与运行时都钉住，防止 window-state 恢复把它带回来）。

**代价**：窗口没有系统投影了。想补阴影只能自绘，但自绘要求窗口比内容大，等于把这一圈再加回来，所以不做。

### 2.3 启动时闪一条原生标题栏

**现象**：每次启动，窗口顶部先出现一条系统标题栏（强调色底 + 应用图标 + "EasyCsv"），随后消失。

**根因**：tao 的 `set_decorations()` 是 `execute_in_thread` **投递到事件线程**执行的，而 `setup()` 里紧跟其后的 `show()` 是同步的 —— 窗口先以"带 caption"的样子显示至少一帧，之后 style 才被改掉。

**处理**：不要在 `show()` 之后补调，直接在配置里写 `"decorations": false`，创建时就没有 caption，不存在中间态。实测创建后 style 直接是 `0x140B0000`（无 caption）。

### 2.4 最大化后任务栏看得见但点不动

**现象**：点标题栏的最大化按钮后，任务栏还在屏幕上画着，但鼠标点上去没反应。

**根因**：Win10 最大化窗口的矩形是 `-7,-7 → 屏宽+7, 屏高+7`（thickframe 的 resize 边被推到屏幕外）。客户区虽然被 tao 的 `WM_NCCALCSIZE` 修正到了 work area，**但窗口矩形仍然铺满整个显示器**。Windows 把"横跨整个显示器的窗口"判定为全屏应用，于是停止把点击路由给任务栏。

**处理**：`clamp_maximized_to_work_area()` —— `IsZoomed` 为真且窗口矩形 ≠ `MONITORINFO.rcWork` 时，`SetWindowPos` 拉回工作区：

```rust
if IsZoomed(hwnd) == 0 { return; }
let work = monitor_info.rc_work;
if rect == work { return; }   // 必须有这行，否则 SetWindowPos → Resized 死循环
SetWindowPos(hwnd, 0, work.left, work.top, work.right - work.left,
             work.bottom - work.top, SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
```

**实测**：1920×1080 屏、任务栏 40px 时，修复前最大化 rect 是 `-7,-7 → 1927,1087`；修复后是 `0,0 → 1920,1040`，客户区 `1920×1040 @ (0,0)`，客户区底边正好压在任务栏上沿。

### 2.5 四个角上有浅色 L 形线

**现象**：只有四个角有 1px 的浅色线（深色主题下是 `#F9F9F9`），四条直边干干净净。浅色主题下几乎看不见，所以容易漏。

**根因**：为了让 resize / Snap 语义完整而保留 `WS_THICKFRAME` —— 但**只要 style 里还有一个 frame 位，DWM 就一直画那 1px 边框**。直边被 `.app-window` 的内容盖住，只有 CSS `border-radius` 切掉的四角会把它露出来，于是形成 L 形。

**处理**：全剥（回到 2.1 的 `FRAME_STYLES`）。

**剥掉 THICKFRAME 会不会丢 resize？不会。** tao 在 `WM_NCHITTEST` 里自己判断边缘，不依赖 style。实测向窗口发 `WM_NCHITTEST`：

| 位置 | 返回 |
|---|---|
| 左边缘 +1px | `HTLEFT` (10) |
| 右边缘 −2px | `HTRIGHT` (11) |
| 上边缘 +1px | `HTTOP` (12) |
| 下边缘 −2px | `HTBOTTOM` (15) |

最大化则由 2.4 的钳制接管。

### 2.6 误判记录：四角的白弧是不是 WebView2 背景？

排查 2.5 时走过两条弯路，都无效，记在这里免得重走：

- `window.set_background_color(Some(Color(0,0,0,0)))` —— 配置里的 `backgroundColor` 只作用于**窗口层**，想连 webview 层一起设要调这个 API。设置后四角没有变化，说明白弧不是 webview 底色。
- `SetClassLongPtrW(hwnd, GCLP_HBRBACKGROUND, 0)` —— 清掉窗口类自带的白色背景刷。同样没有变化。

两处改动留在代码里（无害，顶多防一手首帧未绘制时的闪白），但**它们不是这个 bug 的原因**。真正的答案就是 2.5：DWM 边框在圆角处露出来了。

顺带一个教训：这几轮里有几次"改了没效果"，是因为**采样的根本不是这个窗口**（它被浏览器盖住了），见 3.2。

### 2.7 窗口边缘拖不动（无法调整大小）

**现象**：按住四边或四角拖动，窗口毫无反应。窗口最外约 8px 的窄带点上去也没有任何响应，像一条死区。

**根因（三层，缺一不可）**：

1. tao 的 `WM_NCHITTEST` 把窗口外圈算成**非客户区**（宽度取 `SM_CXFRAME`，实测约 8px），命中就返回 `HTLEFT/HTRIGHT/HTTOP/HTBOTTOM`。鼠标落在这一圈时 Windows 按"边框"处理，事件根本不进 webview —— 前端就算写了边缘手柄也收不到按下。
2. 想改用 `startResizeDragging`（内部发 `WM_NCLBUTTONDOWN`）走系统缩放也不行：**没有 `WS_THICKFRAME` 时 Windows 不进入 sizing loop**，消息发出去尺寸不变（实测）。
3. 可 `WS_THICKFRAME` 又必须剥掉（见 2.5），否则四个圆角处会露出 DWM 的 1px 边框。

**处理**：把缩放整个交给前端。

- Windows 上运行时调 `window.set_resizable(false)`（配置项是跨平台的，不能写死）。tao 的 hit-test 分支要求 `RESIZABLE`，去掉后它走 `DefSubclassProc` 返回 `HTCLIENT`，边缘事件就能进 webview（实测：改前点 `left+2` 收不到 `mousedown`，改后能收到）。
- `WindowResizeHandles` 渲染 8 个手柄（四边 6px、四角 12px）。按下时记录窗口外框与指针起点，移动时用 `setSize` / `setPosition` 直接算几何。
- 移动靠 `requestAnimationFrame` 合并，且同一时刻只允许一个在途 IPC —— 否则快速拖动会堆积几十次往返，窗口明显追不上鼠标。
- 最小尺寸 640×420；最大化时整组手柄卸载，并在按下时再查一次 `isMaximized()` 兜底，防止刚最大化的那一帧还能拖。

**实测**：左/右/上/下各拖 60px、左上角拖 42px，几何变化都符合预期；往小拖到 640 停住；最大化状态下拖边缘尺寸不变；还原后回到原位置。

**试过但无效**：`DWMWA_NCRENDERING_POLICY = DWMNCRP_DISABLED`（想保留 `WS_THICKFRAME` 又不让 DWM 画边框）—— 四角白线照旧。

### 2.8 双击标题栏不最大化

**现象**：双击标题栏空白处没有任何反应（只有左上角品牌区那一小块能用）。

**根因（两层）**：

1. 只有 `TitleBarBrand` 上写了 `data-tauri-drag-region="deep"`，标题栏其余部分根本不是拖拽区，双击自然没人接。
2. 补上 `deep` 之后拖动正常了，双击**仍然**无效：Tauri 的双击判定看 `mousedown.detail === 2`，可第一次按下就已经触发 `start_dragging`（窗口进入系统拖动循环），第二次按下回来时 `detail` 还是 1 —— 永远等不到 2。

**处理**：

- 整条 `<header>` 加 `data-tauri-drag-region="deep"`。Tauri 的脚本从事件目标向上走，遇到 button / `role="menuitem"` 这类可交互元素且它没有显式标注就停下，所以菜单和窗口按钮不会被误当成拖拽区。
- 新增 `useTitleBarDoubleClick(headerRef)`：在 **capture 阶段**监听 `mousedown`，用时间戳（<450ms）判断是不是第二次按下；命中就 `stopPropagation()` 掐掉 Tauri 的 `start_dragging`，自己调 `toggleMaximize()`。跳过可交互元素，且只在 `usesCustomTitleBar`（Windows）生效。

**实测**：双击 → `(0,0)-(1920,1040)`；再双击 → 还原 1100×768。

**已知小瑕疵**：双击的第一次按下仍会进一次系统拖动循环，鼠标若有 1~2px 抖动窗口会轻微偏移。真实双击手是稳的，基本看不到。

### 2.9 两个「修好了还犯」的回潮：启动闪标题栏 / 首帧直角

**症状 A**：按 2.3 在配置里写了 `decorations: false`，启动仍闪一条原生标题栏。
**症状 B**：圆角规则按最大化属性挂了，但首帧（以及 webview 刷新后的头几帧）顶部是直角，过一会儿才圆。

**根因 A（调用顺序）**：2.3 的结论只对「创建那一刻」成立。`setup()` 里在 `show()` 之前还调了 `set_shadow(false)` 和 `set_resizable(false)` —— 这两个都是 tao 的 **flag 变更**，按 2.1 的实测，`set_window_flags` → `to_window_styles()` 会无条件把 `WS_CAPTION` 加回来。原顺序是：

```
set_shadow(false)      ← caption 加回
set_resizable(false)   ← caption 又加回
set_decorations(false) ← 异步投递到事件线程,可能还没执行
show()                 ← 窗口带着 caption 显示 ≥1 帧(闪标题栏)
hide_system_frame()    ← 这时才剥掉
```

更糟的是 `set_decorations(false)` 是异步投递：如果它在我们剥完 frame **之后**才执行，caption 又被加回来，要等下一次 `Focused/Resized` 重放才被剥掉——「有时候」三个字就是这两条竞态给的。

**处理**：

1. 顺序改为 **flag 变更 → `hide_system_frame()` → `show()`**（剥 frame 在窗口仍隐藏时同步完成，hwnd 在创建后即有效）；
2. **删掉 setup 里补调的 `set_decorations(false)`**——配置里已经 `false`，运行时再调一遍纯属多余，还引入上面的异步回潮；`show()` 之后保留一次幂等重放 + 150ms 补调兜底。

**根因 B（属性晚于首帧）**：`index.css` 的圆角规则是
`html[data-custom-chrome="true"][data-window-maximized="false"] .app-window { border-radius: 8px }`，
而 `data-window-maximized` 由 `WindowControls` 挂载后异步调 `isMaximized()` 才写进 `<html>`。**属性缺失时选择器不匹配 → 直角**；promise resolve 之后才变圆。启动慢、webview 刷新、最大化还原竞态都会让「窗口期」肉眼可见。

**处理**：`main.tsx` 在 **React 渲染之前**同步写默认值
`document.documentElement.dataset.windowMaximized = "false"`（与 `customChrome` 同一处的兜底）。默认圆角先行；若这次启动就是最大化（`tauri.conf.json` 的 `"maximized": true` / window-state 恢复），`WindowControls` 的首次 `isMaximized()` 会把它翻成 `"true"`，多圆几帧无害。

**实测要点**：启动连开三次，任何一帧都不应出现强调色标题栏；DevTools 里 `document.documentElement.dataset` 应在首帧前就有 `windowMaximized="false"`。

### 2.10 双击标题栏后窗口变成「全宽 × 残高」

**现象**：首次运行（或上次退出时是最大化），双击自定义标题栏想最大化——结果应用**取消**了最大化，落在一个奇怪的矩形：宽度铺满屏幕、高度只剩一块，客户区下面直接透出桌面（窗口透明，未绘制区 = 透）。

**根因（两步叠加）**：

1. `tauri.conf.json` 曾带 `"maximized": true` —— 首次运行窗口**创建即最大化**；`tauri-plugin-window-state` 恢复上次会话的最大化状态时同理。窗口一显示，`clamp_maximized_to_work_area()`（2.4）用 `SetWindowPos` 把这个**处于最大化状态的窗口**直接改尺寸到工作区。
2. **对 zoomed 窗口 `SetWindowPos` 会改写 Windows 内部保存的还原矩形**。正常还原矩形是创建尺寸 1200×800，被改写后变成「钳制矩形的某个碎片」（实测呈现为全宽 × ~700px）。用户双击标题栏 → `toggleMaximize()` → `isMaximized() == true` → 走**取消最大化** → 窗口"还原"到这个畸形矩形。截图证据：标题栏在 (0,0)、窗口按钮在屏幕右上角（宽 = 1920），内容在 ~700px 处截断。

**处理**：

1. `tauri.conf.json` 去掉 `"maximized": true` —— 首运以 1200×800 常规窗口启动（顺带解决了「启动即最大化所以没圆角」）；用户的偏好由 window-state 插件跨会话记住。
2. `clamp_maximized_to_work_area()` 在 `SetWindowPos` **之前**快照 `WINDOWPLACEMENT`（此时 `show_cmd` 仍是 `SW_SHOWMAXIMIZED`、`rc_normal_position` 还是原值），钳制后用 `SetWindowPlacement`（带 `WPF_ASYNCWINDOWPLACEMENT`）回写快照——窗口保持最大化、还原矩形回到原值。这条同时救了 window-state 恢复最大化的场景。

**实测要点**：把窗口最大化 → `GetWindowPlacement` 记下 `rc_normal_position` → 触发一次钳制（比如切全屏显示器）→ 双击标题栏取消最大化 → 窗口应精确回到记录的矩形，而不是任何「全宽 × 残高」。

### 2.11 首次打开四角有白色小块，最大化→还原才变圆

**现象**：首次打开应用，顶部左上/右上（以及底部两角）的圆角缺口里有白色背景小块；最大化再还原之后缺口才透出桌面、圆角正常。

**根因（惰性合成）**：缺口处看到的是 **WebView2 控制器的默认背景**——tauri 从 config 创建窗口时，`WebviewBuilder::from_config` 并不把 `backgroundColor` 传进 webview 属性（tauri 2.12.6 源码确认），所以 webview 层从创建起就是 WebView2 默认的白。运行时 `set_background_color(透明)` 走事件循环消息，**首帧合成之后**才被处理；WebView2 按需合成，静态页面不再重绘 → 缓存的白底一直挂在四角，直到下一次真正的 resize（最大化→还原）触发重合成。

**处理（三层）**：

1. `tauri.conf.json` 窗口补 `"backgroundColor": "#00000000"` —— config 的这个字段只到**窗口层**（2.6 的结论依然成立），先把窗口层钉住；
2. `setup()` 与 150ms 补调里 `set_background_color(透明)` 保留（webview 层，事后生效）；
3. **新增 `force_webview_recomposition()`**：每次设置背景色后，`SetWindowPos` 把窗口高度 +1px 再复原——两个真实的 `WM_SIZE` 迫使 wry 重新下发 webview bounds 并重合成。setup 里的那次发生在窗口仍隐藏时，零闪烁。

**实测要点**：冷启动，四角立即透出桌面（放大 10 倍看缺口，无白色实心块）；不需要任何最大化/还原操作。

---

## 3. 排查手法

1px 级别的差异不要靠眼睛判断，靠像素。

### 3.1 探针能回答什么

用 python + `ctypes` 直接问系统（本机没有 Pillow / tkinter，不要指望截图库）：

| 想知道 | 怎么问 |
|---|---|
| 窗口 style 还有没有 frame 位 | `GetWindowLongW(hwnd, -16)`，看 `0x00C00000` / `0x00040000` |
| DWM 支持不支持边框属性 | `DwmGetWindowAttribute(hwnd, 34, ...)` 的 HRESULT，`0x80070057` = 不支持 |
| 最大化是否压住任务栏 | `GetWindowRect` vs `SystemParametersInfo(SPI_GETWORKAREA)` |
| 边缘还能不能拖 | `SendMessageW(hwnd, WM_NCHITTEST, 0, MAKELPARAM(x, y))` |
| 四角到底什么颜色 | `GetPixel(GetDC(0), x, y)`，或 `BitBlt` 抓一片自己编码 PNG |

### 3.2 采样前必须确认窗口在最前

`GetPixel` 取的是**屏幕**像素。窗口被遮挡时，读到的是遮挡者的内容 —— 颜色看起来"完全没变"，会让人误以为是代码没生效。

```python
pt = wintypes.POINT(rect.left + 200, rect.top + 200)
root = user32.GetAncestor(user32.WindowFromPoint(pt), 2)  # GA_ROOT
print("ours on top:", root == hwnd)   # 必须为 True 才继续
```

置前用 `SetForegroundWindow` + `AttachThreadInput`（否则前台锁会让它静默失败）。另外 `GetWindowRect` 要在抓屏**之前**读，置前之后窗口位置可能变。

### 3.3 看细节就放大

1px 的弧在原始截图里就是几个像素，肉眼分不清是边框还是抗锯齿。把角落裁 40×40、最近邻放大 10~12 倍再看，一眼能分辨"直线 / 弧线 / 实心块"。

---

## 4. 常量表

| 名字 | 值 | 用途 |
|---|---|---|
| `WS_CAPTION` | `0x00C00000` | 等于 `WS_BORDER(0x00800000) \| WS_DLGFRAME(0x00400000)` |
| `WS_THICKFRAME` | `0x00040000` | resize 边框；留着 DWM 就继续画边框 |
| `GWL_STYLE` | `-16` | `GetWindowLongW` / `SetWindowLongW` 的 index |
| `SWP_FRAMECHANGED` | `0x0020` | 改 style 后必须带，否则非客户区不重算 |
| `DWMWA_BORDER_COLOR` | `34` | Win11 only |
| `DWMWA_VISIBLE_FRAME_BORDER_THICKNESS` | `37` | Win11 only |
| `DWMWA_COLOR_NONE` | `0xFFFFFFFE` | 让 DWM 不画边框 |
| `GCLP_HBRBACKGROUND` | `-10` | 窗口类背景刷 |

---

## 5. 已知取舍

| 取舍 | 原因 | 如果以后要改 |
|---|---|---|
| 没有系统投影 | `shadow: false`，否则客户区被内缩出一圈 | 自绘阴影需要窗口比内容大，会把"多一圈"带回来，不建议 |
| Win10 只能靠剥 style | 没有 `DWMWA_BORDER_COLOR` | 不要指望 DWM 属性，Win10 上必失败 |
| frame 位全剥 | 留任意一个 DWM 都画边框 | 别再为了"保留 resize 语义"留 `WS_THICKFRAME`，tao 自己会处理 |
| 最大化由钳制纠正 | 系统按显示器矩形最大化 | 想更优雅可拦 `WM_GETMINMAXINFO`，但要和 tao 的子类化抢消息，风险更高 |

---

## 6. 改动清单

| 文件 | 做了什么 |
|---|---|
| `src-tauri/tauri.conf.json` | `decorations: false`、`transparent: true`、`shadow: false`、`visible: false` |
| `src-tauri/src/main.rs` | `hide_system_frame()`（DWM 尝试 + 剥 frame 位）、`clamp_maximized_to_work_area()`、setup 时序(**flag 变更 → 剥 frame → show**,不再补调 `set_decorations`)、150ms 补调 |
| `src/main.tsx` / `src/lib/platform.ts` | Windows 上给 `<html>` 打 `data-custom-chrome="true"`;**渲染前同步写 `data-window-maximized="false"`** 保证首帧圆角 |
| `src/components/titlebar/WindowResizeHandles.tsx` | 8 个缩放手柄，自己算 `setSize`/`setPosition`；最大化时卸载 |
| `src-tauri/capabilities/default.json` | `set-size` / `set-position` / `outer-position` / `outer-size` / `scale-factor` |
| `src/index.css` | `html[data-custom-chrome]` 透明、`.app-window` 背景与圆角、最大化时去圆角、最大化时隐藏手柄 |

## 7. 验证清单（改完照这个跑一遍）

1. 启动：不应看到任何原生标题栏，哪怕一帧。
2. 四边：逐边取 0~3px，不应出现 `#0078D7` 或任何与内容不同的 1px 线。
3. 四角：放大 10 倍看，应直接透出桌面/壁纸，没有浅色弧线或 L 形线。
4. 边缘内侧 0px 到窗口矩形应完全重合（客户区 = 窗口矩形），没有透明带。
5. 最大化：`GetWindowRect` = 工作区，客户区底边 = 任务栏上沿；任务栏可点击。
6. 最大化/还原往返一次，位置与尺寸回到原样。
7. 拖四条边与四个角，几何都跟着走；往小拖到 640×420 停住。
8. 最大化状态下拖边缘不应改变尺寸；还原后回到原位置。
9. 双击标题栏空白处能最大化、再双击能还原；双击菜单/窗口按钮不触发。
10. 深色与浅色主题各看一遍 —— 浅色下 1px 浅色线最容易漏。
