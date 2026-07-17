use crate::{
    error::{Result, StudioError},
    models::{
        ArtConfig, ChangeSummaryConfig, ComposerConfig, EnvironmentConfig, Palette, ThemeManifest,
        ThemeRecord, UiConfig,
    },
    storage::{atomic_write, themes_root},
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use image::{ImageFormat, ImageReader, codecs::jpeg::JpegEncoder, imageops::FilterType};
use std::{
    fs,
    io::Cursor,
    path::{Path, PathBuf},
};
use uuid::Uuid;

const MAX_IMAGE_BYTES: u64 = 16 * 1024 * 1024;
const MAX_DIMENSION: u32 = 16_384;
const MAX_PIXELS: u64 = 50_000_000;
const BUILTIN_THEME_VERSION: &str = "1.2.1";
const ALPINE_LAKE: &[u8] = include_bytes!("../assets/preset-alpine-lake.jpg");
const AMBER: &[u8] = include_bytes!("../assets/preset-amber-dusk.jpg");
const AURORA: &[u8] = include_bytes!("../assets/preset-midnight-aurora.jpg");
const CODEX_OBSERVATORY: &[u8] = include_bytes!("../assets/preset-codex-observatory.jpg");
const CYBER: &[u8] = include_bytes!("../assets/preset-cyber-neon.jpg");
const FOREST: &[u8] = include_bytes!("../assets/preset-forest-mist.jpg");
const HARBOR_CITY: &[u8] = include_bytes!("../assets/preset-harbor-city.jpg");
const MIDNIGHT_PAPER_OBSERVATORY: &[u8] =
    include_bytes!("../assets/preset-midnight-paper-observatory.jpg");
const MOONLIT_ALPINE_LAKE: &[u8] = include_bytes!("../assets/preset-moonlit-alpine-lake.jpg");
const PAPER_SKY_WORKSHOP: &[u8] = include_bytes!("../assets/preset-paper-sky-workshop.jpg");
const RAINY_HARBOR: &[u8] = include_bytes!("../assets/preset-rainy-harbor.jpg");
const ROMANTIC: &[u8] = include_bytes!("../assets/preset-romantic-rose.jpg");
const SAKURA: &[u8] = include_bytes!("../assets/preset-sakura-dawn.jpg");
const SKY_LIGHT_STUDY: &[u8] = include_bytes!("../assets/preset-sky-light-study.jpg");
const STRATA_FORGE: &[u8] = include_bytes!("../assets/preset-strata-forge.jpg");
const SUNLIT_SHORE: &[u8] = include_bytes!("../assets/preset-sunlit-shore.jpg");
const YELLOW_GADGETEERS: &[u8] = include_bytes!("../assets/preset-yellow-gadgeteers.jpg");

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 100
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn theme_dir(id: &str) -> Result<PathBuf> {
    if !valid_id(id) {
        return Err(StudioError::from("主题 ID 无效"));
    }
    Ok(themes_root()?.join(id))
}

fn validate_art(art: &ArtConfig) -> Result<()> {
    if !(0.0..=1.0).contains(&art.focus_x) || !(0.0..=1.0).contains(&art.focus_y) {
        return Err(StudioError::from("图片焦点必须位于 0 到 1 之间"));
    }
    if !["auto", "left", "right", "center", "none"].contains(&art.safe_area.as_str()) {
        return Err(StudioError::from("内容安全区设置无效"));
    }
    if !["auto", "ambient", "banner", "off"].contains(&art.task_mode.as_str()) {
        return Err(StudioError::from("任务页背景设置无效"));
    }
    Ok(())
}

fn valid_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn validate_composer(composer: &ComposerConfig) -> Result<()> {
    if composer.background != "auto" && !valid_hex_color(&composer.background) {
        return Err(StudioError::from("输入框背景色必须为自动或十六进制颜色"));
    }
    if !(0.0..=1.0).contains(&composer.opacity) || !(0.0..=1.0).contains(&composer.border_opacity) {
        return Err(StudioError::from("输入框透明度必须位于 0 到 1 之间"));
    }
    if composer.blur > 32 {
        return Err(StudioError::from("输入框模糊强度不能超过 32px"));
    }
    if !["none", "soft", "strong"].contains(&composer.shadow.as_str()) {
        return Err(StudioError::from("输入框阴影设置无效"));
    }
    Ok(())
}

fn validate_environment(environment: &EnvironmentConfig) -> Result<()> {
    if environment.background != "auto" && !valid_hex_color(&environment.background) {
        return Err(StudioError::from("环境面板背景色必须为自动或十六进制颜色"));
    }
    if !(0.0..=1.0).contains(&environment.opacity)
        || !(0.0..=1.0).contains(&environment.border_opacity)
    {
        return Err(StudioError::from("环境面板透明度必须位于 0 到 1 之间"));
    }
    if environment.blur > 32 {
        return Err(StudioError::from("环境面板模糊强度不能超过 32px"));
    }
    if !(8..=32).contains(&environment.radius) {
        return Err(StudioError::from("环境面板圆角必须位于 8px 到 32px 之间"));
    }
    if !["none", "soft", "strong"].contains(&environment.shadow.as_str()) {
        return Err(StudioError::from("环境面板阴影设置无效"));
    }
    Ok(())
}

fn validate_change_summary(change_summary: &ChangeSummaryConfig) -> Result<()> {
    if change_summary.background != "auto" && !valid_hex_color(&change_summary.background) {
        return Err(StudioError::from("变更摘要背景色必须为自动或十六进制颜色"));
    }
    if !(0.0..=1.0).contains(&change_summary.opacity)
        || !(0.0..=1.0).contains(&change_summary.border_opacity)
    {
        return Err(StudioError::from("变更摘要透明度必须位于 0 到 1 之间"));
    }
    if change_summary.blur > 32 {
        return Err(StudioError::from("变更摘要模糊强度不能超过 32px"));
    }
    if !(8..=32).contains(&change_summary.radius) {
        return Err(StudioError::from("变更摘要圆角必须位于 8px 到 32px 之间"));
    }
    if !["none", "soft", "strong"].contains(&change_summary.shadow.as_str()) {
        return Err(StudioError::from("变更摘要阴影设置无效"));
    }
    Ok(())
}

fn validate_ui(ui: &UiConfig) -> Result<()> {
    for (label, surface) in [
        ("侧边栏", &ui.sidebar),
        ("标题栏", &ui.header),
        ("用户消息", &ui.user_bubble),
        ("代码块", &ui.code_block),
        ("活动卡片", &ui.activity_card),
    ] {
        if surface.background != "auto" && !valid_hex_color(&surface.background) {
            return Err(StudioError::from(format!(
                "{label}背景色必须为自动或十六进制颜色"
            )));
        }
        if !(0.0..=1.0).contains(&surface.opacity) || !(0.0..=1.0).contains(&surface.border_opacity)
        {
            return Err(StudioError::from(format!(
                "{label}透明度必须位于 0 到 1 之间"
            )));
        }
        if surface.blur > 32 || surface.radius > 32 {
            return Err(StudioError::from(format!("{label}模糊和圆角不能超过 32px")));
        }
        if !["none", "soft", "strong"].contains(&surface.shadow.as_str()) {
            return Err(StudioError::from(format!("{label}阴影设置无效")));
        }
    }

    for (label, rows) in [
        ("任务列表", &ui.thread_rows),
        ("环境面板项目", &ui.summary_rows),
    ] {
        if rows.background != "auto" && !valid_hex_color(&rows.background) {
            return Err(StudioError::from(format!(
                "{label}背景色必须为自动或十六进制颜色"
            )));
        }
        if !(0.0..=1.0).contains(&rows.opacity)
            || !(0.0..=1.0).contains(&rows.hover_opacity)
            || !(0.0..=1.0).contains(&rows.selected_opacity)
            || rows.radius > 24
        {
            return Err(StudioError::from(format!("{label}样式参数超出范围")));
        }
    }

    if !(0.0..=1.0).contains(&ui.navigation_rail_opacity) {
        return Err(StudioError::from("消息导航轨透明度必须位于 0 到 1 之间"));
    }
    if ui.scrollbar.color != "auto" && !valid_hex_color(&ui.scrollbar.color) {
        return Err(StudioError::from("滚动条颜色必须为自动或十六进制颜色"));
    }
    if !(0.0..=1.0).contains(&ui.scrollbar.opacity)
        || !(4..=16).contains(&ui.scrollbar.width)
        || ui.scrollbar.radius > 16
    {
        return Err(StudioError::from("滚动条样式参数超出范围"));
    }
    if ui.diff.background != "auto" && !valid_hex_color(&ui.diff.background)
        || !valid_hex_color(&ui.diff.added_color)
        || !valid_hex_color(&ui.diff.deleted_color)
        || !(0.0..=1.0).contains(&ui.diff.opacity)
        || ui.diff.radius > 24
    {
        return Err(StudioError::from("Diff 样式参数无效"));
    }
    if !(560..=1200).contains(&ui.content.max_width)
        || !(0.8..=1.3).contains(&ui.content.font_scale)
        || !(4..=32).contains(&ui.content.message_gap)
    {
        return Err(StudioError::from("正文布局参数超出范围"));
    }

    for (label, color) in [
        ("链接", &ui.rich_text.link_color),
        ("行内代码背景", &ui.rich_text.inline_code_background),
        ("引用强调", &ui.rich_text.quote_accent),
        ("引用背景", &ui.rich_text.quote_background),
        ("表格边框", &ui.rich_text.table_border),
        ("表格背景", &ui.rich_text.table_background),
    ] {
        if color != "auto" && !valid_hex_color(color) {
            return Err(StudioError::from(format!(
                "{label}颜色必须为自动或十六进制颜色"
            )));
        }
    }
    if !(0.0..=1.0).contains(&ui.rich_text.inline_code_opacity)
        || !(0.0..=1.0).contains(&ui.rich_text.quote_opacity)
        || !(0.0..=1.0).contains(&ui.rich_text.table_opacity)
        || ui.rich_text.inline_code_radius > 24
        || ui.rich_text.table_radius > 24
        || ui.rich_text.image_radius > 32
    {
        return Err(StudioError::from("富文本样式参数超出范围"));
    }
    Ok(())
}

fn validate_manifest(manifest: &ThemeManifest) -> Result<()> {
    if manifest.schema_version != 1 || !valid_id(&manifest.id) {
        return Err(StudioError::from("主题清单版本或 ID 无效"));
    }
    if manifest.name.trim().is_empty() || manifest.name.chars().count() > 80 {
        return Err(StudioError::from("主题名称必须为 1 到 80 个字符"));
    }
    if !["auto", "light", "dark"].contains(&manifest.appearance.as_str()) {
        return Err(StudioError::from("主题外观设置无效"));
    }
    validate_art(&manifest.art)?;
    validate_composer(&manifest.composer)?;
    validate_environment(&manifest.environment)?;
    validate_change_summary(&manifest.change_summary)?;
    validate_ui(&manifest.ui)
}

fn image_info(bytes: &[u8]) -> Result<(ImageFormat, u32, u32)> {
    if bytes.is_empty() || bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err(StudioError::from("背景图片必须小于 16 MB"));
    }
    let reader = ImageReader::new(Cursor::new(bytes)).with_guessed_format()?;
    let format = reader
        .format()
        .ok_or_else(|| StudioError::from("无法识别图片格式"))?;
    if !matches!(
        format,
        ImageFormat::Jpeg | ImageFormat::Png | ImageFormat::WebP
    ) {
        return Err(StudioError::from("只支持 JPG、PNG 和 WebP 图片"));
    }
    let (width, height) = reader.into_dimensions()?;
    if width == 0
        || height == 0
        || width > MAX_DIMENSION
        || height > MAX_DIMENSION
        || u64::from(width) * u64::from(height) > MAX_PIXELS
    {
        return Err(StudioError::from("图片尺寸超过 16384px 或 5000 万像素限制"));
    }
    Ok((format, width, height))
}

