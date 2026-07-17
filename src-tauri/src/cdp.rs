use crate::error::{Result, StudioError};
use reqwest::redirect::Policy;
use serde::Deserialize;
use serde_json::{Value, json};
use std::{collections::HashSet, thread, time::Duration};
use tungstenite::{Message, connect};
use url::Url;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Target {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub url: String,
    pub web_socket_debugger_url: String,
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 200
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

fn client() -> Result<reqwest::blocking::Client> {
    Ok(reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .redirect(Policy::none())
        .build()?)
}

fn validate_ws(value: &str, port: u16, id: &str) -> Result<()> {
    let url = Url::parse(value).map_err(|_| StudioError::from("CDP WebSocket URL 无效"))?;
    let host = url.host_str().unwrap_or_default();
    let expected = format!("/devtools/page/{id}");
    if !valid_id(id)
        || url.scheme() != "ws"
        || !matches!(host, "127.0.0.1" | "localhost" | "::1")
        || url.port() != Some(port)
        || url.path() != expected
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(StudioError::from(
            "拒绝连接非回环或形状异常的 CDP WebSocket",
        ));
    }
    Ok(())
}

pub fn list_targets(port: u16) -> Result<Vec<Target>> {
    let response = client()?
        .get(format!("http://127.0.0.1:{port}/json/list"))
        .send()?
        .error_for_status()?;
    let targets: Vec<Target> = response.json()?;
    Ok(targets
        .into_iter()
        .filter(|target| {
            target.kind == "page"
                && target.url.starts_with("app://")
                && validate_ws(&target.web_socket_debugger_url, port, &target.id).is_ok()
        })
        .collect())
}

pub fn browser_id(port: u16) -> Result<String> {
    let value: Value = client()?
        .get(format!("http://127.0.0.1:{port}/json/version"))
        .send()?
        .error_for_status()?
        .json()?;
    let websocket = value
        .get("webSocketDebuggerUrl")
        .and_then(Value::as_str)
        .ok_or_else(|| StudioError::from("CDP 未提供 Browser ID"))?;
    let url = Url::parse(websocket).map_err(|_| StudioError::from("Browser WebSocket URL 无效"))?;
    if url.scheme() != "ws"
        || !matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "::1"))
        || url.port() != Some(port)
        || !url.path().starts_with("/devtools/browser/")
    {
        return Err(StudioError::from("拒绝不可信的 Browser WebSocket"));
    }
    url.path_segments()
        .and_then(Iterator::last)
        .filter(|id| valid_id(id))
        .map(str::to_owned)
        .ok_or_else(|| StudioError::from("Browser ID 无效"))
}

pub fn wait_ready(port: u16, attempts: usize) -> Result<String> {
    let mut last = "CDP 尚未就绪".to_string();
    for _ in 0..attempts {
        match (browser_id(port), list_targets(port)) {
            (Ok(id), Ok(targets)) if !targets.is_empty() => return Ok(id),
            (Err(error), _) | (_, Err(error)) => last = error.to_string(),
            _ => {}
        }
        thread::sleep(Duration::from_millis(350));
    }
    Err(StudioError::from(format!(
        "Codex 未能打开安全的本机 CDP：{last}"
    )))
}

fn command(target: &Target, method: &str, params: Value) -> Result<Value> {
    let (mut socket, _) = connect(target.web_socket_debugger_url.as_str())?;
    socket.send(Message::Text(
        json!({ "id": 1, "method": method, "params": params })
            .to_string()
            .into(),
    ))?;
    loop {
        let message = socket.read()?;
        let Message::Text(text) = message else {
            continue;
        };
        let value: Value = serde_json::from_str(text.as_str())?;
        if value.get("id").and_then(Value::as_u64) != Some(1) {
            continue;
        }
        if let Some(error) = value.get("error") {
            return Err(StudioError::from(format!("CDP 命令失败：{error}")));
        }
        return Ok(value.get("result").cloned().unwrap_or(Value::Null));
    }
}

