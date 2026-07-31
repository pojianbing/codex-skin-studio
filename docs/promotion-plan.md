# Codex Skin Studio 推广策划

## 1. 产品定位

Codex Skin Studio 是面向 Codex Desktop 用户的本地主题管理器。它通过本机回环 CDP 在运行时注入统一维护的 CSS 与 renderer payload，支持导入壁纸、主题预览、热切换、托盘守护、会话恢复和一键恢复官方主题。

核心传播句：

> 让 Codex Desktop 拥有自己的主题库，同时保留随时恢复官方外观的退路。

适合强调的卖点：

- 本地主题管理：导入 JPG、PNG、WebP 壁纸生成主题。
- 运行时注入：不修改官方应用包、`app.asar` 或代码签名。
- 热切换：已建立主题会话后，无需重启即可切换主题和参数。
- 安全恢复：暂停皮肤、移除实时 DOM、关闭 CDP，并重启回官方主题。
- 桌面体验：支持 Windows 和 macOS，托盘后台守护，可选登录时后台运行。
- 主题资产透明：主题文件只包含声明式 JSON 和图片，不执行主题自带代码。

需要持续保留的免责声明：

- Codex Skin Studio 不是 OpenAI 官方产品。
- 内置素材来自 MIT 许可预设，但人物、肖像、商标和第三方 IP 素材仍需使用者自行确认授权。
- 主题运行期间会启用本机调试端口；不要同时运行不可信本地程序。

## 2. 目标用户

- 每天高频使用 Codex Desktop 的开发者、设计工程师、独立开发者。
- 喜欢个性化开发环境、终端、编辑器主题和桌面工作流的用户。
- 想把 AI 编程工具从“默认界面”变成“个人工作台”的创作者。
- 愿意尝试非官方增强工具，但重视可恢复和可控风险的高级用户。

## 3. 平台清单

### 首发平台

| 平台 | 目标 | 内容形式 | 发布重点 | 准备素材 |
| --- | --- | --- | --- | --- |
| GitHub | 项目主页、下载和信任背书 | README、Release、Issues、Discussions | 技术原理、安装方式、恢复保证、许可证 | 项目截图、主题预览拼图、安装包、FAQ |
| Product Hunt | 面向国际开发者做首发曝光 | Launch 页面、短视频、评论区答疑 | Theme manager for Codex Desktop | 英文 tagline、3-5 张截图、15-30 秒 demo |
| Hacker News Show HN | 获取开发者反馈 | Show HN 帖子 | 不改包、CDP 注入、可恢复、开源 | 简洁 demo GIF、GitHub 链接、技术说明 |
| X / Twitter | 快速扩散和持续更新 | 短帖、线程、GIF | Before/after、主题热切换 | 8-12 秒循环 GIF、截图、下载链接 |

### 中文开发者社区

| 平台 | 目标 | 内容形式 | 发布重点 | 准备素材 |
| --- | --- | --- | --- | --- |
| V2EX | 找到第一批高级用户 | 分享创造 / 程序员节点帖 | Codex 桌面主题管理、可恢复、开源 | 主题拼图、GitHub 链接、风险说明 |
| 掘金 | 技术文章和实现复盘 | 文章 | Tauri + React + CDP 注入、主题热更新 | 架构图、代码片段、运行效果 GIF |
| 少数派 Matrix | 面向效率工具用户 | 体验文章 | 让 AI 编程桌面变成个人工作台 | 场景图、主题库截图、使用前后对比 |
| 知乎 | 搜索长尾和问答引流 | 回答 / 专栏 | Codex Desktop 能不能换主题、怎么安全恢复 | 操作截图、风险边界、替代方案对比 |

### 内容种草平台

| 平台 | 目标 | 内容形式 | 发布重点 | 准备素材 |
| --- | --- | --- | --- | --- |
| Bilibili | 演示完整体验 | 1-3 分钟视频 | 安装、导入壁纸、热切换、恢复官方主题 | 录屏、封面、字幕、安装包链接 |
| 小红书 | 视觉种草 | 图文笔记 / 短视频 | AI 编程桌面美化、工作台氛围 | 高颜值主题截图、前后对比、封面标题 |
| YouTube Shorts | 海外短视频扩散 | 30-45 秒短视频 | Customize Codex Desktop in seconds | 竖屏录屏、英文字幕、下载 CTA |
| TikTok | 海外轻量曝光 | 15-30 秒短视频 | Desk setup / AI coding aesthetic | 快速切换蒙太奇、音乐节奏点 |

