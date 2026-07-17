# CodexSkinStudio 主题注册与组件适配

这份参考描述当前项目的主题契约。执行时先读源码；字段或实现若已变化，以源码为准并同步更新本技能。

## 需要修改的注册点

一个新的内置主题通常只新增 JPG，并修改 `src-tauri/src/themes.rs`：

1. 文件顶部的 `include_bytes!` 常量。
2. `component_theme(id)` 中的 `ComponentTheme` 分支。
3. `ensure_library()` 中的 `seed_one(...)`。
4. 测试模块的常量 import、bundled-image 数组和 `(id, appearance)` 数组。
5. `BUILTIN_THEME_VERSION` 及对应版本断言。

不要直接创建运行时 `theme.json`。`builtin_manifest`、`apply_component_theme` 和 `seed_manifest` 会生成背景、640x360 缩略图和清单，并按内置版本执行一次迁移。

## 图片和构图字段

`seed_one` 参数的含义：

- `id`: `preset-<slug>`，只能使用 ASCII 字母、数字、`-` 或 `_`。
- `name`: 1 至 80 个字符的主题显示名。
- `accent`: 主强调色，必须是 `#RRGGBB`。
- `focus_x`, `focus_y`: `0.0..=1.0`，对应 CSS `background-position`。
- `safe_area`: `left`、`right`、`center` 或 `none`。

主体位于右侧时通常使用 `focus_x = 0.72..0.85`、`focus_y = 0.42..0.52`、`safe_area = "left"`。主体位于左侧时反向处理。`task_mode` 对内置主题保持 `ambient`。

项目使用 `resize_to_fill(640, 360)` 生成主题卡片，因此 16:10 原图会在缩略图中裁掉上下区域。关键视觉不能只出现在最顶端或最底端。

## ComponentTheme 字段

当前概要字段如下：

| 字段 | 作用 | 选择原则 |
| --- | --- | --- |
| `appearance` | Codex 固定外观 | 默认 `dark`；不暴露切换 |
| `accent` | 链接、选中态、滚动等强调 | 从主体中选择清晰但不过曝的色彩 |
| `sidebar` | 侧栏基色 | 从图片阴影取带色近黑或深中性色 |
| `surface` | 菜单、输入框、面板基色 | 比 sidebar 略亮，保持烟熏玻璃感 |
| `raised` | 用户气泡、活动卡、Diff、引用 | 比 surface 再亮一阶，不能像白色浮层 |
| `code` | 代码块和行内代码 | 全组最暗，保证代码对比 |
| `line` | 边框、表格、滚动条 | 图片中的低饱和中间色 |
| `quote` | 引用强调 | 使用与 accent 可区分的次强调色 |
| `added` / `deleted` | Diff 语义色 | 保持绿/红语义，并与背景有对比 |
| `sidebar_opacity` | 侧栏遮罩强度 | 根据图片亮度和复杂度调节 |
| `panel_opacity` | 主要组件遮罩强度 | 明亮/繁杂图片使用更高值 |
| `blur` | 玻璃模糊 | 通常 `12..20` |
| `radius` | 组件圆角基准 | 工业主题 `10..12`，柔和主题 `14..16` |
| `shadow` | `none` / `soft` / `strong` | 明亮、繁杂背景通常需 `strong` |
| `content_width` | 正文最大宽度 | 通常 `700..800` |

## 透明度起点

先按图片复杂度选择一组起点，再以真实截图调整：

| 图片状态 | `sidebar_opacity` | `panel_opacity` | `blur` | `shadow` |
| --- | ---: | ---: | ---: | --- |
| 明亮或细节繁杂 | `0.88..0.94` | `0.78..0.86` | `12..18` | `strong` |
| 明暗平衡 | `0.80..0.88` | `0.70..0.80` | `16..20` | `soft` |
| 深色且安静 | `0.70..0.82` | `0.62..0.74` | `14..18` | `none` / `soft` |

这些值是起点，不是硬性模板。明亮图片不要通过切到浅色 UI 来解决对比问题；优先使用取自图片阴影的深色玻璃面板。

## apply_component_theme 的派生关系

`apply_component_theme` 会从概要字段派生完整清单，包括：

- `composer`、`environment` 和 `change_summary`；
- 侧栏、标题栏/应用菜单、用户消息、代码块和活动卡片；
- 任务行、摘要行、消息导航轨和滚动条；
- Diff、正文宽度、链接、行内代码、引用、表格和图片圆角。

必须保留 `composer.show_footer_backdrop = false`。`ui.header` 同时为会话标题栏和顶部应用菜单提供颜色；应用菜单注入会保证至少 `0.72` 的不透明度。活动卡标题的 `6px 10px` padding 和 `34px` 最小高度由 renderer 全局处理，不要在单主题注册中重复实现。

## 验证范围约束

当前校验范围包括：

- `appearance`: `auto` / `light` / `dark`；本技能生成的内置主题应固定为 `light` 或 `dark`。
- 颜色：`auto` 或 `#RRGGBB`，但 ComponentTheme 派生后的关键颜色不应为 `auto`。
- opacity: `0..1`；blur: `0..32`。
- 环境/摘要 radius: `8..32`；surface radius: `0..32`；row radius: `0..24`。
- content width: `560..1200`；font scale: `0.8..1.3`；message gap: `4..32`。
- shadow: `none` / `soft` / `strong`。

新增主题后，测试必须同时证明图片可解析、组件 profile 存在、manifest 合法、固定外观正确、关键组件颜色不是 `auto`。