fn extension_for(format: ImageFormat) -> &'static str {
    match format {
        ImageFormat::Jpeg => "jpg",
        ImageFormat::WebP => "webp",
        _ => "png",
    }
}

fn make_thumbnail(bytes: &[u8]) -> Result<Vec<u8>> {
    let image = image::load_from_memory(bytes)?.resize_to_fill(640, 360, FilterType::Lanczos3);
    let mut output = Vec::new();
    JpegEncoder::new_with_quality(&mut output, 84).encode_image(&image)?;
    Ok(output)
}

fn write_manifest(directory: &Path, manifest: &ThemeManifest) -> Result<()> {
    validate_manifest(manifest)?;
    atomic_write(
        &directory.join("theme.json"),
        format!("{}\n", serde_json::to_string_pretty(manifest)?).as_bytes(),
    )
}

#[derive(Clone, Copy)]
struct ComponentTheme {
    appearance: &'static str,
    accent: &'static str,
    sidebar: &'static str,
    surface: &'static str,
    raised: &'static str,
    code: &'static str,
    line: &'static str,
    quote: &'static str,
    added: &'static str,
    deleted: &'static str,
    sidebar_opacity: f64,
    panel_opacity: f64,
    blur: u32,
    radius: u32,
    shadow: &'static str,
    content_width: u32,
}

