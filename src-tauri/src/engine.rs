use crate::{
    cdp,
    error::{Result, StudioError},
    models::{ApplyPlan, CodexInstall, EngineState, ThemeManifest},
    platform,
    storage::{atomic_write, state_path},
    themes,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread::{self, JoinHandle},
    time::Duration,
};

const RENDERER: &str = include_str!("../assets/renderer-inject.js");
const CSS: &str = include_str!("../assets/renderer.css");

pub struct WatcherHandle {
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl WatcherHandle {
    fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

#[derive(Clone)]
pub struct AppRuntime {
    watcher: Arc<Mutex<Option<WatcherHandle>>>,
    operation: Arc<Mutex<()>>,
    supervisor_started: Arc<AtomicBool>,
}

impl AppRuntime {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
            operation: Arc::new(Mutex::new(())),
            supervisor_started: Arc::new(AtomicBool::new(false)),
        }
    }

    fn stop_watcher(&self) {
        let handle = self.watcher.lock().ok().and_then(|mut guard| guard.take());
        if let Some(handle) = handle {
            handle.stop();
        }
    }

    fn start_watcher(
        &self,
        port: u16,
        browser_id: String,
        payload: String,
        revision: String,
        media: cdp::MediaPayload,
    ) {
        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = stop.clone();
        let thread = thread::spawn(move || {
            let mut consecutive_failures = 0;
            while !thread_stop.load(Ordering::SeqCst) {
                match cdp::inject(port, &browser_id, &payload, &revision, &media) {
                    Ok(_) => consecutive_failures = 0,
                    Err(error) => {
                        consecutive_failures += 1;
                        eprintln!("[skin-studio] {error}");
                        if error.to_string().contains("Browser ID 已变化")
                            || consecutive_failures >= 5
                        {
                            break;
                        }
                    }
                }
                for _ in 0..12 {
                    if thread_stop.load(Ordering::SeqCst) {
                        break;
                    }
                    thread::sleep(Duration::from_millis(100));
                }
            }
        });
        if let Ok(mut guard) = self.watcher.lock() {
            *guard = Some(WatcherHandle {
                stop,
                thread: Some(thread),
            });
        }
    }

    fn watcher_running(&self) -> bool {
        self.watcher
            .lock()
            .ok()
            .and_then(|guard| {
                guard
                    .as_ref()
                    .and_then(|handle| handle.thread.as_ref())
                    .map(|thread| !thread.is_finished())
            })
            .unwrap_or(false)
    }

    pub fn start_supervisor(&self) {
        if self
            .supervisor_started
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }

        let runtime = self.clone();
        thread::spawn(move || {
            loop {
                if let Err(error) = recover_active_session(&runtime) {
                    eprintln!("[skin-studio] 自动恢复主题失败：{error}");
                }
                thread::sleep(Duration::from_millis(1500));
            }
        });
    }
}

