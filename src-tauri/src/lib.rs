mod storage;

use tauri::generate_handler;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(generate_handler![
            storage::get_app_data_dir,
            storage::save_store,
            storage::load_store,
            storage::list_projects,
            storage::load_project,
            storage::save_project,
            storage::delete_project,
            storage::load_chapter,
            storage::save_chapter,
            storage::create_snapshot,
            storage::restore_snapshot,
            storage::search_project,
            storage::export_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running 二次风工作台");
}