fn component_theme(id: &str) -> Option<ComponentTheme> {
    Some(match id {
        "preset-alpine-lake" => ComponentTheme {
            appearance: "dark",
            accent: "#84d2dc",
            sidebar: "#24302f",
            surface: "#343d39",
            raised: "#424a44",
            code: "#17201f",
            line: "#aab8b3",
            quote: "#f2c38e",
            added: "#65d69e",
            deleted: "#ff7f73",
            sidebar_opacity: 0.70,
            panel_opacity: 0.62,
            blur: 16,
            radius: 14,
            shadow: "none",
            content_width: 720,
        },
        "preset-amber-dusk" => ComponentTheme {
            appearance: "dark",
            accent: "#f0aa55",
            sidebar: "#17110d",
            surface: "#211812",
            raised: "#2c1f17",
            code: "#100d0b",
            line: "#8c6746",
            quote: "#f2c47d",
            added: "#71c98a",
            deleted: "#ef7867",
            sidebar_opacity: 0.88,
            panel_opacity: 0.82,
            blur: 18,
            radius: 12,
            shadow: "strong",
            content_width: 800,
        },
        "preset-cyber-neon" => ComponentTheme {
            appearance: "dark",
            accent: "#36e1df",
            sidebar: "#080b13",
            surface: "#101523",
            raised: "#16182c",
            code: "#070910",
            line: "#526785",
            quote: "#f05abf",
            added: "#4fe49a",
            deleted: "#ff6385",
            sidebar_opacity: 0.90,
            panel_opacity: 0.78,
            blur: 20,
            radius: 10,
            shadow: "strong",
            content_width: 800,
        },
        "preset-codex-observatory" => ComponentTheme {
            appearance: "dark",
            accent: "#8ed8d5",
            sidebar: "#090e10",
            surface: "#11181b",
            raised: "#172226",
            code: "#080d0f",
            line: "#405c61",
            quote: "#d09b67",
            added: "#66d09b",
            deleted: "#f1746b",
            sidebar_opacity: 0.92,
            panel_opacity: 0.84,
            blur: 14,
            radius: 10,
            shadow: "strong",
            content_width: 720,
        },
        "preset-midnight-aurora" => ComponentTheme {
            appearance: "dark",
            accent: "#45d8be",
            sidebar: "#09121b",
            surface: "#101b29",
            raised: "#12283a",
            code: "#071018",
            line: "#3a6673",
            quote: "#7ba7ff",
            added: "#55d59a",
            deleted: "#f16f7c",
            sidebar_opacity: 0.86,
            panel_opacity: 0.76,
            blur: 20,
            radius: 14,
            shadow: "soft",
            content_width: 760,
        },
        "preset-forest-mist" => ComponentTheme {
            appearance: "dark",
            accent: "#72c09d",
            sidebar: "#0c1713",
            surface: "#13211b",
            raised: "#173027",
            code: "#09120f",
            line: "#426c5b",
            quote: "#d0b278",
            added: "#69ce8d",
            deleted: "#e9786c",
            sidebar_opacity: 0.86,
            panel_opacity: 0.78,
            blur: 20,
            radius: 14,
            shadow: "soft",
            content_width: 760,
        },
        "preset-harbor-city" => ComponentTheme {
            appearance: "dark",
            accent: "#72c7d1",
            sidebar: "#24302f",
            surface: "#35403e",
            raised: "#44504d",
            code: "#17201f",
            line: "#aab9b5",
            quote: "#efad78",
            added: "#65d69e",
            deleted: "#ff7f73",
            sidebar_opacity: 0.70,
            panel_opacity: 0.62,
            blur: 16,
            radius: 12,
            shadow: "none",
            content_width: 720,
        },
        "preset-midnight-paper-observatory" => ComponentTheme {
            appearance: "dark",
            accent: "#c99a4e",
            sidebar: "#09121c",
            surface: "#101b27",
            raised: "#192633",
            code: "#070e16",
            line: "#4a6174",
            quote: "#d7aa60",
            added: "#69c99a",
            deleted: "#ed766b",
            sidebar_opacity: 0.93,
            panel_opacity: 0.86,
            blur: 12,
            radius: 10,
            shadow: "strong",
            content_width: 700,
        },
        "preset-moonlit-alpine-lake" => ComponentTheme {
            appearance: "dark",
            accent: "#91b7ca",
            sidebar: "#0a1117",
            surface: "#111a22",
            raised: "#18242d",
            code: "#080e13",
            line: "#456170",
            quote: "#b6c9d2",
            added: "#69c99a",
            deleted: "#ed766b",
            sidebar_opacity: 0.90,
            panel_opacity: 0.84,
            blur: 14,
            radius: 12,
            shadow: "strong",
            content_width: 720,
        },
        "preset-paper-sky-workshop" => ComponentTheme {
            appearance: "dark",
            accent: "#71c6d6",
            sidebar: "#233033",
            surface: "#354144",
            raised: "#465153",
            code: "#172124",
            line: "#b0c1c2",
            quote: "#ff9b78",
            added: "#65d69e",
            deleted: "#ff7f73",
            sidebar_opacity: 0.70,
            panel_opacity: 0.62,
            blur: 16,
            radius: 12,
            shadow: "none",
            content_width: 720,
        },
        "preset-rainy-harbor" => ComponentTheme {
            appearance: "dark",
            accent: "#5ca5ad",
            sidebar: "#0b1419",
            surface: "#111d23",
            raised: "#172830",
            code: "#081116",
            line: "#446b74",
            quote: "#d17a5d",
            added: "#63c993",
            deleted: "#ef7468",
            sidebar_opacity: 0.90,
            panel_opacity: 0.82,
            blur: 18,
            radius: 12,
            shadow: "strong",
            content_width: 720,
        },
        "preset-romantic-rose" => ComponentTheme {
            appearance: "dark",
            accent: "#ff9fbd",
            sidebar: "#34282d",
            surface: "#47373d",
            raised: "#5a464d",
            code: "#21191c",
            line: "#c8aeb6",
            quote: "#ffc0a8",
            added: "#65d69e",
            deleted: "#ff7f73",
            sidebar_opacity: 0.72,
            panel_opacity: 0.64,
            blur: 16,
            radius: 16,
            shadow: "none",
            content_width: 720,
        },
        "preset-sakura-dawn" => ComponentTheme {
            appearance: "dark",
            accent: "#ff9ab8",
            sidebar: "#34272d",
            surface: "#47353c",
            raised: "#5a434b",
            code: "#21191b",
            line: "#c7abb5",
            quote: "#ffc0a8",
            added: "#65d69e",
            deleted: "#ff7f73",
            sidebar_opacity: 0.70,
            panel_opacity: 0.62,
            blur: 20,
            radius: 16,
            shadow: "none",
            content_width: 760,
        },
        "preset-sky-light-study" => ComponentTheme {
            appearance: "dark",
            accent: "#75c8d5",
            sidebar: "#243032",
            surface: "#354043",
            raised: "#445052",
            code: "#172023",
            line: "#aebfc1",
            quote: "#ff9f7e",
            added: "#65d69e",
            deleted: "#ff7f73",
            sidebar_opacity: 0.70,
            panel_opacity: 0.62,
            blur: 16,
            radius: 12,
            shadow: "none",
            content_width: 720,
        },
        "preset-strata-forge" => ComponentTheme {
            appearance: "dark",
            accent: "#7ed8c5",
            sidebar: "#0b1013",
            surface: "#11171b",
            raised: "#152129",
            code: "#0c1418",
            line: "#4e6871",
            quote: "#f1aa6b",
            added: "#65d69e",
            deleted: "#ff7f73",
            sidebar_opacity: 0.88,
            panel_opacity: 0.78,
            blur: 18,
            radius: 12,
            shadow: "strong",
            content_width: 760,
        },
        "preset-sunlit-shore" => ComponentTheme {
            appearance: "dark",
            accent: "#78c9df",
            sidebar: "#25302f",
            surface: "#37413e",
            raised: "#46514c",
            code: "#17201f",
            line: "#aebbb4",
            quote: "#efb07d",
            added: "#65d69e",
            deleted: "#ff7f73",
            sidebar_opacity: 0.70,
            panel_opacity: 0.62,
            blur: 16,
            radius: 14,
            shadow: "none",
            content_width: 720,
        },
        "preset-yellow-gadgeteers" => ComponentTheme {
            appearance: "dark",
            accent: "#f2c94c",
            sidebar: "#0d1112",
            surface: "#161b1d",
            raised: "#222729",
            code: "#090c0d",
            line: "#6f6544",
            quote: "#48b9c1",
            added: "#64ce8d",
            deleted: "#f07062",
            sidebar_opacity: 0.92,
            panel_opacity: 0.84,
            blur: 12,
            radius: 10,
            shadow: "strong",
            content_width: 700,
        },
        _ => return None,
    })
}

