use crate::{
    cdp,
    error::{Result, StudioError},
    models::{CodexInstall, EngineState, ThemeManifest},
    platform,
    storage::{atomic_write, state_path},
    themes,
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
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
}

impl AppRuntime {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
            operation: Arc::new(Mutex::new(())),
        }
    }

    fn stop_watcher(&self) {
        let handle = self.watcher.lock().ok().and_then(|mut guard| guard.take());
        if let Some(handle) = handle {
            handle.stop();
        }
    }

    fn start_watcher(&self, port: u16, browser_id: String, payload: String, revision: String) {
        self.stop_watcher();
        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = stop.clone();
        let thread = thread::spawn(move || {
            while !thread_stop.load(Ordering::SeqCst) {
                if let Err(error) = cdp::inject(port, &browser_id, &payload, &revision) {
                    eprintln!("[skin-studio] {error}");
                    if error.to_string().contains("Browser ID 已变化") {
                        break;
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

fn payload_for(manifest: &ThemeManifest, directory: &std::path::Path) -> Result<(String, String)> {
    let image = themes::image_bytes(manifest, directory)?;
    let extension = std::path::Path::new(&manifest.image)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("jpg")
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "image/jpeg",
    };
    let theme_json = serde_json::to_string(manifest)?;
    let mut hasher = Sha256::new();
    hasher.update(theme_json.as_bytes());
    hasher.update(&image);
    hasher.update(CSS.as_bytes());
    hasher.update(RENDERER.as_bytes());
    let revision = format!("{:x}", hasher.finalize());
    let art = format!("data:{mime};base64,{}", STANDARD.encode(image));
    let payload = RENDERER
        .replace("__SKIN_CSS__", &serde_json::to_string(CSS)?)
        .replace("__SKIN_ART__", &serde_json::to_string(&art)?)
        .replace("__SKIN_THEME__", &theme_json)
        .replace("__SKIN_REVISION__", &serde_json::to_string(&revision)?);
    Ok((payload, revision))
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
        if !same && !platform::running_pids(&current)?.is_empty() {
            return Err(StudioError::from(
                "检测到与保存状态不同的 Codex 版本，请先关闭 Codex",
            ));
        }
    }
    Ok(current)
}

pub fn apply(runtime: &AppRuntime, theme_id: &str, restart_existing: bool) -> Result<()> {
    let _operation = runtime
        .operation
        .lock()
        .map_err(|_| StudioError::from("主题操作锁已损坏"))?;
    let (manifest, directory) = themes::load_manifest(theme_id)?;
    let (payload, revision) = payload_for(&manifest, &directory)?;
    let old_state = read_state();
    let install = install_from_state_or_current(&old_state)?;

    let mut port = old_state.port.unwrap_or_else(preferred_port);
    let mut browser = if platform::verify_cdp_owner(&install, port)? {
        cdp::browser_id(port).ok()
    } else {
        None
    };
    if browser.is_none() {
        let running = platform::running_pids(&install)?;
        if !running.is_empty() {
            if !restart_existing {
                return Err(StudioError::from(
                    "Codex 正在普通模式运行，请确认重启后再应用主题",
                ));
            }
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
    let browser = browser.ok_or_else(|| StudioError::from("CDP Browser ID 缺失"))?;
    cdp::wait_and_inject(port, &browser, &payload, &revision, 120)?;
    runtime.start_watcher(port, browser.clone(), payload, revision);
    write_state(&EngineState {
        schema_version: 1,
        mode: "active".into(),
        active_theme_id: Some(theme_id.into()),
        port: Some(port),
        codex_executable: Some(install.executable),
        codex_bundle: install.bundle,
        browser_id: Some(browser),
        message: format!("{} 正在本机端口 {} 运行", manifest.name, port),
    })
}

pub fn pause(runtime: &AppRuntime) -> Result<()> {
    let _operation = runtime
        .operation
        .lock()
        .map_err(|_| StudioError::from("主题操作锁已损坏"))?;
    runtime.stop_watcher();
    let mut state = read_state();
    let port = state
        .port
        .ok_or_else(|| StudioError::from("没有可暂停的主题会话"))?;
    cdp::cleanup(port, state.browser_id.as_deref())?;
    state.mode = "paused".into();
    state.message = "皮肤已从当前 Codex 窗口移除".into();
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
    if !platform::running_pids(&install)?.is_empty() {
        platform::stop_codex(&install)?;
    }
    write_state(&EngineState::default())?;
    if restart_codex {
        platform::launch_normal(&install)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::payload_for;
    use crate::models::{ArtConfig, Palette, ThemeManifest};
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn builds_a_closed_payload_without_template_markers() {
        let directory = std::env::temp_dir().join(format!("codex-skin-payload-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("background.jpg"),
            include_bytes!("../assets/preset-midnight-aurora.jpg"),
        )
        .unwrap();
        let manifest = ThemeManifest {
            schema_version: 1,
            id: "test-theme".into(),
            name: "Test".into(),
            version: "1.0.0".into(),
            author: "Test".into(),
            image: "background.jpg".into(),
            thumbnail: "background.jpg".into(),
            appearance: "auto".into(),
            art: ArtConfig::default(),
            palette: Palette::default(),
            built_in: false,
        };
        let (payload, revision) = payload_for(&manifest, &directory).unwrap();
        assert!(!payload.contains("__SKIN_"));
        assert_eq!(revision.len(), 64);
        let _ = fs::remove_dir_all(directory);
    }
}
