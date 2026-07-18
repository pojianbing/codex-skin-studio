import type { CSSProperties, MouseEvent } from 'react'
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
  Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { type PreviewElementId } from '@/lib/preview-elements'

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
  activeElement: PreviewElementId | null
  onSelectElement: (element: PreviewElementId) => void
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

function changeSummaryStyle(
  value: SurfaceStyle,
  fallback: string,
  border: string,
): CSSProperties {
  const shadows: Record<Shadow, string> = {
    none: 'none',
    soft: '0 10px 28px color-mix(in oklab, #101411 20%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--skin-line) 38%, transparent)',
    strong: '0 18px 46px color-mix(in oklab, #080b0a 34%, transparent), 0 3px 10px color-mix(in oklab, #080b0a 18%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--skin-line) 58%, transparent)',
  }

  return {
    display: value.visible ? undefined : 'none',
    background: mix(resolveColor(value.background, fallback), value.opacity),
    borderColor: mix(border, value.borderOpacity),
    borderRadius: `${value.radius}px`,
    backdropFilter: `blur(${value.blur}px) saturate(1.04)`,
    boxShadow: shadows[value.shadow],
  }
}

function applicationMenuStyle(
  value: SurfaceStyle,
  fallback: string,
  border: string,
): CSSProperties {
  return {
    background: mix(resolveColor(value.background, fallback), Math.max(0.72, value.opacity)),
    borderColor: mix(border, value.borderOpacity),
    borderRadius: '0px',
    backdropFilter: `blur(${Math.max(0, value.blur * 0.45)}px) saturate(1.06)`,
    boxShadow: 'none',
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
  className,
  onClick,
}: {
  icon?: React.ReactNode
  label: string
  style?: CSSProperties
  active?: boolean
  className?: string
  onClick?: (event: MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      className={cn(
        "flex h-[15px] items-center gap-[5px] px-[5px] text-[6px] font-medium",
        active && "font-semibold",
        className,
      )}
      style={style}
      onClick={onClick}
    >
      <span className="flex h-[7px] w-[7px] flex-none items-center justify-center opacity-75">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </div>
  )
}

export function CodexPreview({
  theme,
  appearance,
  safeArea,
  activeElement,
  onSelectElement,
}: CodexPreviewProps) {
  const light = appearance === 'light'
  const fallbackSurface = light ? '#f8fafc' : '#18181b'
  const fallbackSidebar = light ? '#f1f5f9' : '#0e121c'
  const fallbackHeader = light ? '#f8fafc' : '#121620'
  const borderColor = light ? '#94a3b8' : '#64748b'
  const mutedText = light ? '#475569' : '#a1a1aa'
  const mainText = light ? '#18181b' : '#f4f4f5'
  const mainLeft = theme.ui.sidebar.visible ? 21 : 0
  const applicationMenuHeight = 5
  const headerHeight = theme.ui.header.visible ? 5 : 0
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
  const diffRowStyle: CSSProperties = {
    display: theme.ui.diff.visible ? 'grid' : 'none',
    background: mix(resolveColor(theme.ui.diff.background, fallbackSurface), theme.ui.diff.opacity),
    borderRadius: `${theme.ui.diff.radius}px`,
  }
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

  const targetClass = (element: PreviewElementId) => cn(
    'preview-target',
    activeElement === element && 'preview-target--active',
  )
  const targetEvents = (element: PreviewElementId) => ({
    onClick: (event: MouseEvent<HTMLElement>) => {
      event.stopPropagation()
      onSelectElement(element)
    },
  })

  return (
    <div
      className={cn(
        "relative isolate w-full shrink-0 overflow-hidden rounded-md border shadow-lg",
        light ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-zinc-700/80 bg-zinc-950 text-zinc-100",
        targetClass('canvas'),
      )}
      onClick={() => onSelectElement('canvas')}
      style={{
        aspectRatio: '16 / 10',
        backgroundImage,
        backgroundPosition,
        backgroundSize: theme.art.taskMode === 'banner' ? '100% 47%' : 'cover',
        backgroundRepeat: 'no-repeat',
      }}
      aria-label="Codex 任务页与顶部菜单栏实时预览"
    >
      <div
        className={cn(
          "absolute inset-0 -z-10",
          light ? "bg-white/20" : "bg-black/12",
        )}
      />

      <nav
        className={cn(
          "absolute inset-x-0 top-0 z-50 flex items-center justify-between border-b px-[7px] text-[5.5px] font-medium",
          targetClass('header'),
        )}
        style={{
          height: `${applicationMenuHeight}%`,
          color: mainText,
          ...applicationMenuStyle(theme.ui.header, fallbackHeader, borderColor),
        }}
        aria-label="Codex 顶部菜单栏预览"
        {...targetEvents('header')}
      >
        <div className="flex min-w-0 items-center gap-[6px]">
          <Monitor size={7} opacity={0.8} />
          <span>文件</span>
          <span>编辑</span>
          <span>视图</span>
          <span>帮助</span>
        </div>
        <div className="flex items-center gap-[4px] opacity-65">
          <span className="h-[5px] w-[5px] rounded-sm border border-current" />
          <span className="h-[5px] w-[5px] rounded-sm border border-current" />
          <span className="h-[5px] w-[5px] rounded-sm border border-current" />
        </div>
      </nav>

      <section
        className={cn(
          "absolute bottom-0 left-0 z-20 flex flex-col border p-[6px]",
          targetClass('sidebar'),
        )}
        style={{
          top: `${applicationMenuHeight}%`,
          width: `${mainLeft}%`,
          color: mainText,
          ...surfaceStyle(theme.ui.sidebar, fallbackSidebar, borderColor),
        }}
        {...targetEvents('sidebar')}
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
            className={targetClass('threadRows')}
            onClick={targetEvents('threadRows').onClick}
          />
          <PreviewRow
            label="完善主题预览"
            style={rowStyle(theme.ui.threadRows, theme.accent, 'hover')}
            className={targetClass('threadRows')}
            onClick={targetEvents('threadRows').onClick}
          />
          <PreviewRow
            label="配置 Codex 界面"
            active
            style={rowStyle(theme.ui.threadRows, theme.accent, 'selected')}
            className={targetClass('threadRows')}
            onClick={targetEvents('threadRows').onClick}
          />
        </div>
        <div className="mt-auto flex items-center gap-[4px] border-t border-current/10 pt-[5px] text-[5px] opacity-60">
          <span className="h-[6px] w-[6px] rounded-full border border-current" />
          <span>custom</span>
        </div>
      </section>

      <header
        className={cn(
          "absolute right-0 top-0 z-10 flex items-center justify-between border px-[8px]",
          targetClass('header'),
        )}
        style={{
          left: `${mainLeft}%`,
          top: `${applicationMenuHeight}%`,
          height: `${headerHeight}%`,
          color: mainText,
          ...surfaceStyle(theme.ui.header, fallbackHeader, borderColor),
        }}
        {...targetEvents('header')}
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
        className={cn("absolute z-0 overflow-hidden", targetClass('content'))}
        style={{
          left: `${contentLeft}%`,
          top: `${applicationMenuHeight + headerHeight + 2}%`,
          bottom: '20%',
          width: `${contentWidth}%`,
          color: mainText,
          fontSize: `${6 * fontScale}px`,
        }}
        {...targetEvents('content')}
      >
        <div className="flex h-full flex-col overflow-hidden" style={{ gap: `${messageGap}px` }}>
          <div
            className={cn(
              "ml-auto max-w-[74%] border px-[6px] py-[4px] leading-[1.35]",
              targetClass('userBubble'),
            )}
            style={surfaceStyle(theme.ui.userBubble, fallbackSurface, borderColor)}
            {...targetEvents('userBubble')}
          >
            把所有界面元素加入实时预览
          </div>

          <div
            className={cn("space-y-[3px] leading-[1.35]", targetClass('richText'))}
            style={{ color: mainText }}
            {...targetEvents('richText')}
          >
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
            className={cn(
              "flex items-center gap-[5px] border px-[5px] py-[3px]",
              targetClass('activityCard'),
            )}
            style={surfaceStyle(theme.ui.activityCard, fallbackSurface, borderColor)}
            {...targetEvents('activityCard')}
          >
            <SquareTerminal size={8} style={{ color: theme.accent }} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">运行构建</div>
              <div className="truncate opacity-55">npm run build</div>
            </div>
            <Check size={8} className="text-emerald-500" />
          </div>

          <div
            className={cn("overflow-hidden border font-mono", targetClass('codeBlock'))}
            style={surfaceStyle(theme.ui.codeBlock, light ? '#f1f5f9' : '#111827', borderColor)}
            {...targetEvents('codeBlock')}
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
        className={cn(
          "absolute right-[2.5%] z-20 flex w-[23%] flex-col border p-[5px]",
          targetClass('environment'),
        )}
        style={{
          top: `${applicationMenuHeight + headerHeight + 3}%`,
          color: mainText,
          ...surfaceStyle(theme.environment, fallbackSurface, borderColor),
        }}
        {...targetEvents('environment')}
      >
        <div className="mb-[3px] flex items-center justify-between text-[6px] font-semibold opacity-65">
          <span>环境信息</span><Plus size={7} />
        </div>
        <PreviewRow
          icon={<FileCode2 size={7} />}
          label="变更  +24  -1"
          active
          style={rowStyle(theme.ui.summaryRows, theme.accent, 'selected')}
          className={targetClass('summaryRows')}
          onClick={targetEvents('summaryRows').onClick}
        />
        <PreviewRow
          icon={<Monitor size={7} />}
          label="本地"
          style={rowStyle(theme.ui.summaryRows, theme.accent, 'hover')}
          className={targetClass('summaryRows')}
          onClick={targetEvents('summaryRows').onClick}
        />
        <PreviewRow
          icon={<GitBranch size={7} />}
          label="main"
          style={rowStyle(theme.ui.summaryRows, theme.accent, 'normal')}
          className={targetClass('summaryRows')}
          onClick={targetEvents('summaryRows').onClick}
        />
        <PreviewRow icon={<GitCommitHorizontal size={7} />} label="提交或推送" />
        <PreviewRow icon={<Github size={7} />} label="比较分支" />
      </aside>

      <section
        className={cn("absolute z-20 overflow-hidden border", targetClass('changeSummary'))}
        style={{
          left: `${contentLeft}%`,
          bottom: '20.5%',
          width: `${contentWidth}%`,
          color: mainText,
          ...changeSummaryStyle(theme.changeSummary, fallbackSurface, borderColor),
        }}
        {...targetEvents('changeSummary')}
      >
        <div className="flex items-center gap-[4px] border-b border-current/10 px-[5px] py-[4px] text-[5.5px] font-semibold">
          <span className="flex h-[14px] w-[14px] flex-none items-center justify-center rounded-[4px] bg-black/80 text-white shadow-sm">
            <FileCode2 size={8} />
          </span>
          <div className="min-w-0 leading-[1.25]">
            <div>已编辑 5 个文件</div>
            <div className="mt-[1px] font-medium">
              <b style={{ color: theme.ui.diff.addedColor }}>+131</b>{' '}
              <b style={{ color: theme.ui.diff.deletedColor }}>-28</b>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-[4px] whitespace-nowrap text-[5px]">
            <span className="flex items-center gap-[2px] opacity-75">撤销 <Undo2 size={6} /></span>
            <span className="rounded-[4px] border border-current/20 px-[3px] py-[2px]">审核</span>
          </div>
        </div>
        <div className="space-y-[1px] p-[2px] text-[5.5px]">
          {[
            ['src-tauri/src/engine.rs', '+17', '-0'],
            ['src-tauri/src/lib.rs', '+19', '-0'],
            ['src-tauri/src/models.rs', '+6', '-5'],
            ['src-tauri/src/storage.rs', '+49', '-13'],
            ['src/App.tsx', '+40', '-10'],
          ].map(([path, added, deleted]) => (
            <div
              key={path}
              className={cn(
                "grid grid-cols-[1fr_auto] items-center gap-[3px] px-[4px] py-[2px]",
                targetClass('diff'),
              )}
              style={diffRowStyle}
              {...targetEvents('diff')}
            >
              <span className="truncate">{path}</span>
              <span className="whitespace-nowrap">
                <b style={{ color: theme.ui.diff.addedColor }}>{added}</b>{' '}
                <b style={{ color: theme.ui.diff.deletedColor }}>{deleted}</b>
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-[3px] border-t border-current/10 px-[5px] py-[3px] text-[5px] font-medium">
          <span>收起文件</span>
          <ChevronDown size={6} style={{ transform: 'rotate(180deg)' }} />
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
        className={cn(
          "absolute z-30 flex h-[16%] items-center border px-[7px]",
          targetClass('composer'),
        )}
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
        {...targetEvents('composer')}
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
        className={cn(
          "absolute z-30 flex flex-col items-center gap-[3px]",
          targetClass('navigation'),
        )}
        style={{
          display: theme.ui.navigationRailVisible ? 'flex' : 'none',
          left: `${mainLeft + 1.2}%`,
          bottom: '25%',
          opacity: theme.ui.navigationRailOpacity,
          color: mutedText,
        }}
        {...targetEvents('navigation')}
      >
        {[0, 1, 2, 3].map((item) => (
          <span key={item} className="h-[2px] w-[2px] rounded-full bg-current" />
        ))}
      </div>

      <div
        className={cn(
          "absolute bottom-[19%] right-[2px] top-[12%] z-40 flex justify-center",
          targetClass('navigation'),
        )}
        style={{
          display: theme.ui.scrollbar.visible ? 'flex' : 'none',
          width: `${Math.max(2, theme.ui.scrollbar.width * 0.36)}px`,
          borderRadius: `${theme.ui.scrollbar.radius * 0.36}px`,
          background: mix(resolveColor(theme.ui.scrollbar.color, mutedText), theme.ui.scrollbar.opacity * 0.22),
        }}
        {...targetEvents('navigation')}
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
