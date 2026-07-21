use crate::{
    error::{Result, StudioError},
    models::{
        ArtConfig, ChangeSummaryConfig, ComposerConfig, EnvironmentConfig, LevelSliderConfig,
        Palette, SemanticTokens, ThemeManifest, ThemeRecord, UiConfig,
    },
    storage::{atomic_write, themes_root},
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{
    codecs::jpeg::JpegEncoder, imageops::FilterType, ImageFormat, ImageReader, Rgb, RgbImage,
};
use mp4::{MediaType, Mp4Reader, TrackType};
use std::{
    collections::HashSet,
    fs,
    io::{Cursor, Read, Seek, Write},
    path::{Path, PathBuf},
};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

const MAX_IMAGE_BYTES: u64 = 16 * 1024 * 1024;
const MAX_VIDEO_BYTES: u64 = 50 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS: u64 = 60;
const MAX_DIMENSION: u32 = 16_384;
const MAX_PIXELS: u64 = 50_000_000;
const THEME_BUNDLE_SCHEMA_VERSION: u32 = 1;
const THEME_BUNDLE_EXTENSION: &str = "codex-theme";
const THEME_BUNDLE_MANIFEST: &str = "bundle.json";
const MAX_THEME_BUNDLE_BYTES: u64 = MAX_VIDEO_BYTES + 256 * 1024;
const MAX_THEME_BUNDLE_MANIFEST_BYTES: u64 = 128 * 1024;
const MAX_THEME_BUNDLE_UNCOMPRESSED_BYTES: u64 = MAX_VIDEO_BYTES + MAX_THEME_BUNDLE_MANIFEST_BYTES;
const MAX_THUMBNAIL_BYTES: usize = 2 * 1024 * 1024;
const BUILTIN_THEME_VERSION: &str = "1.3.3";
const BAMBOO_SKYLIGHT: &[u8] = include_bytes!("../assets/preset-bamboo-skylight.jpg");
const WILDERNESS: &[u8] = include_bytes!("../assets/preset-wilderness.mp4");
const RETIRED_BUILTIN_THEME_IDS: &[&str] = &[
    "custom-9fc18f212a8a435289954b8792efc538",
    "custom-a92f80151e1a4b38bdb2c80159ed459b",
    "custom-3e0ddebbad5c409eb4dd872eece571ee",
    "custom-11fd656b9d7f435186c707331bdde58f",
];

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThemeBundle {
    schema_version: u32,
    background: String,
    theme: ThemeBundleConfig,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThemeBundleConfig {
    name: String,
    version: String,
    author: String,
    appearance: String,
    #[serde(default)]
    background_kind: String,
    art: ArtConfig,
    palette: Palette,
    #[serde(default)]
    level_slider: LevelSliderConfig,
    #[serde(default)]
    composer: ComposerConfig,
    #[serde(default)]
    environment: EnvironmentConfig,
    #[serde(default)]
    change_summary: ChangeSummaryConfig,
    #[serde(default)]
    tokens: SemanticTokens,
    #[serde(default)]
    ui: UiConfig,
}

impl ThemeBundle {
    fn from_manifest(manifest: &ThemeManifest, background: String) -> Self {
        Self {
            schema_version: THEME_BUNDLE_SCHEMA_VERSION,
            background,
            theme: ThemeBundleConfig {
                name: manifest.name.clone(),
                version: manifest.version.clone(),
                author: manifest.author.clone(),
                appearance: manifest.appearance.clone(),
                background_kind: manifest.background_kind.clone(),
                art: manifest.art.clone(),
                palette: manifest.palette.clone(),
                level_slider: manifest.level_slider.clone(),
                composer: manifest.composer.clone(),
                environment: manifest.environment.clone(),
                change_summary: manifest.change_summary.clone(),
                tokens: manifest.tokens.clone(),
                ui: manifest.ui.clone(),
            },
        }
    }

    fn into_manifest(self, id: String, image: String) -> ThemeManifest {
        ThemeManifest {
            schema_version: 1,
            id,
            name: self.theme.name,
            version: self.theme.version,
            author: self.theme.author,
            image,
            background_kind: self.theme.background_kind,
            thumbnail: "thumbnail.jpg".into(),
            appearance: self.theme.appearance,
            art: self.theme.art,
            palette: self.theme.palette,
            level_slider: self.theme.level_slider,
            composer: self.theme.composer,
            environment: self.theme.environment,
            change_summary: self.theme.change_summary,
            tokens: self.theme.tokens,
            ui: self.theme.ui,
            built_in: false,
        }
    }
}

struct ImportedThemeBundle {
    bundle: ThemeBundle,
    image_name: String,
    image_bytes: Vec<u8>,
}

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
    for (label, color) in [
        ("输入框背景", &composer.background),
        ("输入框占位文字", &composer.placeholder_color),
        ("输入框控件", &composer.control_color),
        ("输入框主操作", &composer.primary_action_color),
        ("输入框主操作文字", &composer.primary_action_text),
    ] {
        if color != "auto" && !valid_hex_color(color) {
            return Err(StudioError::from(format!(
                "{label}颜色必须为自动或十六进制颜色"
            )));
        }
    }
    if !(0.0..=1.0).contains(&composer.opacity)
        || !(0.0..=1.0).contains(&composer.border_opacity)
        || !(0.0..=1.0).contains(&composer.control_opacity)
    {
        return Err(StudioError::from("输入框透明度必须位于 0 到 1 之间"));
    }
    if composer.blur > 32 || !(8..=32).contains(&composer.radius) || composer.control_radius > 24 {
        return Err(StudioError::from("输入框模糊或圆角参数无效"));
    }
    if !["none", "soft", "strong"].contains(&composer.shadow.as_str()) {
        return Err(StudioError::from("输入框阴影设置无效"));
    }
    Ok(())
}

fn validate_level_slider(level_slider: &LevelSliderConfig) -> Result<()> {
    if level_slider
        .level_colors
        .iter()
        .any(|color| !valid_hex_color(color))
    {
        return Err(StudioError::from("级别滑块的级别颜色必须为十六进制颜色"));
    }
    if !valid_hex_color(&level_slider.thumb_color) {
        return Err(StudioError::from("级别滑块拖块颜色必须为十六进制颜色"));
    }
    Ok(())
}

fn validate_tokens(tokens: &SemanticTokens) -> Result<()> {
    for (label, color) in [
        ("主文字", &tokens.text_primary),
        ("次级文字", &tokens.text_secondary),
        ("弱化文字", &tokens.text_muted),
        ("禁用文字", &tokens.text_disabled),
        ("反色文字", &tokens.text_inverse),
        ("语义边框", &tokens.border),
        ("焦点环", &tokens.focus_ring),
        ("成功状态", &tokens.success),
        ("警告状态", &tokens.warning),
        ("危险状态", &tokens.danger),
    ] {
        if color != "auto" && !valid_hex_color(color) {
            return Err(StudioError::from(format!(
                "{label}颜色必须为自动或十六进制颜色"
            )));
        }
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
        ("主页建议卡片", &ui.home_suggestions),
        ("弹层与菜单", &ui.overlays),
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
        || !(0.0..=1.0).contains(&ui.diff.hover_opacity)
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
    if !valid_hex_color(&manifest.palette.accent) {
        return Err(StudioError::from("主题强调色必须为十六进制颜色"));
    }
    background_kind(manifest)?;
    validate_art(&manifest.art)?;
    validate_level_slider(&manifest.level_slider)?;
    validate_composer(&manifest.composer)?;
    validate_environment(&manifest.environment)?;
    validate_change_summary(&manifest.change_summary)?;
    validate_tokens(&manifest.tokens)?;
    validate_ui(&manifest.ui)
}

fn background_kind(manifest: &ThemeManifest) -> Result<&'static str> {
    match manifest.background_kind.as_str() {
        "" | "image" => Ok("image"),
        "video" => Ok("video"),
        _ => Err(StudioError::from("背景类型必须是图片或视频")),
    }
}

fn background_kind_for_bundle(value: &str) -> Result<&'static str> {
    match value {
        "" | "image" => Ok("image"),
        "video" => Ok("video"),
        _ => Err(bundle_error("背景类型必须是图片或视频")),
    }
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

fn video_info(bytes: &[u8]) -> Result<(u16, u16)> {
    if bytes.is_empty() || bytes.len() as u64 > MAX_VIDEO_BYTES {
        return Err(StudioError::from("背景视频必须小于 50 MB"));
    }
    let reader = Mp4Reader::read_header(Cursor::new(bytes), bytes.len() as u64)
        .map_err(|_| StudioError::from("无法读取 MP4 视频"))?;
    if reader.duration().as_millis() > u128::from(MAX_VIDEO_DURATION_SECONDS) * 1_000 {
        return Err(StudioError::from("背景视频最长为 60 秒"));
    }
    let track = reader
        .tracks()
        .values()
        .find(|track| matches!(track.track_type(), Ok(TrackType::Video)))
        .ok_or_else(|| StudioError::from("MP4 文件不包含视频轨道"))?;
    if !matches!(track.media_type(), Ok(MediaType::H264)) {
        return Err(StudioError::from("背景视频只支持 H.264 编码的 MP4"));
    }
    let (width, height) = (track.width(), track.height());
    if width == 0 || height == 0 {
        return Err(StudioError::from("视频尺寸无效"));
    }
    Ok((width, height))
}

fn background_info(kind: &str, bytes: &[u8]) -> Result<()> {
    match kind {
        "image" => image_info(bytes).map(|_| ()),
        "video" => video_info(bytes).map(|_| ()),
        _ => Err(StudioError::from("背景类型必须是图片或视频")),
    }
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

fn make_video_thumbnail() -> Result<Vec<u8>> {
    let mut image = RgbImage::from_pixel(640, 360, Rgb([15, 23, 42]));
    for (x, y, pixel) in image.enumerate_pixels_mut() {
        let glow = ((x / 8 + y / 12) % 36) as u8;
        *pixel = Rgb([15 + glow / 3, 23 + glow / 2, 42 + glow]);
    }
    let mut output = Vec::new();
    JpegEncoder::new_with_quality(&mut output, 84).encode_image(&image)?;
    Ok(output)
}

fn make_background_thumbnail(kind: &str, bytes: &[u8]) -> Result<Vec<u8>> {
    match kind {
        "image" => make_thumbnail(bytes),
        "video" => make_video_thumbnail(),
        _ => Err(StudioError::from("背景类型必须是图片或视频")),
    }
}

fn write_manifest(directory: &Path, manifest: &ThemeManifest) -> Result<()> {
    validate_manifest(manifest)?;
    atomic_write(
        &directory.join("theme.json"),
        format!("{}\n", serde_json::to_string_pretty(manifest)?).as_bytes(),
    )
}

fn bundle_error(error: impl std::fmt::Display) -> StudioError {
    StudioError::from(format!("主题包无效：{error}"))
}

fn is_flat_bundle_file(name: &str) -> bool {
    !name.is_empty()
        && !name.contains(['/', '\\'])
        && Path::new(name)
            .file_name()
            .is_some_and(|file_name| file_name == name)
}

fn bundle_background_name(format: ImageFormat) -> String {
    format!("background.{}", extension_for(format))
}

fn bundle_video_name() -> String {
    "background.mp4".into()
}

fn read_bundle_entry<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    name: &str,
    maximum_size: u64,
) -> Result<Vec<u8>> {
    let mut entry = archive
        .by_name(name)
        .map_err(|error| bundle_error(format!("缺少 {name}：{error}")))?;
    if entry.is_dir() || entry.size() > maximum_size {
        return Err(bundle_error(format!("{name} 超出允许范围")));
    }
    let mut bytes = Vec::with_capacity(entry.size() as usize);
    entry
        .by_ref()
        .take(maximum_size.saturating_add(1))
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > maximum_size {
        return Err(bundle_error(format!("{name} 超出允许范围")));
    }
    Ok(bytes)
}

fn encode_theme_bundle(manifest: &ThemeManifest, image: &[u8]) -> Result<Vec<u8>> {
    validate_manifest(manifest)?;
    let kind = background_kind(manifest)?;
    background_info(kind, image)?;
    let background = match kind {
        "image" => bundle_background_name(image_info(image)?.0),
        "video" => bundle_video_name(),
        _ => unreachable!(),
    };
    let bundle = ThemeBundle::from_manifest(manifest, background.clone());
    let manifest_bytes = serde_json::to_vec_pretty(&bundle)?;
    if manifest_bytes.len() as u64 > MAX_THEME_BUNDLE_MANIFEST_BYTES {
        return Err(bundle_error("主题配置过大"));
    }

    let cursor = Cursor::new(Vec::new());
    let mut writer = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    writer
        .start_file(THEME_BUNDLE_MANIFEST, options)
        .map_err(bundle_error)?;
    writer.write_all(&manifest_bytes)?;
    writer
        .start_file(background, options)
        .map_err(bundle_error)?;
    writer.write_all(image)?;
    let output = writer.finish().map_err(bundle_error)?.into_inner();
    if output.len() as u64 > MAX_THEME_BUNDLE_BYTES {
        return Err(bundle_error("主题包超过 50 MB 限制"));
    }
    Ok(output)
}

fn decode_theme_bundle(bytes: &[u8]) -> Result<ImportedThemeBundle> {
    if bytes.is_empty() || bytes.len() as u64 > MAX_THEME_BUNDLE_BYTES {
        return Err(bundle_error("主题包必须小于 50 MB"));
    }
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(bundle_error)?;
    if archive.len() != 2 {
        return Err(bundle_error("主题包只能包含配置和一张背景图片"));
    }

    let mut names = HashSet::new();
    let mut uncompressed_size = 0_u64;
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(bundle_error)?;
        let name = entry.name();
        if entry.is_dir() || !is_flat_bundle_file(name) || !names.insert(name.to_owned()) {
            return Err(bundle_error("主题包包含不安全或重复的文件名"));
        }
        uncompressed_size = uncompressed_size
            .checked_add(entry.size())
            .ok_or_else(|| bundle_error("主题包内容过大"))?;
        if uncompressed_size > MAX_THEME_BUNDLE_UNCOMPRESSED_BYTES {
            return Err(bundle_error("主题包解压后超过允许大小"));
        }
    }

    let manifest_bytes = read_bundle_entry(
        &mut archive,
        THEME_BUNDLE_MANIFEST,
        MAX_THEME_BUNDLE_MANIFEST_BYTES,
    )?;
    let bundle: ThemeBundle = serde_json::from_slice(&manifest_bytes)?;
    if bundle.schema_version != THEME_BUNDLE_SCHEMA_VERSION {
        return Err(bundle_error("不支持的主题包版本"));
    }
    if !is_flat_bundle_file(&bundle.background) || bundle.background == THEME_BUNDLE_MANIFEST {
        return Err(bundle_error("背景文件名无效"));
    }
    if !names.contains(THEME_BUNDLE_MANIFEST)
        || !names.contains(&bundle.background)
        || names.len() != 2
    {
        return Err(bundle_error("主题包文件与配置不一致"));
    }

    let kind = background_kind_for_bundle(&bundle.theme.background_kind)?;
    let image_bytes = read_bundle_entry(
        &mut archive,
        &bundle.background,
        if kind == "video" {
            MAX_VIDEO_BYTES
        } else {
            MAX_IMAGE_BYTES
        },
    )?;
    background_info(kind, &image_bytes)?;
    let image_name = match kind {
        "image" => bundle_background_name(image_info(&image_bytes)?.0),
        "video" => bundle_video_name(),
        _ => unreachable!(),
    };
    if bundle.background != image_name {
        return Err(bundle_error("背景文件扩展名与图片格式不一致"));
    }
    validate_manifest(
        &bundle
            .clone()
            .into_manifest("bundle-validation".into(), image_name.clone()),
    )?;

    Ok(ImportedThemeBundle {
        bundle,
        image_name,
        image_bytes,
    })
}