fn apply_component_theme(manifest: &mut ThemeManifest) -> Result<()> {
    let theme = component_theme(&manifest.id)
        .ok_or_else(|| StudioError::from(format!("内置主题 {} 缺少组件适配", manifest.id)))?;
    let light = theme.appearance == "light";
    let border_opacity = if light { 0.44 } else { 0.36 };
    let raised_opacity = (theme.panel_opacity + 0.04).min(0.94);

    manifest.version = BUILTIN_THEME_VERSION.into();
    manifest.appearance = theme.appearance.into();
    manifest.palette.accent = theme.accent.into();
    manifest.composer = ComposerConfig {
        background: theme.surface.into(),
        opacity: theme.panel_opacity,
        blur: theme.blur,
        border_opacity,
        shadow: theme.shadow.into(),
        show_footer_backdrop: false,
    };
    manifest.environment = EnvironmentConfig {
        visible: true,
        background: theme.surface.into(),
        opacity: raised_opacity,
        blur: theme.blur,
        border_opacity,
        shadow: theme.shadow.into(),
        radius: theme.radius + 2,
    };
    manifest.change_summary = ChangeSummaryConfig {
        visible: true,
        background: theme.raised.into(),
        opacity: raised_opacity,
        blur: theme.blur.saturating_sub(4),
        border_opacity: border_opacity - 0.04,
        shadow: theme.shadow.into(),
        radius: theme.radius,
    };

    let mut ui = UiConfig::default();
    ui.sidebar.background = theme.sidebar.into();
    ui.sidebar.opacity = theme.sidebar_opacity;
    ui.sidebar.blur = theme.blur;
    ui.sidebar.border_opacity = border_opacity - 0.10;
    ui.header.background = theme.surface.into();
    ui.header.opacity = (theme.panel_opacity - 0.20).max(0.48);
    ui.header.blur = theme.blur;
    ui.header.border_opacity = border_opacity - 0.14;
    ui.user_bubble.background = theme.raised.into();
    ui.user_bubble.opacity = theme.panel_opacity;
    ui.user_bubble.blur = theme.blur.saturating_sub(4);
    ui.user_bubble.border_opacity = border_opacity;
    ui.user_bubble.shadow = theme.shadow.into();
    ui.user_bubble.radius = theme.radius + 4;
    ui.code_block.background = theme.code.into();
    ui.code_block.opacity = if light { 0.90 } else { 0.94 };
    ui.code_block.blur = theme.blur.saturating_sub(6);
    ui.code_block.border_opacity = border_opacity;
    ui.code_block.shadow = theme.shadow.into();
    ui.code_block.radius = theme.radius;
    ui.activity_card.background = theme.raised.into();
    ui.activity_card.opacity = raised_opacity;
    ui.activity_card.blur = theme.blur.saturating_sub(4);
    ui.activity_card.border_opacity = border_opacity - 0.04;
    ui.activity_card.shadow = theme.shadow.into();
    ui.activity_card.radius = theme.radius;
    ui.thread_rows.background = theme.accent.into();
    ui.thread_rows.opacity = if light { 0.03 } else { 0.02 };
    ui.thread_rows.hover_opacity = if light { 0.09 } else { 0.11 };
    ui.thread_rows.selected_opacity = if light { 0.14 } else { 0.18 };
    ui.thread_rows.radius = theme.radius.min(12);
    ui.summary_rows.background = theme.accent.into();
    ui.summary_rows.opacity = if light { 0.04 } else { 0.03 };
    ui.summary_rows.hover_opacity = if light { 0.10 } else { 0.12 };
    ui.summary_rows.selected_opacity = if light { 0.15 } else { 0.19 };
    ui.summary_rows.radius = theme.radius.min(12);
    ui.navigation_rail_opacity = if light { 0.56 } else { 0.64 };
    ui.scrollbar.color = theme.line.into();
    ui.scrollbar.opacity = if light { 0.46 } else { 0.42 };
    ui.scrollbar.width = 6;
    ui.scrollbar.radius = 6;
    ui.diff.background = theme.raised.into();
    ui.diff.opacity = if light { 0.34 } else { 0.22 };
    ui.diff.added_color = theme.added.into();
    ui.diff.deleted_color = theme.deleted.into();
    ui.diff.radius = theme.radius.min(8);
    ui.content.max_width = theme.content_width;
    ui.content.message_gap = if theme.radius >= 14 { 18 } else { 16 };
    ui.rich_text.link_color = theme.accent.into();
    ui.rich_text.inline_code_background = theme.code.into();
    ui.rich_text.inline_code_opacity = if light { 0.76 } else { 0.82 };
    ui.rich_text.inline_code_radius = theme.radius.min(8);
    ui.rich_text.quote_accent = theme.quote.into();
    ui.rich_text.quote_background = theme.raised.into();
    ui.rich_text.quote_opacity = if light { 0.46 } else { 0.32 };
    ui.rich_text.table_border = theme.line.into();
    ui.rich_text.table_background = theme.surface.into();
    ui.rich_text.table_opacity = if light { 0.62 } else { 0.48 };
    ui.rich_text.table_radius = theme.radius.min(10);
    ui.rich_text.image_radius = theme.radius;
    manifest.ui = ui;
    Ok(())
}

