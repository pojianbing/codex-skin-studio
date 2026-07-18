import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

if (process.platform !== "win32") {
  process.exit(0);
}

const executablePath = resolve(
  "src-tauri",
  "target",
  "debug",
  "codex-skin-studio.exe",
).replace(/'/g, "''");

const command = `
$ErrorActionPreference = 'Stop'
$target = '${executablePath}'
$matchingProcesses = @(
  Get-CimInstance Win32_Process -Filter "Name = 'codex-skin-studio.exe'" |
    Where-Object {
      $_.ExecutablePath -and
      [System.IO.Path]::GetFullPath($_.ExecutablePath).Equals(
        $target,
        [System.StringComparison]::OrdinalIgnoreCase
      )
    }
)

foreach ($process in $matchingProcesses) {
  Write-Host "Stopping stale desktop process (PID $($process.ProcessId))."
  Stop-Process -Id $process.ProcessId -Force
}
`;

try {
  execFileSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
    { stdio: "inherit" },
  );
} catch (error) {
  console.error("Could not stop the stale desktop process.");
  process.exit(error.status ?? 1);
}