### 长期资产

| 平台 | 目标 | 内容形式 | 发布重点 | 准备素材 |
| --- | --- | --- | --- | --- |
| 官网 / Landing Page | 转化下载 | 单页站 | 一句话定位、下载按钮、FAQ、截图 | Logo、hero 图、主题墙、demo 视频 |
| Discord / Telegram | 用户反馈与主题分享 | 社群频道 | 主题投稿、Bug 反馈、版本预告 | 频道规则、主题提交模板 |
| Reddit | 获取海外小众圈层反馈 | Subreddit 帖子 | 遵守各社区自推广规则，优先讲问题和实现 | Demo GIF、开源链接、透明声明 |
| Indie Hackers | 独立开发叙事 | Build in public | 开发过程、用户增长、开源工具定位 | 里程碑截图、数据看板、发布日志 |

## 4. 推广文案

### 中文短句

1. 给 Codex Desktop 换一套属于你的工作台皮肤。
2. 导入一张壁纸，生成一个本地 Codex 主题。
3. 不改官方包，不碰 `app.asar`，随时恢复官方主题。
4. Codex Skin Studio：为 Codex Desktop 做的本地主题管理器。
5. 主题热切换、托盘守护、一键恢复，把 Codex 变成你的桌面工作台。

### 英文短句

1. A local theme manager for Codex Desktop.
2. Bring your own wallpaper. Turn it into a Codex Desktop theme.
3. Customize Codex Desktop without modifying the official app bundle.
4. Hot-switch themes, keep sessions alive, and restore the official look anytime.
5. Make Codex Desktop feel like your own workspace.

### GitHub README 顶部文案

Codex Skin Studio is a local theme manager for Codex Desktop on Windows and macOS. Import wallpapers, preview layouts, hot-switch themes, keep a tray helper running in the background, and restore the official appearance when you need a clean reset. It uses loopback CDP runtime injection and does not modify the official app bundle, `app.asar`, or code signature.

### Product Hunt 文案

Tagline:

> Local wallpaper themes for Codex Desktop.

Description:

Codex Skin Studio lets you turn local wallpapers into Codex Desktop themes. It supports previewing, safe-area controls, light/dark appearance, hot switching after the first session, tray background recovery, and one-click restore to the official look. It is a community-made utility and not an official OpenAI product.

Maker comment:

I built Codex Skin Studio because I wanted Codex Desktop to feel more like a personal workspace without patching the app itself. The tool injects a maintained renderer payload at runtime through loopback CDP, keeps themes as declarative JSON plus images, and makes restoring the official appearance a first-class action. I would love feedback from Codex power users, especially around theme ergonomics, recovery behavior, and macOS packaging.

### Hacker News / Show HN 文案

Title:

Show HN: Codex Skin Studio - local themes for Codex Desktop

Body:

I built a small Tauri app that manages local wallpaper themes for Codex Desktop on Windows and macOS.

It imports JPG/PNG/WebP wallpapers, generates local themes, previews safe areas, hot-switches themes after the first debug session, and can restore the official appearance by removing injected DOM and restarting Codex normally.

The important constraint was to avoid modifying the official app bundle, `app.asar`, or code signature. The current approach uses loopback CDP runtime injection with a maintained CSS/renderer payload. Themes are declarative JSON plus images and do not execute theme-provided code.

This is a community utility, not an official OpenAI product. I am mainly looking for feedback from people who live in Codex Desktop all day.

### V2EX 文案

标题：

做了一个 Codex Desktop 本地主题管理器：Codex Skin Studio

正文：

最近做了一个小工具 Codex Skin Studio，目标是让 Codex Desktop 可以像编辑器一样拥有自己的主题库。