fn should_upgrade_builtin(current: &ThemeManifest, next: &ThemeManifest) -> bool {
    current.built_in && next.built_in && current.version != next.version
}

fn seed_manifest(manifest: ThemeManifest, bytes: &[u8]) -> Result<()> {
    let directory = theme_dir(&manifest.id)?;
    let manifest_path = directory.join("theme.json");
    if manifest_path.is_file() {
        let current = fs::read(&manifest_path)
            .ok()
            .and_then(|data| serde_json::from_slice::<ThemeManifest>(&data).ok());
        let should_upgrade =
            current.is_some_and(|current| should_upgrade_builtin(&current, &manifest));
        if !should_upgrade {
            return Ok(());
        }
    }
    fs::create_dir_all(&directory)?;
    fs::write(directory.join("background.jpg"), bytes)?;
    fs::write(directory.join("thumbnail.jpg"), make_thumbnail(bytes)?)?;
    write_manifest(&directory, &manifest)
}

fn builtin_manifest(
    id: &str,
    name: &str,
    accent: &str,
    focus_x: f64,
    safe_area: &str,
) -> Result<ThemeManifest> {
    let mut manifest = ThemeManifest {
        schema_version: 1,
        id: id.into(),
        name: name.into(),
        version: BUILTIN_THEME_VERSION.into(),
        author: "Fei-Away/Codex-Dream-Skin contributors".into(),
        image: "background.jpg".into(),
        thumbnail: "thumbnail.jpg".into(),
        appearance: "auto".into(),
        art: ArtConfig {
            focus_x,
            focus_y: if id == "preset-strata-forge" {
                0.48
            } else {
                0.45
            },
            safe_area: safe_area.into(),
            task_mode: "ambient".into(),
        },
        palette: Palette {
            accent: accent.into(),
        },
        composer: ComposerConfig::default(),
        environment: EnvironmentConfig::default(),
        change_summary: ChangeSummaryConfig::default(),
        ui: UiConfig::default(),
        built_in: true,
    };
    apply_component_theme(&mut manifest)?;
    Ok(manifest)
}

