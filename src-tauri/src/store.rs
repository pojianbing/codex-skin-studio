use crate::{
    error::{Result, StudioError},
    storage::{atomic_write, store_state_path},
    themes,
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use ed25519_dalek::{Signature, VerifyingKey};
use reqwest::{
    blocking::{Client, Response},
    header::USER_AGENT,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashSet, fs, io::Read, time::Duration};
use url::Url;

const STORE_OWNER: &str = "pojianbing";
const STORE_REPOSITORY: &str = "codex-skin-themes";
const STORE_ID: &str = "pojianbing-codex-skin-themes";
const STORE_SIGNING_KEY_ID: &str = "store-2026-07";
const MAX_CATALOG_BYTES: u64 = 1024 * 1024;
const MAX_THEME_BUNDLE_BYTES: u64 = 16 * 1024 * 1024 + 256 * 1024;
const MAX_PREVIEW_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RawAsset {
    asset: String,
    sha256: String,
    size: u64,
    content_type: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RawLicense {
    spdx: String,
    url: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RawStoreTheme {
    id: String,
    name: String,
    version: String,
    author: String,
    description: String,
    tags: Vec<String>,
    license: RawLicense,
    source_url: Option<String>,
    theme_schema_version: u32,
    published_at: String,
    bundle: RawAsset,
    preview: RawAsset,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RawCatalog {
    schema_version: u32,
    store_id: String,
    store_version: String,
    generated_at: String,
    minimum_app_version: String,
    signing_key_id: String,
    themes: Vec<RawStoreTheme>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct ReleaseAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoreCache {
    release_tag: String,
    fetched_at: String,
    catalog: RawCatalog,
    assets: Vec<ReleaseAsset>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoreInstall {
    store_theme_id: String,
    local_theme_id: String,
    installed_version: String,
    bundle_sha256: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoreState {
    schema_version: u32,
    #[serde(default)]
    cache: Option<StoreCache>,
    #[serde(default)]
    installs: Vec<StoreInstall>,
}

impl Default for StoreState {
    fn default() -> Self {
        Self {
            schema_version: 1,
            cache: None,
            installs: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreTheme {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub tags: Vec<String>,
    pub license: String,
    pub license_url: String,
    pub source_url: Option<String>,
    pub preview_url: String,
    pub published_at: String,
    pub install_status: String,
    pub local_theme_id: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreCatalog {
    pub release_tag: String,
    pub store_version: String,
    pub fetched_at: String,
    pub source: String,
    pub themes: Vec<StoreTheme>,
}

fn store_state() -> StoreState {
    store_state_path()
        .ok()
        .and_then(|path| fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .filter(|state: &StoreState| state.schema_version == 1)
        .unwrap_or_default()
}

fn write_store_state(state: &StoreState) -> Result<()> {
    atomic_write(
        &store_state_path()?,
        format!("{}\n", serde_json::to_string_pretty(state)?).as_bytes(),
    )
}

fn client() -> Result<Client> {
    Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(Into::into)
}

fn latest_download_url(asset: &str) -> String {
    format!("https://github.com/{STORE_OWNER}/{STORE_REPOSITORY}/releases/latest/download/{asset}")
}

fn is_semver(value: &str) -> bool {
    let core = value.split('-').next().unwrap_or_default();
    let parts = core.split('.').collect::<Vec<_>>();
    parts.len() == 3
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
}

fn version_parts(value: &str) -> Option<(u32, u32, u32)> {
    let mut parts = value.split('-').next()?.split('.');
    Some((
        parts.next()?.parse().ok()?,
        parts.next()?.parse().ok()?,
        parts.next()?.parse().ok()?,
    ))
}

fn app_supports(version: &str) -> bool {
    version_parts(env!("CARGO_PKG_VERSION")) >= version_parts(version)
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

fn valid_asset_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 160
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

fn valid_hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

fn valid_https_url(value: &str) -> bool {
    Url::parse(value).is_ok_and(|url| url.scheme() == "https" && url.host_str().is_some())
}

fn approved_asset_url(value: &str) -> bool {
    Url::parse(value).is_ok_and(|url| {
        let release_prefix = format!("/{STORE_OWNER}/{STORE_REPOSITORY}/releases/download/");
        let latest_prefix = format!("/{STORE_OWNER}/{STORE_REPOSITORY}/releases/latest/download/");
        url.scheme() == "https"
            && url.host_str() == Some("github.com")
            && (url.path().starts_with(&release_prefix) || url.path().starts_with(&latest_prefix))
    })
}

fn verify_asset(asset: &RawAsset, maximum_size: u64, expected_content_type: &str) -> Result<()> {
    if !valid_asset_name(&asset.asset)
        || !valid_hash(&asset.sha256)
        || asset.size == 0
        || asset.size > maximum_size
        || asset.content_type != expected_content_type
    {
        return Err(StudioError::from("主题商店资源声明无效"));
    }
    Ok(())
}

fn validate_catalog(catalog: &RawCatalog) -> Result<()> {
    if catalog.schema_version != 1
        || catalog.store_id != STORE_ID
        || !is_semver(&catalog.store_version)
        || !is_semver(&catalog.minimum_app_version)
        || !app_supports(&catalog.minimum_app_version)
        || catalog.signing_key_id != STORE_SIGNING_KEY_ID
        || catalog.themes.is_empty()
        || catalog.themes.len() > 100
    {
        return Err(StudioError::from("主题商店目录不受当前应用支持"));
    }
    let mut ids = HashSet::new();
    let mut assets = HashSet::new();
    for theme in &catalog.themes {
        if !valid_id(&theme.id)
            || !ids.insert(&theme.id)
            || theme.name.trim().is_empty()
            || theme.name.chars().count() > 80
            || theme.author.trim().is_empty()
            || theme.author.chars().count() > 80
            || theme.description.trim().is_empty()
            || theme.description.chars().count() > 280
            || !is_semver(&theme.version)
            || theme.theme_schema_version != 1
            || theme.tags.len() > 8
            || theme.tags.iter().any(|tag| !valid_id(tag))
            || theme.license.spdx.trim().is_empty()
            || !valid_https_url(&theme.license.url)
            || theme
                .source_url
                .as_deref()
                .is_some_and(|url| !valid_https_url(url))
        {
            return Err(StudioError::from("主题商店主题信息无效"));
        }
        verify_asset(&theme.bundle, MAX_THEME_BUNDLE_BYTES, "application/zip")?;
        if !matches!(
            theme.preview.content_type.as_str(),
            "image/jpeg" | "image/png" | "image/webp"
        ) {
            return Err(StudioError::from("主题商店预览图类型无效"));
        }
        verify_asset(
            &theme.preview,
            MAX_PREVIEW_BYTES,
            &theme.preview.content_type,
        )?;
        if !assets.insert(&theme.bundle.asset) || !assets.insert(&theme.preview.asset) {
            return Err(StudioError::from("主题商店目录包含重名资源"));
        }
    }
    Ok(())
}

fn release_asset<'a>(assets: &'a [ReleaseAsset], name: &str) -> Result<&'a ReleaseAsset> {
    let asset = assets
        .iter()
        .find(|asset| asset.name == name)
        .ok_or_else(|| StudioError::from("主题商店 Release 缺少资源"))?;
    if !approved_asset_url(&asset.browser_download_url) {
        return Err(StudioError::from("主题商店资源地址不受信任"));
    }
    Ok(asset)
}

fn read_response(mut response: Response, maximum_size: u64) -> Result<Vec<u8>> {
    if response
        .content_length()
        .is_some_and(|length| length > maximum_size)
    {
        return Err(StudioError::from("下载内容超过允许大小"));
    }
    let mut bytes = Vec::new();
    response
        .by_ref()
        .take(maximum_size.saturating_add(1))
        .read_to_end(&mut bytes)?;
    if bytes.len() as u64 > maximum_size {
        return Err(StudioError::from("下载内容超过允许大小"));
    }
    Ok(bytes)
}

fn download_url(http: &Client, url: &str, maximum_size: u64) -> Result<Vec<u8>> {
    if !approved_asset_url(url) {
        return Err(StudioError::from("主题商店资源地址不受信任"));
    }
    let response = http
        .get(url)
        .header(USER_AGENT, "CodexSkinStudio")
        .send()?
        .error_for_status()?;
    read_response(response, maximum_size)
}

fn download_asset(http: &Client, asset: &ReleaseAsset, maximum_size: u64) -> Result<Vec<u8>> {
    if !approved_asset_url(&asset.browser_download_url) || asset.size > maximum_size {
        return Err(StudioError::from("主题商店资源地址或大小无效"));
    }
    let bytes = download_url(http, &asset.browser_download_url, maximum_size)?;
    if bytes.len() as u64 != asset.size {
        return Err(StudioError::from("主题商店下载大小与目录不匹配"));
    }
    Ok(bytes)
}

fn verify_catalog_signature(catalog: &[u8], signature: &[u8]) -> Result<()> {
    let public_key = STANDARD
        .decode(include_str!("../assets/theme-store-public.key").trim())
        .map_err(|_| StudioError::from("主题商店公钥格式无效"))?;
    let public_key: [u8; 32] = public_key
        .try_into()
        .map_err(|_| StudioError::from("主题商店公钥长度无效"))?;
    let signature: [u8; 64] = signature
        .try_into()
        .map_err(|_| StudioError::from("主题商店目录签名长度无效"))?;
    let verifying_key =
        VerifyingKey::from_bytes(&public_key).map_err(|_| StudioError::from("主题商店公钥无效"))?;
    verify_signature(&verifying_key, catalog, &signature)
}

fn verify_signature(
    verifying_key: &VerifyingKey,
    catalog: &[u8],
    signature: &[u8; 64],
) -> Result<()> {
    verifying_key
        .verify_strict(catalog, &Signature::from_bytes(&signature))
        .map_err(|_| StudioError::from("主题商店目录签名验证失败"))
}

fn fetch_catalog() -> Result<StoreCache> {
    let http = client()?;
    let catalog_bytes = download_url(
        &http,
        &latest_download_url("catalog.json"),
        MAX_CATALOG_BYTES,
    )
    .map_err(|error| {
        if error.to_string().contains("404") {
            StudioError::from("主题商店尚未发布正式 Release")
        } else {
            error
        }
    })?;
    let signature = download_url(&http, &latest_download_url("catalog.sig"), 64)?;
    verify_catalog_signature(&catalog_bytes, &signature)?;
    let catalog: RawCatalog = serde_json::from_slice(&catalog_bytes)?;
    validate_catalog(&catalog)?;
    let assets = catalog
        .themes
        .iter()
        .flat_map(|theme| [&theme.bundle, &theme.preview])
        .map(|asset| ReleaseAsset {
            name: asset.asset.clone(),
            browser_download_url: latest_download_url(&asset.asset),
            size: asset.size,
        })
        .collect();
    Ok(StoreCache {
        release_tag: "latest".into(),
        fetched_at: format!("{}", chrono_free_timestamp()),
        catalog,
        assets,
    })
}

fn chrono_free_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
}

fn cache_for(refresh: bool) -> Result<(StoreState, StoreCache, String)> {
    let mut state = store_state();
    if !refresh && let Some(cache) = state.cache.clone() {
        return Ok((state, cache, "cache".into()));
    }
    match fetch_catalog() {
        Ok(cache) => {
            state.cache = Some(cache.clone());
            write_store_state(&state)?;
            Ok((state, cache, "network".into()))
        }
        Err(error) => state
            .cache
            .clone()
            .map(|cache| (state, cache, "cache".into()))
            .ok_or(error),
    }
}

fn asset_url(cache: &StoreCache, name: &str) -> Result<String> {
    Ok(release_asset(&cache.assets, name)?
        .browser_download_url
        .clone())
}

fn display_catalog(state: &StoreState, cache: &StoreCache, source: String) -> Result<StoreCatalog> {
    let themes = cache
        .catalog
        .themes
        .iter()
        .map(|theme| {
            let install = state
                .installs
                .iter()
                .find(|install| install.store_theme_id == theme.id);
            let local_theme_id = install
                .filter(|install| themes::load_manifest(&install.local_theme_id).is_ok())
                .map(|install| install.local_theme_id.clone());
            let install_status = match (install, &local_theme_id) {
                (Some(install), Some(_))
                    if install.installed_version == theme.version
                        && install.bundle_sha256 == theme.bundle.sha256 =>
                {
                    "installed"
                }
                (Some(_), Some(_)) => "updateAvailable",
                _ => "notInstalled",
            }
            .into();
            Ok(StoreTheme {
                id: theme.id.clone(),
                name: theme.name.clone(),
                version: theme.version.clone(),
                author: theme.author.clone(),
                description: theme.description.clone(),
                tags: theme.tags.clone(),
                license: theme.license.spdx.clone(),
                license_url: theme.license.url.clone(),
                source_url: theme.source_url.clone(),
                preview_url: asset_url(cache, &theme.preview.asset)?,
                published_at: theme.published_at.clone(),
                install_status,
                local_theme_id,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(StoreCatalog {
        release_tag: cache.release_tag.clone(),
        store_version: cache.catalog.store_version.clone(),
        fetched_at: cache.fetched_at.clone(),
        source,
        themes,
    })
}

pub fn catalog(refresh: bool) -> Result<StoreCatalog> {
    let (state, cache, source) = cache_for(refresh)?;
    display_catalog(&state, &cache, source)
}

pub fn install_theme(store_theme_id: &str) -> Result<crate::models::ThemeRecord> {
    let (mut state, cache, _) = cache_for(false)?;
    let theme = cache
        .catalog
        .themes
        .iter()
        .find(|theme| theme.id == store_theme_id)
        .ok_or_else(|| StudioError::from("主题商店中没有该主题"))?;
    let asset = release_asset(&cache.assets, &theme.bundle.asset)?;
    let bytes = download_asset(&client()?, asset, MAX_THEME_BUNDLE_BYTES)?;
    let actual_hash = format!("{:x}", Sha256::digest(&bytes));
    if actual_hash != theme.bundle.sha256 || bytes.len() as u64 != theme.bundle.size {
        return Err(StudioError::from("主题包哈希校验失败"));
    }
    let existing = state
        .installs
        .iter()
        .find(|install| install.store_theme_id == theme.id)
        .filter(|install| themes::load_manifest(&install.local_theme_id).is_ok())
        .cloned();
    let record = match existing {
        Some(install) => themes::replace_theme_bundle(&install.local_theme_id, &bytes)?,
        None => themes::import_theme_bundle_bytes(&bytes)?,
    };
    state.installs.retain(|install| {
        install.store_theme_id != theme.id && install.local_theme_id != record.id
    });
    state.installs.push(StoreInstall {
        store_theme_id: theme.id.clone(),
        local_theme_id: record.id.clone(),
        installed_version: theme.version.clone(),
        bundle_sha256: theme.bundle.sha256.clone(),
    });
    write_store_state(&state)?;
    Ok(record)
}

pub fn forget_local_theme(local_theme_id: &str) -> Result<()> {
    let mut state = store_state();
    let count = state.installs.len();
    state
        .installs
        .retain(|install| install.local_theme_id != local_theme_id);
    if state.installs.len() != count {
        write_store_state(&state)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{RawCatalog, approved_asset_url, validate_catalog, verify_signature};
    use ed25519_dalek::{Signer, SigningKey};

    fn catalog() -> RawCatalog {
        serde_json::from_str(
            r##"{
              "schemaVersion": 1,
              "storeId": "pojianbing-codex-skin-themes",
              "storeVersion": "0.1.0",
              "generatedAt": "2026-07-18T00:00:00Z",
              "minimumAppVersion": "0.2.0",
              "signingKeyId": "store-2026-07",
              "themes": [{
                "id": "amber-dusk", "name": "Amber", "version": "1.2.4", "author": "Studio",
                "description": "A valid theme.", "tags": ["dark"],
                "license": { "spdx": "MIT", "url": "https://example.com/license" },
                "themeSchemaVersion": 1, "publishedAt": "2026-07-18T00:00:00Z",
                "bundle": { "asset": "amber-dusk-1.2.4.codex-theme", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "size": 100, "contentType": "application/zip" },
                "preview": { "asset": "amber-dusk-1.2.4.jpg", "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "size": 50, "contentType": "image/jpeg" }
              }]
            }"##,
        )
        .expect("test catalog should deserialize")
    }

    #[test]
    fn accepts_a_supported_catalog() {
        let catalog = catalog();
        validate_catalog(&catalog).expect("catalog should validate");
    }

    #[test]
    fn accepts_latest_release_assets_only_from_the_store_repository() {
        assert!(approved_asset_url(
            "https://github.com/pojianbing/codex-skin-themes/releases/latest/download/catalog.json"
        ));
        assert!(!approved_asset_url(
            "https://github.com/other/repo/releases/latest/download/catalog.json"
        ));
    }

    #[test]
    fn accepts_a_valid_ed25519_catalog_signature() {
        let signing_key = SigningKey::from_bytes(&[7; 32]);
        let catalog = b"signed catalog";
        let signature = signing_key.sign(catalog).to_bytes();
        verify_signature(&signing_key.verifying_key(), catalog, &signature)
            .expect("signature should verify");
    }
}