pub fn read_state() -> EngineState {
    state_path()
        .ok()
        .and_then(|path| fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn write_state(state: &EngineState) -> Result<()> {
    atomic_write(
        &state_path()?,
        format!("{}\n", serde_json::to_string_pretty(state)?).as_bytes(),
    )
}

fn media_mime(manifest: &ThemeManifest) -> &'static str {
    match manifest.background_kind.as_str() {
        "video" => "video/mp4",
        _ => match std::path::Path::new(&manifest.image)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("jpg")
            .to_ascii_lowercase()
            .as_str()
        {
            "png" => "image/png",
            "webp" => "image/webp",
            _ => "image/jpeg",
        },
    }
}

fn payload_for(manifest: &ThemeManifest, image: &[u8], asset_id: &str) -> Result<(String, String)> {
    let theme_json = serde_json::to_string(manifest)?;
    let mut hasher = Sha256::new();
    hasher.update(theme_json.as_bytes());
    hasher.update(image);
    hasher.update(CSS.as_bytes());
    hasher.update(RENDERER.as_bytes());
    let revision = format!("{:x}", hasher.finalize());
    let payload = RENDERER
        .replace("__SKIN_CSS__", &serde_json::to_string(CSS)?)
        .replace("__SKIN_MEDIA_ID__", &serde_json::to_string(asset_id)?)
        .replace("__SKIN_THEME__", &theme_json)
        .replace("__SKIN_REVISION__", &serde_json::to_string(&revision)?);
    Ok((payload, revision))
}

fn prepare_payload(
    manifest: &ThemeManifest,
    directory: &std::path::Path,
) -> Result<(String, String, cdp::MediaPayload)> {
    let image = themes::image_bytes(manifest, directory)?;
    let asset_id = format!("{:x}", Sha256::digest(&image));
    let (payload, revision) = payload_for(manifest, &image, &asset_id)?;
    let media = cdp::MediaPayload {
        asset_id,
        mime: media_mime(manifest),
        bytes: image.into(),
    };
    Ok((payload, revision, media))
}

fn preferred_port() -> u16 {
    #[cfg(target_os = "macos")]
    {
        9341
    }
    #[cfg(not(target_os = "macos"))]
    {
        9335
    }
}

fn install_from_state_or_current(state: &EngineState) -> Result<CodexInstall> {
    let current =
        platform::find_codex()?.ok_or_else(|| StudioError::from("未找到官方 Codex Desktop"))?;
    if let Some(saved) = &state.codex_executable {
        let same = if cfg!(target_os = "windows") {
            saved.eq_ignore_ascii_case(&current.executable)
        } else {
            saved == &current.executable
        };
        if !same && !platform::main_pids(&current)?.is_empty() {
            return Err(StudioError::from(
                "检测到与保存状态不同的 Codex 版本，请先关闭 Codex",
            ));
        }
    }
    Ok(current)
}

pub fn apply_plan(theme_id: &str) -> Result<ApplyPlan> {
    themes::load_manifest(theme_id)?;
    let state = read_state();
    let install = install_from_state_or_current(&state)?;
    let port = state.port.unwrap_or_else(preferred_port);
    let action = if platform::verify_cdp_owner(&install, port)? && cdp::browser_id(port).is_ok() {
        "hotSwitch"
    } else if platform::main_pids(&install)?.is_empty() {
        "launch"
    } else {
        "restart"
    };
    Ok(ApplyPlan {
        action: action.into(),
    })
}

fn recover_active_session(runtime: &AppRuntime) -> Result<()> {
    if runtime.watcher_running() {
        return Ok(());
    }

    // Read the recovery intent while holding the same lock as manual theme
    // operations. Otherwise a recovery queued before restore_official can apply
    // a stale theme after the official state has already been persisted.
    let _operation = runtime
        .operation
        .lock()
        .map_err(|_| StudioError::from("主题操作锁已损坏"))?;
    if runtime.watcher_running() {
        return Ok(());
    }
    let state = read_state();
    if state.mode != "active" {
        return Ok(());
    }
    let Some(theme_id) = state.active_theme_id.as_deref() else {
        return Ok(());
    };
    let install = install_from_state_or_current(&state)?;
    if platform::main_pids(&install)?.is_empty() {
        return Ok(());
    }

    // A normal Codex launch cannot be attached to after startup. Re-establish the
    // previously approved themed session as soon as the process is detected.
    apply_locked(runtime, theme_id, true)
}

pub fn apply(runtime: &AppRuntime, theme_id: &str, restart_existing: bool) -> Result<()> {
    let _operation = runtime
        .operation
        .lock()
        .map_err(|_| StudioError::from("主题操作锁已损坏"))?;
    apply_locked(runtime, theme_id, restart_existing)
}

fn apply_locked(runtime: &AppRuntime, theme_id: &str, restart_existing: bool) -> Result<()> {
    let (manifest, directory) = themes::load_manifest(theme_id)?;
    let old_state = read_state();
    let install = install_from_state_or_current(&old_state)?;

    let mut port = old_state.port.unwrap_or_else(preferred_port);
    let mut browser = if platform::verify_cdp_owner(&install, port)? {
        cdp::browser_id(port).ok()
    } else {
        None
    };
    let mut launch_required = false;
    if browser.is_none() {
        let running = platform::main_pids(&install)?;
        if !running.is_empty() && !restart_existing {
            return Err(StudioError::from(
                "Codex 正在普通模式运行，请确认重启后再应用主题",
            ));
        }
        launch_required = true;
    }
    let (payload, revision, media) = prepare_payload(&manifest, &directory)?;

    // The previous watcher owns an old payload. It must finish before the new
    // payload is injected, otherwise a same-browser hot switch can be reverted.
    runtime.stop_watcher();
    let applied = (|| {
        if launch_required {
            if !platform::running_pids(&install)?.is_empty() {
                platform::stop_codex(&install)?;
            }
            port = platform::select_port(preferred_port())?;
            platform::launch_with_cdp(&install, port)?;
            browser = Some(cdp::wait_ready(port, 130)?);
            if !platform::verify_cdp_owner(&install, port)? {
                return Err(StudioError::from(
                    "CDP 监听进程不属于已验证的官方 Codex 可执行文件",
                ));
            }
        }
        let browser = browser
            .clone()
            .ok_or_else(|| StudioError::from("CDP Browser ID 缺失"))?;
        cdp::wait_and_inject(port, &browser, &payload, &revision, &media, 120)?;
        write_state(&EngineState {
            schema_version: 1,
            mode: "active".into(),
            active_theme_id: Some(theme_id.into()),
            port: Some(port),
            codex_executable: Some(install.executable.clone()),
            codex_bundle: install.bundle.clone(),
            browser_id: Some(browser.clone()),
            message: format!("{} 正在本机端口 {} 运行", manifest.name, port),
        })?;
        Ok(browser)
    })();

    match applied {
        Ok(browser) => {
            runtime.start_watcher(port, browser, payload, revision, media);
            Ok(())
        }
        Err(error) => Err(error),
    }
}

pub fn launch_codex_on_open(runtime: &AppRuntime) -> Result<()> {
    let state = read_state();
    let install = install_from_state_or_current(&state)?;
    if !platform::main_pids(&install)?.is_empty() {
        return Ok(());
    }

    if state.mode == "active"
        && let Some(theme_id) = state.active_theme_id.as_deref()
        && apply(runtime, theme_id, false).is_ok()
    {
        return Ok(());
    }

    platform::launch_normal(&install)
}

pub fn pause(runtime: &AppRuntime) -> Result<()> {
    let _operation = runtime
        .operation
        .lock()
        .map_err(|_| StudioError::from("主题操作锁已损坏"))?;
    runtime.stop_watcher();
    let mut state = read_state();
    if state.active_theme_id.is_none() {
        return Err(StudioError::from("没有可暂停的主题会话"));
    }
    if let Some(port) = state.port
        && cdp::browser_id(port).ok().as_deref() == state.browser_id.as_deref()
    {
        let _ = cdp::cleanup(port, state.browser_id.as_deref());
    }
    state.mode = "paused".into();
    state.message = "主题已暂停，后台自动接管已停止".into();
    write_state(&state)
}

pub fn restore_official(runtime: &AppRuntime, restart_codex: bool) -> Result<()> {
    let _operation = runtime
        .operation
        .lock()
        .map_err(|_| StudioError::from("主题操作锁已损坏"))?;
    runtime.stop_watcher();
    let state = read_state();
    let install = install_from_state_or_current(&state)?;

    if let Some(port) = state.port
        && cdp::browser_id(port).ok().as_deref() == state.browser_id.as_deref()
    {
        let _ = cdp::cleanup(port, state.browser_id.as_deref());
    }
    // Persist the user's intent before touching the Codex process. A stop or
    // relaunch failure must not leave an active theme eligible for recovery.
    write_state(&EngineState::default())?;
    if !platform::running_pids(&install)?.is_empty() {
        platform::stop_codex(&install)?;
    }
    if restart_codex {
        platform::launch_normal(&install)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{CSS, payload_for};
    use crate::models::{
        ArtConfig, ChangeSummaryConfig, ComposerConfig, EnvironmentConfig, LevelSliderConfig,
        Palette, SemanticTokens, ThemeManifest, UiConfig,
    };
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn builds_a_closed_payload_without_template_markers() {
        let directory = std::env::temp_dir().join(format!("codex-skin-payload-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("background.jpg"),
            include_bytes!("../assets/preset-bamboo-skylight.jpg"),
        )
        .unwrap();
        let manifest = ThemeManifest {
            schema_version: 1,
            id: "test-theme".into(),
            name: "Test".into(),
            version: "1.0.0".into(),
            author: "Test".into(),
            image: "background.jpg".into(),
            background_kind: "image".into(),
            thumbnail: "background.jpg".into(),
            appearance: "auto".into(),
            art: ArtConfig::default(),
            palette: Palette::default(),
            level_slider: LevelSliderConfig::default(),
            composer: ComposerConfig::default(),
            environment: EnvironmentConfig::default(),
            change_summary: ChangeSummaryConfig::default(),
            tokens: SemanticTokens::default(),
            ui: UiConfig::default(),
            built_in: false,
        };
        let image = fs::read(directory.join("background.jpg")).unwrap();
        let (payload, revision) = payload_for(
            &manifest,
            &image,
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        )
        .unwrap();
        assert!(!payload.contains("__SKIN_"));
        assert!(
            payload.contains("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        );
        assert!(!payload.contains("base64,"));
        assert_eq!(revision.len(), 64);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn video_background_preserves_fixed_body_portals() {
        assert!(CSS.contains("skin-background-video body > #root"));
        assert!(!CSS.contains("body > :not(#codex-skin-studio-video)"));
    }
}
