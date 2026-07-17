use crate::{
    error::{Result, StudioError},
    models::{ArtConfig, Palette, ThemeManifest, ThemeRecord},
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
    validate_art(&manifest.art)
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

fn seed_one(
    id: &str,
    name: &str,
    accent: &str,
    bytes: &[u8],
    focus_x: f64,
    safe_area: &str,
) -> Result<()> {
    let directory = theme_dir(id)?;
    if directory.join("theme.json").is_file() {
        return Ok(());
    }
    fs::create_dir_all(&directory)?;
    fs::write(directory.join("background.jpg"), bytes)?;
    fs::write(directory.join("thumbnail.jpg"), make_thumbnail(bytes)?)?;
    write_manifest(
        &directory,
        &ThemeManifest {
            schema_version: 1,
            id: id.into(),
            name: name.into(),
            version: "1.0.0".into(),
            author: "Fei-Away/Codex-Dream-Skin contributors".into(),
            image: "background.jpg".into(),
            thumbnail: "thumbnail.jpg".into(),
            appearance: "auto".into(),
            art: ArtConfig {
                focus_x,
                focus_y: 0.45,
                safe_area: safe_area.into(),
                task_mode: "ambient".into(),
            },
            palette: Palette {
                accent: accent.into(),
            },
            built_in: true,
        },
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
        built_in: false,
    };
    write_manifest(&directory, &manifest)?;
    record_from(manifest, &directory)
}

pub fn update_theme(id: &str, appearance: &str, art: ArtConfig) -> Result<()> {
    let (mut manifest, directory) = load_manifest(id)?;
    manifest.appearance = appearance.into();
    manifest.art = art;
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
        ROMANTIC, SAKURA, SKY_LIGHT_STUDY, SUNLIT_SHORE, YELLOW_GADGETEERS, image_info,
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
            SUNLIT_SHORE,
            YELLOW_GADGETEERS,
        ] {
            let (_, width, height) = image_info(bytes).expect("bundled image should validate");
            assert!(width > 0 && height > 0);
        }
        assert!(image_info(&[]).is_err());
        assert!(image_info(&vec![0; MAX_IMAGE_BYTES as usize + 1]).is_err());
    }
}
