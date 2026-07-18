# Codex Skin Studio

Windows 和 macOS 的 Codex Desktop 本地主题管理器。应用通过回环 CDP 在运行时注入统一维护的 CSS 与 renderer payload，不修改官方应用包、`app.asar` 或代码签名。

## 功能

- 导入 JPG、PNG、WebP 壁纸并生成本地主题
- 导入和导出单文件 `.codex-theme` 主题包，保留背景图和全部组件配置
- 主题商店从官方 GitHub Release 读取签名目录，校验主题包 SHA-256 后安装或更新
- 主题预览、浅色/深色外观、内容安全区和任务页模式
- 本机 CDP 注入与 renderer 路由重注入
- 已建立主题会话时无重启热切换
- 托盘后台守护、会话自动恢复和可选的登录时后台运行
- 暂停当前皮肤
- 停止 watcher、移除实时 DOM、关闭 CDP 并正常重启 Codex
- 主题文件只包含声明式 JSON 和图片，不执行主题自带代码

内置主题同步自 `Fei-Away/Codex-Dream-Skin` 的可运行 preset：琥珀黄昏、赛博霓虹、森野薄雾、午夜极光、桥本有菜和樱粉晨曦。仓库中的 UI 概念截图不作为背景导入。

## 开发

```powershell
npm install
npm run desktop:dev
```

检查与构建：

```powershell
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run desktop:build
```

## 本地数据

- Windows：`%LOCALAPPDATA%\codex\CodexSkinStudio\data`
- macOS：`~/Library/Application Support/studio.codex.CodexSkinStudio`

主题存放在数据目录的 `themes/<theme-id>`。引擎状态写入 `engine-state.json`，采用同目录临时文件和可恢复替换。

`.codex-theme` 是 Skin Studio 的 ZIP 主题包，固定包含 `bundle.json` 和一张 JPG、PNG 或 WebP 背景图。导入时应用会重新生成缩略图、验证组件配置及图片限制，并创建新的本地主题副本；主题包不包含引擎状态、CDP 连接信息或可执行代码。

主题商店仅连接 `pojianbing/codex-skin-themes` 最新正式 GitHub Release 的公开下载地址，不调用易受未认证配额限制的 REST API。客户端固定内置 Ed25519 公钥，要求 `catalog.json` 与 `catalog.sig` 验签通过，并将主题包的实际大小和 SHA-256 与目录交叉校验。网络不可用时使用上次验证成功的目录缓存；不会自动安装或自动更新主题。

## 恢复保证

当前版本不修改 Codex 的 `config.toml`。恢复官方主题时会停止应用内 watcher、仅连接保存的 Browser ID 清理实时 DOM、关闭已验证路径下的 Codex 进程，然后不带调试参数重新启动官方应用。

首次接管一个以普通模式运行的 Codex 时仍需要重启，因为 Electron 的远程调试端口只能在主进程启动时开启。主题会话建立后，切换主题和调整参数都会直接热更新。关闭 Skin Studio 主窗口只会将它收进系统托盘；启用“登录时后台运行”后，守护进程会在登录时恢复活动会话，并在检测到 Codex 以普通模式重新打开后尽早重新接管。用户主动退出 Codex 时，守护进程不会自行再次打开它。

CDP 只绑定回环地址，但同一用户下的本地进程仍可能访问调试端口。主题运行期间不要运行不可信程序。

## 素材与许可

内置主题素材来自 Fei-Away/Codex-Dream-Skin 的 MIT 许可预设。人物、肖像、商标和第三方 IP 素材仍需使用者自行确认权利，不因代码许可自动获得商业使用授权。应用代码使用 MIT License。Codex Skin Studio 不是 OpenAI 官方产品。
