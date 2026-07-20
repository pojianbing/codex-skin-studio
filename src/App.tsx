import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import {
  Check, ChevronDown, Download, ImagePlus, Library, LoaderCircle,
  PanelRight, Pause, Play, RefreshCw, RotateCcw, ShieldCheck, Trash2,
  SlidersHorizontal, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { CodexPreview } from '@/components/codex-preview'
import { AppUpdater } from '@/components/app-updater'
import { ThemeStore } from '@/components/theme-store'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { type ElementTab, type PreviewElementId, previewElementMeta } from '@/lib/preview-elements'

type EngineMode = 'official' | 'active' | 'paused' | 'error'
type ArtConfig = {
  focusX: number
  focusY: number
  safeArea: 'auto' | 'left' | 'right' | 'center' | 'none'
  taskMode: 'auto' | 'ambient' | 'banner' | 'off'
}
type ComposerConfig = {
  background: string
  opacity: number
  blur: number
  borderOpacity: number
  shadow: 'none' | 'soft' | 'strong'
  showFooterBackdrop: boolean
  radius: number
  placeholderColor: string
  controlColor: string
  controlOpacity: number
  controlRadius: number
  primaryActionColor: string
  primaryActionText: string
}
type EnvironmentConfig = {
  visible: boolean
  background: string
  opacity: number
  blur: number
  borderOpacity: number
  shadow: 'none' | 'soft' | 'strong'
  radius: number
}
type ChangeSummaryConfig = {
  visible: boolean
  background: string
  opacity: number
  blur: number
  borderOpacity: number
  shadow: 'none' | 'soft' | 'strong'
  radius: number
}
type LevelSliderConfig = {
  enabled: boolean
  levelColors: [string, string, string, string, string]
  thumbColor: string
}
type SurfaceStyle = {
  visible: boolean
  background: string
  opacity: number
  blur: number
  borderOpacity: number
  shadow: 'none' | 'soft' | 'strong'
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
type ScrollbarStyle = {
  visible: boolean
  color: string
  opacity: number
  width: number
  radius: number
}
type DiffStyle = {
  visible: boolean
  background: string
  opacity: number
  hoverOpacity: number
  addedColor: string
  deletedColor: string
  radius: number
}
type ContentLayoutStyle = {
  maxWidth: number
  fontScale: number
  messageGap: number
}
type RichTextStyle = {
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
type SemanticTokens = {
  textPrimary: string
  textSecondary: string
  textMuted: string
  textDisabled: string
  textInverse: string
  border: string
  focusRing: string
  success: string
  warning: string
  danger: string
}
type UiConfig = {
  sidebar: SurfaceStyle
  header: SurfaceStyle
  userBubble: SurfaceStyle
  codeBlock: SurfaceStyle
  activityCard: SurfaceStyle
  homeSuggestions: SurfaceStyle
  overlays: SurfaceStyle
  threadRows: RowStyle
  summaryRows: RowStyle
  navigationRailVisible: boolean
  navigationRailOpacity: number
  scrollbar: ScrollbarStyle
  diff: DiffStyle
  content: ContentLayoutStyle
  richText: RichTextStyle
}
type ThemeRecord = {
  id: string
  name: string
  version: string
  appearance: 'auto' | 'light' | 'dark'
  accent: string
  levelSlider: LevelSliderConfig
  art: ArtConfig
  composer: ComposerConfig
  environment: EnvironmentConfig
  changeSummary: ChangeSummaryConfig
  tokens: SemanticTokens
  ui: UiConfig
  previewDataUrl: string
  builtIn: boolean
}
type Dashboard = {
  platform: string
  codexFound: boolean
  codexVersion?: string
  mode: EngineMode
  activeThemeId?: string
  port?: number
  message: string
  autostartEnabled: boolean
  launchCodexOnOpen: boolean
  themes: ThemeRecord[]
}
type ApplyPlan = { action: 'hotSwitch' | 'launch' | 'restart' }
type ThemeFilter = 'all' | 'builtIn' | 'custom'

const fallbackDashboard: Dashboard = {
  platform: 'desktop', codexFound: false, mode: 'official',
  message: '正在连接本地引擎', autostartEnabled: false, launchCodexOnOpen: false, themes: [],
}

const levelSliderLabels = ['低', '标准', '高', '超高', '极高'] as const

const themeBundleFilename = (theme: ThemeRecord) => {
  const name = theme.name
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .replace(/\.+$/, '')
  return `${name || theme.id}.codex-theme`
}

const sliderValue = (value: number | readonly number[]) => (
  typeof value === 'number' ? value : value[0]
)

function ToggleSetting({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-zinc-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 flex-none rounded-full border transition-colors cursor-pointer",
          checked ? "border-emerald-400/40 bg-emerald-500" : "border-zinc-700 bg-zinc-800"
        )}
      >
        <span className={cn(
          "absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
    </div>
  )
}

function SliderSetting({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}) {
  const displayValue = useMemo(() => {
    if (unit === '%') {
      return Math.round(value * 100)
    }
    return value
  }, [value, unit])

  const [localText, setLocalText] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      setLocalText(`${displayValue}${unit}`)
    }
  }, [displayValue, unit, isFocused])

  const commitInput = (text: string) => {
    let clean = text.replace(/[^\d.-]/g, '')
    let num = parseFloat(clean)
    if (isNaN(num)) {
      setLocalText(`${displayValue}${unit}`)
      return
    }

    if (unit === '%') {
      num = num / 100
    }

    num = Math.max(min, Math.min(max, num))
    const decimals = (String(step).split('.')[1] || '').length
    num = parseFloat(num.toFixed(decimals))
    onChange(num)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitInput(localText)
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setLocalText(`${displayValue}${unit}`)
      e.currentTarget.blur()
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    commitInput(localText)
  }

  const handleFocus = () => {
    setIsFocused(true)
    setLocalText(String(displayValue))
  }

  const adjust = (direction: 1 | -1) => {
    let nextValue = value + direction * step
    nextValue = Math.max(min, Math.min(max, nextValue))
    const decimals = (String(step).split('.')[1] || '').length
    nextValue = parseFloat(nextValue.toFixed(decimals))
    onChange(nextValue)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-zinc-300">{label}</label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjust(-1)}
            disabled={value <= min}
            className="w-[18px] h-[18px] flex items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none select-none text-[10px] font-bold cursor-pointer transition-colors"
            title="减少"
          >
            -
          </button>
          <input
            type="text"
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className="w-11 h-[18px] text-center text-[10px] font-mono font-bold bg-zinc-950 border border-zinc-800 rounded text-zinc-300 focus:border-zinc-500 focus:outline-none transition-colors"
          />
          <button
            type="button"
            onClick={() => adjust(1)}
            disabled={value >= max}
            className="w-[18px] h-[18px] flex items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none select-none text-[10px] font-bold cursor-pointer transition-colors"
            title="增加"
          >
            +
          </button>
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(sliderValue(next))}
        className="w-full cursor-pointer py-1"
      />
    </div>
  )
}

function ColorSetting({
  label,
  value,
  autoColor,
  allowAuto = true,
  onChange,
}: {
  label: string
  value: string
  autoColor: string
  allowAuto?: boolean
  onChange: (value: string) => void
}) {
  const isAuto = value === 'auto'
  const resolved = isAuto ? autoColor : value
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-zinc-300">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        {allowAuto && (
          <label className="flex items-center gap-1 cursor-pointer select-none text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors">
            <input
              type="checkbox"
              checked={isAuto}
              onChange={(e) => onChange(e.target.checked ? 'auto' : resolved)}
              className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-950 w-3 h-3 cursor-pointer"
            />
            <span>跟随主题</span>
          </label>
        )}
        <div className={cn(
          "flex items-center gap-1.5 transition-all duration-200",
          isAuto && allowAuto ? "opacity-40 pointer-events-none" : "opacity-100"
        )}>
          <label
            className="relative h-6 w-6 flex-none overflow-hidden rounded border border-zinc-700 ring-1 ring-black/20 cursor-pointer hover:border-zinc-500 transition-colors"
            title={`选择${label}`}
          >
            <span className="absolute inset-0" style={{ backgroundColor: resolved }} />
            <input
              type="color"
              aria-label={label}
              disabled={isAuto && allowAuto}
              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
              value={resolved}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
          <code className="w-[50px] truncate text-right text-[10px] font-semibold text-zinc-500">
            {resolved.toUpperCase()}
          </code>
        </div>
      </div>
    </div>
  )
}

