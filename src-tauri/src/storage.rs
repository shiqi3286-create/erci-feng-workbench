use serde_json::Value;
use std::{fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};

fn data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("data");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn safe_id(id: &str) -> Result<&str, String> {
    if id.is_empty() || id.chars().any(|c| matches!(c, '/' | '\\' | ':')) || id == "." || id == ".." {
        return Err("非法项目 ID".into());
    }
    Ok(id)
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

/* ---------- 全量存档（localStorage 的磁盘镜像） ---------- */

#[tauri::command]
pub fn save_store(app: AppHandle, data: String) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("store.json");
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_store(app: AppHandle) -> Result<String, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("store.json");
    if !path.exists() { return Ok(String::new()); }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, String> { Ok(data_root(&app)?.to_string_lossy().to_string()) }

#[tauri::command]
pub fn list_projects(app: AppHandle) -> Result<Vec<Value>, String> {
    let root = data_root(&app)?;
    let mut result = Vec::new();
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map_err(|e| e.to_string())?.is_dir() { continue; }
        let file = entry.path().join("project.json");
        if file.exists() {
            if let Ok(text) = fs::read_to_string(file) { if let Ok(value) = serde_json::from_str::<Value>(&text) { result.push(value); } }
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn load_project(app: AppHandle, project_id: String) -> Result<Value, String> {
    let id = safe_id(&project_id)?;
    let path = data_root(&app)?.join(id).join("project.json");
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_project(app: AppHandle, project_id: String, project: Value) -> Result<(), String> {
    let id = safe_id(&project_id)?;
    write_json(&data_root(&app)?.join(id).join("project.json"), &project)
}

#[tauri::command]
pub fn delete_project(app: AppHandle, project_id: String) -> Result<(), String> {
    let id = safe_id(&project_id)?;
    let path = data_root(&app)?.join(id);
    if path.exists() { fs::remove_dir_all(path).map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
pub fn load_chapter(app: AppHandle, project_id: String, volume: String, chapter: String) -> Result<String, String> {
    let id = safe_id(&project_id)?; let vol = safe_id(&volume)?; let ch = safe_id(&chapter)?;
    fs::read_to_string(data_root(&app)?.join(id).join("chapters").join(vol).join(format!("{ch}.md"))).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_chapter(app: AppHandle, project_id: String, volume: String, chapter: String, content: String) -> Result<(), String> {
    let id = safe_id(&project_id)?; let vol = safe_id(&volume)?; let ch = safe_id(&chapter)?;
    let path = data_root(&app)?.join(id).join("chapters").join(vol).join(format!("{ch}.md"));
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_snapshot(app: AppHandle, project_id: String, volume: String, chapter: String, content: String, snapshot_id: String) -> Result<String, String> {
    let id = safe_id(&project_id)?; let vol = safe_id(&volume)?; let ch = safe_id(&chapter)?; let snap = safe_id(&snapshot_id)?;
    let path = data_root(&app)?.join(id).join("chapters").join(vol).join(format!("{ch}.snap")).join(format!("{snap}.md"));
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_snapshot(app: AppHandle, project_id: String, volume: String, chapter: String, snapshot_id: String) -> Result<String, String> {
    let id = safe_id(&project_id)?; let vol = safe_id(&volume)?; let ch = safe_id(&chapter)?; let snap = safe_id(&snapshot_id)?;
    fs::read_to_string(data_root(&app)?.join(id).join("chapters").join(vol).join(format!("{ch}.snap")).join(format!("{snap}.md"))).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_project(app: AppHandle, project_id: String, query: String) -> Result<Vec<Value>, String> {
    let id = safe_id(&project_id)?; let root = data_root(&app)?.join(id).join("chapters");
    let mut hits = Vec::new();
    if !root.exists() { return Ok(hits); }
    fn walk(dir: &Path, query: &str, hits: &mut Vec<Value>) -> Result<(), String> {
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?; let p = entry.path();
            if p.is_dir() { walk(&p, query, hits)?; }
            else if p.extension().and_then(|x| x.to_str()) == Some("md") {
                let text = fs::read_to_string(&p).unwrap_or_default();
                if text.to_lowercase().contains(&query.to_lowercase()) { hits.push(serde_json::json!({"path": p.to_string_lossy().to_string(), "preview": text.chars().take(180).collect::<String>()})); }
            }
        }
        Ok(())
    }
    walk(&root, &query, &mut hits)?; Ok(hits)
}

#[tauri::command]
pub fn export_project(app: AppHandle, project_id: String, destination: String) -> Result<String, String> {
    let id = safe_id(&project_id)?; let from = data_root(&app)?.join(id);
    let dest = PathBuf::from(destination); fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    fn copy_dir(from: &Path, to: &Path) -> Result<(), String> {
        fs::create_dir_all(to).map_err(|e| e.to_string())?;
        for e in fs::read_dir(from).map_err(|e| e.to_string())? { let e=e.map_err(|e|e.to_string())?; let p=e.path(); let d=to.join(e.file_name()); if p.is_dir(){copy_dir(&p,&d)?}else{fs::copy(&p,&d).map_err(|e|e.to_string())?;} }
        Ok(())
    }
    copy_dir(&from, &dest.join(id))?; Ok(dest.to_string_lossy().to_string())
}