目前支持导入 JPG / PNG / WebP 壁纸生成本地主题，预览主题布局，设置浅色/深色外观、内容安全区和任务页背景。已经建立主题会话后，切换主题和调整参数可以热更新，不需要每次重启。

实现上没有修改官方应用包、`app.asar` 或代码签名，而是通过本机回环 CDP 做运行时注入。恢复官方主题时会停止 watcher、移除实时 DOM、关闭 CDP，并正常重启 Codex。

它不是 OpenAI 官方产品，主题素材授权也需要使用者自行确认。欢迎 Codex 重度用户试试，尤其想听听大家对恢复流程、主题预览和 macOS 体验的反馈。

### 掘金技术文章标题

1. 我用 Tauri 做了一个 Codex Desktop 本地主题管理器
2. 不改 `app.asar`，如何给 Electron 桌面应用做运行时主题注入
3. Codex Skin Studio：从壁纸导入到主题热切换的实现记录

开头：

Codex Skin Studio 是一个 Windows / macOS 桌面应用，用来给 Codex Desktop 管理本地主题。它看起来像一个皮肤工具，但真正让我在意的是可恢复性：不修改官方应用包，不破坏代码签名，主题文件不执行自带代码，并且提供一键恢复官方主题。

### 小红书文案

标题：

我把 Codex Desktop 变成了自己的 AI 工作台

正文：

每天都在用 Codex，默认界面看久了总想换点氛围。于是做了一个本地主题管理器 Codex Skin Studio。

可以导入自己的壁纸，生成 Codex 主题；内置多套预设；支持深浅色、内容安全区、任务页背景，还能热切换。重点是它不修改官方应用包，想恢复官方主题也可以一键回去。

适合每天长时间使用 Codex Desktop、又想把工作台整理得更顺眼的人。

备注：这是社区工具，不是 OpenAI 官方产品。使用第三方图片做主题前记得确认授权。

### Bilibili 视频脚本

标题：

给 Codex Desktop 换主题：我做了一个本地皮肤管理器

结构：

1. 0:00-0:05 展示默认 Codex 与主题版 Codex 的对比。
2. 0:05-0:20 打开 Codex Skin Studio，展示主题库和内置主题。
3. 0:20-0:35 导入一张本地壁纸，展示预览和安全区调节。
4. 0:35-0:50 点击应用主题，展示 Codex Desktop 变化。
5. 0:50-1:05 展示热切换、暂停、恢复官方主题。
6. 1:05-1:15 说明非官方产品、素材授权和本机调试端口风险。

口播：

这是 Codex Skin Studio，一个给 Codex Desktop 做本地主题管理的小工具。你可以导入自己的壁纸，生成主题，调整内容安全区和外观模式。它不会修改官方应用包，也不会改 `app.asar`，主题会话建立后还能热切换。想回到官方外观时，点恢复官方主题就可以清理注入内容并正常重启 Codex。

## 5. 素材清单

### 已有素材

- 应用图标：`src-tauri/icons/icon.png`、`src-tauri/icons/icon.ico`
- Hero 图：`src/assets/hero.png`
- 内置主题背景：`src-tauri/assets/preset-*.jpg`
- 产品核心文案：`README.md`
- 应用内真实界面：`src/App.tsx` 对应的主题库、预览、外观设置、恢复确认弹窗

### 首批必须制作的素材

| 素材 | 规格 | 用途 | 内容 |
| --- | --- | --- | --- |
| 主截图 | 1600x1000 或 1920x1200 | GitHub、Product Hunt、官网 | Skin Studio 主题库 + 右侧预览 |
| 前后对比图 | 1600x900 | X、小红书、V2EX | 默认 Codex vs 应用主题后的 Codex |
| 主题拼图 | 1600x1200 | 小红书、少数派、官网 | 6-9 个内置主题缩略图 |
| 热切换 GIF | 1280x720，8-12 秒 | GitHub、HN、X | 点击不同主题，Codex 外观实时变化 |
| 恢复官方主题 GIF | 1280x720，6-8 秒 | 技术社区 | 点击恢复，展示回到官方外观 |
| Product Hunt Gallery | 1270x760，3-5 张 | Product Hunt | 功能总览、主题库、导入壁纸、恢复官方 |
| 视频封面 | 1920x1080 | Bilibili、YouTube | “给 Codex Desktop 换主题” + 界面截图 |
| 竖屏短视频 | 1080x1920，15-30 秒 | 小红书、TikTok、Shorts | 快速切换 3 个主题，结尾展示应用名称 |

