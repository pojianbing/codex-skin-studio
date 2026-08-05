use crate::{
    error::{Result, StudioError},
    storage::atomic_write,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use std::{
    env, fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use toml_edit::{DocumentMut, Item, Table, value};
use uuid::Uuid;

const DEEPSEEK_FLASH: &str = "deepseek-v4-flash";
const DEEPSEEK_PRO: &str = "deepseek-v4-pro";
const DEFAULT_API_KEY_ENV: &str = "DEEPSEEK_API_KEY";
const DEFAULT_ROUTER_PROVIDER: &str = "codex-skin-router";
const DEFAULT_CATALOG_FILENAME: &str = "models-with-deepseek.json";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureCodexModelsRequest {
    pub mode: String,
    #[serde(default)]
    pub include_pro: bool,
    #[serde(default)]
    pub api_key_env: Option<String>,
    #[serde(default)]
    pub use_current_provider: bool,
    #[serde(default)]
    pub router_provider_id: Option<String>,
    #[serde(default)]
    pub router_base_url: Option<String>,
    #[serde(default)]
    pub selected_model: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexModelsStatus {
    pub config_path: String,
    pub config_exists: bool,
    pub catalog_path: Option<String>,
    pub catalog_exists: bool,
    pub current_model: Option<String>,
    pub current_provider: Option<String>,
    pub gpt_model_count: usize,
    pub deepseek_model_count: usize,
    pub deepseek_flash_enabled: bool,
    pub deepseek_pro_enabled: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureCodexModelsResult {
    pub mode: String,
    pub config_path: String,
    pub catalog_path: String,
    pub backup_config_path: Option<String>,
    pub backup_catalog_path: Option<String>,
    pub gpt_model_count: usize,
    pub deepseek_model_count: usize,
    pub selected_model: String,
}

struct CodexPaths {
    home: PathBuf,
    config: PathBuf,
}

pub fn status() -> Result<CodexModelsStatus> {
    let paths = codex_paths()?;
    let config_exists = paths.config.exists();
    let document = if config_exists {
        parse_config(&fs::read_to_string(&paths.config)?)?
    } else {
        DocumentMut::new()
    };
    let catalog_path = catalog_path_from_config(&document, &paths.home);
    let catalog = catalog_path
        .as_deref()
        .and_then(|path| read_catalog(path).ok());
    let counts = catalog.as_ref().map(catalog_counts).unwrap_or_default();

    Ok(CodexModelsStatus {
        config_path: paths.config.display().to_string(),
        config_exists,
        catalog_path: catalog_path.map(|path| path.display().to_string()),
        catalog_exists: catalog.is_some(),
        current_model: current_model_from_config(&document),
        current_provider: current_provider_from_config(&document),
        gpt_model_count: counts.0,
        deepseek_model_count: counts.1,
        deepseek_flash_enabled: has_model(catalog.as_ref(), DEEPSEEK_FLASH),
        deepseek_pro_enabled: has_model(catalog.as_ref(), DEEPSEEK_PRO),
    })
}

pub fn configure(request: ConfigureCodexModelsRequest) -> Result<ConfigureCodexModelsResult> {
    let mode = request.mode.trim().to_ascii_lowercase();
    if !matches!(mode.as_str(), "mixed" | "deepseek") {
        return Err(StudioError::from("Codex 模型接入模式无效"));
    }

    let paths = codex_paths()?;
    let config_text = if paths.config.exists() {
        fs::read_to_string(&paths.config)?
    } else {
        String::new()
    };
    let mut document = parse_config(&config_text)?;
    let current_catalog_path = catalog_path_from_config(&document, &paths.home);
    let current_catalog = match current_catalog_path.as_deref() {
        Some(path) if path.exists() => read_catalog(path)?,
        _ => json!({ "models": [] }),
    };
    let template = current_catalog
        .get("models")
        .and_then(Value::as_array)
        .and_then(|models| {
            models.iter().find(|model| {
                model
                    .get("slug")
                    .and_then(Value::as_str)
                    .is_some_and(|slug| !slug.starts_with("deepseek-"))
            })
        })
        .cloned();
    let catalog = if mode == "mixed" {
        merge_catalog(current_catalog, template.as_ref(), request.include_pro)?
    } else {
        deepseek_catalog(template.as_ref(), request.include_pro)
    };
    let model_array = catalog
        .get("models")
        .and_then(Value::as_array)
        .ok_or_else(|| StudioError::from("生成的 Codex 模型目录缺少 models 数组"))?;
    let selected_model = request
        .selected_model
        .as_deref()
        .filter(|model| {
            model_array
                .iter()
                .any(|entry| entry.get("slug").and_then(Value::as_str) == Some(*model))
        })
        .map(str::to_owned)
        .unwrap_or_else(|| DEEPSEEK_FLASH.to_owned());
    if !matches!(selected_model.as_str(), DEEPSEEK_FLASH | DEEPSEEK_PRO) {
        return Err(StudioError::from("只支持 DeepSeek 模型作为新默认模型"));
    }

    let provider_id = if mode == "deepseek" {
        let api_key_env = request
            .api_key_env
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(DEFAULT_API_KEY_ENV);
        if !is_env_name(api_key_env) {
            return Err(StudioError::from("DeepSeek API Key 环境变量名无效"));
        }
        set_provider(
            &mut document,
            "deepseek",
            "DeepSeek",
            "https://api.deepseek.com/",
            Some(api_key_env),
        )?;
        document["preferred_auth_method"] = value("apikey");
        document["forced_login_method"] = value("api");
        "deepseek".to_owned()
    } else if request.use_current_provider {
        current_provider_from_config(&document)
            .ok_or_else(|| StudioError::from("当前 Codex 配置没有 model_provider，无法复用"))?
    } else {
        let provider_id = request
            .router_provider_id
            .as_deref()
            .map(str::trim)
            .filter(|value| is_provider_id(value))
            .unwrap_or(DEFAULT_ROUTER_PROVIDER);
        let base_url = request
            .router_base_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| StudioError::from("混合模式需要填写 Responses 路由地址"))?;
        set_provider(
            &mut document,
            provider_id,
            "Codex model router",
            base_url,
            None,
        )?;
        provider_id.to_owned()
    };

    document["model"] = value(selected_model.clone());
    document["model_provider"] = value(provider_id);
    let catalog_path = paths.home.join(DEFAULT_CATALOG_FILENAME);
    let backup_catalog_path = backup_existing(&catalog_path)?;
    let backup_config_path = backup_existing(&paths.config)?;

    atomic_write(
        &catalog_path,
        format!("{}\n", serde_json::to_string_pretty(&catalog)?).as_bytes(),
    )?;
    document["model_catalog_json"] = value(catalog_path.display().to_string());

    if let Err(error) = atomic_write(&paths.config, document.to_string().as_bytes()) {
        if let Some(backup) = backup_catalog_path.as_deref() {
            fs::copy(backup, &catalog_path)?;
        } else {
            let _ = fs::remove_file(&catalog_path);
        }
        return Err(error);
    }

    let counts = catalog_counts(&catalog);
    Ok(ConfigureCodexModelsResult {
        mode,
        config_path: paths.config.display().to_string(),
        catalog_path: catalog_path.display().to_string(),
        backup_config_path: backup_config_path.map(|path| path.display().to_string()),
        backup_catalog_path: backup_catalog_path.map(|path| path.display().to_string()),
        gpt_model_count: counts.0,
        deepseek_model_count: counts.1,
        selected_model,
    })
}

fn codex_paths() -> Result<CodexPaths> {
    let home = env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(|path| PathBuf::from(path).join(".codex")))
        .or_else(|| env::var_os("HOME").map(|path| PathBuf::from(path).join(".codex")))
        .ok_or_else(|| StudioError::from("无法确定 Codex 配置目录"))?;
    Ok(CodexPaths {
        config: home.join("config.toml"),
        home,
    })
}

fn parse_config(text: &str) -> Result<DocumentMut> {
    if text.trim().is_empty() {
        return Ok(DocumentMut::new());
    }
    text.parse::<DocumentMut>()
        .map_err(|error| StudioError::from(format!("Codex config.toml 无效：{error}")))
}

fn read_catalog(path: &Path) -> Result<Value> {
    let text = fs::read_to_string(path)?;
    let catalog: Value = serde_json::from_str(&text)?;
    if !catalog.get("models").is_some_and(Value::is_array) {
        return Err(StudioError::from("Codex 模型目录缺少 models 数组"));
    }
    Ok(catalog)
}

fn current_model_from_config(document: &DocumentMut) -> Option<String> {
    document
        .get("model")
        .and_then(Item::as_str)
        .map(str::to_owned)
}

fn current_provider_from_config(document: &DocumentMut) -> Option<String> {
    document
        .get("model_provider")
        .and_then(Item::as_str)
        .map(str::to_owned)
}

fn catalog_path_from_config(document: &DocumentMut, codex_home: &Path) -> Option<PathBuf> {
    let configured = document
        .get("model_catalog_json")
        .and_then(Item::as_str)
        .map(str::to_owned);
    let path = configured.map(|configured| {
        let expanded = if let Some(rest) = configured.strip_prefix("~/") {
            codex_home.parent().unwrap_or(codex_home).join(rest)
        } else if let Some(rest) = configured.strip_prefix("~\\") {
            codex_home.parent().unwrap_or(codex_home).join(rest)
        } else {
            PathBuf::from(configured)
        };
        if expanded.is_absolute() {
            expanded
        } else {
            codex_home.join(expanded)
        }
    });
    path.or_else(|| {
        let default = codex_home.join("models.json");
        default.exists().then_some(default)
    })
}

fn has_model(catalog: Option<&Value>, slug: &str) -> bool {
    catalog
        .and_then(|catalog| catalog.get("models"))
        .and_then(Value::as_array)
        .is_some_and(|models| {
            models
                .iter()
                .any(|model| model.get("slug").and_then(Value::as_str) == Some(slug))
        })
}

fn catalog_counts(catalog: &Value) -> (usize, usize) {
    catalog
        .get("models")
        .and_then(Value::as_array)
        .map(|models| {
            models.iter().fold((0, 0), |(gpt, deepseek), model| {
                let slug = model
                    .get("slug")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if slug.starts_with("deepseek-") {
                    (gpt, deepseek + 1)
                } else if slug.starts_with("gpt-") {
                    (gpt + 1, deepseek)
                } else {
                    (gpt, deepseek)
                }
            })
        })
        .unwrap_or_default()
}

fn merge_catalog(mut catalog: Value, template: Option<&Value>, include_pro: bool) -> Result<Value> {
    let models = catalog
        .get_mut("models")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| StudioError::from("Codex 模型目录缺少 models 数组"))?;
    models.retain(|model| {
        let slug = model
            .get("slug")
            .and_then(Value::as_str)
            .unwrap_or_default();
        slug != DEEPSEEK_FLASH && slug != DEEPSEEK_PRO
    });
    models.push(deepseek_model(
        DEEPSEEK_FLASH,
        "DeepSeek-V4-Flash",
        template,
    ));
    if include_pro {
        models.push(deepseek_model(DEEPSEEK_PRO, "DeepSeek-V4-Pro", template));
    }
    Ok(catalog)
}

fn deepseek_catalog(template: Option<&Value>, include_pro: bool) -> Value {
    let mut catalog = json!({ "models": [] });
    let models = catalog
        .get_mut("models")
        .and_then(Value::as_array_mut)
        .expect("new catalog always contains a models array");
    models.push(deepseek_model(
        DEEPSEEK_FLASH,
        "DeepSeek-V4-Flash",
        template,
    ));
    if include_pro {
        models.push(deepseek_model(DEEPSEEK_PRO, "DeepSeek-V4-Pro", template));
    }
    catalog
}

fn deepseek_model(slug: &str, display_name: &str, template: Option<&Value>) -> Value {
    let mut model = template.cloned().unwrap_or_else(|| {
        json!({
            "model_messages": {
                "instructions_template": "You are Codex, an AI coding assistant.",
                "base_instructions": "You are Codex, an AI coding assistant.",
                "instructions_variables": {},
                "approvals": null
            }
        })
    });
    let object = model
        .as_object_mut()
        .expect("model template must be an object");
    set(object, "slug", json!(slug));
    set(object, "prefer_websockets", json!(false));
    set(object, "support_verbosity", json!(true));
    set(object, "default_verbosity", json!("low"));
    set(object, "apply_patch_tool_type", json!("freeform"));
    set(object, "web_search_tool_type", json!("text"));
    set(object, "input_modalities", json!(["text"]));
    set(object, "supports_image_detail_original", json!(false));
    set(
        object,
        "truncation_policy",
        json!({ "mode": "tokens", "limit": 10000 }),
    );
    set(object, "supports_parallel_tool_calls", json!(true));
    set(object, "tool_mode", Value::Null);
    set(object, "multi_agent_version", json!("v2"));
    set(object, "use_responses_lite", json!(false));
    set(object, "include_skills_usage_instructions", json!(false));
    set(object, "auto_review_model_override", Value::Null);
    set(object, "context_window", json!(1048576));
    set(object, "max_context_window", json!(1048576));
    set(object, "effective_context_window_percent", json!(95));
    set(object, "auto_compact_token_limit", Value::Null);
    set(object, "comp_hash", json!("3000"));
    set(object, "reasoning_summary_format", json!("experimental"));
    set(object, "default_reasoning_summary", json!("none"));
    set(object, "display_name", json!(display_name));
    set(
        object,
        "description",
        json!("DeepSeek model for Codex coding workflows."),
    );
    set(object, "default_reasoning_level", json!("high"));
    set(
        object,
        "supported_reasoning_levels",
        json!([
            { "effort": "low", "description": "Fast responses with lighter reasoning" },
            { "effort": "high", "description": "Extra high reasoning depth for complex problems" },
            { "effort": "max", "description": "Maximum reasoning depth for the hardest problems" }
        ]),
    );
    set(object, "shell_type", json!("shell_command"));
    set(object, "visibility", json!("list"));
    set(object, "minimal_client_version", json!("0.144.0"));
    set(object, "supported_in_api", json!(true));
    set(object, "availability_nux", Value::Null);
    set(object, "upgrade", Value::Null);
    set(object, "priority", json!(1));
    set(object, "supports_reasoning_summaries", json!(true));
    set(object, "supports_search_tool", json!(true));
    model
}

fn set(object: &mut Map<String, Value>, key: &str, value: Value) {
    object.insert(key.to_owned(), value);
}

fn set_provider(
    document: &mut DocumentMut,
    provider_id: &str,
    name: &str,
    base_url: &str,
    env_key: Option<&str>,
) -> Result<()> {
    if !is_provider_id(provider_id) {
        return Err(StudioError::from("Codex provider 标识无效"));
    }
    let providers = document["model_providers"]
        .or_insert(Item::Table(Table::new()))
        .as_table_mut()
        .ok_or_else(|| StudioError::from("Codex model_providers 配置不是表格"))?;
    let mut provider = Table::new();
    provider["name"] = value(name);
    provider["base_url"] = value(base_url);
    provider["wire_api"] = value("responses");
    if let Some(env_key) = env_key {
        provider["env_key"] = value(env_key);
    }
    providers[provider_id] = Item::Table(provider);
    Ok(())
}

fn is_provider_id(value: &str) -> bool {
    !value.is_empty()
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
}

fn is_env_name(value: &str) -> bool {
    !value.is_empty()
        && value.chars().enumerate().all(|(index, character)| {
            (index == 0 && (character.is_ascii_alphabetic() || character == '_'))
                || (index > 0 && (character.is_ascii_alphanumeric() || character == '_'))
        })
}

fn backup_existing(path: &Path) -> Result<Option<PathBuf>> {
    if !path.exists() {
        return Ok(None);
    }
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| StudioError::from(format!("无法生成配置备份时间：{error}")))?
        .as_secs();
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("codex-config");
    let backup = path.with_file_name(format!("{filename}.backup-{timestamp}-{}", Uuid::new_v4()));
    fs::copy(path, &backup)?;
    Ok(Some(backup))
}

