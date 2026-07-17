use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtConfig {
    pub focus_x: f64,
    pub focus_y: f64,
    pub safe_area: String,
    pub task_mode: String,
}

impl Default for ArtConfig {
    fn default() -> Self {
        Self {
            focus_x: 0.68,
            focus_y: 0.45,
            safe_area: "auto".into(),
            task_mode: "ambient".into(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Palette {
    pub accent: String,
}

impl Default for Palette {
    fn default() -> Self {
        Self {
            accent: "#237a57".into(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeManifest {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub image: String,
    pub thumbnail: String,
    pub appearance: String,
    pub art: ArtConfig,
    pub palette: Palette,
    #[serde(default)]
    pub built_in: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeRecord {
    pub id: String,
    pub name: String,
    pub version: String,
    pub appearance: String,
    pub accent: String,
    pub art: ArtConfig,
    pub preview_data_url: String,
    pub built_in: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineState {
    pub schema_version: u32,
    pub mode: String,
    pub active_theme_id: Option<String>,
    pub port: Option<u16>,
    pub codex_executable: Option<String>,
    pub codex_bundle: Option<String>,
    pub browser_id: Option<String>,
    pub message: String,
}

impl Default for EngineState {
    fn default() -> Self {
        Self {
            schema_version: 1,
            mode: "official".into(),
            active_theme_id: None,
            port: None,
            codex_executable: None,
            codex_bundle: None,
            browser_id: None,
            message: "Codex 正在使用官方主题".into(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    pub platform: String,
    pub codex_found: bool,
    pub codex_version: Option<String>,
    pub mode: String,
    pub active_theme_id: Option<String>,
    pub port: Option<u16>,
    pub message: String,
    pub themes: Vec<ThemeRecord>,
}

#[derive(Clone, Debug)]
pub struct CodexInstall {
    pub executable: String,
    pub bundle: Option<String>,
    pub version: Option<String>,
}