function ShadowSetting({
  value,
  onChange,
}: {
  value: SurfaceStyle['shadow']
  onChange: (value: SurfaceStyle['shadow']) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-zinc-300">阴影</label>
      <div className="flex w-full gap-1 rounded-lg bg-zinc-950 p-1">
        {(['none', 'soft', 'strong'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={cn(
              "flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer",
              value === option ? "bg-zinc-800 text-zinc-50 shadow-sm" : "text-zinc-500 hover:text-zinc-200"
            )}
            onClick={() => onChange(option)}
          >
            {option === 'none' ? '关闭' : option === 'soft' ? '柔和' : '强调'}
          </button>
        ))}
      </div>
    </div>
  )
}

function ConfigSection({
  element,
  title,
  children,
  open,
  active,
  onOpenChange,
  onHoverChange,
  sectionRef,
}: {
  element: PreviewElementId
  title: string
  children: ReactNode
  open: boolean
  active: boolean
  onOpenChange: (open: boolean) => void
  onHoverChange: (active: boolean) => void
  sectionRef: (node: HTMLDetailsElement | null) => void
}) {
  return (
    <details
      ref={sectionRef}
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className={cn(
        "config-section-link group border-t border-zinc-800 first:border-t-0",
        active && "config-section-link--active",
      )}
      data-config-element={element}
    >
      <summary className="flex h-10 list-none items-center justify-between gap-3 text-xs font-semibold text-zinc-300 cursor-pointer select-none [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown size={13} className="text-zinc-600 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 pb-4">{children}</div>
    </details>
  )
}

function SurfaceStyleEditor({
  value,
  autoColor,
  onChange,
}: {
  value: SurfaceStyle
  autoColor: string
  onChange: (value: SurfaceStyle) => void
}) {
  const patch = (next: Partial<SurfaceStyle>) => onChange({ ...value, ...next })
  return (
    <>
      <ToggleSetting label="显示" checked={value.visible} onChange={(visible) => patch({ visible })} />
      {value.visible && (
        <>
          <ColorSetting label="背景色" value={value.background} autoColor={autoColor} onChange={(background) => patch({ background })} />
          <SliderSetting label="不透明度" value={value.opacity} min={0} max={1} step={0.01} unit="%" onChange={(opacity) => patch({ opacity })} />
          <SliderSetting label="背景模糊" value={value.blur} min={0} max={32} step={1} unit="px" onChange={(blur) => patch({ blur })} />
          <SliderSetting label="边框强度" value={value.borderOpacity} min={0} max={1} step={0.01} unit="%" onChange={(borderOpacity) => patch({ borderOpacity })} />
          <SliderSetting label="圆角" value={value.radius} min={0} max={32} step={1} unit="px" onChange={(radius) => patch({ radius })} />
          <ShadowSetting value={value.shadow} onChange={(shadow) => patch({ shadow })} />
        </>
      )}
    </>
  )
}

function OverlayStyleEditor({
  value,
  autoColor,
  onChange,
}: {
  value: SurfaceStyle
  autoColor: string
  onChange: (value: SurfaceStyle) => void
}) {
  const patch = (next: Partial<SurfaceStyle>) => onChange({ ...value, visible: true, ...next })
  return (
    <>
      <ColorSetting label="背景色" value={value.background} autoColor={autoColor} onChange={(background) => patch({ background })} />
      <SliderSetting label="不透明度" value={value.opacity} min={0} max={1} step={0.01} unit="%" onChange={(opacity) => patch({ opacity })} />
      <SliderSetting label="背景模糊" value={value.blur} min={0} max={32} step={1} unit="px" onChange={(blur) => patch({ blur })} />
      <SliderSetting label="边框强度" value={value.borderOpacity} min={0} max={1} step={0.01} unit="%" onChange={(borderOpacity) => patch({ borderOpacity })} />
      <SliderSetting label="圆角" value={value.radius} min={0} max={32} step={1} unit="px" onChange={(radius) => patch({ radius })} />
      <ShadowSetting value={value.shadow} onChange={(shadow) => patch({ shadow })} />
    </>
  )
}

function SemanticTokensEditor({
  value,
  appearance,
  onChange,
}: {
  value: SemanticTokens
  appearance: 'light' | 'dark'
  onChange: (value: SemanticTokens) => void
}) {
  const automatic = appearance === 'light'
    ? {
        textPrimary: '#0F172A', textSecondary: '#334155', textMuted: '#475569', textDisabled: '#94A3B8',
        textInverse: '#FFFFFF', border: '#94A3B8', focusRing: '#2563EB', success: '#16A34A', warning: '#D97706', danger: '#DC2626',
      }
    : {
        textPrimary: '#F4F4F5', textSecondary: '#D4D4D8', textMuted: '#B8C0CA', textDisabled: '#6F7885',
        textInverse: '#101318', border: '#64748B', focusRing: '#60A5FA', success: '#4ADE80', warning: '#FBBF24', danger: '#FB7185',
      }
  const fields: Array<[keyof SemanticTokens, string]> = [
    ['textPrimary', '主文字'], ['textSecondary', '次级文字'], ['textMuted', '弱化文字'], ['textDisabled', '禁用文字'],
    ['textInverse', '反色文字'], ['border', '语义边框'], ['focusRing', '焦点环'], ['success', '成功状态'],
    ['warning', '警告状态'], ['danger', '危险状态'],
  ]
  return (
    <div className="flex flex-col gap-3">
      {fields.map(([key, label], index) => (
        <div key={key}>
          {index === 5 && <div className="mb-3 h-px bg-zinc-800" />}
          <ColorSetting
            label={label}
            value={value[key]}
            autoColor={automatic[key]}
            onChange={(next) => onChange({ ...value, [key]: next })}
          />
        </div>
      ))}
    </div>
  )
}

function RowStyleEditor({
  value,
  autoColor,
  onChange,
}: {
  value: RowStyle
  autoColor: string
  onChange: (value: RowStyle) => void
}) {
  const patch = (next: Partial<RowStyle>) => onChange({ ...value, ...next })
  return (
    <>
      <ToggleSetting label="显示" checked={value.visible} onChange={(visible) => patch({ visible })} />
      {value.visible && (
        <>
          <ColorSetting label="背景色" value={value.background} autoColor={autoColor} onChange={(background) => patch({ background })} />
          <SliderSetting label="常态强度" value={value.opacity} min={0} max={1} step={0.01} unit="%" onChange={(opacity) => patch({ opacity })} />
          <SliderSetting label="悬停强度" value={value.hoverOpacity} min={0} max={1} step={0.01} unit="%" onChange={(hoverOpacity) => patch({ hoverOpacity })} />
          <SliderSetting label="选中强度" value={value.selectedOpacity} min={0} max={1} step={0.01} unit="%" onChange={(selectedOpacity) => patch({ selectedOpacity })} />
          <SliderSetting label="圆角" value={value.radius} min={0} max={24} step={1} unit="px" onChange={(radius) => patch({ radius })} />
        </>
      )}
    </>
  )
}

