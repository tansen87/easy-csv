pub mod ai;
pub mod ai_memory;
pub mod config;
pub mod csv;
pub mod pipeline;
pub mod session;
pub mod storage;
pub mod xan;

pub fn invoke_handler() -> Box<dyn Fn(tauri::ipc::Invoke) -> bool + Send + Sync> {
  Box::new(tauri::generate_handler![
    ai::call_ai,
    ai_memory::save_conversation,
    ai_memory::load_conversation_history,
    ai_memory::save_feedback,
    ai_memory::load_feedback_rules,
    ai_memory::save_correction,
    ai_memory::clear_conversations,
    ai_memory::clear_feedback,
    ai_memory::clear_corrections,
    config::get_default_delimiter,
    config::set_default_delimiter,
    config::get_no_headers,
    config::set_no_headers,
    config::get_system_notification,
    config::set_system_notification,
    config::get_minimize_to_tray,
    config::set_minimize_to_tray,
    config::get_ai_config,
    config::set_ai_config,
    config::save_api_key,
    config::load_api_key,
    config::delete_api_key,
    config::has_api_key,
    csv::read_csv_file,
    csv::profile_csv,
    pipeline::execute_xan_pipeline,
    pipeline::set_pipeline_cancelled,
    xan::check_xan_installed,
    session::save_session,
    session::load_session,
    storage::save_recent_files,
    storage::load_recent_files,
    storage::load_profile_cache,
    storage::save_profile_cache,
    storage::set_window_title,
    storage::toggle_devtools,
    storage::file_exists,
    storage::save_pipeline_versions,
    storage::load_pipeline_versions,
    storage::save_lineage_data,
    storage::load_lineage_data
  ])
}
