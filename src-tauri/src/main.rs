// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
  Manager, WindowEvent,
  menu::{Menu, MenuItem},
  tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
};

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(easy_csv::invoke_handler())
    .setup(|app| {
      let show_item = MenuItem::with_id(app, "show", "show", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "quit", true, None::<&str>)?;
      let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;
      let _tray = TrayIconBuilder::new()
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
        .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        let config = easy_csv::config::load_config().unwrap_or_default();
        let minimize_to_tray = config.minimize_to_tray.unwrap_or(true);
        if minimize_to_tray {
          api.prevent_close();
          window.hide().unwrap();
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