function App() {
  const [activeView, setActiveView] = useState<'library' | 'store'>('library')
  const [dashboard, setDashboard] = useState<Dashboard>(fallbackDashboard)
  const [selectedId, setSelectedId] = useState<string>()
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>('all')
  const [working, setWorking] = useState<string>()
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ThemeRecord | null>(null)
  const [elementTab, setElementTab] = useState<ElementTab>('shell')
  const [openConfigSections, setOpenConfigSections] = useState<Set<PreviewElementId>>(() => new Set())
  const [hoveredElement, setHoveredElement] = useState<PreviewElementId | null>(null)
  const [selectedElement, setSelectedElement] = useState<PreviewElementId | null>(null)
  const [pendingScrollElement, setPendingScrollElement] = useState<PreviewElementId | null>(null)
  const configSectionRefs = useRef(new Map<PreviewElementId, HTMLDetailsElement>())
  const [showPreview, setShowPreview] = useState(() => {
    try {
      return localStorage.getItem('cs-show-preview') !== 'false'
    } catch {
      return true
    }
  })

  const togglePreview = () => {
    const next = !showPreview
    setShowPreview(next)
    try {
      localStorage.setItem('cs-show-preview', String(next))
    } catch { }
  }

  const activeElement = hoveredElement ?? selectedElement

  const setConfigSectionOpen = (element: PreviewElementId, open: boolean) => {
    setOpenConfigSections((current) => {
      const next = new Set(current)
      if (open) {
        next.add(element)
      } else {
        next.delete(element)
      }
      return next
    })
  }

  const setConfigSectionRef = (element: PreviewElementId, node: HTMLDetailsElement | null) => {
    if (node) {
      configSectionRefs.current.set(element, node)
    } else {
      configSectionRefs.current.delete(element)
    }
  }

  const selectElementTab = (tab: ElementTab) => {
    setElementTab(tab)
    setSelectedElement(null)
  }

  const selectPreviewElement = (element: PreviewElementId) => {
    setSelectedElement(element)
    setElementTab(previewElementMeta[element].tab)
    setConfigSectionOpen(element, true)
    setPendingScrollElement(element)
  }

  const configSectionProps = (element: PreviewElementId) => ({
    element,
    active: activeElement === element,
    open: openConfigSections.has(element),
    onOpenChange: (open: boolean) => setConfigSectionOpen(element, open),
    onHoverChange: (hovering: boolean) => setHoveredElement(hovering ? element : null),
    sectionRef: (node: HTMLDetailsElement | null) => setConfigSectionRef(element, node),
  })

  useEffect(() => {
    if (!pendingScrollElement) return
    const section = configSectionRefs.current.get(pendingScrollElement)
    if (!section) return

    const frame = window.requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'center' })
      section.querySelector('summary')?.focus({ preventScroll: true })
      setPendingScrollElement(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [elementTab, pendingScrollElement])

  const filteredThemes = useMemo(() => {
    if (themeFilter === 'builtIn') return dashboard.themes.filter((theme) => theme.builtIn)
    if (themeFilter === 'custom') return dashboard.themes.filter((theme) => !theme.builtIn)
    return dashboard.themes
  }, [dashboard.themes, themeFilter])

  const selected = useMemo(
    () => filteredThemes.find((theme) => theme.id === selectedId) ?? filteredThemes[0],
    [filteredThemes, selectedId],
  )

  const resolvedSafeArea = useMemo(() => {
    if (!selected) return 'left'
    if (selected.art.safeArea === 'auto') {
      return selected.art.focusX > 0.6 ? 'left' : (selected.art.focusX < 0.4 ? 'right' : 'left')
    }
    return selected.art.safeArea
  }, [selected])

  const resolvedAppearance = useMemo(() => {
    if (!selected) return 'dark'
    if (selected.appearance === 'auto') {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      } catch {
        return 'dark'
      }
    }
    return selected.appearance
  }, [selected])



  const refresh = async () => {
    try {
      const next = await invoke<Dashboard>('get_dashboard')
      setDashboard(next)
      setSelectedId((current) => current ?? next.activeThemeId ?? next.themes[0]?.id)
    } catch (error) {
      toast.error(String(error))
    }
  }

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(interval)
  }, [])

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setWorking(key)
    try {
      await action()
      await refresh()
      toast.success(success)
    } catch (error) {
      toast.error(String(error))
    } finally {
      setWorking(undefined)
    }
  }

  const importWallpaper = async () => {
    const selectedPath = await open({
      multiple: false, directory: false,
      filters: [{ name: '主题背景', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    })
    if (!selectedPath) return
    await run('import', async () => {
      const theme = await invoke<ThemeRecord>('import_wallpaper', { path: selectedPath })
      setSelectedId(theme.id)
    }, '主题已加入本地主题库')
  }

  const importThemeBundle = async () => {
    const selectedPath = await open({
      multiple: false, directory: false,
      filters: [{ name: 'Codex Skin Studio 主题包', extensions: ['codex-theme'] }],
    })
    if (!selectedPath) return
    await run('import-theme', async () => {
      const theme = await invoke<ThemeRecord>('import_theme_bundle', { path: selectedPath })
      setSelectedId(theme.id)
    }, '主题包已加入本地主题库')
  }

  const exportSelected = async () => {
    if (!selected) return
    const selectedPath = await save({
      title: '导出主题包',
      defaultPath: themeBundleFilename(selected),
      filters: [{ name: 'Codex Skin Studio 主题包', extensions: ['codex-theme'] }],
    })
    if (!selectedPath) return
    const path = selectedPath.toLowerCase().endsWith('.codex-theme')
      ? selectedPath
      : `${selectedPath}.codex-theme`
    await run(
      'export',
      () => invoke('export_theme', { themeId: selected.id, path }),
      '主题包已导出',
    )
  }

  const deleteTheme = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    setWorking('delete')
    try {
      await invoke('delete_theme', { themeId: target.id })
      setSelectedId((current) => current === target.id ? undefined : current)
      await refresh()
      toast.success('主题已删除')
    } catch (error) {
      toast.error(String(error))
    } finally {
      setWorking(undefined)
    }
  }

  const applySelected = async (restartExisting = false) => {
    if (!selected) return
    await run('apply', async () => {
      await invoke('apply_theme', { themeId: selected.id, restartExisting })
      try {
        await invoke('activate_codex')
      } catch (error) {
        console.warn('Unable to activate Codex after applying the theme:', error)
      }
    }, `${selected.name} 已应用`)
  }

  const requestApply = async () => {
    if (!selected) return
    setWorking('plan')
    try {
      const plan = await invoke<ApplyPlan>('get_apply_plan', { themeId: selected.id })
      if (plan.action === 'restart') {
        setConfirmRestart(true)
        return
      }
    } catch (error) {
      toast.error(String(error))
      return
    } finally {
      setWorking(undefined)
    }
    await applySelected(false)
  }

  const toggleAutostart = async () => {
    const enabled = !dashboard.autostartEnabled
    await run(
      'autostart',
      () => invoke('set_autostart', { enabled }),
      enabled ? '已启用开机启动' : '已关闭开机启动',
    )
  }

  const updateSelected = async (patch: Partial<Pick<ThemeRecord, 'appearance' | 'art' | 'levelSlider' | 'composer' | 'environment' | 'changeSummary' | 'tokens' | 'ui'>>) => {
    if (!selected) return
    const next = {
      ...selected,
      ...patch,
      art: patch.art ? { ...selected.art, ...patch.art } : selected.art,
      levelSlider: patch.levelSlider
        ? { ...selected.levelSlider, ...patch.levelSlider }
        : selected.levelSlider,
      composer: patch.composer ? { ...selected.composer, ...patch.composer } : selected.composer,
      environment: patch.environment
        ? { ...selected.environment, ...patch.environment }
        : selected.environment,
      changeSummary: patch.changeSummary
        ? { ...selected.changeSummary, ...patch.changeSummary }
        : selected.changeSummary,
      tokens: patch.tokens ? { ...selected.tokens, ...patch.tokens } : selected.tokens,
      ui: patch.ui ? { ...selected.ui, ...patch.ui } : selected.ui,
    }
    setDashboard((current) => ({
      ...current,
      themes: current.themes.map((theme) => (theme.id === next.id ? next : theme)),
    }))
    try {
      await invoke('update_theme', {
        themeId: next.id, appearance: next.appearance, art: next.art,
        levelSlider: next.levelSlider,
        composer: next.composer, environment: next.environment,
        changeSummary: next.changeSummary, tokens: next.tokens, ui: next.ui,
      })
      if (dashboard.activeThemeId === next.id) {
        await invoke('apply_theme', { themeId: next.id, restartExisting: false })
      }
    } catch (error) {
      toast.error(String(error))
      await refresh()
    }
  }

  const toggleCodexLaunchOnOpen = async () => {
    const enabled = !dashboard.launchCodexOnOpen
    await run(
      'launch-codex-on-open',
      () => invoke('set_launch_codex_on_open', { enabled }),
      enabled ? '已启用启动时打开 Codex' : '已关闭启动时打开 Codex',
    )
  }

  const handleStoreInstalled = async (themeId: string) => {
    setSelectedId(themeId)
    await refresh()
  }

  const updateUi = <Key extends keyof UiConfig,>(key: Key, value: UiConfig[Key]) => {
    if (!selected) return Promise.resolve()
    return updateSelected({ ui: { ...selected.ui, [key]: value } })
  }

  const modeLabel = dashboard.mode === 'active' ? '主题运行中'
    : dashboard.mode === 'paused' ? '主题已暂停'
      : dashboard.mode === 'error' ? '需要处理' : '官方主题'

  return (
    <div className="flex w-full h-full min-h-0 overflow-hidden bg-transparent text-zinc-50 font-sans selection:bg-primary/20">
      {/* Sidebar */}
      <aside className="w-[218px] flex-none flex flex-col p-5 bg-zinc-900/35 backdrop-blur-xl text-zinc-200 border-r border-zinc-850/40">
        {/* Brand mark */}
        <div className="flex gap-3 align-middle items-center px-2 pb-6 border-b border-zinc-850/40 mb-4" aria-label="Codex Skin Studio">
          <img
            src="/app-icon.png"
            className="w-9 h-9 select-none hover:scale-[1.04] transition-all duration-300 object-contain"
            alt="Codex Skin Studio Logo"
          />
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm text-zinc-50">Skin Studio</span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mt-1">Codex themes</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 flex flex-col gap-1" aria-label="主导航">
          <button
            onClick={() => setActiveView('library')}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-lg border px-3 text-sm font-semibold transition-all duration-300 cursor-pointer hover:scale-[1.01] active:scale-[0.99]',
              activeView === 'library' 
                ? 'border-zinc-800/50 bg-zinc-800/60 text-zinc-50 shadow-[0_4px_12px_rgba(0,0,0,0.15)] backdrop-blur-sm' 
                : 'border-transparent bg-transparent text-zinc-400 hover:bg-zinc-800/35 hover:text-zinc-100',
            )}
          >
            <Library size={16} />
            <span>主题库</span>
          </button>
          <button
            onClick={() => setActiveView('store')}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-lg border px-3 text-sm font-semibold transition-all duration-300 cursor-pointer hover:scale-[1.01] active:scale-[0.99]',
              activeView === 'store' 
                ? 'border-zinc-800/50 bg-zinc-800/60 text-zinc-50 shadow-[0_4px_12px_rgba(0,0,0,0.15)] backdrop-blur-sm' 
                : 'border-transparent bg-transparent text-zinc-400 hover:bg-zinc-800/35 hover:text-zinc-100',
            )}
          >
            <Download size={16} />
            <span>主题商店</span>
          </button>
        </nav>

        {/* Compact app information */}
        <div className="mt-auto pt-3 border-t border-zinc-850/40">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-850/50 bg-zinc-950/25 px-3 py-2.5 text-[10px] backdrop-blur-sm">
            <span className="shrink-0 text-zinc-500">应用版本</span>
            <AppUpdater />
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-transparent">
        {activeView === 'store' ? (
          <ThemeStore onInstalled={handleStoreInstalled} />
        ) : (
          <>
        {/* Topbar */}
        <header className="h-[68px] border-b border-zinc-850/40 bg-zinc-900/35 backdrop-blur-md px-6 flex items-center justify-between flex-none">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-50">主题库</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              {themeFilter === 'all'
                ? `${dashboard.themes.length} 个本地主题`
                : `${filteredThemes.length} / ${dashboard.themes.length} 个本地主题`}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              role="switch"
              aria-checked={dashboard.autostartEnabled}
              title="开机启动"
              onClick={() => void toggleAutostart()}
              disabled={Boolean(working)}
              className="flex h-8 items-center gap-2 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-800/60 text-[11px] font-semibold text-zinc-350 hover:text-zinc-200 disabled:opacity-50 cursor-pointer transition-all duration-300"
            >
              <span className={cn(
                "relative h-4 w-7 rounded-full transition-colors duration-300",
                dashboard.autostartEnabled ? "bg-emerald-500" : "bg-zinc-700",
              )}>
                <span className={cn(
                  "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-300",
                  dashboard.autostartEnabled ? "translate-x-3" : "translate-x-0",
                )} />
              </span>
              <span>开机启动</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={dashboard.launchCodexOnOpen}
              title="启动 Skin Studio 时自动打开 Codex"
              onClick={() => void toggleCodexLaunchOnOpen()}
              disabled={Boolean(working)}
              className="flex h-8 items-center gap-2 px-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-800/60 text-[11px] font-semibold text-zinc-350 hover:text-zinc-200 disabled:opacity-50 cursor-pointer transition-all duration-300"
            >
              <span className={cn(
                "relative h-4 w-7 rounded-full transition-colors duration-300",
                dashboard.launchCodexOnOpen ? "bg-emerald-500" : "bg-zinc-700",
              )}>
                <span className={cn(
                  "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-300",
                  dashboard.launchCodexOnOpen ? "translate-x-3" : "translate-x-0",
                )} />
              </span>
              <span>启动时打开 Codex</span>
            </button>
            <Button
              variant="outline"
              size="icon-sm"
              title="刷新"
              onClick={() => void refresh()}
              disabled={Boolean(working)}
              className="text-zinc-400 hover:text-zinc-55 bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/60 cursor-pointer transition-all duration-300"
            >
              <RefreshCw size={15} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void importThemeBundle()}
              disabled={Boolean(working)}
              className="border-zinc-800/60 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-50 hover:border-zinc-700/60 cursor-pointer transition-all duration-300 active:scale-95"
            >
              {working === 'import-theme' ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <Upload size={15} />
              )}
              导入主题包
            </Button>
            <Button
              onClick={() => void importWallpaper()}
              disabled={Boolean(working)}
              size="sm"
              className="bg-gradient-to-br from-zinc-50 to-zinc-200 text-zinc-950 hover:from-white hover:to-zinc-100 shadow-[0_2px_8px_rgba(255,255,255,0.03)] cursor-pointer transition-all duration-300 active:scale-95 font-semibold"
            >
              {working === 'import' ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <ImagePlus size={15} />
              )}
              导入背景
            </Button>
          </div>
        </header>

        {/* Content grid */}
        <section className="grid min-h-0 flex-1 grid-cols-[minmax(360px,1.05fr)_minmax(320px,0.95fr)] overflow-hidden">
          {/* Left panel: Theme browser */}
          <div className="overflow-y-auto p-6 border-r border-zinc-850/40 bg-zinc-900/10">
            <div className="flex justify-between items-center mb-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <span>已安装主题</span>
              <span>选择主题进行编辑</span>
            </div>
            <div className="mb-4 flex items-center gap-3 border-y border-zinc-850/45 py-2.5">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">主题类型</span>
              <div className="flex min-w-0 flex-1 rounded-lg border border-zinc-800/70 bg-zinc-950/45 p-0.5" role="group" aria-label="主题类型筛选">
                {([
                  ['all', '全部'],
                  ['builtIn', '内置'],
                  ['custom', '自定义'],
                ] as const).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={themeFilter === filter}
                    onClick={() => setThemeFilter(filter)}
                    className={cn(
                      'h-6 min-w-0 flex-1 rounded-md px-2 text-[10px] font-semibold transition-colors cursor-pointer',
                      themeFilter === filter
                        ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                        : 'text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-200',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {filteredThemes.map((theme) => (
                <button
                  key={theme.id}
                  className={cn(
                    "flex flex-col overflow-hidden text-left border rounded-xl bg-gradient-to-b from-zinc-900/60 to-zinc-950/80 backdrop-blur-sm transition-all duration-300 ease-out cursor-pointer group shadow-sm hover:shadow-[0_12px_24px_rgba(0,0,0,0.3)] hover:-translate-y-1",
                    selected?.id === theme.id
                      ? "border-zinc-250 shadow-[0_0_15px_rgba(255,255,255,0.08)] ring-1 ring-zinc-200/50"
                      : "border-zinc-800/80 hover:border-zinc-700/50"
                  )}
                  onClick={() => setSelectedId(theme.id)}
                >
                  <span
                    className="relative block w-full aspect-video bg-zinc-950 bg-center bg-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    style={{ backgroundImage: `url(${theme.previewDataUrl})` }}
                  >
                    {/* Shadow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-90 transition-opacity" />
                    {selected?.id === theme.id && (
                      <i className="absolute z-10 top-2.5 right-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-zinc-50 text-zinc-950 shadow-md border border-white/20">
                        <Check size={13} strokeWidth={3.5} />
                      </i>
                    )}
                  </span>
                  <span className="flex flex-col p-3.5">
                    <b className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">{theme.name}</b>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={cn(
                        "rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase",
                        theme.builtIn 
                          ? "bg-zinc-800/80 text-zinc-400 border border-zinc-700/30"
                          : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                      )}>
                        {theme.builtIn ? '内置' : '自定义'}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">v{theme.version}</span>
                    </div>
                  </span>
                </button>
              ))}
              {filteredThemes.length > 0 ? (
                <button
                  className="flex flex-col items-center justify-center min-h-[160px] gap-2.5 border border-dashed border-zinc-800 hover:border-zinc-700/60 rounded-xl bg-zinc-900/10 hover:bg-zinc-900/30 transition-all duration-300 cursor-pointer text-zinc-500 hover:text-zinc-200 group hover:scale-[1.01]"
                  onClick={() => void importWallpaper()}
                >
                  <ImagePlus size={20} className="group-hover:scale-110 transition-transform duration-300 text-zinc-500 group-hover:text-zinc-300" />
                  <span className="text-xs font-semibold">导入背景图片</span>
                </button>
              ) : (
                <div className="col-span-2 flex min-h-[190px] flex-col items-center justify-center gap-3 border border-dashed border-zinc-800 bg-zinc-900/10 px-6 text-center">
                  <ImagePlus size={24} strokeWidth={1.5} className="text-zinc-600" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-300">
                      {themeFilter === 'custom' ? '还没有自定义主题' : '主题库暂时为空'}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {themeFilter === 'custom' ? '导入背景图片或主题包后会显示在这里' : '正在读取本地主题'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void importWallpaper()}
                    className="border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 cursor-pointer"
                  >
                    <ImagePlus size={13} />
                    导入背景
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Inspector */}
          <aside className="flex min-h-0 flex-col overflow-hidden bg-zinc-900/20 backdrop-blur-xl border-l border-zinc-800/40">
            {selected ? (
              <>
                <div className="shrink-0 border-b border-zinc-850/40 bg-zinc-900/15 px-5 pt-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-all duration-300">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <button
                      onClick={togglePreview}
                      className="flex min-w-0 items-center gap-2 hover:text-zinc-50 transition-colors cursor-pointer group"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800/80 text-zinc-300 group-hover:bg-zinc-700 transition-colors">
                        <PanelRight size={11} />
                      </span>
                      <span className="text-[11px] font-bold text-zinc-300 group-hover:text-zinc-50 transition-colors">Codex 实时预览</span>
                      <ChevronDown
                        size={11}
                        className={cn(
                          "text-zinc-500 group-hover:text-zinc-300 transition-transform duration-300",
                          showPreview ? "rotate-0" : "-rotate-90"
                        )}
                      />
                    </button>
                    <span className="max-w-[48%] truncate text-right text-[10px] font-medium text-zinc-500">
                      {selected.name}
                    </span>
                  </div>
                  <div className={cn(
                    "grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-in-out",
                    showPreview ? "grid-rows-[1fr] opacity-100 pb-4" : "grid-rows-[0fr] opacity-0 pb-0 pointer-events-none"
                  )}>
                    <div className="overflow-hidden">
                      <div className="max-w-[780px] mx-auto w-full">
                        <CodexPreview
                          theme={selected}
                          appearance={resolvedAppearance}
                          safeArea={resolvedSafeArea}
                          activeElement={activeElement}
                          onSelectElement={selectPreviewElement}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
                  {/* Theme Title Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                    <div>
                      <h2 className="text-base font-bold text-zinc-50">{selected.name}</h2>

                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-xs"
                        title="导出主题包"
                        aria-label="导出主题包"
                        onClick={() => void exportSelected()}
                        disabled={Boolean(working)}
                        className="border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 cursor-pointer"
                      >
                        {working === 'export' ? (
                          <LoaderCircle className="animate-spin" size={13} />
                        ) : (
                          <Download size={13} />
                        )}
                      </Button>
                      {!selected.builtIn && (
                        <Button
                          variant="destructive"
                          size="icon-xs"
                          title="删除主题"
                          aria-label={`删除主题 ${selected.name}`}
                          onClick={() => setDeleteTarget(selected)}
                          disabled={Boolean(working)}
                          className="cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </div>


                  {/* Advanced UI Settings */}
                  <div className="flex flex-col gap-2 pb-5 border-b border-zinc-800/40">
                    <label className="mb-1 flex items-center gap-2 text-xs font-bold text-zinc-450 tracking-wide uppercase">
                      <SlidersHorizontal size={13} className="text-zinc-550" />
                      <span>界面元素</span>
                    </label>

                    {/* Inline Tab Selectors */}
                    <div className="flex p-0.5 rounded-lg bg-zinc-950/80 border border-zinc-850/50 mb-2">
                      <button
                        type="button"
                        onClick={() => selectElementTab('shell')}
                        className={cn(
                          "flex-1 py-1.5 text-[11px] font-bold rounded transition-all duration-300 cursor-pointer text-center active:scale-98",
                          elementTab === 'shell'
                            ? "bg-zinc-850 border border-zinc-700/20 text-zinc-50 shadow-md"
                            : "text-zinc-450 hover:text-zinc-205"
                        )}
                      >
                        基础框架
                      </button>
                      <button
                        type="button"
                        onClick={() => selectElementTab('components')}
                        className={cn(
                          "flex-1 py-1.5 text-[11px] font-bold rounded transition-all duration-300 cursor-pointer text-center active:scale-98",
                          elementTab === 'components'
                            ? "bg-zinc-850 border border-zinc-700/20 text-zinc-50 shadow-md"
                            : "text-zinc-450 hover:text-zinc-205"
                        )}
                      >
                        视图组件
                      </button>
                      <button
                        type="button"
                        onClick={() => selectElementTab('styles')}
                        className={cn(
                          "flex-1 py-1.5 text-[11px] font-bold rounded transition-all duration-300 cursor-pointer text-center active:scale-98",
                          elementTab === 'styles'
                            ? "bg-zinc-850 border border-zinc-700/20 text-zinc-50 shadow-md"
                            : "text-zinc-450 hover:text-zinc-205"
                        )}
                      >
                        辅助样式
                      </button>
                    </div>

                    {elementTab === 'shell' && (
                      <>
                        <ConfigSection title="画布与焦点" {...configSectionProps('canvas')}>
                          <div className="grid grid-cols-2 gap-4 pb-1">
                            <div className="flex flex-col gap-2">
                              <label className="text-[10px] font-bold text-zinc-400 tracking-wide uppercase">
                                内容安全区
                              </label>
                              <Select
                                value={selected.art.safeArea}
                                onValueChange={(val) => void updateSelected({ art: { ...selected.art, safeArea: val as ArtConfig['safeArea'] } })}
                              >
                                <SelectTrigger className="w-full h-8 text-xs cursor-pointer bg-zinc-900 border-zinc-800">
                                  <SelectValue placeholder="选择安全区" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">自动</SelectItem>
                                  <SelectItem value="left">左侧</SelectItem>
                                  <SelectItem value="right">右侧</SelectItem>
                                  <SelectItem value="center">居中</SelectItem>
                                  <SelectItem value="none">关闭</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex flex-col gap-2">
                              <label className="text-[10px] font-bold text-zinc-400 tracking-wide uppercase">
                                任务页背景
                              </label>
                              <Select
                                value={selected.art.taskMode}
                                onValueChange={(val) => void updateSelected({ art: { ...selected.art, taskMode: val as ArtConfig['taskMode'] } })}
                              >
                                <SelectTrigger className="w-full h-8 text-xs cursor-pointer bg-zinc-900 border-zinc-800">
                                  <SelectValue placeholder="选择任务页" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">自动</SelectItem>
                                  <SelectItem value="ambient">氛围</SelectItem>
                                  <SelectItem value="banner">横幅</SelectItem>
                                  <SelectItem value="off">关闭</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <SliderSetting
                            label="水平焦点"
                            value={selected.art.focusX}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(focusX) => void updateSelected({ art: { ...selected.art, focusX } })}
                          />
                        </ConfigSection>

                        <ConfigSection title="输入框" {...configSectionProps('composer')}>
                          <ColorSetting
                            label="背景色"
                            value={selected.composer.background}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#121620'}
                            onChange={(background) => void updateSelected({
                              composer: { ...selected.composer, background },
                            })}
                          />
                          <SliderSetting
                            label="不透明度"
                            value={selected.composer.opacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(opacity) => void updateSelected({
                              composer: { ...selected.composer, opacity },
                            })}
                          />
                          <SliderSetting
                            label="背景模糊"
                            value={selected.composer.blur}
                            min={0}
                            max={32}
                            step={1}
                            unit="px"
                            onChange={(blur) => void updateSelected({
                              composer: { ...selected.composer, blur },
                            })}
                          />
                          <SliderSetting
                            label="边框强度"
                            value={selected.composer.borderOpacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(borderOpacity) => void updateSelected({
                              composer: { ...selected.composer, borderOpacity },
                            })}
                          />
                          <ShadowSetting
                            value={selected.composer.shadow}
                            onChange={(shadow) => void updateSelected({
                              composer: { ...selected.composer, shadow },
                            })}
                          />
                          <SliderSetting
                            label="输入框圆角"
                            value={selected.composer.radius}
                            min={8}
                            max={32}
                            step={1}
                            unit="px"
                            onChange={(radius) => void updateSelected({
                              composer: { ...selected.composer, radius },
                            })}
                          />
                          <div className="h-px bg-zinc-800" />
                          <ColorSetting
                            label="占位文字"
                            value={selected.composer.placeholderColor}
                            autoColor={resolvedAppearance === 'light' ? '#475569' : '#B8C0CA'}
                            onChange={(placeholderColor) => void updateSelected({
                              composer: { ...selected.composer, placeholderColor },
                            })}
                          />
                          <ColorSetting
                            label="内部控件颜色"
                            value={selected.composer.controlColor}
                            autoColor={selected.accent}
                            onChange={(controlColor) => void updateSelected({
                              composer: { ...selected.composer, controlColor },
                            })}
                          />
                          <SliderSetting
                            label="内部控件强度"
                            value={selected.composer.controlOpacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(controlOpacity) => void updateSelected({
                              composer: { ...selected.composer, controlOpacity },
                            })}
                          />
                          <SliderSetting
                            label="内部控件圆角"
                            value={selected.composer.controlRadius}
                            min={0}
                            max={24}
                            step={1}
                            unit="px"
                            onChange={(controlRadius) => void updateSelected({
                              composer: { ...selected.composer, controlRadius },
                            })}
                          />
                          <ColorSetting
                            label="主操作颜色"
                            value={selected.composer.primaryActionColor}
                            autoColor={selected.accent}
                            onChange={(primaryActionColor) => void updateSelected({
                              composer: { ...selected.composer, primaryActionColor },
                            })}
                          />
                          <ColorSetting
                            label="主操作文字"
                            value={selected.composer.primaryActionText}
                            autoColor={resolvedAppearance === 'light' ? '#FFFFFF' : '#101318'}
                            onChange={(primaryActionText) => void updateSelected({
                              composer: { ...selected.composer, primaryActionText },
                            })}
                          />
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-xs font-semibold text-zinc-300">底部浮层渐变</span>
                              <small className="text-[10px] font-medium text-zinc-500">
                                {selected.composer.showFooterBackdrop ? '显示' : '隐藏'}
                              </small>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={selected.composer.showFooterBackdrop}
                              aria-label="显示底部浮层渐变"
                              title={selected.composer.showFooterBackdrop ? '隐藏底部浮层渐变' : '显示底部浮层渐变'}
                              onClick={() => void updateSelected({
                                composer: {
                                  ...selected.composer,
                                  showFooterBackdrop: !selected.composer.showFooterBackdrop,
                                },
                              })}
                              className={cn(
                                "relative h-5 w-9 flex-none rounded-full border transition-colors cursor-pointer",
                                selected.composer.showFooterBackdrop
                                  ? "border-emerald-400/40 bg-emerald-500"
                                  : "border-zinc-700 bg-zinc-800"
                              )}
                            >
                              <span className={cn(
                                "absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                                selected.composer.showFooterBackdrop ? "translate-x-4" : "translate-x-0"
                              )} />
                            </button>
                          </div>
                        </ConfigSection>

                        <ConfigSection title="环境面板" {...configSectionProps('environment')}>
                          <ToggleSetting
                            label="显示"
                            checked={selected.environment.visible}
                            onChange={(visible) => void updateSelected({
                              environment: { ...selected.environment, visible },
                            })}
                          />
                          {selected.environment.visible && (
                            <>
                              <ColorSetting
                                label="背景色"
                                value={selected.environment.background}
                                autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                                onChange={(background) => void updateSelected({
                                  environment: { ...selected.environment, background },
                                })}
                              />
                              <SliderSetting
                                label="不透明度"
                                value={selected.environment.opacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(opacity) => void updateSelected({
                                  environment: { ...selected.environment, opacity },
                                })}
                              />
                              <SliderSetting
                                label="背景模糊"
                                value={selected.environment.blur}
                                min={0}
                                max={32}
                                step={1}
                                unit="px"
                                onChange={(blur) => void updateSelected({
                                  environment: { ...selected.environment, blur },
                                })}
                              />
                              <SliderSetting
                                label="边框强度"
                                value={selected.environment.borderOpacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(borderOpacity) => void updateSelected({
                                  environment: { ...selected.environment, borderOpacity },
                                })}
                              />
                              <SliderSetting
                                label="圆角"
                                value={selected.environment.radius}
                                min={8}
                                max={32}
                                step={1}
                                unit="px"
                                onChange={(radius) => void updateSelected({
                                  environment: { ...selected.environment, radius },
                                })}
                              />
                              <ShadowSetting
                                value={selected.environment.shadow}
                                onChange={(shadow) => void updateSelected({
                                  environment: { ...selected.environment, shadow },
                                })}
                              />
                            </>
                          )}
                        </ConfigSection>

                        <ConfigSection title="变更摘要" {...configSectionProps('changeSummary')}>
                          <ToggleSetting
                            label="显示"
                            checked={selected.changeSummary.visible}
                            onChange={(visible) => void updateSelected({
                              changeSummary: { ...selected.changeSummary, visible },
                            })}
                          />
                          {selected.changeSummary.visible && (
                            <>
                              <ColorSetting
                                label="背景色"
                                value={selected.changeSummary.background}
                                autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                                onChange={(background) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, background },
                                })}
                              />
                              <SliderSetting
                                label="不透明度"
                                value={selected.changeSummary.opacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(opacity) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, opacity },
                                })}
                              />
                              <SliderSetting
                                label="背景模糊"
                                value={selected.changeSummary.blur}
                                min={0}
                                max={32}
                                step={1}
                                unit="px"
                                onChange={(blur) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, blur },
                                })}
                              />
                              <SliderSetting
                                label="边框强度"
                                value={selected.changeSummary.borderOpacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(borderOpacity) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, borderOpacity },
                                })}
                              />
                              <SliderSetting
                                label="圆角"
                                value={selected.changeSummary.radius}
                                min={8}
                                max={32}
                                step={1}
                                unit="px"
                                onChange={(radius) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, radius },
                                })}
                              />
                              <ShadowSetting
                                value={selected.changeSummary.shadow}
                                onChange={(shadow) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, shadow },
                                })}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  selectElementTab('styles')
                                  setSelectedElement('diff')
                                }}
                                className="flex h-9 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900 cursor-pointer"
                              >
                                <span>配置文件内容区域</span>
                                <span className="text-zinc-500">背景、行状态与增删颜色</span>
                              </button>
                            </>
                          )}
                        </ConfigSection>

                        <ConfigSection title="左侧边栏" {...configSectionProps('sidebar')}>
                          <SurfaceStyleEditor
                            value={selected.ui.sidebar}
                            autoColor={resolvedAppearance === 'light' ? '#f1f5f9' : '#0e121c'}
                            onChange={(value) => void updateUi('sidebar', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="顶部标题栏" {...configSectionProps('header')}>
                          <SurfaceStyleEditor
                            value={selected.ui.header}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#121620'}
                            onChange={(value) => void updateUi('header', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="正文布局" {...configSectionProps('content')}>
                          <SliderSetting
                            label="内容宽度"
                            value={selected.ui.content.maxWidth}
                            min={560}
                            max={1200}
                            step={8}
                            unit="px"
                            onChange={(maxWidth) => void updateUi('content', { ...selected.ui.content, maxWidth })}
                          />
                          <SliderSetting
                            label="字体缩放"
                            value={selected.ui.content.fontScale}
                            min={0.8}
                            max={1.3}
                            step={0.01}
                            unit="%"
                            onChange={(fontScale) => void updateUi('content', { ...selected.ui.content, fontScale })}
                          />
                          <SliderSetting
                            label="消息间距"
                            value={selected.ui.content.messageGap}
                            min={4}
                            max={32}
                            step={1}
                            unit="px"
                            onChange={(messageGap) => void updateUi('content', { ...selected.ui.content, messageGap })}
                          />
                        </ConfigSection>
                      </>
                    )}

                    {elementTab === 'components' && (
                      <>
                        <ConfigSection title="用户消息气泡" {...configSectionProps('userBubble')}>
                          <SurfaceStyleEditor
                            value={selected.ui.userBubble}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                            onChange={(value) => void updateUi('userBubble', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="代码块" {...configSectionProps('codeBlock')}>
                          <SurfaceStyleEditor
                            value={selected.ui.codeBlock}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                            onChange={(value) => void updateUi('codeBlock', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="工具活动卡片" {...configSectionProps('activityCard')}>
                          <SurfaceStyleEditor
                            value={selected.ui.activityCard}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                            onChange={(value) => void updateUi('activityCard', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="弹层与菜单" {...configSectionProps('overlays')}>
                          <OverlayStyleEditor
                            value={selected.ui.overlays}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                            onChange={(value) => void updateUi('overlays', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="级别滑块" {...configSectionProps('levelSlider')}>
                          <ToggleSetting
                            label="自定义轨道"
                            checked={selected.levelSlider.enabled}
                            onChange={(enabled) => void updateSelected({
                              levelSlider: { ...selected.levelSlider, enabled },
                            })}
                          />
                          {selected.levelSlider.enabled && (
                            <>
                              <div className="h-px bg-zinc-800" />
                              {levelSliderLabels.map((label, index) => (
                                <ColorSetting
                                  key={label}
                                  label={`级别 ${index + 1} · ${label}`}
                                  value={selected.levelSlider.levelColors[index]}
                                  autoColor={selected.levelSlider.levelColors[index]}
                                  allowAuto={false}
                                  onChange={(color) => {
                                    const levelColors = selected.levelSlider.levelColors.map(
                                      (current, currentIndex) => currentIndex === index ? color : current,
                                    ) as LevelSliderConfig['levelColors']
                                    void updateSelected({
                                      levelSlider: { ...selected.levelSlider, levelColors },
                                    })
                                  }}
                                />
                              ))}
                              <div className="h-px bg-zinc-800" />
                              <ColorSetting
                                label="拖块颜色"
                                value={selected.levelSlider.thumbColor}
                                autoColor="#ffffff"
                                allowAuto={false}
                                onChange={(thumbColor) => void updateSelected({
                                  levelSlider: { ...selected.levelSlider, thumbColor },
                                })}
                              />
                            </>
                          )}
                        </ConfigSection>

                        <ConfigSection title="任务列表行" {...configSectionProps('threadRows')}>
                          <RowStyleEditor
                            value={selected.ui.threadRows}
                            autoColor={selected.accent}
                            onChange={(value) => void updateUi('threadRows', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="环境面板项目" {...configSectionProps('summaryRows')}>
                          <RowStyleEditor
                            value={selected.ui.summaryRows}
                            autoColor={selected.accent}
                            onChange={(value) => void updateUi('summaryRows', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="主页建议卡片" {...configSectionProps('homeSuggestions')}>
                          <SurfaceStyleEditor
                            value={selected.ui.homeSuggestions}
                            autoColor={resolvedAppearance === 'light' ? '#ffffff' : '#121620'}
                            onChange={(value) => void updateUi('homeSuggestions', value)}
                          />
                          <p className="text-[11px] leading-relaxed text-zinc-500">
                            卡片文字继承“主文字”语义色，图标颜色由 Codex 保持原生状态色。
                          </p>
                        </ConfigSection>
                      </>
                    )}

                    {elementTab === 'styles' && (
                      <>
                        <ConfigSection title="语义文字与状态" {...configSectionProps('tokens')}>
                          <SemanticTokensEditor
                            value={selected.tokens}
                            appearance={resolvedAppearance}
                            onChange={(tokens) => void updateSelected({ tokens })}
                          />
                        </ConfigSection>

                        <ConfigSection title="导航轨与滚动条" {...configSectionProps('navigation')}>
                          <ToggleSetting
                            label="消息导航轨"
                            checked={selected.ui.navigationRailVisible}
                            onChange={(value) => void updateUi('navigationRailVisible', value)}
                          />
                          {selected.ui.navigationRailVisible && (
                            <SliderSetting
                              label="导航轨不透明度"
                              value={selected.ui.navigationRailOpacity}
                              min={0}
                              max={1}
                              step={0.01}
                              unit="%"
                              onChange={(value) => void updateUi('navigationRailOpacity', value)}
                            />
                          )}
                          <div className="h-px bg-zinc-800" />
                          <ToggleSetting
                            label="滚动条"
                            checked={selected.ui.scrollbar.visible}
                            onChange={(visible) => void updateUi('scrollbar', { ...selected.ui.scrollbar, visible })}
                          />
                          {selected.ui.scrollbar.visible && (
                            <>
                              <ColorSetting
                                label="滚动条颜色"
                                value={selected.ui.scrollbar.color}
                                autoColor={resolvedAppearance === 'light' ? '#94a3b8' : '#64748b'}
                                onChange={(color) => void updateUi('scrollbar', { ...selected.ui.scrollbar, color })}
                              />
                              <SliderSetting
                                label="不透明度"
                                value={selected.ui.scrollbar.opacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(opacity) => void updateUi('scrollbar', { ...selected.ui.scrollbar, opacity })}
                              />
                              <SliderSetting
                                label="宽度"
                                value={selected.ui.scrollbar.width}
                                min={4}
                                max={16}
                                step={1}
                                unit="px"
                                onChange={(width) => void updateUi('scrollbar', { ...selected.ui.scrollbar, width })}
                              />
                              <SliderSetting
                                label="圆角"
                                value={selected.ui.scrollbar.radius}
                                min={0}
                                max={16}
                                step={1}
                                unit="px"
                                onChange={(radius) => void updateUi('scrollbar', { ...selected.ui.scrollbar, radius })}
                              />
                            </>
                          )}
                        </ConfigSection>

                        <ConfigSection title="变更摘要文件区" {...configSectionProps('diff')}>
                          <ToggleSetting
                            label="显示"
                            checked={selected.ui.diff.visible}
                            onChange={(visible) => void updateUi('diff', { ...selected.ui.diff, visible })}
                          />
                          {selected.ui.diff.visible && (
                            <>
                              <ColorSetting
                                label="背景色"
                                value={selected.ui.diff.background}
                                autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                                onChange={(background) => void updateUi('diff', { ...selected.ui.diff, background })}
                              />
                              <SliderSetting
                                label="背景不透明度"
                                value={selected.ui.diff.opacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(opacity) => void updateUi('diff', { ...selected.ui.diff, opacity })}
                              />
                              <SliderSetting
                                label="悬停背景不透明度"
                                value={selected.ui.diff.hoverOpacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(hoverOpacity) => void updateUi('diff', { ...selected.ui.diff, hoverOpacity })}
                              />
                              <ColorSetting
                                label="新增颜色"
                                value={selected.ui.diff.addedColor}
                                autoColor="#22c55e"
                                allowAuto={false}
                                onChange={(addedColor) => void updateUi('diff', { ...selected.ui.diff, addedColor })}
                              />
                              <ColorSetting
                                label="删除颜色"
                                value={selected.ui.diff.deletedColor}
                                autoColor="#ef4444"
                                allowAuto={false}
                                onChange={(deletedColor) => void updateUi('diff', { ...selected.ui.diff, deletedColor })}
                              />
                              <SliderSetting
                                label="圆角"
                                value={selected.ui.diff.radius}
                                min={0}
                                max={24}
                                step={1}
                                unit="px"
                                onChange={(radius) => void updateUi('diff', { ...selected.ui.diff, radius })}
                              />
                            </>
                          )}
                        </ConfigSection>

                        <ConfigSection title="富文本内容" {...configSectionProps('richText')}>
                          <ColorSetting
                            label="链接颜色"
                            value={selected.ui.richText.linkColor}
                            autoColor={selected.accent}
                            onChange={(linkColor) => void updateUi('richText', { ...selected.ui.richText, linkColor })}
                          />
                          <ColorSetting
                            label="行内代码背景"
                            value={selected.ui.richText.inlineCodeBackground}
                            autoColor={resolvedAppearance === 'light' ? '#f1f5f9' : '#18181b'}
                            onChange={(inlineCodeBackground) => void updateUi('richText', { ...selected.ui.richText, inlineCodeBackground })}
                          />
                          <SliderSetting
                            label="行内代码强度"
                            value={selected.ui.richText.inlineCodeOpacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(inlineCodeOpacity) => void updateUi('richText', { ...selected.ui.richText, inlineCodeOpacity })}
                          />
                          <SliderSetting
                            label="行内代码圆角"
                            value={selected.ui.richText.inlineCodeRadius}
                            min={0}
                            max={24}
                            step={1}
                            unit="px"
                            onChange={(inlineCodeRadius) => void updateUi('richText', { ...selected.ui.richText, inlineCodeRadius })}
                          />
                          <ColorSetting
                            label="引用强调色"
                            value={selected.ui.richText.quoteAccent}
                            autoColor={selected.accent}
                            onChange={(quoteAccent) => void updateUi('richText', { ...selected.ui.richText, quoteAccent })}
                          />
                          <ColorSetting
                            label="引用背景"
                            value={selected.ui.richText.quoteBackground}
                            autoColor={resolvedAppearance === 'light' ? '#f1f5f9' : '#18181b'}
                            onChange={(quoteBackground) => void updateUi('richText', { ...selected.ui.richText, quoteBackground })}
                          />
                          <SliderSetting
                            label="引用背景强度"
                            value={selected.ui.richText.quoteOpacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(quoteOpacity) => void updateUi('richText', { ...selected.ui.richText, quoteOpacity })}
                          />
                          <ColorSetting
                            label="表格边框"
                            value={selected.ui.richText.tableBorder}
                            autoColor={resolvedAppearance === 'light' ? '#cbd5e1' : '#475569'}
                            onChange={(tableBorder) => void updateUi('richText', { ...selected.ui.richText, tableBorder })}
                          />
                          <ColorSetting
                            label="表格背景"
                            value={selected.ui.richText.tableBackground}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                            onChange={(tableBackground) => void updateUi('richText', { ...selected.ui.richText, tableBackground })}
                          />
                          <SliderSetting
                            label="表格背景强度"
                            value={selected.ui.richText.tableOpacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(tableOpacity) => void updateUi('richText', { ...selected.ui.richText, tableOpacity })}
                          />
                          <SliderSetting
                            label="表格圆角"
                            value={selected.ui.richText.tableRadius}
                            min={0}
                            max={24}
                            step={1}
                            unit="px"
                            onChange={(tableRadius) => void updateUi('richText', { ...selected.ui.richText, tableRadius })}
                          />
                          <SliderSetting
                            label="图片圆角"
                            value={selected.ui.richText.imageRadius}
                            min={0}
                            max={32}
                            step={1}
                            unit="px"
                            onChange={(imageRadius) => void updateUi('richText', { ...selected.ui.richText, imageRadius })}
                          />
                        </ConfigSection>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-center text-zinc-500">
                <Library size={32} strokeWidth={1.5} className="text-zinc-700" />
                <span className="text-xs font-semibold">
                  {themeFilter === 'custom' ? '没有可编辑的自定义主题' : '主题库为空'}
                </span>
              </div>
            )}
          </aside>
        </section>

        {/* Footer actions */}
        <footer className="h-[76px] px-6 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between flex-none">
          <div className="flex gap-2.5 items-center text-zinc-200">
            <ShieldCheck size={18} strokeWidth={2.5} className="text-emerald-500" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-50">{modeLabel}</span>
              <small className="text-[10px] text-zinc-400 mt-0.5 max-w-[360px] truncate">
                {dashboard.message}
              </small>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {dashboard.mode === 'active' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void run('pause', () => invoke('pause_skin'), '主题已暂停')}
                disabled={Boolean(working)}
                className="text-zinc-200 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 cursor-pointer"
              >
                <Pause size={15} />
                暂停
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRestore(true)}
              disabled={Boolean(working) || dashboard.mode === 'official'}
              className="text-amber-400 bg-amber-950/20 border-amber-900/50 hover:bg-amber-950/40 hover:border-amber-800 cursor-pointer"
            >
              <RotateCcw size={15} />
              恢复官方主题
            </Button>
            <Button
              onClick={() => void requestApply()}
              disabled={!selected || Boolean(working)}
              size="sm"
              className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200 font-semibold cursor-pointer shadow-md"
            >
              {working === 'apply' || working === 'plan' ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <Play size={15} />
              )}
              {dashboard.mode === 'active' && dashboard.activeThemeId !== selected?.id
                ? '切换主题'
                : dashboard.mode === 'paused' && dashboard.activeThemeId === selected?.id
                  ? '恢复主题'
                  : '应用主题'}
            </Button>
          </div>
        </footer>
          </>
        )}
      </main>

      {/* Sonner Toaster component */}
      <Toaster position="top-right" />

      {/* Confirm Restart Dialog */}
      <Dialog open={confirmRestart} onOpenChange={setConfirmRestart}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <Play size={20} />
            </div>
            <DialogTitle>应用“{selected?.name}”</DialogTitle>
            <DialogDescription>
              Codex 需要使用本机调试端口启动。未发送的输入可能丢失。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestart(false)} className="cursor-pointer">
              取消
            </Button>
            <Button onClick={() => { setConfirmRestart(false); void applySelected(true) }} className="cursor-pointer">
              重启并应用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Theme Deletion Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-lg bg-rose-950/60 text-rose-400 flex items-center justify-center mb-2">
              <Trash2 size={20} />
            </div>
            <DialogTitle>删除“{deleteTarget?.name}”？</DialogTitle>
            <DialogDescription>
              背景图片和全部组件配置将被移除，此操作无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="cursor-pointer">
              取消
            </Button>
            <Button variant="destructive" onClick={() => void deleteTheme()} className="cursor-pointer">
              删除主题
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Restore Dialog */}
      <Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-2">
              <RotateCcw size={20} />
            </div>
            <DialogTitle>恢复官方主题</DialogTitle>
            <DialogDescription>
              当前皮肤和调试会话将被移除，Codex 会以普通模式重新启动。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(false)} className="cursor-pointer">
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => { setConfirmRestore(false); void run('restore', () => invoke('restore_official', { restartCodex: true }), '已恢复官方主题') }}
              className="cursor-pointer"
            >
              恢复官方主题
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
