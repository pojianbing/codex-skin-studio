use crate::{
    error::{Result, StudioError},
    models::CodexInstall,
};
use std::{
    net::TcpListener,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

fn is_main_codex_command(command: &str) -> bool {
    !command
        .split_ascii_whitespace()
        .any(|argument| argument == "--type" || argument.starts_with("--type="))
}

pub fn platform_label() -> String {
    #[cfg(target_os = "windows")]
    {
        "Windows".into()
    }
    #[cfg(target_os = "macos")]
    {
        "macOS".into()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::env::consts::OS.into()
    }
}

#[cfg(target_os = "windows")]
pub fn find_codex() -> Result<Option<CodexInstall>> {
    let script = r#"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $p=Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1; if($p -and $p.SignatureKind -eq 'Store' -and -not $p.IsDevelopmentMode){ $exe=Join-Path $p.InstallLocation 'app\ChatGPT.exe'; if(Test-Path -LiteralPath $exe){ [pscustomobject]@{executable=$exe;version="$($p.Version)"} | ConvertTo-Json -Compress } }"#;
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()?;
    if !output.status.success() {
        return Err(StudioError::from(
            "无法验证 Microsoft Store 中的 Codex 安装",
        ));
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Ok(None);
    }
    let value: serde_json::Value = serde_json::from_str(&text)?;
    let executable = value
        .get("executable")
        .and_then(|item| item.as_str())
        .ok_or_else(|| StudioError::from("Codex 安装信息缺少可执行文件"))?;
    Ok(Some(CodexInstall {
        executable: executable.into(),
        bundle: None,
        version: value
            .get("version")
            .and_then(|item| item.as_str())
            .map(str::to_owned),
    }))
}

#[cfg(target_os = "macos")]
pub fn find_codex() -> Result<Option<CodexInstall>> {
    use std::path::Path;
    let home = std::env::var("HOME").unwrap_or_default();
    let candidates = [
        "/Applications/ChatGPT.app".to_string(),
        "/Applications/Codex.app".to_string(),
        format!("{home}/Applications/ChatGPT.app"),
        format!("{home}/Applications/Codex.app"),
    ];
    for bundle in candidates {
        if !Path::new(&bundle).is_dir() {
            continue;
        }
        let identifier = Command::new("/usr/bin/plutil")
            .args([
                "-extract",
                "CFBundleIdentifier",
                "raw",
                "-o",
                "-",
                &format!("{bundle}/Contents/Info.plist"),
            ])
            .output()?;
        if String::from_utf8_lossy(&identifier.stdout).trim() != "com.openai.codex" {
            continue;
        }
        let signature = Command::new("/usr/bin/codesign")
            .args(["--verify", "--deep", "--strict", &bundle])
            .output()?;
        if !signature.status.success() {
            return Err(StudioError::from("Codex 应用签名无效，请重新安装官方应用"));
        }
        let details = Command::new("/usr/bin/codesign")
            .args(["-dv", "--verbose=4", &bundle])
            .output()?;
        let details = String::from_utf8_lossy(&details.stderr);
        let team_id = details
            .lines()
            .find_map(|line| line.strip_prefix("TeamIdentifier="));
        if team_id != Some("2DC432GLL2") {
            return Err(StudioError::from("Codex 应用签名团队与 OpenAI 不匹配"));
        }
        let executable_name = Command::new("/usr/bin/plutil")
            .args([
                "-extract",
                "CFBundleExecutable",
                "raw",
                "-o",
                "-",
                &format!("{bundle}/Contents/Info.plist"),
            ])
            .output()?;
        let executable = format!(
            "{bundle}/Contents/MacOS/{}",
            String::from_utf8_lossy(&executable_name.stdout).trim()
        );
        let version = Command::new("/usr/bin/plutil")
            .args([
                "-extract",
                "CFBundleShortVersionString",
                "raw",
                "-o",
                "-",
                &format!("{bundle}/Contents/Info.plist"),
            ])
            .output()
            .ok()
            .map(|item| String::from_utf8_lossy(&item.stdout).trim().to_string());
        return Ok(Some(CodexInstall {
            executable,
            bundle: Some(bundle),
            version,
        }));
    }
    Ok(None)
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn find_codex() -> Result<Option<CodexInstall>> {
    Ok(None)
}

pub fn select_port(preferred: u16) -> Result<u16> {
    for port in preferred..=preferred.saturating_add(100) {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }
    Err(StudioError::from("没有找到可用的本机 CDP 端口"))
}

#[cfg(target_os = "windows")]
fn windows_processes(install: &CodexInstall) -> Result<Vec<(u32, String)>> {
    let script = r#"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Select-Object ProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress"#;
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()?;
    if !output.status.success() {
        return Err(StudioError::from("无法检查 Codex 进程"));
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let value: serde_json::Value =
        serde_json::from_str(text.trim()).unwrap_or_else(|_| serde_json::Value::Array(Vec::new()));
    let values = value.as_array().cloned().unwrap_or_else(|| {
        if value.is_object() {
            vec![value]
        } else {
            Vec::new()
        }
    });
    Ok(values
        .into_iter()
        .filter_map(|item| {
            let path = item
                .get("ExecutablePath")
                .or_else(|| item.get("executablePath"))?
                .as_str()?;
            if path.eq_ignore_ascii_case(&install.executable) {
                let pid = item
                    .get("ProcessId")
                    .or_else(|| item.get("processId"))?
                    .as_u64()
                    .and_then(|pid| u32::try_from(pid).ok())?;
                let command = item
                    .get("CommandLine")
                    .or_else(|| item.get("commandLine"))
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_owned();
                Some((pid, command))
            } else {
                None
            }
        })
        .collect())
}

#[cfg(target_os = "windows")]
pub fn running_pids(install: &CodexInstall) -> Result<Vec<u32>> {
    Ok(windows_processes(install)?
        .into_iter()
        .map(|(pid, _)| pid)
        .collect())
}

#[cfg(target_os = "windows")]
pub fn main_pids(install: &CodexInstall) -> Result<Vec<u32>> {
    Ok(windows_processes(install)?
        .into_iter()
        .filter_map(|(pid, command)| is_main_codex_command(&command).then_some(pid))
        .collect())
}

#[cfg(target_os = "macos")]
pub fn running_pids(install: &CodexInstall) -> Result<Vec<u32>> {
    let output = Command::new("/bin/ps")
        .args(["-axo", "pid=,command="])
        .output()?;
    let text = String::from_utf8_lossy(&output.stdout);
    Ok(text
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            let split = line.find(char::is_whitespace)?;
            let pid = line[..split].parse().ok()?;
            let command = line[split..].trim_start();
            command.starts_with(&install.executable).then_some(pid)
        })
        .collect())
}

#[cfg(target_os = "macos")]
pub fn main_pids(install: &CodexInstall) -> Result<Vec<u32>> {
    let output = Command::new("/bin/ps")
        .args(["-axo", "pid=,command="])
        .output()?;
    let text = String::from_utf8_lossy(&output.stdout);
    Ok(text
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            let split = line.find(char::is_whitespace)?;
            let pid = line[..split].parse().ok()?;
            let command = line[split..].trim_start();
            (command.starts_with(&install.executable) && is_main_codex_command(command))
                .then_some(pid)
        })
        .collect())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn running_pids(_install: &CodexInstall) -> Result<Vec<u32>> {
    Ok(Vec::new())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn main_pids(_install: &CodexInstall) -> Result<Vec<u32>> {
    Ok(Vec::new())
}

#[cfg(target_os = "windows")]
pub fn verify_cdp_owner(install: &CodexInstall, port: u16) -> Result<bool> {
    let script = format!(
        r#"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); @((Get-NetTCPConnection -State Listen -LocalPort {port} -ErrorAction SilentlyContinue) | ForEach-Object {{ $p=Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" -ErrorAction SilentlyContinue; [pscustomobject]@{{address="$($_.LocalAddress)";path="$($p.ExecutablePath)"}} }}) | ConvertTo-Json -Compress"#
    );
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()?;
    if !output.status.success() {
        return Ok(false);
    }
    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .unwrap_or_else(|_| serde_json::Value::Array(Vec::new()));
    let values = value.as_array().cloned().unwrap_or_else(|| {
        if value.is_object() {
            vec![value]
        } else {
            Vec::new()
        }
    });
    if values.is_empty() {
        return Ok(false);
    }
    Ok(values.iter().all(|item| {
        let address = item
            .get("address")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        let path = item
            .get("path")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        matches!(address, "127.0.0.1" | "::1") && path.eq_ignore_ascii_case(&install.executable)
    }))
}

#[cfg(target_os = "macos")]
pub fn verify_cdp_owner(install: &CodexInstall, port: u16) -> Result<bool> {
    let output = Command::new("/usr/sbin/lsof")
        .args(["-nP", &format!("-iTCP:{port}"), "-sTCP:LISTEN", "-Fpnt"])
        .output()?;
    if !output.status.success() {
        return Ok(false);
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut pids = Vec::new();
    let mut addresses = Vec::new();
    for line in text.lines() {
        if let Some(value) = line
            .strip_prefix('p')
            .and_then(|value| value.parse::<u32>().ok())
        {
            pids.push(value);
        }
        if let Some(value) = line.strip_prefix('n') {
            addresses.push(value.to_owned());
        }
    }
    if pids.is_empty()
        || addresses.is_empty()
        || !addresses
            .iter()
            .all(|value| value.starts_with("127.0.0.1:") || value.starts_with("[::1]:"))
    {
        return Ok(false);
    }
    let running = running_pids(install)?;
    Ok(pids.iter().all(|pid| running.contains(pid)))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn verify_cdp_owner(_install: &CodexInstall, _port: u16) -> Result<bool> {
    Ok(false)
}

pub fn stop_codex(install: &CodexInstall) -> Result<()> {
    let pids = running_pids(install)?;
    #[cfg(target_os = "windows")]
    for pid in &pids {
        let _ = Command::new("taskkill.exe")
            .args(["/PID", &pid.to_string()])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(target_os = "macos")]
    for pid in &pids {
        let _ = Command::new("/bin/kill")
            .args(["-TERM", &pid.to_string()])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let deadline = Instant::now() + Duration::from_secs(4);
    while Instant::now() < deadline {
        if running_pids(install)?.is_empty() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(200));
    }

    // Re-resolve the exact executable path before escalation so a recycled PID
    // can never cause an unrelated process to receive a force signal.
    let remaining = running_pids(install)?;
    #[cfg(target_os = "windows")]
    for pid in &remaining {
        let _ = Command::new("taskkill.exe")
            .args(["/PID", &pid.to_string(), "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(target_os = "macos")]
    for pid in &remaining {
        let _ = Command::new("/bin/kill")
            .args(["-KILL", &pid.to_string()])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let deadline = Instant::now() + Duration::from_secs(4);
    while Instant::now() < deadline {
        if running_pids(install)?.is_empty() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(200));
    }
    Err(StudioError::from("Codex 没有在限定时间内退出"))
}

#[cfg(target_os = "windows")]
pub fn launch_with_cdp(install: &CodexInstall, port: u16) -> Result<()> {
    Command::new(&install.executable)
        .args([
            "--remote-debugging-address=127.0.0.1",
            &format!("--remote-debugging-port={port}"),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn launch_with_cdp(install: &CodexInstall, port: u16) -> Result<()> {
    let bundle = install
        .bundle
        .as_ref()
        .ok_or_else(|| StudioError::from("Codex bundle 路径缺失"))?;
    Command::new("/usr/bin/open")
        .args([
            "-na",
            bundle,
            "--args",
            "--remote-debugging-address=127.0.0.1",
            &format!("--remote-debugging-port={port}"),
        ])
        .spawn()?;
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn launch_with_cdp(_install: &CodexInstall, _port: u16) -> Result<()> {
    Err(StudioError::from("当前平台不支持 Codex Desktop"))
}

#[cfg(target_os = "windows")]
pub fn launch_normal(install: &CodexInstall) -> Result<()> {
    Command::new(&install.executable)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn launch_normal(install: &CodexInstall) -> Result<()> {
    let bundle = install
        .bundle
        .as_ref()
        .ok_or_else(|| StudioError::from("Codex bundle 路径缺失"))?;
    Command::new("/usr/bin/open")
        .args(["-na", bundle])
        .spawn()?;
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn launch_normal(_install: &CodexInstall) -> Result<()> {
    Err(StudioError::from("当前平台不支持 Codex Desktop"))
}

#[cfg(test)]
mod tests {
    use super::is_main_codex_command;

    #[test]
    fn distinguishes_electron_main_and_helper_processes() {
        assert!(is_main_codex_command(
            r#"C:\Program Files\Codex\ChatGPT.exe --remote-debugging-port=9335"#
        ));
        assert!(!is_main_codex_command(
            r#"C:\Program Files\Codex\ChatGPT.exe --type=renderer --lang=zh-CN"#
        ));
        assert!(!is_main_codex_command(
            r#"C:\Program Files\Codex\ChatGPT.exe --type crashpad-handler"#
        ));
    }
}
