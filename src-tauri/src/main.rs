// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
  Manager, WindowEvent,
  menu::{Menu, MenuItem},
  tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
};
#[cfg(target_os = "windows")]
use tauri_plugin_prevent_default::PlatformOptions;
use tauri_plugin_prevent_default::{Builder as PreventDefaultBuilder, Flags};

/// Runtime tray availability. On Linux the tray depends on libappindicator /
/// GTK; if it is unavailable the app keeps running without a tray and
/// `minimize_to_tray` is ignored.
#[derive(Default)]
struct AppState {
  tray_available: AtomicBool,
}

/// Build the system tray. Returns a `Result` so setup can degrade gracefully:
/// if the tray fails to initialize (e.g. Linux without libappindicator), we log
/// the reason and continue without it.
fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<tauri::tray::TrayIcon> {
  let show_item = MenuItem::with_id(app, "show", "show", true, None::<&str>)?;
  let quit_item = MenuItem::with_id(app, "quit", "quit", true, None::<&str>)?;
  let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;
  TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&tray_menu)
    .show_menu_on_left_click(false)
    .tooltip("Easy Csv")
    .on_tray_icon_event(|tray, event| match event {
      TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: tauri::tray::MouseButtonState::Up,
        ..
      } => {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          window.show().unwrap();
          window.set_focus().unwrap();
          window.set_always_on_top(true).unwrap();
          window.set_always_on_top(false).unwrap();
        }
      }
      TrayIconEvent::Click {
        button: MouseButton::Right,
        ..
      } => {}
      _ => {}
    })
    .on_menu_event(|app, event| match event.id.as_ref() {
      "show" => {
        if let Some(window) = app.get_webview_window("main") {
          window.show().unwrap();
          window.set_focus().unwrap();
          window.set_always_on_top(true).unwrap();
          window.set_always_on_top(false).unwrap();
        }
      }
      "quit" => {
        app.exit(0);
      }
      _ => {}
    })
    .build(app)
}

/// Remove the 1px frame the desktop paints around every framed top-level
/// window. Windows 11 draws it in the system accent colour and exposes
/// `DWMWA_BORDER_COLOR` to switch it off; Windows 10 has no such attribute,
/// so the frame bits have to go from the window style instead — tao keeps
/// `WS_CAPTION` / `WS_THICKFRAME` on undecorated windows and only hides the
/// non-client area in `WM_NCCALCSIZE`, which leaves DWM a border to colour.
/// Resizing, snapping and maximise/restore keep working because tao handles
/// `WM_NCHITTEST` and the maximise geometry itself.
#[cfg(target_os = "windows")]
fn hide_system_frame(hwnd: isize) {
  use std::ffi::c_void;

  #[link(name = "dwmapi")]
  unsafe extern "system" {
    fn DwmSetWindowAttribute(
      hwnd: isize,
      attribute: u32,
      value: *const c_void,
      size: u32,
    ) -> i32;
  }

  #[link(name = "user32")]
  unsafe extern "system" {
    fn SetClassLongPtrW(hwnd: isize, index: i32, value: isize) -> isize;
    fn GetWindowLongW(hwnd: isize, index: i32) -> i32;
    fn SetWindowLongW(hwnd: isize, index: i32, value: i32) -> i32;
    fn SetWindowPos(
      hwnd: isize,
      insert_after: isize,
      x: i32,
      y: i32,
      cx: i32,
      cy: i32,
      flags: u32,
    ) -> i32;
  }

  const DWMWA_BORDER_COLOR: u32 = 34;
  const DWMWA_VISIBLE_FRAME_BORDER_THICKNESS: u32 = 37;
  const DWMWA_COLOR_NONE: u32 = 0xFFFF_FFFE;

  const GWL_STYLE: i32 = -16;
  // The window class ships a white background brush. Nothing erases a
  // transparent window, so clear it to keep bare corners from flashing
  // white before the webview paints.
  const GCLP_HBRBACKGROUND: i32 = -10;
  // `WS_CAPTION` is `WS_BORDER | WS_DLGFRAME`. `WS_THICKFRAME` has to go
  // too: as long as the window carries any frame bit, DWM keeps painting
  // its 1px border, and the only place the CSS border-radius does not
  // cover it is the four corners - which is exactly where it showed up as
  // a light arc. Maximise geometry is handled by
  // `clamp_maximized_to_work_area`, resize by tao's own hit-testing.
  const FRAME_STYLES: u32 = 0x00C0_0000 | 0x0004_0000;
  // SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED
  const SWP_KEEP_GEOMETRY: u32 = 0x0001 | 0x0002 | 0x0004 | 0x0010 | 0x0020;

  // Idempotent: once the slot is empty this returns 0 and changes nothing.
  let _ = unsafe { SetClassLongPtrW(hwnd, GCLP_HBRBACKGROUND, 0) };

  let color: u32 = DWMWA_COLOR_NONE;
  let thickness: u32 = 0;
  // SAFETY: `hwnd` is a live window handle and DWM only reads `size` bytes
  // from each pointer; both locals outlive the calls.
  let border = unsafe {
    DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, &color as *const u32 as *const c_void, 4)
  };
  let _ = unsafe {
    DwmSetWindowAttribute(
      hwnd,
      DWMWA_VISIBLE_FRAME_BORDER_THICKNESS,
      &thickness as *const u32 as *const c_void,
      4,
    )
  };

  // Windows 10 (or any DWM that refused the attribute): the border is painted
  // because the window still carries frame styles, so drop them. tao
  // re-applies its own style whenever window flags change, which is why this
  // runs from every window event; the equality check keeps it a no-op once
  // the bits are gone.
  if border != 0 {
    // SAFETY: same live handle. The style swap is followed by
    // `SWP_FRAMECHANGED` so the non-client area is recalculated at once.
    let style = unsafe { GetWindowLongW(hwnd, GWL_STYLE) } as u32;
    let stripped = style & !FRAME_STYLES;
    if stripped != style {
      unsafe {
        SetWindowLongW(hwnd, GWL_STYLE, stripped as i32);
        SetWindowPos(hwnd, 0, 0, 0, 0, 0, SWP_KEEP_GEOMETRY);
      }
    }
  }
}

