# 图片与真实 Codex 视觉验收

主题完成的标准是“真实 Codex 中可用”，不是仅在 Studio 卡片或静态预览中看起来合理。

## 资源级验收

1. 用 `ffprobe` 确认最终 JPG 与仓库占多数的预设尺寸一致。
2. 确认文件可解析、小于 16 MB、没有拉伸、色带或明显 JPEG 瑕疵。
3. 查看完整原图，重点检查：
   - 前景、中景、背景层次明确；
   - 主要主体没有被右侧/左侧内容安全区的 UI 遮挡；
   - 顶部约 36px 没有关键面部、文字或焦点物体；
   - 安静区域仍有材质和氛围，但不会干扰正文。
4. 用与项目相同的 cover 逻辑生成临时缩略图并查看：

```powershell
ffmpeg -y -i src-tauri/assets/preset-<slug>.jpg -vf "scale=640:360:force_original_aspect_ratio=increase,crop=640:360" -q:v 2 $env:TEMP\preset-<slug>-thumb.jpg
```

缩略图必须在没有文字标签的情况下仍能识别主题，主体不能被居中 16:9 裁切移除。

## 启动前验证

先完成所有静态命令：

```powershell
cargo fmt --all -- --check
cargo test
npm run build
npm run lint
git diff --check
```

检查 diff，确保只包含预期图片、注册和测试变化；不要覆盖用户已有的 renderer 或 App 修改。

## 找到真实 Codex renderer

状态文件位于：

```powershell
$statePath = Join-Path $env:LOCALAPPDATA 'codex\CodexSkinStudio\data\engine-state.json'
$state = Get-Content -Raw $statePath | ConvertFrom-Json
$targets = Invoke-RestMethod "http://127.0.0.1:$($state.port)/json/list"
$targets | Where-Object { $_.type -eq 'page' -and $_.url -like 'app://*' }
```

只连接回环地址、状态文件指定端口和 `/devtools/page/<id>` 形状的 WebSocket。选择同时存在 `main.main-surface` 与 `aside.app-shell-left-panel` 的 page target。不要连接普通浏览器网页或非 Codex target。

若 Studio/Codex 未运行，启动项目已有的桌面开发流程并通过 Studio 激活新主题；不要仅修改运行时状态文件来伪造激活结果。确认 `activeThemeId` 是新主题。

## 计算样式检查

通过 target 的 `webSocketDebuggerUrl` 发送 CDP `Runtime.evaluate`。至少采集：

```javascript
(() => {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const style = (selector) => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const value = getComputedStyle(node);
    return {
      display: value.display,
      color: value.color,
      background: value.background,
      borderColor: value.borderColor,
      backdropFilter: value.backdropFilter,
    };
  };
  return {
    revision: window.__CODEX_SKIN_STUDIO_STATE__?.revision ?? null,
    rootClasses: [...root.classList],
    art: css.getPropertyValue('--skin-art').trim(),
    artPosition: css.getPropertyValue('--skin-art-position').trim(),
    accent: css.getPropertyValue('--skin-accent').trim(),
    composerOpacity: css.getPropertyValue('--skin-composer-opacity').trim(),
    sidebar: style('aside.app-shell-left-panel'),
    appMenu: style('[class~="group/application-menu-top-bar"]'),
    header: style('main.main-surface > header.app-header-tint'),
    composer: style('.composer-surface-chrome'),
    environment: style('.skin-environment-panel-surface'),
    activity: style('.skin-activity-card-surface'),
    hiddenFooterLayers: [...document.querySelectorAll('.skin-composer-footer-backdrop')]
      .map((node) => getComputedStyle(node).display),
  };
})()
```

预期根节点包含 `codex-skin-studio`、一个固定的 `skin-theme-*` class、一个 `skin-safe-*` class 和 `skin-task-ambient`。`art` 不能为 `none`，所有 `.skin-composer-footer-backdrop` 的计算 display 应为 `none`，而 composer 自身不能是 `none`。

## 截图验收

使用 CDP `Page.captureScreenshot` 捕获当前桌面视口 PNG，并保存到可追踪的临时或 QA 路径。查看截图，而不是只判断 API 成功。

至少观察以下区域：

1. 顶部应用菜单：必须与 header 主题一致，文字和图标可读，不能透明到消失。
2. 左侧栏和任务行：选中、hover 与背景保持层次，不形成大面积白雾。
3. 对话正文：图片仍可感知，但文字、链接、引用、表格和代码块对比充分。
4. 输入框：组件边界清晰；其上方装饰渐变默认隐藏；底部没有突兀黑带。
5. 环境面板、活动卡和 Diff：padding 正常、标题不贴边、语义色可辨认。
6. 主体：未被菜单、侧栏、输入框或主内容梯度完全遮挡。

若明亮图片让组件发灰发白，先把 `sidebar` / `surface` / `raised` 调为图片阴影色并提高 opacity；若画面被 UI 完全吞没，再逐步降低 opacity 或重新调整 safe area。每次修改后重新运行相关测试、重新激活并截图。

## 无法实时验收时

若本机没有可连接的 Codex renderer，仍完成图片、注册、测试和静态构建，但在交付中明确写出“未完成真实 Codex CDP 截图验收”及原因。不要用 Studio 的 React 预览替代该结论。