fn seed_one(
    id: &str,
    name: &str,
    accent: &str,
    bytes: &[u8],
    focus_x: f64,
    safe_area: &str,
) -> Result<()> {
    seed_manifest(
        builtin_manifest(id, name, accent, focus_x, safe_area)?,
        bytes,
    )
}

pub fn ensure_library() -> Result<()> {
    seed_one(
        "preset-alpine-lake",
        "云岭晨湖",
        "#69aebc",
        ALPINE_LAKE,
        0.8,
        "left",
    )?;
    seed_one(
        "preset-amber-dusk",
        "琥珀黄昏",
        "#ffb347",
        AMBER,
        0.5,
        "center",
    )?;
    seed_one(
        "preset-cyber-neon",
        "赛博霓虹",
        "#16e0ff",
        CYBER,
        0.5,
        "center",
    )?;
    seed_one(
        "preset-codex-observatory",
        "代码观测站",
        "#8ed8d5",
        CODEX_OBSERVATORY,
        0.82,
        "left",
    )?;
    seed_one(
        "preset-midnight-aurora",
        "午夜极光",
        "#2de1c2",
        AURORA,
        0.7,
        "left",
    )?;
    seed_one(
        "preset-forest-mist",
        "森野薄雾",
        "#65b895",
        FOREST,
        0.66,
        "left",
    )?;
    seed_one(
        "preset-harbor-city",
        "晨光海湾",
        "#49aeb5",
        HARBOR_CITY,
        0.78,
        "left",
    )?;
    seed_one(
        "preset-midnight-paper-observatory",
        "纸艺夜航",
        "#c89a4b",
        MIDNIGHT_PAPER_OBSERVATORY,
        0.8,
        "left",
    )?;
    seed_one(
        "preset-moonlit-alpine-lake",
        "月下云岭",
        "#7897b2",
        MOONLIT_ALPINE_LAKE,
        0.79,
        "left",
    )?;
    seed_one(
        "preset-paper-sky-workshop",
        "纸艺云端",
        "#4aa4b7",
        PAPER_SKY_WORKSHOP,
        0.79,
        "left",
    )?;
    seed_one(
        "preset-rainy-harbor",
        "雨夜海湾",
        "#438b96",
        RAINY_HARBOR,
        0.79,
        "left",
    )?;
    seed_one(
        "preset-romantic-rose",
        "桥本有菜",
        "#d86482",
        ROMANTIC,
        0.72,
        "left",
    )?;
    seed_one(
        "preset-sakura-dawn",
        "樱粉晨曦",
        "#f0607a",
        SAKURA,
        0.65,
        "left",
    )?;
    seed_one(
        "preset-sky-light-study",
        "天光书房",
        "#6fbfca",
        SKY_LIGHT_STUDY,
        0.79,
        "left",
    )?;
    seed_one(
        "preset-strata-forge",
        "叠境工坊",
        "#7ed8c5",
        STRATA_FORGE,
        0.81,
        "left",
    )?;
    seed_one(
        "preset-sunlit-shore",
        "晴日海岸",
        "#5baed1",
        SUNLIT_SHORE,
        0.79,
        "left",
    )?;
    seed_one(
        "preset-yellow-gadgeteers",
        "小黄人工坊",
        "#f2c94c",
        YELLOW_GADGETEERS,
        0.78,
        "left",
    )?;
    Ok(())
}