/// Windows maximises a window to the monitor rectangle, not to its work
/// area, so a borderless window ends up covering the taskbar. Windows also
/// treats any window spanning the whole monitor as a fullscreen app and stops
/// routing clicks to the taskbar, which is what makes it dead under a
/// maximised EasyCsv. Pull the maximised window back onto the work area.
///
/// The pull-back must preserve the *restore rectangle*: `SetWindowPos` on a
/// zoomed window silently rewrites the rect Windows will un-maximise to, so a
/// double-click on the title bar would land the window on a mangled geometry
/// (full width × a fragment of the height — first observed with a
/// created-maximized first run, `tauri.conf.json` `"maximized": true`). Read
/// `WINDOWPLACEMENT` before the resize and re-assert it afterwards.
#[cfg(target_os = "windows")]
fn clamp_maximized_to_work_area(hwnd: isize) {
  #[repr(C)]
  #[derive(Default, Clone, Copy)]
  struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
  }

  #[repr(C)]
  #[derive(Default, Clone, Copy)]
  struct Point {
    x: i32,
    y: i32,
  }

  #[repr(C)]
  struct WindowPlacement {
    length: u32,
    flags: u32,
    show_cmd: u32,
    pt_min_position: Point,
    pt_max_position: Point,
    rc_normal_position: Rect,
  }

  #[repr(C)]
  struct MonitorInfo {
    cb_size: u32,
    rc_monitor: Rect,
    rc_work: Rect,
    flags: u32,
  }

  #[link(name = "user32")]
  unsafe extern "system" {
    fn GetWindowRect(hwnd: isize, rect: *mut Rect) -> i32;
    fn IsZoomed(hwnd: isize) -> i32;
    fn MonitorFromWindow(hwnd: isize, flags: u32) -> isize;
    fn GetMonitorInfoW(monitor: isize, info: *mut MonitorInfo) -> i32;
    fn SetWindowPos(
      hwnd: isize,
      insert_after: isize,
      x: i32,
      y: i32,
      cx: i32,
      cy: i32,
      flags: u32,
    ) -> i32;
    fn GetWindowPlacement(hwnd: isize, placement: *mut WindowPlacement) -> i32;
    fn SetWindowPlacement(hwnd: isize, placement: *const WindowPlacement) -> i32;
  }

  const MONITOR_DEFAULTTONEAREST: u32 = 2;
  // SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED
  const SWP_FLAGS: u32 = 0x0004 | 0x0010 | 0x0020;
  // Asynchronous placement so `SetWindowPlacement` cannot deadlock against
  // our own caller if the event thread is busy.
  const WPF_ASYNCWINDOWPLACEMENT: u32 = 0x0004;

  // SAFETY: `hwnd` is a live window handle; `Rect`/`MonitorInfo` are plain
  // structs and both are fully initialised before the calls touch them.
  if unsafe { IsZoomed(hwnd) } == 0 {
    return;
  }
  // Snapshot the placement BEFORE touching geometry: `rc_normal_position` is
  // the rect the next un-maximise will land on, and `show_cmd` is still
  // SW_SHOWMAXIMIZED here, so re-asserting the snapshot keeps the window
  // maximised with its original restore rect.
  let mut placement = WindowPlacement {
    length: std::mem::size_of::<WindowPlacement>() as u32,
    flags: 0,
    show_cmd: 0,
    pt_min_position: Point::default(),
    pt_max_position: Point::default(),
    rc_normal_position: Rect::default(),
  };
  if unsafe { GetWindowPlacement(hwnd, &mut placement) } == 0 {
    return;
  }
  let mut info = MonitorInfo {
    cb_size: std::mem::size_of::<MonitorInfo>() as u32,
    rc_monitor: Rect::default(),
    rc_work: Rect::default(),
    flags: 0,
  };
  let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
  if unsafe { GetMonitorInfoW(monitor, &mut info) } == 0 {
    return;
  }
  let work = info.rc_work;
  let mut rect = Rect::default();
  if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
    return;
  }
  // Already clamped (or the taskbar moved): nothing to do. Without this the
  // `SetWindowPos` below would re-enter through `Resized` forever.
  if rect.left == work.left
    && rect.top == work.top
    && rect.right == work.right
    && rect.bottom == work.bottom
  {
    return;
  }
  unsafe {
    SetWindowPos(
      hwnd,
      0,
      work.left,
      work.top,
      work.right - work.left,
      work.bottom - work.top,
      SWP_FLAGS,
    );
    // Undo the restore-rect rewrite the `SetWindowPos` above just caused.
    // `show_cmd` is unchanged, so the window stays maximised.
    placement.flags |= WPF_ASYNCWINDOWPLACEMENT;
    let _ = SetWindowPlacement(hwnd, &placement);
  }
}

