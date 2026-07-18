use crate::error::{Result, StudioError};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};
use uuid::Uuid;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub launch_codex_on_open: bool,
}

pub fn app_root() -> Result<PathBuf> {
    let dirs = ProjectDirs::from("studio", "codex", "CodexSkinStudio")
        .ok_or_else(|| StudioError::from("无法确定应用数据目录"))?;
    let root = dirs.data_local_dir().to_path_buf();
    fs::create_dir_all(&root)?;
    Ok(root)
}

pub fn themes_root() -> Result<PathBuf> {
    let path = app_root()?.join("themes");
    fs::create_dir_all(&path)?;
    Ok(path)
}

pub fn state_path() -> Result<PathBuf> {
    Ok(app_root()?.join("engine-state.json"))
}

pub fn store_state_path() -> Result<PathBuf> {
    Ok(app_root()?.join("theme-store-state.json"))
}

fn settings_path() -> Result<PathBuf> {
    Ok(app_root()?.join("settings.json"))
}

pub fn read_settings() -> AppSettings {
    settings_path()
        .ok()
        .and_then(|path| fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

pub fn write_settings(settings: &AppSettings) -> Result<()> {
    atomic_write(
        &settings_path()?,
        format!("{}\n", serde_json::to_string_pretty(settings)?).as_bytes(),
    )
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| StudioError::from("目标路径没有父目录"))?;
    fs::create_dir_all(parent)?;
    let temporary = parent.join(format!(".studio-{}.tmp", Uuid::new_v4()));
    fs::write(&temporary, bytes)?;
    if path.exists() {
        let backup = parent.join(format!(".studio-{}.bak", Uuid::new_v4()));
        fs::rename(path, &backup)?;
        match fs::rename(&temporary, path) {
            Ok(()) => {
                let _ = fs::remove_file(backup);
            }
            Err(error) => {
                let _ = fs::rename(backup, path);
                let _ = fs::remove_file(temporary);
                return Err(error.into());
            }
        }
    } else {
        fs::rename(temporary, path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::AppSettings;

    #[test]
    fn codex_launch_on_open_is_disabled_by_default() {
        assert!(!AppSettings::default().launch_codex_on_open);
    }
}