fn evaluate(target: &Target, expression: &str) -> Result<Value> {
    let result = command(
        target,
        "Runtime.evaluate",
        json!({
          "expression": expression, "awaitPromise": true, "returnByValue": true, "userGesture": false
        }),
    )?;
    if let Some(details) = result.get("exceptionDetails") {
        return Err(StudioError::from(format!("Renderer 执行失败：{details}")));
    }
    Ok(result
        .pointer("/result/value")
        .cloned()
        .unwrap_or(Value::Null))
}

fn verified_codex_target(target: &Target) -> bool {
    evaluate(target, "Boolean(document.querySelector('main.main-surface') && document.querySelector('aside.app-shell-left-panel'))").ok().and_then(|value| value.as_bool()).unwrap_or(false)
}

pub fn inject(
    port: u16,
    expected_browser_id: &str,
    payload: &str,
    revision: &str,
) -> Result<usize> {
    if browser_id(port)? != expected_browser_id {
        return Err(StudioError::from("CDP Browser ID 已变化，注入已停止"));
    }
    let mut count = 0;
    for target in list_targets(port)? {
        if !verified_codex_target(&target) {
            continue;
        }
        let installed = evaluate(
            &target,
            "window.__CODEX_SKIN_STUDIO_STATE__?.revision || null",
        )
        .ok()
        .and_then(|value| value.as_str().map(str::to_owned));
        if installed.as_deref() != Some(revision) {
            evaluate(&target, payload)?;
        }
        count += 1;
    }
    if count == 0 {
        return Err(StudioError::from("没有找到经过验证的 Codex renderer"));
    }
    Ok(count)
}

pub fn wait_and_inject(
    port: u16,
    expected_browser_id: &str,
    payload: &str,
    revision: &str,
    attempts: usize,
) -> Result<usize> {
    let mut last_error = StudioError::from("Codex renderer 尚未就绪");
    for _ in 0..attempts {
        match inject(port, expected_browser_id, payload, revision) {
            Ok(count) => return Ok(count),
            Err(error) => {
                if error.to_string().contains("Browser ID 已变化") {
                    return Err(error);
                }
                last_error = error;
            }
        }
        thread::sleep(Duration::from_millis(250));
    }
    Err(StudioError::from(format!(
        "等待经过验证的 Codex renderer 超时：{last_error}"
    )))
}

pub fn cleanup(port: u16, expected_browser_id: Option<&str>) -> Result<usize> {
    if let Some(expected) = expected_browser_id
        && browser_id(port)? != expected
    {
        return Err(StudioError::from("CDP Browser ID 已变化，拒绝清理未知会话"));
    }
    let mut cleaned = HashSet::new();
    for target in list_targets(port)? {
        if !verified_codex_target(&target) {
            continue;
        }
        evaluate(
            &target,
            "window.__CODEX_SKIN_STUDIO_STATE__?.cleanup?.() ?? true",
        )?;
        cleaned.insert(target.id);
    }
    Ok(cleaned.len())
}

#[cfg(test)]
mod tests {
    use super::validate_ws;

    #[test]
    fn accepts_only_same_port_loopback_page_urls() {
        assert!(validate_ws("ws://127.0.0.1:9335/devtools/page/page-1", 9335, "page-1").is_ok());
        assert!(validate_ws("ws://localhost:9335/devtools/page/page-1", 9335, "page-1").is_ok());
        for value in [
            "ws://example.com:9335/devtools/page/page-1",
            "ws://127.0.0.1:9336/devtools/page/page-1",
            "ws://127.0.0.1:9335/devtools/page/other",
            "ws://127.0.0.1:9335/devtools/page/page-1?token=x",
        ] {
            assert!(
                validate_ws(value, 9335, "page-1").is_err(),
                "accepted {value}"
            );
        }
    }
}