/// WebView2 composites lazily: a static page does not redraw, so a background
/// colour applied *after* the first composition stays cached until something
/// forces a repaint — which used to be the user's next maximize/restore, and
/// read as "white squares in the rounded corners on first launch" (the white
/// was the controller's default background showing through the CSS radius
/// cut-outs). Nudging the window by 1px and back sends two real `WM_SIZE`s,
/// which make wry re-send the webview bounds and recomposite with the (now
/// transparent) default background.
#[cfg(target_os = "windows")]
fn force_webview_recomposition(hwnd: isize) {
  #[repr(C)]
  #[derive(Default, Clone, Copy)]
  struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
  }

  #[link(name = "user32")]
  unsafe extern "system" {
    fn GetWindowRect(hwnd: isize, rect: *mut Rect) -> i32;
    fn SetWindowPos(
      hwnd: isize,
      insert_after: isize,
      x: i32,
      y: i32,
      cx: i32,
      cy: i32,
      flags: u32,
    ) -> i32;
  }

  // SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE
  const SWP_MOVE_FLAGS: u32 = 0x0002 | 0x0004 | 0x0010;

  // SAFETY: `hwnd` is a live window handle; `Rect` is fully initialised.
  let mut rect = Rect::default();
  if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
    return;
  }
  let width = rect.right - rect.left;
  let height = rect.bottom - rect.top;
  unsafe {
    SetWindowPos(hwnd, 0, rect.left, rect.top, width, height + 1, SWP_MOVE_FLAGS);
    SetWindowPos(hwnd, 0, rect.left, rect.top, width, height, SWP_MOVE_FLAGS);
  }
}

