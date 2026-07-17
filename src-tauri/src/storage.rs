use crate::error::{Result, StudioError};
use directories::ProjectDirs;
use std::{
    fs,
    path::{Path, PathBuf},
};
use uuid::Uuid;

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
