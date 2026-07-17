---
name: generate-codex-theme
description: 根据用户对壁纸内容的自然语言描述，在 CodexSkinStudio 中端到端生成新的 Codex Desktop 内置主题：调用 imagegen 创建有层次感的 3D 位图，按现有预设尺寸规范化，为图片提取并配置匹配的组件主题，注册 Rust 内置资源，并完成构建、测试和真实 Codex 视觉验收。用户说“生成主题”“添加壁纸主题”“按这段画面描述制作主题”“为图片适配 Codex 组件”，或只描述希望看到的图片内容时使用。
---

# 生成 Codex 主题

把用户的画面描述直接变成可用的 CodexSkinStudio 内置主题。除非缺少必需的参考图片，否则不要要求用户补充主题 ID、名称、配色、外观模式或组件参数；从画面和仓库约定中推导这些值并完成实现。

## 开始前

1. 完整阅读 [references/theme-schema.md](references/theme-schema.md) 和 [references/visual-qa.md](references/visual-qa.md)。
2. 阅读仓库根目录的 `AGENTS.md`（若存在），遵守工作区和 Git 约束。
3. 检查 `git status --short`。保留所有已有修改，不重置、不覆盖无关工作。
4. 重新检查 `src-tauri/src/themes.rs`、`src-tauri/src/models.rs`、`src-tauri/assets/renderer-inject.js` 和 `src-tauri/assets/renderer.css`。仓库实现优先于本技能中的快照信息。
5. 用 `ffprobe` 或可靠的图像库统计 `src-tauri/assets/preset-*.jpg` 的尺寸，以占多数的尺寸为本次目标。当前基准是 `1920x1200`（16:10），但不要假定它永远不变。

## 从描述形成主题规格

只需把用户的画面内容当作必需输入，并自行确定：

- 唯一的英文 kebab-case ID，格式为 `preset-<slug>`；
- 简短、有辨识度的中文主题名；
- 主体焦点 `focus_x` / `focus_y` 和内容安全区；
- 固定的 `appearance`，以及完整的图片匹配组件配色；
- 图片生成最终提示词。

先用 `rg` 确认 ID、常量名、中文名和文件名均未冲突。不要给主题增加浅色/深色切换；每个主题只使用最适合图片的固定外观。默认优先选择深色烟熏玻璃组件，即使壁纸明亮也不要使用大面积发白的半透明面板。只有在图片和真实 Codex 验收都明确支持时才选择 `light`。

## 生成图片

1. 调用 `$imagegen`，并先完整阅读该技能的 `SKILL.md`。
2. 在用户描述之外，给生成提示词补充以下默认要求：
   - 有明确前景、中景、背景和遮挡关系的高质量 3D 场景；
   - 材质、体积光、阴影和景深形成真实层次，不使用廉价塑料感；
   - 主要视觉尽量位于右侧，左侧保留低细节、低对比的对话可读区；
   - 顶部约 36px 不放面部、文字或关键细节，为应用菜单栏留出安全区；
   - 中央 16:9 裁切后仍能识别主题主体；
   - 不生成文字、徽标、水印、假 UI 或可读代码。
3. 如果用户指定了不同构图或风格，以用户要求为准，但仍保留 Codex 可读区和裁切安全性。
4. 生成后立即用图像查看工具检查完整画面。若主体位置、层次、顶部安全区或可读区不合格，重新生成，不要靠组件遮罩掩盖失败的构图。

## 规范化图片

将最终图像写入 `src-tauri/assets/preset-<slug>.jpg`。使用高质量 cover 缩放加居中裁切，使其与本次检测到的目标尺寸完全一致。例如当前基准可用：

```powershell
ffmpeg -y -i <generated-image> -vf "scale=1920:1200:force_original_aspect_ratio=increase,crop=1920:1200" -q:v 2 -map_metadata -1 src-tauri/assets/preset-<slug>.jpg
```

不要拉伸图片。确认文件小于项目的 16 MB 上限，并再次核对宽高。额外生成一个临时 `640x360` 居中 cover 裁切用于检查主题卡片；不要把临时 QA 图片留在资源目录。

## 注册并适配组件

只用 `apply_patch` 手工修改文本文件。按 [references/theme-schema.md](references/theme-schema.md) 中的清单完成 `src-tauri/src/themes.rs`：

1. 为 JPG 添加 `include_bytes!` 常量。
2. 在 `component_theme` 中添加完整 `ComponentTheme` 分支，所有颜色都从图片视觉语言推导。
3. 在 `ensure_library` 中添加 `seed_one`，写入 ID、中文名、主强调色、焦点和安全区。
4. 将 `BUILTIN_THEME_VERSION` 的 patch 版本增加一次，确保已安装的内置主题配置迁移。同步所有硬编码版本断言。
5. 把图片常量加入 bundled-image 测试，把 ID 和固定外观加入组件适配测试。

保持 `show_footer_backdrop: false`。应用菜单栏沿用 `ui.header` 主题配置；不要为单个主题修改全局 renderer 选择器。组件必须服务于图片，但正文、代码、Diff、引用和菜单的可读性高于“尽可能透明”。

## 验证和迭代

依次运行：

```powershell
cargo fmt --all -- --check
cargo test
npm run build
npm run lint
git diff --check
```

任何失败都要定位并修复。然后按 [references/visual-qa.md](references/visual-qa.md) 在真实 Codex Desktop 中激活主题，检查计算样式并截取桌面视口截图。至少确认：

- 图片未变形，主体、顶部菜单和对话内容互不冲突；
- 根节点使用预期的固定外观和安全区 class；
- 侧栏、应用菜单、输入框、环境面板、活动卡片、代码块和 Diff 均已应用主题；
- 明亮壁纸上没有发白、低对比的组件；
- 输入框上方黑色渐变默认隐藏，但 `.composer-surface-chrome` 本身仍可见；
- 活动标题内边距和高度正常，文字或图标没有重叠。

根据真实截图调整 `ComponentTheme` 的颜色、透明度、模糊、圆角、阴影和正文宽度，重复验证，直到图片与组件成为同一个视觉系统。

## 交付

最后简洁报告：主题 ID 和中文名、图片文件路径、最终图片提示词、固定外观和安全区、修改的注册点、验证命令结果、真实 Codex 截图路径。明确说明任何未能完成的实时验收，不要把静态预览当作真实 Codex 验收。