pub fn load_manifest(id: &str) -> Result<(ThemeManifest, PathBuf)> {
    let directory = theme_dir(id)?;
    let manifest: ThemeManifest = serde_json::from_slice(&fs::read(directory.join("theme.json"))?)?;
    validate_manifest(&manifest)?;
    if manifest.id != id {
        return Err(StudioError::from("主题目录与清单 ID 不一致"));
    }
    let image = directory.join(&manifest.image);
    let thumbnail = directory.join(&manifest.thumbnail);
    if image.parent() != Some(directory.as_path())
        || thumbnail.parent() != Some(directory.as_path())
        || !image.is_file()
        || !thumbnail.is_file()
    {
        return Err(StudioError::from("主题资源必须位于主题目录内"));
    }
    Ok((manifest, directory))
}

fn record_from(manifest: ThemeManifest, directory: &Path) -> Result<ThemeRecord> {
    let thumbnail = fs::read(directory.join(&manifest.thumbnail))?;
    Ok(ThemeRecord {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        appearance: manifest.appearance,
        accent: manifest.palette.accent,
        art: manifest.art,
        composer: manifest.composer,
        environment: manifest.environment,
        change_summary: manifest.change_summary,
        ui: manifest.ui,
        preview_data_url: format!("data:image/jpeg;base64,{}", STANDARD.encode(thumbnail)),
        built_in: manifest.built_in,
    })
}

pub fn list_themes() -> Result<Vec<ThemeRecord>> {
    ensure_library()?;
    let mut records = Vec::new();
    for entry in fs::read_dir(themes_root()?)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        if let Ok((manifest, directory)) = load_manifest(&id) {
            records.push(record_from(manifest, &directory)?);
        }
    }
    records.sort_by(|left, right| {
        right
            .built_in
            .cmp(&left.built_in)
            .then_with(|| left.name.cmp(&right.name))
    });
    Ok(records)
}

pub fn import_wallpaper(path: &str) -> Result<ThemeRecord> {
    let source = Path::new(path);
    if !source.is_file() {
        return Err(StudioError::from("请选择一个本地图片文件"));
    }
    let bytes = fs::read(source)?;
    let (format, _, _) = image_info(&bytes)?;
    let id = format!("custom-{}", Uuid::new_v4().simple());
    let directory = theme_dir(&id)?;
    fs::create_dir_all(&directory)?;
    let extension = extension_for(format);
    let image_name = format!("background.{extension}");
    fs::write(directory.join(&image_name), &bytes)?;
    fs::write(directory.join("thumbnail.jpg"), make_thumbnail(&bytes)?)?;
    let fallback_name = "自定义主题".to_string();
    let name = source
        .file_stem()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&fallback_name)
        .chars()
        .take(80)
        .collect();
    let manifest = ThemeManifest {
        schema_version: 1,
        id: id.clone(),
        name,
        version: "1.0.0".into(),
        author: "本地用户".into(),
        image: image_name,
        thumbnail: "thumbnail.jpg".into(),
        appearance: "auto".into(),
        art: ArtConfig::default(),
        palette: Palette::default(),
        composer: ComposerConfig::default(),
        environment: EnvironmentConfig::default(),
        change_summary: ChangeSummaryConfig::default(),
        ui: UiConfig::default(),
        built_in: false,
    };
    write_manifest(&directory, &manifest)?;
    record_from(manifest, &directory)
}

