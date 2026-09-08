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

      Ok(())
    })
    .on_window_event(|window, event| {
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
