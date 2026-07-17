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
pub struct ComposerConfig {
    pub background: String,
    pub opacity: f64,
    pub blur: u32,
    pub border_opacity: f64,
    pub shadow: String,
    #[serde(default)]
    pub show_footer_backdrop: bool,
}

impl Default for ComposerConfig {
    fn default() -> Self {
        Self {
            background: "auto".into(),
            opacity: 0.88,
            blur: 12,
            border_opacity: 0.65,
            shadow: "soft".into(),
            show_footer_backdrop: false,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentConfig {
    pub visible: bool,
    pub background: String,
    pub opacity: f64,
    pub blur: u32,
    pub border_opacity: f64,
    pub shadow: String,
    pub radius: u32,
}

impl Default for EnvironmentConfig {
    fn default() -> Self {
        Self {
            visible: true,
            background: "auto".into(),
            opacity: 0.92,
            blur: 12,
            border_opacity: 0.55,
            shadow: "soft".into(),
            radius: 24,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSummaryConfig {
    pub visible: bool,
    pub background: String,
    pub opacity: f64,
    pub blur: u32,
    pub border_opacity: f64,
    pub shadow: String,
    pub radius: u32,
}

impl Default for ChangeSummaryConfig {
    fn default() -> Self {
        Self {
            visible: true,
            background: "auto".into(),
            opacity: 0.72,
            blur: 8,
            border_opacity: 0.45,
            shadow: "soft".into(),
            radius: 12,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceConfig {
    pub visible: bool,
    pub background: String,
    pub opacity: f64,
    pub blur: u32,
    pub border_opacity: f64,
    pub shadow: String,
    pub radius: u32,
}

impl Default for SurfaceConfig {
    fn default() -> Self {
        Self {
            visible: true,
            background: "auto".into(),
            opacity: 0.8,
            blur: 6,
            border_opacity: 0.35,
            shadow: "none".into(),
            radius: 12,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowConfig {
    pub visible: bool,
    pub background: String,
    pub opacity: f64,
    pub hover_opacity: f64,
    pub selected_opacity: f64,
    pub radius: u32,
}

impl Default for RowConfig {
    fn default() -> Self {
        Self {
            visible: true,
            background: "auto".into(),
            opacity: 0.0,
            hover_opacity: 0.1,
            selected_opacity: 0.18,
            radius: 8,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrollbarConfig {
    pub visible: bool,
    pub color: String,
    pub opacity: f64,
    pub width: u32,
    pub radius: u32,
}

impl Default for ScrollbarConfig {
    fn default() -> Self {
        Self {
            visible: true,
            color: "auto".into(),
            opacity: 0.45,
            width: 8,
            radius: 8,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffConfig {
    pub visible: bool,
    pub background: String,
    pub opacity: f64,
    pub added_color: String,
    pub deleted_color: String,
    pub radius: u32,
}

impl Default for DiffConfig {
    fn default() -> Self {
        Self {
            visible: true,
            background: "auto".into(),
            opacity: 0.12,
            added_color: "#22c55e".into(),
            deleted_color: "#ef4444".into(),
            radius: 6,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentLayoutConfig {
    pub max_width: u32,
    pub font_scale: f64,
    pub message_gap: u32,
}

impl Default for ContentLayoutConfig {
    fn default() -> Self {
        Self {
            max_width: 768,
            font_scale: 1.0,
            message_gap: 16,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RichTextConfig {
    pub link_color: String,
    pub inline_code_background: String,
    pub inline_code_opacity: f64,
    pub inline_code_radius: u32,
    pub quote_accent: String,
    pub quote_background: String,
    pub quote_opacity: f64,
    pub table_border: String,
    pub table_background: String,
    pub table_opacity: f64,
    pub table_radius: u32,
    pub image_radius: u32,
}

impl Default for RichTextConfig {
    fn default() -> Self {
        Self {
            link_color: "auto".into(),
            inline_code_background: "auto".into(),
            inline_code_opacity: 0.65,
            inline_code_radius: 6,
            quote_accent: "auto".into(),
            quote_background: "auto".into(),
            quote_opacity: 0.24,
            table_border: "auto".into(),
            table_background: "auto".into(),
            table_opacity: 0.4,
            table_radius: 8,
            image_radius: 8,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiConfig {
    pub sidebar: SurfaceConfig,
    pub header: SurfaceConfig,
    pub user_bubble: SurfaceConfig,
    pub code_block: SurfaceConfig,
    pub activity_card: SurfaceConfig,
    pub thread_rows: RowConfig,
    pub summary_rows: RowConfig,
    pub navigation_rail_visible: bool,
    pub navigation_rail_opacity: f64,
    pub scrollbar: ScrollbarConfig,
    pub diff: DiffConfig,
    pub content: ContentLayoutConfig,
    pub rich_text: RichTextConfig,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            sidebar: SurfaceConfig {
                opacity: 0.76,
                blur: 8,
                border_opacity: 0.25,
                radius: 0,
                ..SurfaceConfig::default()
            },
            header: SurfaceConfig {
                opacity: 0.42,
                blur: 8,
                border_opacity: 0.25,
                radius: 0,
                ..SurfaceConfig::default()
            },
            user_bubble: SurfaceConfig {
                opacity: 0.62,
                blur: 4,
                border_opacity: 0.25,
                radius: 20,
                ..SurfaceConfig::default()
            },
            code_block: SurfaceConfig {
                opacity: 0.82,
                border_opacity: 0.35,
                shadow: "soft".into(),
                ..SurfaceConfig::default()
            },
            activity_card: SurfaceConfig {
                opacity: 0.68,
                blur: 4,
                border_opacity: 0.3,
                ..SurfaceConfig::default()
            },
            thread_rows: RowConfig::default(),
            summary_rows: RowConfig {
                hover_opacity: 0.12,
                selected_opacity: 0.16,
                ..RowConfig::default()
            },
            navigation_rail_visible: true,
            navigation_rail_opacity: 0.7,
            scrollbar: ScrollbarConfig::default(),
            diff: DiffConfig::default(),
            content: ContentLayoutConfig::default(),
            rich_text: RichTextConfig::default(),
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
    pub composer: ComposerConfig,
    #[serde(default)]
    pub environment: EnvironmentConfig,
    #[serde(default)]
    pub change_summary: ChangeSummaryConfig,
    #[serde(default)]
    pub ui: UiConfig,
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
    pub composer: ComposerConfig,
    pub environment: EnvironmentConfig,
    pub change_summary: ChangeSummaryConfig,
    pub ui: UiConfig,
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
    pub autostart_enabled: bool,
    pub themes: Vec<ThemeRecord>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPlan {
    pub action: String,
}

#[derive(Clone, Debug)]
pub struct CodexInstall {
    pub executable: String,
    pub bundle: Option<String>,
    pub version: Option<String>,
    pub app_user_model_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::{ComposerConfig, ThemeManifest};

    #[test]
    fn legacy_manifest_uses_default_composer_settings() {
        let manifest: ThemeManifest = serde_json::from_str(
            r##"{
                "schemaVersion": 1,
                "id": "legacy-theme",
                "name": "Legacy",
                "version": "1.0.0",
                "author": "Test",
                "image": "background.jpg",
                "thumbnail": "thumbnail.jpg",
                "appearance": "auto",
                "art": {
                    "focusX": 0.5,
                    "focusY": 0.5,
                    "safeArea": "auto",
                    "taskMode": "ambient"
                },
                "palette": { "accent": "#237a57" }
            }"##,
        )
        .expect("legacy manifest should deserialize");

        assert_eq!(manifest.composer.background, "auto");
        assert_eq!(manifest.composer.opacity, 0.88);
        assert_eq!(manifest.composer.blur, 12);
        assert_eq!(manifest.composer.border_opacity, 0.65);
        assert_eq!(manifest.composer.shadow, "soft");
        assert!(!manifest.composer.show_footer_backdrop);
        assert!(manifest.environment.visible);
        assert_eq!(manifest.environment.background, "auto");
        assert_eq!(manifest.environment.radius, 24);
        assert!(manifest.change_summary.visible);
        assert_eq!(manifest.change_summary.opacity, 0.72);
        assert_eq!(manifest.change_summary.radius, 12);
        assert_eq!(manifest.ui.content.max_width, 768);
        assert_eq!(manifest.ui.user_bubble.radius, 20);
        assert!(manifest.ui.scrollbar.visible);
    }

    #[test]
    fn saved_composer_without_backdrop_setting_defaults_to_hidden() {
        let composer: ComposerConfig = serde_json::from_str(
            r#"{
                "background": "auto",
                "opacity": 0.88,
                "blur": 12,
                "borderOpacity": 0.65,
                "shadow": "soft"
            }"#,
        )
        .expect("previous composer settings should deserialize");

        assert!(!composer.show_footer_backdrop);
    }
}
