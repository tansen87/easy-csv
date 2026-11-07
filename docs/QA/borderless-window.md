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
}
```

```rust
// main.rs → setup()
let _ = window.set_shadow(false);
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
| `src-tauri/src/main.rs` | `hide_system_frame()`（DWM 尝试 + 剥 frame 位）、`clamp_maximized_to_work_area()`、`setup()` 里的调用时序与 150ms 补调 |
| `src/index.css` | `html[data-custom-chrome]` 透明、`.app-window` 背景与圆角、最大化时去圆角 |
| `src/main.tsx` / `src/lib/platform.ts` | Windows 上给 `<html>` 打 `data-custom-chrome="true"` |

## 7. 验证清单（改完照这个跑一遍）

1. 启动：不应看到任何原生标题栏，哪怕一帧。
2. 四边：逐边取 0~3px，不应出现 `#0078D7` 或任何与内容不同的 1px 线。
3. 四角：放大 10 倍看，应直接透出桌面/壁纸，没有浅色弧线或 L 形线。
4. 边缘内侧 0px 到窗口矩形应完全重合（客户区 = 窗口矩形），没有透明带。
5. 最大化：`GetWindowRect` = 工作区，客户区底边 = 任务栏上沿；任务栏可点击。
6. 最大化/还原往返一次，位置与尺寸回到原样。
7. `WM_NCHITTEST` 四条边分别返回 `HTLEFT/HTRIGHT/HTTOP/HTBOTTOM`。
8. 深色与浅色主题各看一遍 —— 浅色下 1px 浅色线最容易漏。
