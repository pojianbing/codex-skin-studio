mod cdp;
mod engine;
mod error;
mod models;
mod platform;
mod storage;
mod themes;

use engine::AppRuntime;
use models::{ArtConfig, Dashboard, ThemeRecord};

#[tauri::command]
async fn get_dashboard() -> std::result::Result<Dashboard, String> {
    tauri::async_runtime::spawn_blocking(|| {
        themes::ensure_library().map_err(|error| error.to_string())?;
        let themes = themes::list_themes().map_err(|error| error.to_string())?;
        let state = engine::read_state();
        let install = platform::find_codex().map_err(|error| error.to_string())?;
        Ok(Dashboard {
            platform: platform::platform_label(),
            codex_found: install.is_some(),
            codex_version: install.and_then(|value| value.version),
            mode: state.mode,
            active_theme_id: state.active_theme_id,
            port: state.port,
            message: state.message,
            themes,
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn import_wallpaper(path: String) -> std::result::Result<ThemeRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        themes::import_wallpaper(&path).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn update_theme(
    theme_id: String,
    appearance: String,
    art: ArtConfig,
) -> std::result::Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        themes::update_theme(&theme_id, &appearance, art).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn delete_theme(theme_id: String) -> std::result::Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        themes::delete_theme(&theme_id).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn apply_theme(
    runtime: tauri::State<'_, AppRuntime>,
    theme_id: String,
    restart_existing: bool,
) -> std::result::Result<(), String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        engine::apply(&runtime, &theme_id, restart_existing).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn pause_skin(runtime: tauri::State<'_, AppRuntime>) -> std::result::Result<(), String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        engine::pause(&runtime).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn restore_official(
    runtime: tauri::State<'_, AppRuntime>,
    restart_codex: bool,
) -> std::result::Result<(), String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        engine::restore_official(&runtime, restart_codex).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppRuntime::new())
        .setup(|_| {
            themes::ensure_library()
                .map_err(|error| Box::<dyn std::error::Error>::from(error.to_string()))?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard,
            import_wallpaper,
            update_theme,
            delete_theme,
            apply_theme,
            pause_skin,
            restore_official,
        ])
        .run(tauri::generate_context!())
        .expect("Codex Skin Studio failed to start");
}
