mod storage;

use tauri::{
    generate_handler,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

const RELEASE_URL: &str = "https://github.com/shiqi3286-create/erci-feng-workbench/releases/latest";

#[tauri::command]
fn app_version() -> String { env!("CARGO_PKG_VERSION").to_string() }

/* 用系统默认浏览器打开发布页（手动更新：检查到新版后跳转下载） */
#[cfg(target_os = "windows")]
#[tauri::command]
fn open_release_page() -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("cmd")
        .args(["/c", "start", "", RELEASE_URL])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW，避免闪黑框
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn open_release_page() -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(RELEASE_URL)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(generate_handler![
            storage::get_app_data_dir,
            storage::save_store,
            storage::load_store,
            storage::save_snapshot,
            storage::load_snapshot,
            storage::list_projects,
            storage::load_project,
            storage::save_project,
            storage::delete_project,
            storage::load_chapter,
            storage::save_chapter,
            storage::load_chapter_bundle,
            storage::save_chapter_bundle,
            storage::create_snapshot,
            storage::restore_snapshot,
            open_release_page
        ])
        .setup(|app| {
            /* ---------- 系统托盘 ---------- */
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let update = MenuItem::with_id(app, "check_update", "检查更新", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &update, &quit])?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().expect("缺少应用图标").clone())
                .tooltip("二次风工作台 · AI 小说创作台")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_main(app),
                    "check_update" => {
                        show_main(app);
                        let _ = app.emit("check-update", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // 左键单击：切换主窗口显隐；右键出菜单（show_menu_on_left_click(false)）
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) { let _ = w.hide(); } else { show_main(app); }
                        }
                    }
                })
                .build(app)?;

            /* ---------- 关闭主窗口 → 最小化到托盘（退出走托盘菜单） ---------- */
            let main = app.get_webview_window("main").expect("缺少主窗口");
            let win = main.clone();
            main.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win.hide();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running 二次风工作台");
}