fn validate_theme_bundle_path(path: &Path) -> Result<()> {
    if path.file_name().is_none()
        || path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_none_or(|extension| !extension.eq_ignore_ascii_case(THEME_BUNDLE_EXTENSION))
    {
        return Err(StudioError::from("主题包文件必须使用 .codex-theme 扩展名"));
    }
    if path.is_dir() {
        return Err(StudioError::from("主题包路径不能是目录"));
    }
    Ok(())
}

fn install_theme_bundle_with_id(
    root: &Path,
    imported: ImportedThemeBundle,
    id: String,
) -> Result<ThemeRecord> {
    let directory = root.join(&id);
    let temporary = root.join(format!(".studio-import-{}", Uuid::new_v4()));
    let backup = root.join(format!(".studio-backup-{}", Uuid::new_v4()));
    let result = (|| {
        fs::create_dir_all(&temporary)?;
        let manifest = imported.bundle.into_manifest(id, imported.image_name);
        fs::write(temporary.join(&manifest.image), imported.image_bytes)?;
        fs::write(
            temporary.join(&manifest.thumbnail),
            make_background_thumbnail(
                background_kind(&manifest)?,
                &fs::read(temporary.join(&manifest.image))?,
            )?,
        )?;
        write_manifest(&temporary, &manifest)?;
        if directory.exists() {
            fs::rename(&directory, &backup)?;
        }
        fs::rename(&temporary, &directory)?;
        if backup.exists() {
            let _ = fs::remove_dir_all(&backup);
        }
        record_from(manifest, &directory)
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(temporary);
        if backup.exists() && !directory.exists() {
            let _ = fs::rename(backup, directory);
        }
    }
    result
}

fn install_theme_bundle(root: &Path, imported: ImportedThemeBundle) -> Result<ThemeRecord> {
    install_theme_bundle_with_id(
        root,
        imported,
        format!("custom-{}", Uuid::new_v4().simple()),
    )
}

#[cfg(test)]
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

#[cfg(test)]
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
        "preset-tidal-signal" => ComponentTheme {
            appearance: "dark",
            accent: "#72d6cf",
            sidebar: "#07151d",
            surface: "#0d2229",
            raised: "#12343a",
            code: "#061016",
            line: "#3f7478",
            quote: "#d49a5d",
            added: "#72d6a0",
            deleted: "#ef786e",
            sidebar_opacity: 0.94,
            panel_opacity: 0.84,
            blur: 18,
            radius: 12,
            shadow: "strong",
            content_width: 760,
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
        "preset-riso-spring-stream" => ComponentTheme {
            appearance: "dark",
            accent: "#9bd66f",
            sidebar: "#1b3027",
            surface: "#263e34",
            raised: "#355247",
            code: "#12251e",
            line: "#82a493",
            quote: "#f0afa8",
            added: "#75d292",
            deleted: "#f08078",
            sidebar_opacity: 0.92,
            panel_opacity: 0.84,
            blur: 14,
            radius: 16,
            shadow: "strong",
            content_width: 740,
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
        "preset-windrest-cloud-house" => ComponentTheme {
            appearance: "dark",
            accent: "#e2b35f",
            sidebar: "#101a16",
            surface: "#18241f",
            raised: "#24342b",
            code: "#0a1210",
            line: "#668076",
            quote: "#8fc3c6",
            added: "#70cf96",
            deleted: "#ef7e70",
            sidebar_opacity: 0.92,
            panel_opacity: 0.84,
            blur: 16,
            radius: 14,
            shadow: "strong",
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

#[cfg(test)]
fn apply_component_theme(manifest: &mut ThemeManifest) -> Result<()> {
    let theme = component_theme(&manifest.id)
        .ok_or_else(|| StudioError::from(format!("内置主题 {} 缺少组件适配", manifest.id)))?;
    let light = theme.appearance == "light";
    let border_opacity = if light { 0.44 } else { 0.36 };
    let raised_opacity = (theme.panel_opacity + 0.04).min(0.94);

    manifest.version = BUILTIN_THEME_VERSION.into();
    manifest.appearance = theme.appearance.into();
    manifest.palette.accent = theme.accent.into();
    manifest.level_slider = LevelSliderConfig::default();
    manifest.composer = ComposerConfig {
        background: theme.surface.into(),
        opacity: theme.panel_opacity,
        blur: theme.blur,
        border_opacity,
        shadow: theme.shadow.into(),
        show_footer_backdrop: false,
        ..ComposerConfig::default()
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
    manifest.tokens = SemanticTokens {
        text_primary: if light { "#172033" } else { "#f4f4f5" }.into(),
        text_secondary: if light { "#334155" } else { "#d4d4d8" }.into(),
        text_muted: if light { "#526174" } else { "#b8c0ca" }.into(),
        text_disabled: if light { "#8a96a8" } else { "#6f7885" }.into(),
        text_inverse: if light { "#ffffff" } else { "#101318" }.into(),
        border: theme.line.into(),
        focus_ring: theme.accent.into(),
        success: theme.added.into(),
        warning: "#f6b73c".into(),
        danger: theme.deleted.into(),
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
    ui.home_suggestions.background = theme.raised.into();
    ui.home_suggestions.opacity = raised_opacity;
    ui.home_suggestions.blur = theme.blur.saturating_sub(2);
    ui.home_suggestions.border_opacity = border_opacity;
    ui.home_suggestions.shadow = theme.shadow.into();
    ui.home_suggestions.radius = (theme.radius + 4).min(32);
    ui.overlays.background = theme.surface.into();
    ui.overlays.opacity = raised_opacity;
    ui.overlays.blur = theme.blur;
    ui.overlays.border_opacity = border_opacity;
    ui.overlays.shadow = theme.shadow.into();
    ui.overlays.radius = theme.radius;
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
    ui.diff.hover_opacity = if light { 0.46 } else { 0.34 };
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

fn replace_builtin_theme(root: &Path, manifest: ThemeManifest, bytes: &[u8]) -> Result<()> {
    validate_manifest(&manifest)?;
    let kind = background_kind(&manifest)?;
    background_info(kind, bytes)?;

    let directory = root.join(&manifest.id);
    let temporary = root.join(format!(".studio-builtin-{}", Uuid::new_v4()));
    let backup = root.join(format!(".studio-builtin-backup-{}", Uuid::new_v4()));
    let result = (|| {
        fs::create_dir_all(&temporary)?;
        fs::write(temporary.join(&manifest.image), bytes)?;
        fs::write(
            temporary.join(&manifest.thumbnail),
            make_background_thumbnail(kind, bytes)?,
        )?;
        write_manifest(&temporary, &manifest)?;
        if directory.exists() {
            fs::rename(&directory, &backup)?;
        }
        fs::rename(&temporary, &directory)?;
        if backup.exists() {
            let _ = fs::remove_dir_all(&backup);
        }
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(&temporary);
        if backup.exists() && !directory.exists() {
            let _ = fs::rename(&backup, &directory);
        }
    }
    result
}

fn seed_manifest(manifest: ThemeManifest, bytes: &[u8]) -> Result<()> {
    let root = themes_root()?;
    let directory = root.join(&manifest.id);
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
    replace_builtin_theme(&root, manifest, bytes)
}

#[cfg(test)]
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
        background_kind: "image".into(),
        thumbnail: "thumbnail.jpg".into(),
        appearance: "dark".into(),
        art: ArtConfig {
            focus_x,
            focus_y: match id {
                "preset-riso-spring-stream" => 0.52,
                "preset-strata-forge" => 0.48,
                "preset-windrest-cloud-house" => 0.47,
                _ => 0.45,
            },
            safe_area: safe_area.into(),
            task_mode: "ambient".into(),
        },
        palette: Palette {
            accent: accent.into(),
        },
        level_slider: LevelSliderConfig::default(),
        composer: ComposerConfig::default(),
        environment: EnvironmentConfig::default(),
        change_summary: ChangeSummaryConfig::default(),
        tokens: SemanticTokens::default(),
        ui: UiConfig::default(),
        built_in: true,
    };
    apply_component_theme(&mut manifest)?;
    Ok(manifest)
}

fn default_builtin_manifest(id: &str, name: &str) -> ThemeManifest {
    ThemeManifest {
        schema_version: 1,
        id: id.into(),
        name: name.into(),
        version: BUILTIN_THEME_VERSION.into(),
        author: "Codex Skin Studio contributors".into(),
        image: "background.jpg".into(),
        background_kind: "image".into(),
        thumbnail: "thumbnail.jpg".into(),
        appearance: "dark".into(),
        art: ArtConfig::default(),
        palette: Palette::default(),
        level_slider: LevelSliderConfig::default(),
        composer: ComposerConfig::default(),
        environment: EnvironmentConfig::default(),
        change_summary: ChangeSummaryConfig::default(),
        tokens: SemanticTokens::default(),
        ui: UiConfig::default(),
        built_in: true,
    }
}

fn bamboo_skylight_manifest() -> ThemeManifest {
    default_builtin_manifest("custom-da9d3b18bf414ac0be12f0080b94f041", "竹影天光")
}

fn wilderness_manifest() -> ThemeManifest {
    let mut manifest = default_builtin_manifest("preset-wilderness", "旷野");
    manifest.author = "哲风壁纸".into();
    manifest.image = "background.mp4".into();
    manifest.background_kind = "video".into();
    manifest.art.focus_x = 0.68;
    manifest
}

fn builtin_theme(id: &str) -> Option<(ThemeManifest, &'static [u8])> {
    match id {
        "custom-da9d3b18bf414ac0be12f0080b94f041" => {
            Some((bamboo_skylight_manifest(), BAMBOO_SKYLIGHT))
        }
        "preset-wilderness" => Some((wilderness_manifest(), WILDERNESS)),
        _ => None,
    }
}

fn remove_retired_builtin_themes(root: &Path) -> Result<()> {
    for id in RETIRED_BUILTIN_THEME_IDS {
        let directory = root.join(id);
        let manifest_path = directory.join("theme.json");
        let is_retired_builtin = fs::read(&manifest_path)
            .ok()
            .and_then(|data| serde_json::from_slice::<ThemeManifest>(&data).ok())
            .is_some_and(|manifest| manifest.built_in);
        if is_retired_builtin {
            fs::remove_dir_all(directory)?;
        }
    }
    Ok(())
}

pub fn ensure_library() -> Result<()> {
    remove_retired_builtin_themes(&themes_root()?)?;
    for id in [
        "custom-da9d3b18bf414ac0be12f0080b94f041",
        "preset-wilderness",
    ] {
        let (manifest, bytes) =
            builtin_theme(id).expect("built-in theme registry must contain seeded ID");
        seed_manifest(manifest, bytes)?;
    }
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
    let background_kind = background_kind(&manifest)?.into();
    let background_path = (background_kind == "video").then(|| {
        directory
            .join(&manifest.image)
            .to_string_lossy()
            .into_owned()
    });
    Ok(ThemeRecord {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        appearance: manifest.appearance,
        accent: manifest.palette.accent,
        level_slider: manifest.level_slider,
        art: manifest.art,
        composer: manifest.composer,
        environment: manifest.environment,
        change_summary: manifest.change_summary,
        tokens: manifest.tokens,
        ui: manifest.ui,
        background_kind,
        preview_data_url: format!("data:image/jpeg;base64,{}", STANDARD.encode(thumbnail)),
        background_path,
        built_in: manifest.built_in,
    })
}

pub fn save_video_thumbnail(id: &str, thumbnail_data_url: &str) -> Result<()> {
    let (_, encoded) = thumbnail_data_url
        .split_once(',')
        .filter(|(prefix, _)| *prefix == "data:image/jpeg;base64")
        .ok_or_else(|| StudioError::from("视频预览格式无效"))?;
    if encoded.len() > MAX_THUMBNAIL_BYTES * 2 {
        return Err(StudioError::from("视频预览图过大"));
    }
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| StudioError::from("视频预览图无法解码"))?;
    if bytes.len() > MAX_THUMBNAIL_BYTES {
        return Err(StudioError::from("视频预览图过大"));
    }
    image_info(&bytes)?;

    let (manifest, directory) = load_manifest(id)?;
    if background_kind(&manifest)? != "video" {
        return Err(StudioError::from("只有视频背景可以更新预览图"));
    }
    atomic_write(
        &directory.join(&manifest.thumbnail),
        &make_thumbnail(&bytes)?,
    )
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

pub fn export_theme(id: &str, path: &str) -> Result<()> {
    let output = Path::new(path);
    validate_theme_bundle_path(output)?;
    let (manifest, directory) = load_manifest(id)?;
    let image = image_bytes(&manifest, &directory)?;
    atomic_write(output, &encode_theme_bundle(&manifest, &image)?)
}

pub fn import_theme_bundle(path: &str) -> Result<ThemeRecord> {
    let source = Path::new(path);
    validate_theme_bundle_path(source)?;
    let metadata = fs::metadata(source)?;
    if !metadata.is_file() {
        return Err(StudioError::from("请选择一个主题包文件"));
    }
    if metadata.len() > MAX_THEME_BUNDLE_BYTES {
        return Err(bundle_error("主题包必须小于 16 MB"));
    }
    let imported = decode_theme_bundle(&fs::read(source)?)?;
    install_theme_bundle(&themes_root()?, imported)
}

pub fn import_theme_bundle_bytes(bytes: &[u8]) -> Result<ThemeRecord> {
    install_theme_bundle(&themes_root()?, decode_theme_bundle(bytes)?)
}

pub fn replace_theme_bundle(id: &str, bytes: &[u8]) -> Result<ThemeRecord> {
    let (current, _) = load_manifest(id)?;
    if current.built_in {
        return Err(StudioError::from("内置主题不能由主题商店更新"));
    }
    install_theme_bundle_with_id(&themes_root()?, decode_theme_bundle(bytes)?, id.into())
}

pub fn import_wallpaper(path: &str) -> Result<ThemeRecord> {
    let source = Path::new(path);
    if !source.is_file() {
        return Err(StudioError::from("请选择一个本地图片或 MP4 视频文件"));
    }
    let bytes = fs::read(source)?;
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let (background_kind, image_name) = match extension.as_str() {
        "mp4" => {
            video_info(&bytes)?;
            ("video", "background.mp4".into())
        }
        _ => {
            let (format, _, _) = image_info(&bytes)?;
            let extension = extension_for(format);
            ("image", format!("background.{extension}"))
        }
    };
    let id = format!("custom-{}", Uuid::new_v4().simple());
    let directory = theme_dir(&id)?;
    fs::create_dir_all(&directory)?;
    fs::write(directory.join(&image_name), &bytes)?;
    fs::write(
        directory.join("thumbnail.jpg"),
        make_background_thumbnail(background_kind, &bytes)?,
    )?;
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
        background_kind: background_kind.into(),
        thumbnail: "thumbnail.jpg".into(),
        appearance: "dark".into(),
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
    write_manifest(&directory, &manifest)?;
    record_from(manifest, &directory)
}

pub fn update_theme(
    id: &str,
    appearance: &str,
    art: ArtConfig,
    level_slider: LevelSliderConfig,
    composer: ComposerConfig,
    environment: EnvironmentConfig,
    change_summary: ChangeSummaryConfig,
    tokens: SemanticTokens,
    ui: UiConfig,
) -> Result<()> {
    let (mut manifest, directory) = load_manifest(id)?;
    manifest.appearance = appearance.into();
    manifest.art = art;
    manifest.level_slider = level_slider;
    manifest.composer = composer;
    manifest.environment = environment;
    manifest.change_summary = change_summary;
    manifest.tokens = tokens;
    manifest.ui = ui;
    write_manifest(&directory, &manifest)
}

pub fn restore_builtin_theme(id: &str) -> Result<()> {
    let (manifest, bytes) =
        builtin_theme(id).ok_or_else(|| StudioError::from("只能恢复内置主题"))?;
    replace_builtin_theme(&themes_root()?, manifest, bytes)
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
    background_info(background_kind(manifest)?, &bytes)?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::{
        background_kind, bamboo_skylight_manifest, builtin_manifest, builtin_theme,
        decode_theme_bundle, encode_theme_bundle, image_info, install_theme_bundle,
        replace_builtin_theme, should_upgrade_builtin, validate_manifest, video_info,
        wilderness_manifest, ThemeBundle, BAMBOO_SKYLIGHT, BUILTIN_THEME_VERSION, MAX_IMAGE_BYTES,
        WILDERNESS,
    };
    use crate::models::ThemeManifest;

    #[test]
    fn legacy_themes_default_to_image_backgrounds_and_video_themes_are_recognized() {
        let mut manifest = bamboo_skylight_manifest();
        manifest.background_kind.clear();
        assert_eq!(background_kind(&manifest).unwrap(), "image");

        manifest.background_kind = "video".into();
        manifest.image = "background.mp4".into();
        assert_eq!(background_kind(&manifest).unwrap(), "video");
    }

    #[test]
    fn bamboo_skylight_is_a_protected_builtin_theme() {
        let manifest = bamboo_skylight_manifest();
        assert!(manifest.built_in);
        assert_eq!(manifest.name, "竹影天光");
        assert_eq!(manifest.composer.opacity, 0.2);
        assert_eq!(manifest.ui.diff.background, "#ffffff");
    }

    #[test]
    fn wilderness_is_a_protected_builtin_video_theme() {
        let manifest = wilderness_manifest();
        assert!(manifest.built_in);
        assert_eq!(manifest.name, "旷野");
        assert_eq!(manifest.author, "哲风壁纸");
        assert_eq!(manifest.background_kind, "video");
        assert_eq!(manifest.image, "background.mp4");
    }

    #[test]
    fn builtin_registry_contains_only_bamboo_skylight_and_wilderness() {
        assert!(builtin_theme("custom-da9d3b18bf414ac0be12f0080b94f041").is_some());
        assert!(builtin_theme("preset-wilderness").is_some());
        assert!(builtin_theme("custom-9fc18f212a8a435289954b8792efc538").is_none());
        assert!(builtin_theme("custom-a92f80151e1a4b38bdb2c80159ed459b").is_none());
        assert!(builtin_theme("custom-3e0ddebbad5c409eb4dd872eece571ee").is_none());
        assert!(builtin_theme("custom-11fd656b9d7f435186c707331bdde58f").is_none());
    }

    #[test]
    fn builtin_wilderness_writes_a_video_background_and_thumbnail() {
        let (manifest, background) =
            builtin_theme("preset-wilderness").expect("wilderness should be registered");
        let root =
            std::env::temp_dir().join(format!("skin-studio-video-builtin-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("test theme root should be created");

        replace_builtin_theme(&root, manifest.clone(), background)
            .expect("video built-in theme should be written");
        let directory = root.join(&manifest.id);
        assert_eq!(
            fs::read(directory.join("background.mp4")).expect("video background should exist"),
            background,
        );
        assert!(directory.join("thumbnail.jpg").is_file());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn restoring_builtin_theme_replaces_user_configuration_and_background() {
        let (manifest, background) = builtin_theme("custom-da9d3b18bf414ac0be12f0080b94f041")
            .expect("bamboo skylight should be registered as a built-in theme");
        let root =
            std::env::temp_dir().join(format!("skin-studio-builtin-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("test theme root should be created");

        replace_builtin_theme(&root, manifest.clone(), background)
            .expect("initial built-in theme should be written");
        let directory = root.join(&manifest.id);
        let mut modified: ThemeManifest = serde_json::from_slice(
            &fs::read(directory.join("theme.json")).expect("seeded manifest should exist"),
        )
        .expect("seeded manifest should deserialize");
        modified.composer.opacity = 0.91;
        fs::write(
            directory.join("theme.json"),
            serde_json::to_vec_pretty(&modified).expect("modified manifest should serialize"),
        )
        .expect("modified manifest should be written");
        fs::write(directory.join("background.jpg"), b"changed background")
            .expect("modified background should be written");

        replace_builtin_theme(&root, manifest.clone(), background)
            .expect("built-in theme should be restored");
        let restored: ThemeManifest = serde_json::from_slice(
            &fs::read(directory.join("theme.json")).expect("restored manifest should exist"),
        )
        .expect("restored manifest should deserialize");
        assert_eq!(restored.composer.opacity, manifest.composer.opacity);
        assert_eq!(
            fs::read(directory.join("background.jpg")).expect("restored background should exist"),
            background,
        );

        let _ = fs::remove_dir_all(root);
    }
    use std::{
        fs,
        io::{Cursor, Write},
    };
    use uuid::Uuid;
    use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

    #[test]
    fn validates_bundled_image_and_rejects_invalid_payloads() {
        let (_, width, height) =
            image_info(BAMBOO_SKYLIGHT).expect("bundled image should validate");
        assert!(width > 0 && height > 0);
        video_info(WILDERNESS).expect("bundled video should validate");
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
            ("preset-riso-spring-stream", "dark"),
            ("preset-romantic-rose", "dark"),
            ("preset-sakura-dawn", "dark"),
            ("preset-sky-light-study", "dark"),
            ("preset-strata-forge", "dark"),
            ("preset-sunlit-shore", "dark"),
            ("preset-windrest-cloud-house", "dark"),
            ("preset-yellow-gadgeteers", "dark"),
        ];
        for (id, appearance) in themes {
            let manifest = builtin_manifest(id, id, "#000000", 0.5, "left")
                .expect("every bundled theme should have a component adaptation");
            validate_manifest(&manifest).expect("adapted theme should validate");
            assert_eq!(manifest.version, BUILTIN_THEME_VERSION);
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

    #[test]
    fn loads_existing_theme_manifests_with_new_component_defaults() {
        let source = builtin_manifest("preset-alpine-lake", "兼容性测试", "#69aebc", 0.8, "left")
            .expect("built-in manifest should exist");
        let mut legacy = serde_json::to_value(source).expect("manifest should serialize");
        legacy
            .as_object_mut()
            .expect("manifest should be an object")
            .remove("tokens");
        legacy
            .pointer_mut("/ui")
            .and_then(serde_json::Value::as_object_mut)
            .expect("ui should be an object")
            .remove("overlays");
        let composer = legacy
            .pointer_mut("/composer")
            .and_then(serde_json::Value::as_object_mut)
            .expect("composer should be an object");
        for field in [
            "radius",
            "placeholderColor",
            "controlColor",
            "controlOpacity",
            "controlRadius",
            "primaryActionColor",
            "primaryActionText",
        ] {
            composer.remove(field);
        }

        let restored: ThemeManifest = serde_json::from_value(legacy)
            .expect("older manifest should deserialize with defaults");
        validate_manifest(&restored).expect("restored manifest should validate");
        assert_eq!(restored.composer.radius, 16);
        assert_eq!(restored.composer.control_radius, 8);
        assert_eq!(restored.ui.overlays.radius, 12);
        assert_eq!(restored.tokens.focus_ring, "auto");
    }

    #[test]
    fn theme_bundle_round_trip_preserves_configuration_and_creates_local_copy() {
        let mut source = builtin_manifest("preset-alpine-lake", "导出测试", "#69aebc", 0.8, "left")
            .expect("source theme should validate");
        source.author = "Skin Studio test".into();
        source.version = "2.4.0".into();
        source.art.task_mode = "banner".into();
        source.composer.opacity = 0.71;
        source.composer.control_radius = 11;
        source.tokens.focus_ring = "#7dd3fc".into();
        source.ui.overlays.radius = 14;
        source.ui.content.max_width = 880;
        source.ui.rich_text.image_radius = 17;

        let archive =
            encode_theme_bundle(&source, BAMBOO_SKYLIGHT).expect("theme bundle should be encoded");
        let imported = decode_theme_bundle(&archive).expect("theme bundle should be decoded");
        let root = std::env::temp_dir().join(format!("skin-studio-theme-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("test root should be created");

        let record =
            install_theme_bundle(&root, imported).expect("theme bundle should be installed");
        assert!(record.id.starts_with("custom-"));
        assert!(!record.built_in);
        let directory = root.join(&record.id);
        let stored: ThemeManifest = serde_json::from_slice(
            &fs::read(directory.join("theme.json")).expect("stored manifest should exist"),
        )
        .expect("stored manifest should deserialize");
        assert!(!stored.built_in);
        assert_eq!(stored.name, source.name);
        assert_eq!(stored.version, source.version);
        assert_eq!(stored.author, source.author);
        assert_eq!(stored.art.task_mode, "banner");
        assert_eq!(stored.composer.opacity, 0.71);
        assert_eq!(stored.composer.control_radius, 11);
        assert_eq!(stored.tokens.focus_ring, "#7dd3fc");
        assert_eq!(stored.ui.overlays.radius, 14);
        assert_eq!(stored.ui.content.max_width, 880);
        assert_eq!(stored.ui.rich_text.image_radius, 17);
        assert_eq!(
            fs::read(directory.join(&stored.image)).expect("stored background should exist"),
            BAMBOO_SKYLIGHT,
        );
        assert!(directory.join(&stored.thumbnail).is_file());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_theme_bundle_with_unsafe_file_name() {
        let source = builtin_manifest("preset-alpine-lake", "安全性测试", "#69aebc", 0.8, "left")
            .expect("source theme should validate");
        let bundle = ThemeBundle::from_manifest(&source, "../background.jpg".into());
        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        writer
            .start_file("bundle.json", options)
            .expect("manifest entry should be written");
        writer
            .write_all(&serde_json::to_vec(&bundle).expect("bundle should serialize"))
            .expect("manifest should be written");
        writer
            .start_file("../background.jpg", options)
            .expect("unsafe entry should be written for the test");
        writer
            .write_all(BAMBOO_SKYLIGHT)
            .expect("background should be written");
        let archive = writer.finish().expect("archive should finish").into_inner();

        assert!(decode_theme_bundle(&archive).is_err());
    }
}
