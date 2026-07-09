pub mod config;
pub mod csv;
pub mod pipeline;
pub mod storage;
pub mod xan;

pub fn invoke_handler() -> Box<dyn Fn(tauri::ipc::Invoke) -> bool + Send + Sync> {
  Box::new(tauri::generate_handler![
    config::get_default_delimiter,
    config::set_default_delimiter,
    config::get_no_headers,
    config::set_no_headers,
    config::get_show_execution_notification,
    config::set_show_execution_notification,
    csv::read_csv_file,
    csv::profile_csv,
    pipeline::execute_xan_pipeline,
    xan::check_xan_installed,
    storage::save_history,
    storage::load_history,
    storage::save_recent_files,
    storage::load_recent_files,
    storage::load_profile_cache,
    storage::save_profile_cache,
    storage::set_window_title,
    storage::toggle_devtools
  ])
}