#[cfg(test)]
mod tests {
    use super::{catalog_counts, deepseek_catalog, merge_catalog, parse_config, set_provider};
    use serde_json::json;
    use toml_edit::value;

    #[test]
    fn merge_keeps_gpt_models_and_adds_flash() {
        let catalog = json!({ "models": [{ "slug": "gpt-5.5" }] });
        let merged = merge_catalog(catalog, Some(&json!({ "slug": "gpt-5.5" })), false).unwrap();
        assert_eq!(catalog_counts(&merged), (1, 1));
        assert!(merged.to_string().contains("deepseek-v4-flash"));
    }

    #[test]
    fn deepseek_catalog_can_include_pro() {
        let catalog = deepseek_catalog(None, true);
        assert_eq!(catalog_counts(&catalog), (0, 2));
    }

    #[test]
    fn provider_update_preserves_unrelated_config() {
        let mut document = parse_config("goals = true\n[model_providers]\n").unwrap();
        set_provider(
            &mut document,
            "deepseek",
            "DeepSeek",
            "https://api.deepseek.com/",
            Some("DEEPSEEK_API_KEY"),
        )
        .unwrap();
        document["model"] = value("deepseek-v4-flash");
        assert_eq!(document["goals"].as_bool(), Some(true));
        assert_eq!(
            document["model_providers"]["deepseek"]["wire_api"].as_str(),
            Some("responses")
        );
    }
}
