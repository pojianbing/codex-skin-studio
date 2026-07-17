import type { CSSProperties } from 'react'
import {
  ArrowUp,
  Check,
  ChevronDown,
  CircleDot,
  Code2,
  FileCode2,
  Folder,
  GitBranch,
  GitCommitHorizontal,
  Github,
  Monitor,
  Plus,
  Search,
  SquareTerminal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Shadow = 'none' | 'soft' | 'strong'

type SurfaceStyle = {
  visible: boolean
  background: string
  opacity: number
  blur: number
  borderOpacity: number
  shadow: Shadow
  radius: number
}

type RowStyle = {
  visible: boolean
  background: string
  opacity: number
  hoverOpacity: number
  selectedOpacity: number
  radius: number
}

type PreviewTheme = {
  name: string
  accent: string
  previewDataUrl: string
  art: {
    focusX: number
    focusY: number
    taskMode: 'auto' | 'ambient' | 'banner' | 'off'
  }
  composer: {
    background: string
    opacity: number
    blur: number
    borderOpacity: number
    shadow: Shadow
    showFooterBackdrop: boolean
  }
  environment: SurfaceStyle
  changeSummary: SurfaceStyle
  ui: {
    sidebar: SurfaceStyle
    header: SurfaceStyle
    userBubble: SurfaceStyle
    codeBlock: SurfaceStyle
    activityCard: SurfaceStyle
    threadRows: RowStyle
    summaryRows: RowStyle
    navigationRailVisible: boolean
    navigationRailOpacity: number
    scrollbar: {
      visible: boolean
      color: string
      opacity: number
      width: number
      radius: number
    }
    diff: {
      visible: boolean
      background: string
      opacity: number
      addedColor: string
      deletedColor: string
      radius: number
    }
    content: {
      maxWidth: number
      fontScale: number
      messageGap: number
    }
    richText: {
      linkColor: string
      inlineCodeBackground: string
      inlineCodeOpacity: number
      inlineCodeRadius: number
      quoteAccent: string
      quoteBackground: string
      quoteOpacity: number
      tableBorder: string
      tableBackground: string
      tableOpacity: number
      tableRadius: number
      imageRadius: number
    }
  }
}

type CodexPreviewProps = {
  theme: PreviewTheme
  appearance: 'light' | 'dark'
  safeArea: 'auto' | 'left' | 'right' | 'center' | 'none'
}

const percent = (value: number) => Math.round(value * 100)

const mix = (color: string, opacity: number) => (
  `color-mix(in oklab, ${color} ${percent(opacity)}%, transparent)`
)

const resolveColor = (value: string, fallback: string) => (
  value === 'auto' ? fallback : value
)

const shadow = (value: Shadow) => {
  if (value === 'none') return 'none'
  if (value === 'strong') return '0 7px 18px rgba(0, 0, 0, 0.38), 0 1px 4px rgba(0, 0, 0, 0.3)'
  return '0 4px 12px rgba(0, 0, 0, 0.22)'
}

function surfaceStyle(
  value: SurfaceStyle,
  fallback: string,
  border: string,
): CSSProperties {
  return {
    display: value.visible ? undefined : 'none',
    background: mix(resolveColor(value.background, fallback), value.opacity),
    borderColor: mix(border, value.borderOpacity),
    borderRadius: `${Math.max(0, value.radius * 0.38)}px`,
    backdropFilter: `blur(${Math.max(0, value.blur * 0.45)}px) saturate(1.06)`,
    boxShadow: shadow(value.shadow),
  }
}

function rowStyle(
  value: RowStyle,
  fallback: string,
  state: 'normal' | 'hover' | 'selected',
): CSSProperties {
  const opacity = state === 'selected'
    ? value.selectedOpacity
    : state === 'hover' ? value.hoverOpacity : value.opacity
  return {
    display: value.visible ? undefined : 'none',
    background: mix(resolveColor(value.background, fallback), opacity),
    borderRadius: `${Math.max(0, value.radius * 0.38)}px`,
  }
}

function PreviewRow({
  icon,
  label,
  style,
  active = false,
}: {
  icon?: React.ReactNode
  label: string
  style?: CSSProperties
  active?: boolean
}) {
  return (
    <div
      className={cn(
        "flex h-[15px] items-center gap-[5px] px-[5px] text-[6px] font-medium",
        active && "font-semibold",
      )}
      style={style}
    >
      <span className="flex h-[7px] w-[7px] flex-none items-center justify-center opacity-75">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </div>
  )
}

export function CodexPreview({ theme, appearance, safeArea }: CodexPreviewProps) {
  const light = appearance === 'light'
  const fallbackSurface = light ? '#f8fafc' : '#18181b'
  const fallbackSidebar = light ? '#f1f5f9' : '#0e121c'
  const fallbackHeader = light ? '#f8fafc' : '#121620'
  const borderColor = light ? '#94a3b8' : '#64748b'
  const mutedText = light ? '#475569' : '#a1a1aa'
  const mainText = light ? '#18181b' : '#f4f4f5'
  const mainLeft = theme.ui.sidebar.visible ? 21 : 0
  const headerHeight = theme.ui.header.visible ? 11 : 0
  const environmentRight = theme.environment.visible ? 28 : 4
  const widthRatio = Math.max(0, Math.min(1, (theme.ui.content.maxWidth - 560) / 640))
  const availableWidth = 100 - mainLeft - environmentRight
  const desiredWidth = theme.environment.visible
    ? 31 + widthRatio * 12
    : 38 + widthRatio * 18
  const contentWidth = Math.min(desiredWidth, availableWidth - 5)
  const contentLeft = mainLeft + Math.max(3, (availableWidth - contentWidth) / 2)
  const fontScale = theme.ui.content.fontScale
  const messageGap = 1.5 + theme.ui.content.messageGap * 0.09
  const inlineCodeColor = resolveColor(theme.ui.richText.inlineCodeBackground, fallbackSurface)
  const quoteAccent = resolveColor(theme.ui.richText.quoteAccent, theme.accent)
  const quoteColor = resolveColor(theme.ui.richText.quoteBackground, fallbackSurface)
  const tableBorder = resolveColor(theme.ui.richText.tableBorder, borderColor)
  const tableColor = resolveColor(theme.ui.richText.tableBackground, fallbackSurface)
  const linkColor = resolveColor(theme.ui.richText.linkColor, theme.accent)
  const composerColor = resolveColor(theme.composer.background, light ? '#f8fafc' : '#121620')
  const backgroundPosition = `${percent(theme.art.focusX)}% ${percent(theme.art.focusY)}%`
  const safeAreaShade = safeArea === 'right'
    ? 'linear-gradient(to left, rgba(0,0,0,.5), transparent 58%)'
    : safeArea === 'center'
      ? 'linear-gradient(rgba(0,0,0,.28), rgba(0,0,0,.28))'
      : safeArea === 'none'
        ? 'linear-gradient(transparent, transparent)'
        : 'linear-gradient(to right, rgba(0,0,0,.5), transparent 58%)'

  const backgroundImage = theme.art.taskMode === 'off'
    ? undefined
    : `${safeAreaShade}, url(${theme.previewDataUrl})`

  return (
    <div
      className={cn(
        "relative isolate w-full shrink-0 overflow-hidden rounded-md border shadow-lg",
        light ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-zinc-700/80 bg-zinc-950 text-zinc-100",
      )}
      style={{
        aspectRatio: '16 / 10',
        backgroundImage,
        backgroundPosition,
        backgroundSize: theme.art.taskMode === 'banner' ? '100% 47%' : 'cover',
        backgroundRepeat: 'no-repeat',
      }}
      aria-label="Codex 任务页实时预览"
    >
      <div
        className={cn(
          "absolute inset-0 -z-10",
          light ? "bg-white/20" : "bg-black/12",
        )}
      />

      <section
        className="absolute inset-y-0 left-0 z-20 flex flex-col border p-[6px]"
        style={{
          width: `${mainLeft}%`,
          color: mainText,
          ...surfaceStyle(theme.ui.sidebar, fallbackSidebar, borderColor),
        }}
      >
        <div className="flex h-[18px] items-center justify-between px-[3px] text-[7px] font-bold">
          <span>Codex</span>
          <Search size={7} opacity={0.65} />
        </div>
        <div className="space-y-[2px] border-b border-current/10 pb-[5px]">
          <PreviewRow icon={<Plus size={7} />} label="新建任务" />
          <PreviewRow icon={<GitBranch size={7} />} label="拉取请求" />
          <PreviewRow icon={<CircleDot size={7} />} label="已安排" />
        </div>
        <div className="mt-[5px] text-[5px] font-semibold uppercase opacity-50">项目</div>
        <div className="mt-[2px] space-y-[2px]">
          <PreviewRow
            icon={<Folder size={7} />}
            label="CodexSkinStudio"
            style={rowStyle(theme.ui.threadRows, theme.accent, 'normal')}
          />
          <PreviewRow
            label="完善主题预览"
            style={rowStyle(theme.ui.threadRows, theme.accent, 'hover')}
          />
          <PreviewRow
            label="配置 Codex 界面"
            active
            style={rowStyle(theme.ui.threadRows, theme.accent, 'selected')}
          />
        </div>
        <div className="mt-auto flex items-center gap-[4px] border-t border-current/10 pt-[5px] text-[5px] opacity-60">
          <span className="h-[6px] w-[6px] rounded-full border border-current" />
          <span>custom</span>
        </div>
      </section>

      <header
        className="absolute right-0 top-0 z-10 flex items-center justify-between border px-[8px]"
        style={{
          left: `${mainLeft}%`,
          height: `${headerHeight}%`,
          color: mainText,
          ...surfaceStyle(theme.ui.header, fallbackHeader, borderColor),
        }}
      >
        <div className="flex min-w-0 items-center gap-[4px] text-[6px] font-semibold">
          <Folder size={7} opacity={0.7} />
          <span className="max-w-[120px] truncate">完善主题预览</span>
        </div>
        <div className="flex items-center gap-[5px] opacity-60">
          <Search size={7} />
          <GitBranch size={7} />
          <span className="h-[7px] w-[7px] rounded-full border border-current" />
        </div>
      </header>

      <main
        className="absolute z-0 overflow-hidden"
        style={{
          left: `${contentLeft}%`,
          top: `${headerHeight + 2}%`,
          bottom: '20%',
          width: `${contentWidth}%`,
          color: mainText,
          fontSize: `${6 * fontScale}px`,
        }}
      >
        <div className="flex h-full flex-col overflow-hidden" style={{ gap: `${messageGap}px` }}>
          <div
            className="ml-auto max-w-[74%] border px-[6px] py-[4px] leading-[1.35]"
            style={surfaceStyle(theme.ui.userBubble, fallbackSurface, borderColor)}
          >
            把所有界面元素加入实时预览
          </div>

          <div className="space-y-[3px] leading-[1.35]" style={{ color: mainText }}>
            <div>
              已更新 <span style={{ color: linkColor }}>Codex 任务页</span>，配置会在
              <code
                className="mx-[2px] border border-current/10 px-[2px] py-[1px]"
                style={{
                  background: mix(inlineCodeColor, theme.ui.richText.inlineCodeOpacity),
                  borderRadius: `${theme.ui.richText.inlineCodeRadius * 0.35}px`,
                }}
              >
                preview
              </code>
              中即时呈现。
            </div>
            <blockquote
              className="border-l-2 px-[4px] py-[2px]"
              style={{
                borderColor: quoteAccent,
                background: mix(quoteColor, theme.ui.richText.quoteOpacity),
              }}
            >
              预览与真实布局保持一致
            </blockquote>
            <div className="grid grid-cols-[1.15fr_.85fr] gap-[3px]">
              <div
                className="overflow-hidden border"
                style={{
                  borderColor: tableBorder,
                  borderRadius: `${theme.ui.richText.tableRadius * 0.35}px`,
                  background: mix(tableColor, theme.ui.richText.tableOpacity),
                }}
              >
                <div className="grid grid-cols-2 border-b px-[3px] py-[2px] font-semibold" style={{ borderColor: tableBorder }}>
                  <span>区域</span><span>状态</span>
                </div>
                <div className="grid grid-cols-2 px-[3px] py-[2px]">
                  <span>输入框</span><span style={{ color: theme.accent }}>实时</span>
                </div>
              </div>
              <div
                className="bg-center bg-cover"
                style={{
                  backgroundImage: `url(${theme.previewDataUrl})`,
                  borderRadius: `${theme.ui.richText.imageRadius * 0.35}px`,
                }}
              />
            </div>
          </div>

          <div
            className="flex items-center gap-[5px] border px-[5px] py-[3px]"
            style={surfaceStyle(theme.ui.activityCard, fallbackSurface, borderColor)}
          >
            <SquareTerminal size={8} style={{ color: theme.accent }} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">运行构建</div>
              <div className="truncate opacity-55">npm run build</div>
            </div>
            <Check size={8} className="text-emerald-500" />
          </div>

          <div
            className="overflow-hidden border font-mono"
            style={surfaceStyle(theme.ui.codeBlock, light ? '#f1f5f9' : '#111827', borderColor)}
          >
            <div className="flex items-center justify-between border-b border-current/10 px-[5px] py-[2px] opacity-65">
              <span>tsx</span><Code2 size={7} />
            </div>
            <div className="px-[5px] py-[3px] leading-[1.45]">
              <span style={{ color: theme.accent }}>const</span> preview = <span className="text-emerald-500">'live'</span>
            </div>
          </div>
        </div>
      </main>

      <aside
        className="absolute right-[2.5%] z-20 flex w-[23%] flex-col border p-[5px]"
        style={{
          top: `${headerHeight + 3}%`,
          color: mainText,
          ...surfaceStyle(theme.environment, fallbackSurface, borderColor),
        }}
      >
        <div className="mb-[3px] flex items-center justify-between text-[6px] font-semibold opacity-65">
          <span>环境信息</span><Plus size={7} />
        </div>
        <PreviewRow
          icon={<FileCode2 size={7} />}
          label="变更  +24  -1"
          active
          style={rowStyle(theme.ui.summaryRows, theme.accent, 'selected')}
        />
        <PreviewRow
          icon={<Monitor size={7} />}
          label="本地"
          style={rowStyle(theme.ui.summaryRows, theme.accent, 'hover')}
        />
        <PreviewRow
          icon={<GitBranch size={7} />}
          label="main"
          style={rowStyle(theme.ui.summaryRows, theme.accent, 'normal')}
        />
        <PreviewRow icon={<GitCommitHorizontal size={7} />} label="提交或推送" />
        <PreviewRow icon={<Github size={7} />} label="比较分支" />
      </aside>

      <section
        className="absolute z-20 overflow-hidden border"
        style={{
          left: `${contentLeft}%`,
          bottom: '20.5%',
          width: `${contentWidth}%`,
          color: mainText,
          ...surfaceStyle(theme.changeSummary, fallbackSurface, borderColor),
        }}
      >
        <div className="flex h-[15px] items-center justify-between border-b border-current/10 px-[5px] text-[5.5px] font-semibold">
          <span>已编辑 3 个文件</span>
          <span className="opacity-65">审核</span>
        </div>
        <div
          className="grid grid-cols-[1fr_auto] items-center gap-[3px] px-[5px] py-[3px] text-[5.5px]"
          style={{
            display: theme.ui.diff.visible ? 'grid' : 'none',
            background: mix(resolveColor(theme.ui.diff.background, fallbackSurface), theme.ui.diff.opacity),
            borderRadius: `${theme.ui.diff.radius * 0.35}px`,
          }}
        >
          <span className="truncate">src/components/codex-preview.tsx</span>
          <span>
            <b style={{ color: theme.ui.diff.addedColor }}>+24</b>{' '}
            <b style={{ color: theme.ui.diff.deletedColor }}>-1</b>
          </span>
        </div>
      </section>

      <div
        className="pointer-events-none absolute bottom-0 z-10 h-[22%]"
        style={{
          left: `${mainLeft}%`,
          right: 0,
          display: theme.composer.showFooterBackdrop ? undefined : 'none',
          background: light
            ? 'linear-gradient(to top, rgba(248,250,252,.98), rgba(248,250,252,.72) 58%, transparent)'
            : 'linear-gradient(to top, rgba(9,9,11,.98), rgba(9,9,11,.72) 58%, transparent)',
        }}
      />

      <div
        className="absolute z-30 flex h-[16%] items-center border px-[7px]"
        style={{
          left: `${contentLeft}%`,
          bottom: '2.8%',
          width: `${contentWidth}%`,
          color: mainText,
          background: mix(composerColor, theme.composer.opacity),
          borderColor: mix(borderColor, theme.composer.borderOpacity),
          borderRadius: '9px',
          backdropFilter: `blur(${theme.composer.blur * 0.45}px) saturate(1.06)`,
          boxShadow: shadow(theme.composer.shadow),
        }}
      >
        <Plus size={8} opacity={0.7} />
        <span className="ml-[5px] text-[5.5px] opacity-45">随心输入</span>
        <div className="ml-auto flex items-center gap-[5px] text-[5px]">
          <span className="opacity-60">5.6 Codex</span>
          <ChevronDown size={6} opacity={0.6} />
          <span
            className="flex h-[13px] w-[13px] items-center justify-center rounded-full"
            style={{ background: mix(mainText, 0.7), color: light ? '#fff' : '#111' }}
          >
            <ArrowUp size={7} />
          </span>
        </div>
      </div>

      <div
        className="absolute z-30 flex flex-col items-center gap-[3px]"
        style={{
          display: theme.ui.navigationRailVisible ? 'flex' : 'none',
          left: `${mainLeft + 1.2}%`,
          bottom: '25%',
          opacity: theme.ui.navigationRailOpacity,
          color: mutedText,
        }}
      >
        {[0, 1, 2, 3].map((item) => (
          <span key={item} className="h-[2px] w-[2px] rounded-full bg-current" />
        ))}
      </div>

      <div
        className="absolute bottom-[19%] right-[2px] top-[12%] z-40 flex justify-center"
        style={{
          display: theme.ui.scrollbar.visible ? 'flex' : 'none',
          width: `${Math.max(2, theme.ui.scrollbar.width * 0.36)}px`,
          borderRadius: `${theme.ui.scrollbar.radius * 0.36}px`,
          background: mix(resolveColor(theme.ui.scrollbar.color, mutedText), theme.ui.scrollbar.opacity * 0.22),
        }}
      >
        <span
          className="mt-[22%] block h-[28%] w-full"
          style={{
            borderRadius: `${theme.ui.scrollbar.radius * 0.36}px`,
            background: mix(resolveColor(theme.ui.scrollbar.color, mutedText), theme.ui.scrollbar.opacity),
          }}
        />
      </div>
    </div>
  )
}