pub fn update_theme(
    id: &str,
    appearance: &str,
    art: ArtConfig,
    composer: ComposerConfig,
    environment: EnvironmentConfig,
    change_summary: ChangeSummaryConfig,
    ui: UiConfig,
) -> Result<()> {
    let (mut manifest, directory) = load_manifest(id)?;
    manifest.appearance = appearance.into();
    manifest.art = art;
    manifest.composer = composer;
    manifest.environment = environment;
    manifest.change_summary = change_summary;
    manifest.ui = ui;
    write_manifest(&directory, &manifest)
}

pub fn delete_theme(id: &str) -> Result<()> {
    let (manifest, directory) = load_manifest(id)?;
    if manifest.built_in {
        return Err(StudioError::from("内置主题不能删除"));
    }
    fs::remove_dir_all(directory)?;
    Ok(())
}

pub fn image_bytes(manifest: &ThemeManifest, directory: &Path) -> Result<Vec<u8>> {
    let bytes = fs::read(directory.join(&manifest.image))?;
    image_info(&bytes)?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::{
        ALPINE_LAKE, AMBER, AURORA, CODEX_OBSERVATORY, CYBER, FOREST, HARBOR_CITY, MAX_IMAGE_BYTES,
        MIDNIGHT_PAPER_OBSERVATORY, MOONLIT_ALPINE_LAKE, PAPER_SKY_WORKSHOP, RAINY_HARBOR,
        ROMANTIC, SAKURA, SKY_LIGHT_STUDY, STRATA_FORGE, SUNLIT_SHORE, YELLOW_GADGETEERS,
        builtin_manifest, image_info, should_upgrade_builtin, validate_manifest,
    };

    #[test]
    fn validates_bundled_image_and_rejects_invalid_payloads() {
        for bytes in [
            ALPINE_LAKE,
            AMBER,
            AURORA,
            CODEX_OBSERVATORY,
            CYBER,
            FOREST,
            HARBOR_CITY,
            MIDNIGHT_PAPER_OBSERVATORY,
            MOONLIT_ALPINE_LAKE,
            PAPER_SKY_WORKSHOP,
            RAINY_HARBOR,
            ROMANTIC,
            SAKURA,
            SKY_LIGHT_STUDY,
            STRATA_FORGE,
            SUNLIT_SHORE,
            YELLOW_GADGETEERS,
        ] {
            let (_, width, height) = image_info(bytes).expect("bundled image should validate");
            assert!(width > 0 && height > 0);
        }
        assert!(image_info(&[]).is_err());
        assert!(image_info(&vec![0; MAX_IMAGE_BYTES as usize + 1]).is_err());
    }

    #[test]
    fn validates_all_builtin_component_adaptations() {
        let themes = [
            ("preset-alpine-lake", "dark"),
            ("preset-amber-dusk", "dark"),
            ("preset-cyber-neon", "dark"),
            ("preset-codex-observatory", "dark"),
            ("preset-midnight-aurora", "dark"),
            ("preset-forest-mist", "dark"),
            ("preset-harbor-city", "dark"),
            ("preset-midnight-paper-observatory", "dark"),
            ("preset-moonlit-alpine-lake", "dark"),
            ("preset-paper-sky-workshop", "dark"),
            ("preset-rainy-harbor", "dark"),
            ("preset-romantic-rose", "dark"),
            ("preset-sakura-dawn", "dark"),
            ("preset-sky-light-study", "dark"),
            ("preset-strata-forge", "dark"),
            ("preset-sunlit-shore", "dark"),
            ("preset-yellow-gadgeteers", "dark"),
        ];
        for (id, appearance) in themes {
            let manifest = builtin_manifest(id, id, "#000000", 0.5, "left")
                .expect("every bundled theme should have a component adaptation");
            validate_manifest(&manifest).expect("adapted theme should validate");
            assert_eq!(manifest.version, "1.2.1");
            assert_eq!(manifest.appearance, appearance);
            assert_ne!(manifest.ui.sidebar.background, "auto");
            assert_ne!(manifest.ui.code_block.background, "auto");
            assert_ne!(manifest.ui.rich_text.link_color, "auto");
        }
    }

    #[test]
    fn upgrades_only_older_builtin_themes() {
        let next = builtin_manifest("preset-strata-forge", "叠境工坊", "#7ed8c5", 0.81, "left")
            .expect("strata forge defaults should validate");
        let mut old = next.clone();
        old.version = "1.0.0".into();
        assert!(should_upgrade_builtin(&old, &next));
        assert!(!should_upgrade_builtin(&next, &next));
        old.built_in = false;
        assert!(!should_upgrade_builtin(&old, &next));
    }
}