fn main() {
  tauri::Builder::default()
    .manage(AppState::default())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin({
      let builder = PreventDefaultBuilder::new().with_flags(Flags::empty());
      // PlatformOptions (browser accelerator key handling) is Windows-only in
      // tauri-plugin-prevent-default v5; other platforms just use empty flags.
      #[cfg(target_os = "windows")]
      let builder = builder.platform(PlatformOptions::new().browser_accelerator_keys(false));
      builder.build()
    })
    .invoke_handler(easy_csv::invoke_handler())
    .setup(|app| {
      // Ensure the (user-provided) plugin drop-in directory exists so the
      // resolution errors are easy to understand.
      easy_csv::plugins::ensure_plugin_dir_exists();

      // Tray is optional: degrade gracefully (no tray) if it fails to build.
      let tray_available = setup_tray(app.handle()).is_ok();
      let state = app.state::<AppState>();
      state
        .tray_available
        .store(tray_available, Ordering::Relaxed);
      if !tray_available {
        eprintln!("[EasyCsv] system tray unavailable; running without minimize-to-tray");
      }

      // Windows draws its own title bar (design 043), so the native frame has
      // to go before the window is revealed. The window starts hidden
      // (`visible: false`) to avoid a flash of the native frame at startup.
      match app.get_webview_window("main") {
        Some(window) => {
          // Windows draws its own title bar (design 043): drop the native
          // frame while the window is still hidden, then reveal it.
          // No DWM shadow either: tao would inset the client area to make
          // room for it, leaving a transparent band along the right and
          // bottom edges that reads as an extra ring around the window.
          //
          // ORDER MATTERS (QA §2.9): `set_shadow` / `set_resizable` are tao
          // flag changes, and every flag change recomputes the window style
          // with `WS_CAPTION` back on. Stripping the frame must therefore
          // happen *after* those calls and *before* `show()` — otherwise the
          // window is revealed for a frame or two wearing the caption it was
          // just given, which is the "native title bar at startup" flash.
          // `set_decorations(false)` is deliberately NOT called again: the
          // config already created the window without decorations, and the
          // call is posted to tao's event thread — it can execute after the
          // strip below and re-add the caption until the next replay.
          #[cfg(target_os = "windows")]
          let _ = window.set_shadow(false);
          // Windows-only: while `RESIZABLE` is set, tao's hit-test claims the
          // outer 8px as non-client area, so the edge resize grips never see
          // a pointer. The grips drive the geometry themselves instead.
          // macOS/Linux keep the native frame and native resizing.
          #[cfg(target_os = "windows")]
          let _ = window.set_resizable(false);

          // Applied while still hidden (and again after `show`, since Windows
          // repaints the frame on first show; tao also applies styles from its
          // event thread). One delayed retry runs on a plain thread where a
          // few hundred milliseconds of drift do not matter.
          #[cfg(target_os = "windows")]
          if let Ok(hwnd) = window.hwnd() {
            let raw = hwnd.0 as isize;
            hide_system_frame(raw);
            clamp_maximized_to_work_area(raw);
            // Belt and braces, not the fix for the corner arcs: the config's
            // `backgroundColor` only reaches the window layer, so the webview
            // layer gets a transparent colour here. It stops a white frame
            // from flashing before the first paint.
            let _ = window.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
            // The colour lands via an event-loop message that is processed
            // after the first composition; without this nudge the cached
            // white background survives until the next real resize (QA §2.11).
            force_webview_recomposition(raw);
            let window_for_retry = window.clone();
            std::thread::spawn(move || {
              std::thread::sleep(std::time::Duration::from_millis(150));
              hide_system_frame(raw);
              let _ = window_for_retry.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
              force_webview_recomposition(raw);
            });
          }

          let _ = window.show();

          // Frame replay after the reveal: first-show repaints and tao's
          // async style application can bring the caption back for a frame;
          // the strip is idempotent so this only costs one syscall.
          #[cfg(target_os = "windows")]
          if let Ok(hwnd) = window.hwnd() {
            hide_system_frame(hwnd.0 as isize);
          }
        }
        None => eprintln!("[EasyCsv] main window not found; nothing to reveal"),
      }

      Ok(())
    })
    .on_window_event(|window, event| {
      // Restoring or re-focusing can make Windows paint the frame again.
      #[cfg(target_os = "windows")]
      if matches!(event, WindowEvent::Focused(true) | WindowEvent::Resized(_)) {
        if let Ok(hwnd) = window.hwnd() {
          hide_system_frame(hwnd.0 as isize);
          clamp_maximized_to_work_area(hwnd.0 as isize);
        }
      }
      if let WindowEvent::CloseRequested { api, .. } = event {
        let app = window.app_handle();
        let tray_available = app
          .try_state::<AppState>()
          .map(|s| s.tray_available.load(Ordering::Relaxed))
          .unwrap_or(false);
        let config = easy_csv::config::load_config().unwrap_or_default();
        let minimize_to_tray = config.minimize_to_tray.unwrap_or(true);
        if minimize_to_tray && tray_available {
          api.prevent_close();
          window.hide().unwrap();
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
