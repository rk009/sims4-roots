#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::Manager;
use tauri_plugin_fs::FsExt;

struct WorkspaceRoot(std::path::PathBuf);

fn config_dir(root: &WorkspaceRoot) -> std::path::PathBuf {
    if cfg!(debug_assertions) { root.0.join("release/conf") } else { root.0.join("conf") }
}

#[tauri::command]
fn startup_json(app: tauri::AppHandle, root: tauri::State<'_, WorkspaceRoot>) -> Result<Option<(String, String, String)>, String> {
    let path = config_dir(&root).join("families.json");
    let characters_path = path.with_file_name("characters.json");
    if !path.exists() || !characters_path.exists() { return Ok(None); }
    let characters = std::fs::read_to_string(&characters_path).map_err(|e| format!("{}: {}", characters_path.display(), e))?;
    app.fs_scope().allow_file(&characters_path).map_err(|e| e.to_string())?;
    let text = std::fs::read_to_string(&path).map_err(|e| format!("{}: {}", path.display(), e))?;
    app.fs_scope().allow_file(&path).map_err(|e| e.to_string())?;
    Ok(Some((path.to_string_lossy().into_owned(), characters, text)))
}

#[tauri::command]
fn startup_worlds(root: tauri::State<'_, WorkspaceRoot>) -> Result<Option<String>, String> {
    let path = config_dir(&root).join("worlds.json");
    if !path.exists() { return Ok(None); }
    std::fs::read_to_string(&path).map(Some).map_err(|e| format!("{}: {}", path.display(), e))
}

#[tauri::command]
fn save_worlds(root: tauri::State<'_, WorkspaceRoot>, text: String) -> Result<(), String> {
    let directory = config_dir(&root);
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    std::fs::write(directory.join("worlds.json"), text).map_err(|e| e.to_string())
}

#[tauri::command]
fn default_json_path(root: tauri::State<'_, WorkspaceRoot>) -> Result<String, String> {
    let directory = config_dir(&root);
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    Ok(directory.join("families.json").to_string_lossy().into_owned())
}

#[tauri::command]
fn authorize_json_pair(app: tauri::AppHandle, path: String) -> Result<(), String> {
    if !app.fs_scope().is_allowed(&path) { return Err("このファイルはまだ選択されていません。".into()); }
    let path = std::path::PathBuf::from(path);
    for name in ["characters.json", "families.json"] {
        app.fs_scope().allow_file(path.with_file_name(name)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn remember_json_path(app: tauri::AppHandle, root: tauri::State<'_, WorkspaceRoot>, path: String) -> Result<(), String> {
    if !app.fs_scope().is_allowed(&path) { return Err("このファイルはまだ選択されていません。".into()); }
    std::fs::write(root.0.join(".app-data/source-path.txt"), path).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![startup_json, startup_worlds, save_worlds, default_json_path, authorize_json_pair, remember_json_path])
        .setup(|app| {
            let root = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()
            } else {
                std::env::current_exe()?.parent().unwrap().to_path_buf()
            };
            let data = root.join(".app-data").join("webview");
            std::fs::create_dir_all(&data)?;
            app.manage(WorkspaceRoot(root));
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                .title("Sims4 Roots")
                .inner_size(1440.0, 960.0)
                .min_inner_size(960.0, 640.0)
                .data_directory(data)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Sims4 Roots could not start");
}
