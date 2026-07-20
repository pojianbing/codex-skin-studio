mod cdp;
mod engine;
mod error;
mod models;
mod platform;
mod storage;
mod store;
mod themes;

use engine::AppRuntime;
use models::{
    ApplyPlan, ArtConfig, ChangeSummaryConfig, ComposerConfig, Dashboard, EnvironmentConfig,
    LevelSliderConfig, SemanticTokens, ThemeRecord, UiConfig,
};
use tauri::Manager;

#[cfg(any(target_os = "windows", target_os = "macos"))]
use tauri_plugin_autostart::ManagerExt;

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn autostart_enabled(app: &tauri::AppHandle) -> std::result::Result<bool, String> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        app.autolaunch()
            .is_enabled()
            .map_err(|error| error.to_string())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = app;
        Ok(false)
    }
}

#[tauri::command]
async fn get_dashboard(app: tauri::AppHandle) -> std::result::Result<Dashboard, String> {
    let autostart_enabled = autostart_enabled(&app)?;
    let launch_codex_on_open = storage::read_settings().launch_codex_on_open;
    tauri::async_runtime::spawn_blocking(move || {
        themes::ensure_library().map_err(|error| error.to_string())?;
        let themes = themes::list_themes().map_err(|error| error.to_string())?;
        let state = engine::read_state();
        let install = platform::find_codex().map_err(|error| error.to_string())?;
        let message = if state.mode == "active"
            && install
                .as_ref()
                .map(|install| platform::main_pids(install).map(|pids| pids.is_empty()))
                .transpose()
                .map_err(|error| error.to_string())?
                .unwrap_or(true)
        {
            "后台守护已就绪，等待 Codex 启动".into()
        } else {
            state.message
        };
        Ok(Dashboard {
            platform: platform::platform_label(),
            codex_found: install.is_some(),
            codex_version: install.and_then(|value| value.version),
            mode: state.mode,
            active_theme_id: state.active_theme_id,
            port: state.port,
            message,
            autostart_enabled,
            launch_codex_on_open,
            themes,
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn get_apply_plan(theme_id: String) -> std::result::Result<ApplyPlan, String> {
    tauri::async_runtime::spawn_blocking(move || {
        engine::apply_plan(&theme_id).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> std::result::Result<bool, String> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        let manager = app.autolaunch();
        if enabled {
            manager.enable().map_err(|error| error.to_string())?;
        } else {
            manager.disable().map_err(|error| error.to_string())?;
        }
        manager.is_enabled().map_err(|error| error.to_string())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (app, enabled);
        Err("当前平台不支持开机启动".into())
    }
}

#[tauri::command]
fn set_launch_codex_on_open(enabled: bool) -> std::result::Result<bool, String> {
    let mut settings = storage::read_settings();
    settings.launch_codex_on_open = enabled;
    storage::write_settings(&settings).map_err(|error| error.to_string())?;
    Ok(settings.launch_codex_on_open)
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
async fn import_theme_bundle(path: String) -> std::result::Result<ThemeRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        themes::import_theme_bundle(&path).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn get_store_catalog(refresh: bool) -> std::result::Result<store::StoreCatalog, String> {
    tauri::async_runtime::spawn_blocking(move || {
        store::catalog(refresh).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn install_store_theme(
    runtime: tauri::State<'_, AppRuntime>,
    store_id: String,
) -> std::result::Result<ThemeRecord, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let theme = store::install_theme(&store_id).map_err(|error| error.to_string())?;
        let state = engine::read_state();
        if state.mode == "active" && state.active_theme_id.as_deref() == Some(&theme.id) {
            engine::apply(&runtime, &theme.id, false).map_err(|error| error.to_string())?;
        }
        Ok(theme)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn export_theme(theme_id: String, path: String) -> std::result::Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        themes::export_theme(&theme_id, &path).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn update_theme(
    theme_id: String,
    appearance: String,
    art: ArtConfig,
    level_slider: LevelSliderConfig,
    composer: ComposerConfig,
    environment: EnvironmentConfig,
    change_summary: ChangeSummaryConfig,
    tokens: SemanticTokens,
    ui: UiConfig,
) -> std::result::Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        themes::update_theme(
            &theme_id,
            &appearance,
            art,
            level_slider,
            composer,
            environment,
            change_summary,
            tokens,
            ui,
        )
        .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn delete_theme(theme_id: String) -> std::result::Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        themes::delete_theme(&theme_id).map_err(|error| error.to_string())?;
        store::forget_local_theme(&theme_id).map_err(|error| error.to_string())
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
async fn activate_codex() -> std::result::Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let install = platform::find_codex()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "未找到 Codex Desktop".to_string())?;
        platform::activate_codex(&install).map_err(|error| error.to_string())
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

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    };

    let open = MenuItem::with_id(app, "open", "打开 Skin Studio", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "暂停/恢复主题", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出后台", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &toggle, &quit])?;
    let mut tray = TrayIconBuilder::with_id("skin-studio")
        .tooltip("Codex Skin Studio")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main_window(app),
            "toggle" => {
                let runtime = app.state::<AppRuntime>().inner().clone();
                std::thread::spawn(move || {
                    let state = engine::read_state();
                    let result = if state.mode == "active" {
                        engine::pause(&runtime)
                    } else if state.mode == "paused" {
                        state
                            .active_theme_id
                            .ok_or_else(|| "没有可恢复的主题".into())
                            .and_then(|theme_id| engine::apply(&runtime, &theme_id, false))
                    } else {
                        Ok(())
                    };
                    if let Err(error) = result {
                        eprintln!("[skin-studio] 托盘主题操作失败：{error}");
                    }
                });
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    let has_updater_config = context
        .config()
        .plugins
        .0
        .get("updater")
        .is_some_and(serde_json::Value::is_object);

    let builder = tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init());
    let builder = if has_updater_config {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    } else {
        builder
    };
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
        if !args.iter().any(|argument| argument == "--background") {
            show_main_window(app);
        }
    }));
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    let builder = builder.plugin(tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        Some(vec!["--background"]),
    ));

    builder
        .plugin(tauri_plugin_dialog::init())
        .manage(AppRuntime::new())
        .setup(|app| {
            themes::ensure_library()
                .map_err(|error| Box::<dyn std::error::Error>::from(error.to_string()))?;
            let runtime = app.state::<AppRuntime>().inner().clone();
            runtime.start_supervisor();
            if storage::read_settings().launch_codex_on_open {
                let runtime = runtime.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    if let Err(error) = engine::launch_codex_on_open(&runtime) {
                        eprintln!("[skin-studio] 启动 Codex 失败：{error}");
                    }
                });
            }
            #[cfg(any(target_os = "windows", target_os = "macos"))]
            setup_tray(app)?;
            let background = std::env::args_os().any(|argument| argument == "--background");
            if !background {
                show_main_window(app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main"
                && let tauri::WindowEvent::CloseRequested { api, .. } = event
            {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard,
            get_apply_plan,
            set_autostart,
            set_launch_codex_on_open,
            import_wallpaper,
            import_theme_bundle,
            get_store_catalog,
            install_store_theme,
            export_theme,
            update_theme,
            delete_theme,
            apply_theme,
            activate_codex,
            pause_skin,
            restore_official,
        ])
        .run(context)
        .expect("Codex Skin Studio failed to start");
}