### 推荐截图镜头

1. 主题库全景：左侧主题卡片、右侧实时预览、底部应用按钮。
2. 导入壁纸：文件选择后主题加入本地主题库的瞬间。
3. 外观控制：跟随系统、浅色、深色的分段控件。
4. 安全区控制：展示左侧、右侧、居中、关闭的视觉差异。
5. 托盘守护：窗口关闭后后台运行，重新打开仍保持状态。
6. 恢复官方主题：确认弹窗 + 恢复后的 Codex。

## 6. 发布节奏

### 第 1 周：准备期

- 补齐 README 中的安装包下载、截图、FAQ 和安全说明。
- 录制 1 条横屏 demo、1 条竖屏短视频、2 张前后对比图。
- 准备 GitHub Release，包含 Windows 和 macOS 安装包。
- 建立 issue 模板：Bug、主题兼容、素材授权、平台问题。

### 第 2 周：首发期

- Day 1：GitHub Release + X 线程。
- Day 2：V2EX 分享创造 + 掘金技术文章。
- Day 3：Product Hunt。
- Day 4：Show HN。
- Day 5：Bilibili 视频 + 小红书图文。
- Day 6-7：集中回复反馈，整理 FAQ，发布补丁版本。

### 第 3-4 周：二次传播

- 发布“如何制作自己的 Codex 主题”教程。
- 收集用户主题投稿，做主题墙。
- 写一篇实现复盘：为什么选择运行时注入而不是修改包。
- 开启主题征集：每周精选 3 个用户主题。

## 7. 首发检查清单

- [ ] 确认 Windows 安装包可下载并可卸载。
- [ ] 确认 macOS 打包和首次运行说明完整。
- [ ] README 首页展示 1 张主截图和 1 个 GIF。
- [ ] 发布页明确写出“非官方产品”。
- [ ] 发布页明确写出 CDP 本机调试端口风险。
- [ ] 发布页明确写出第三方图片授权提示。
- [ ] 准备 5 条常见问题答复。
- [ ] 准备 3 个可复制的社媒短帖。
- [ ] 建立反馈收集渠道。

## 8. 常见问题答复

Q: 这会修改 Codex 官方应用吗？

A: 不会。当前实现不修改官方应用包、`app.asar` 或代码签名，而是在运行时通过本机回环 CDP 注入维护好的 CSS 和 renderer payload。

Q: 可以随时恢复官方主题吗？

A: 可以。应用提供恢复官方主题操作，会停止 watcher、移除实时 DOM、关闭 CDP，并以普通模式重启 Codex。

Q: 主题文件会执行代码吗？

A: 不会。主题文件只包含声明式 JSON 和图片，不执行主题自带代码。

Q: 为什么第一次应用主题可能需要重启 Codex？

A: Electron 的远程调试端口只能在主进程启动时开启。首次接管普通模式运行的 Codex 时需要重启；主题会话建立后切换主题可以热更新。

Q: 这是 OpenAI 官方工具吗？

A: 不是。Codex Skin Studio 是社区工具，不是 OpenAI 官方产品。

## 9. 参考链接

- Product Hunt Launch Guide: https://www.producthunt.com/launch
- Hacker News Guidelines: https://news.ycombinator.com/newsguidelines.html
- GitHub Releases Docs: https://docs.github.com/repositories/releasing-projects-on-github/about-releases
- GitHub Topics Docs: https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics
- Reddit Self-Promotion Guidance: https://www.reddit.com/wiki/selfpromotion/
- 少数派 Matrix: https://sspai.com/matrix
- 掘金创作者中心: https://juejin.cn/creator/content
- 小红书创作者中心: https://creator.xiaohongshu.com/
- V2EX 分享创造节点: https://www.v2ex.com/go/create
