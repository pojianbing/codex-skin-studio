import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import {
  Check, ChevronDown, Download, Files, ImagePlus, Library, LoaderCircle, MonitorCog,
  PanelBottom, PanelRight, Pause, Play, RefreshCw, RotateCcw, Settings2, ShieldCheck, Trash2,
  SlidersHorizontal,
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
type UiConfig = {
  sidebar: SurfaceStyle
  header: SurfaceStyle
  userBubble: SurfaceStyle
  codeBlock: SurfaceStyle
  activityCard: SurfaceStyle
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
  art: ArtConfig
  composer: ComposerConfig
  environment: EnvironmentConfig
  changeSummary: ChangeSummaryConfig
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
  themes: ThemeRecord[]
}
type ApplyPlan = { action: 'hotSwitch' | 'launch' | 'restart' }

const fallbackDashboard: Dashboard = {
  platform: 'desktop', codexFound: false, mode: 'official',
  message: '正在连接本地引擎', autostartEnabled: false, themes: [],
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
  output,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  output: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-zinc-300">{label}</label>
        <output className="text-[10px] font-mono font-semibold text-zinc-500">{output}</output>
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
  const resolved = value === 'auto' ? autoColor : value
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-zinc-300">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <label
          className="relative h-7 w-7 flex-none overflow-hidden rounded-md border border-zinc-700 ring-1 ring-black/20 cursor-pointer"
          title={`选择${label}`}
        >
          <span className="absolute inset-0" style={{ backgroundColor: resolved }} />
          <input
            type="color"
            aria-label={label}
            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
            value={resolved}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <code className="w-[74px] truncate text-right text-[10px] font-semibold text-zinc-500">
          {value === 'auto' ? '跟随主题' : value.toUpperCase()}
        </code>
        {allowAuto ? (
          <Button
            variant="ghost"
            size="icon-xs"
            title="恢复自动颜色"
            aria-label={`${label}恢复自动`}
            disabled={value === 'auto'}
            onClick={() => onChange('auto')}
            className="text-zinc-500 hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
          >
            <RotateCcw size={12} />
          </Button>
        ) : (
          <span className="h-7 w-7 flex-none" aria-hidden="true" />
        )}
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

function ConfigSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-t border-zinc-800 first:border-t-0">
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
          <SliderSetting label="不透明度" value={value.opacity} min={0} max={1} step={0.01} output={`${Math.round(value.opacity * 100)}%`} onChange={(opacity) => patch({ opacity })} />
          <SliderSetting label="背景模糊" value={value.blur} min={0} max={32} step={1} output={`${value.blur}px`} onChange={(blur) => patch({ blur })} />
          <SliderSetting label="边框强度" value={value.borderOpacity} min={0} max={1} step={0.01} output={`${Math.round(value.borderOpacity * 100)}%`} onChange={(borderOpacity) => patch({ borderOpacity })} />
          <SliderSetting label="圆角" value={value.radius} min={0} max={32} step={1} output={`${value.radius}px`} onChange={(radius) => patch({ radius })} />
          <ShadowSetting value={value.shadow} onChange={(shadow) => patch({ shadow })} />
        </>
      )}
    </>
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
          <SliderSetting label="常态强度" value={value.opacity} min={0} max={1} step={0.01} output={`${Math.round(value.opacity * 100)}%`} onChange={(opacity) => patch({ opacity })} />
          <SliderSetting label="悬停强度" value={value.hoverOpacity} min={0} max={1} step={0.01} output={`${Math.round(value.hoverOpacity * 100)}%`} onChange={(hoverOpacity) => patch({ hoverOpacity })} />
          <SliderSetting label="选中强度" value={value.selectedOpacity} min={0} max={1} step={0.01} output={`${Math.round(value.selectedOpacity * 100)}%`} onChange={(selectedOpacity) => patch({ selectedOpacity })} />
          <SliderSetting label="圆角" value={value.radius} min={0} max={24} step={1} output={`${value.radius}px`} onChange={(radius) => patch({ radius })} />
        </>
      )}
    </>
  )
}

function App() {
  const [dashboard, setDashboard] = useState<Dashboard>(fallbackDashboard)
  const [selectedId, setSelectedId] = useState<string>()
  const [working, setWorking] = useState<string>()
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)

  const selected = useMemo(
    () => dashboard.themes.find((theme) => theme.id === selectedId) ?? dashboard.themes[0],
    [dashboard.themes, selectedId],
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

  const previewComposerColor = selected
    ? selected.composer.background !== 'auto'
      ? selected.composer.background
      : resolvedAppearance === 'light' ? '#f8fafc' : '#121620'
    : '#121620'

  const previewComposerShadow = selected?.composer.shadow === 'none'
    ? 'none'
    : selected?.composer.shadow === 'strong'
      ? '0 14px 34px rgba(0, 0, 0, 0.42), 0 3px 8px rgba(0, 0, 0, 0.2)'
      : '0 8px 20px rgba(0, 0, 0, 0.24)'

  const previewEnvironmentColor = selected
    ? selected.environment.background !== 'auto'
      ? selected.environment.background
      : resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'
    : '#18181b'

  const previewEnvironmentShadow = selected?.environment.shadow === 'none'
    ? 'none'
    : selected?.environment.shadow === 'strong'
      ? '0 12px 30px rgba(0, 0, 0, 0.44), 0 3px 8px rgba(0, 0, 0, 0.22)'
      : '0 7px 18px rgba(0, 0, 0, 0.26)'

  const previewChangeSummaryColor = selected
    ? selected.changeSummary.background !== 'auto'
      ? selected.changeSummary.background
      : resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'
    : '#18181b'

  const previewChangeSummaryShadow = selected?.changeSummary.shadow === 'none'
    ? 'none'
    : selected?.changeSummary.shadow === 'strong'
      ? '0 10px 24px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2)'
      : '0 6px 16px rgba(0, 0, 0, 0.22)'

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

  const applySelected = async (restartExisting = false) => {
    if (!selected) return
    await run('apply', () => invoke('apply_theme', {
      themeId: selected.id, restartExisting,
    }), `${selected.name} 已应用`)
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

  const updateSelected = async (patch: Partial<Pick<ThemeRecord, 'appearance' | 'art' | 'composer' | 'environment' | 'changeSummary' | 'ui'>>) => {
    if (!selected) return
    const next = {
      ...selected,
      ...patch,
      art: patch.art ? { ...selected.art, ...patch.art } : selected.art,
      composer: patch.composer ? { ...selected.composer, ...patch.composer } : selected.composer,
      environment: patch.environment
        ? { ...selected.environment, ...patch.environment }
        : selected.environment,
      changeSummary: patch.changeSummary
        ? { ...selected.changeSummary, ...patch.changeSummary }
        : selected.changeSummary,
      ui: patch.ui ? { ...selected.ui, ...patch.ui } : selected.ui,
    }
    setDashboard((current) => ({
      ...current,
      themes: current.themes.map((theme) => (theme.id === next.id ? next : theme)),
    }))
    try {
      await invoke('update_theme', {
        themeId: next.id, appearance: next.appearance, art: next.art,
        composer: next.composer, environment: next.environment,
        changeSummary: next.changeSummary, ui: next.ui,
      })
      if (dashboard.activeThemeId === next.id) {
        await invoke('apply_theme', { themeId: next.id, restartExisting: false })
      }
    } catch (error) {
      toast.error(String(error))
      await refresh()
    }
  }

  const updateUi = <Key extends keyof UiConfig,>(key: Key, value: UiConfig[Key]) => {
    if (!selected) return Promise.resolve()
    return updateSelected({ ui: { ...selected.ui, [key]: value } })
  }

  const modeLabel = dashboard.mode === 'active' ? '主题运行中'
    : dashboard.mode === 'paused' ? '主题已暂停'
      : dashboard.mode === 'error' ? '需要处理' : '官方主题'

  return (
    <div className="flex w-full h-full min-h-0 overflow-hidden bg-zinc-950 text-zinc-50 font-sans selection:bg-primary/20">
      {/* Sidebar */}
      <aside className="w-[218px] flex-none flex flex-col p-5 bg-zinc-900 text-zinc-200 border-r border-zinc-800">
        {/* Brand mark */}
        <div className="flex gap-3 align-middle items-center px-2 pb-6 border-b border-zinc-800 mb-4" aria-label="Codex Skin Studio">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-50 text-zinc-950 font-extrabold text-sm tracking-wider shadow-inner select-none">
            CS
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm text-zinc-50">Skin Studio</span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mt-1">Codex themes</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 flex flex-col gap-1" aria-label="主导航">
          <button className="flex items-center gap-3 w-full h-10 px-3 rounded-lg text-sm font-medium transition-all text-zinc-50 bg-zinc-800 shadow-sm border border-zinc-700 cursor-pointer">
            <Library size={16} />
            <span>主题库</span>
          </button>
          <button className="flex items-center gap-3 w-full h-10 px-3 rounded-lg text-sm font-medium transition-all text-zinc-500 bg-transparent cursor-not-allowed opacity-50" disabled>
            <Download size={16} />
            <span>主题商店</span>
            <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-950 text-zinc-600">稍后</span>
          </button>
        </nav>

        {/* Runtime info block */}
        <div className="mt-auto pt-4 border-t border-zinc-800">
          <div className="flex gap-3 items-center p-3 rounded-lg bg-zinc-950/40 border border-zinc-800 mb-3">
            <span className={cn(
              "w-2 h-2 rounded-full ring-4 flex-none",
              dashboard.mode === 'active' ? "bg-emerald-400 ring-emerald-950/40"
                : dashboard.mode === 'paused' ? "bg-amber-400 ring-amber-950/40"
                  : dashboard.mode === 'error' ? "bg-rose-400 ring-rose-950/40"
                    : "bg-zinc-400 ring-zinc-950/40"
            )} />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-zinc-50 truncate">{modeLabel}</span>
              <span className="text-[10px] text-zinc-400 truncate mt-0.5">
                {dashboard.codexFound ? `Codex ${dashboard.codexVersion ?? ''}` : '未找到 Codex'}
              </span>
            </div>
          </div>
          <div className="flex gap-2 items-center px-2 text-[10px] text-zinc-500 font-medium tracking-wide uppercase">
            <MonitorCog size={13} className="text-zinc-600" />
            <span>{dashboard.platform}</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-zinc-950">
        {/* Topbar */}
        <header className="h-[68px] border-b border-zinc-800 bg-zinc-900 px-6 flex items-center justify-between flex-none">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-50">主题库</h1>
            <p className="text-xs text-zinc-400 mt-0.5">{dashboard.themes.length} 个本地主题</p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              role="switch"
              aria-checked={dashboard.autostartEnabled}
              title="开机启动"
              onClick={() => void toggleAutostart()}
              disabled={Boolean(working)}
              className="flex h-8 items-center gap-2 px-2.5 rounded-md border border-zinc-800 bg-zinc-900 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              <span className={cn(
                "relative h-4 w-7 rounded-full transition-colors",
                dashboard.autostartEnabled ? "bg-emerald-500" : "bg-zinc-700",
              )}>
                <span className={cn(
                  "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
                  dashboard.autostartEnabled ? "translate-x-3" : "translate-x-0",
                )} />
              </span>
              <span>开机启动</span>
            </button>
            <Button
              variant="outline"
              size="icon-sm"
              title="刷新"
              onClick={() => void refresh()}
              disabled={Boolean(working)}
              className="text-zinc-400 hover:text-zinc-50 bg-zinc-900 border-zinc-800 cursor-pointer"
            >
              <RefreshCw size={15} />
            </Button>
            <Button
              onClick={() => void importWallpaper()}
              disabled={Boolean(working)}
              size="sm"
              className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200 shadow-sm cursor-pointer"
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
        <section className="flex-1 grid grid-cols-[minmax(430px,1.15fr)_minmax(360px,0.85fr)] min-h-0 overflow-hidden">
          {/* Left panel: Theme browser */}
          <div className="overflow-y-auto p-6 border-r border-zinc-800 bg-zinc-900/30">
            <div className="flex justify-between items-center mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <span>已安装</span>
              <span>选择主题</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {dashboard.themes.map((theme) => (
                <button
                  key={theme.id}
                  className={cn(
                    "flex flex-col overflow-hidden text-left border rounded-lg bg-zinc-900 transition-all cursor-pointer group shadow-sm hover:shadow-md hover:-translate-y-0.5",
                    selected?.id === theme.id
                      ? "border-zinc-50 ring-1 ring-zinc-50"
                      : "border-zinc-800 hover:border-zinc-700"
                  )}
                  onClick={() => setSelectedId(theme.id)}
                >
                  <span
                    className="relative block w-full aspect-video bg-zinc-950 bg-center bg-cover"
                    style={{ backgroundImage: `url(${theme.previewDataUrl})` }}
                  >
                    {/* Shadow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                    {selected?.id === theme.id && (
                      <i className="absolute z-10 top-2.5 right-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-zinc-50 text-zinc-950 shadow-md">
                        <Check size={13} strokeWidth={3} />
                      </i>
                    )}
                  </span>
                  <span className="flex flex-col p-3.5">
                    <b className="text-sm font-semibold text-zinc-100 truncate">{theme.name}</b>
                    <small className="text-[10px] text-zinc-400 mt-1.5 flex items-center gap-1.5">
                      <span>{theme.builtIn ? '内置主题' : '本地主题'}</span>
                      <span>·</span>
                      <span>{theme.version}</span>
                    </small>
                  </span>
                </button>
              ))}
              <button
                className="flex flex-col items-center justify-center min-h-[160px] gap-2.5 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/20 hover:bg-zinc-900/50 hover:border-zinc-700 transition-all cursor-pointer text-zinc-400 hover:text-zinc-100"
                onClick={() => void importWallpaper()}
              >
                <ImagePlus size={20} />
                <span className="text-xs font-semibold">导入背景</span>
              </button>
            </div>
          </div>

          {/* Right panel: Inspector */}
          <aside className="overflow-y-auto p-6 bg-zinc-900 flex flex-col gap-6">
            {selected ? (
              <>
                {/* Live Preview */}
                <div
                  className="relative shrink-0 overflow-hidden w-full aspect-[16/10] border border-zinc-800 rounded-lg bg-zinc-950 bg-center bg-cover shadow-md"
                  style={{ backgroundImage: `url(${selected.previewDataUrl})` }}
                >
                  {/* Overlay Gradient depending on safeArea */}
                  <div className={cn(
                    "absolute inset-0 pointer-events-none transition-all duration-300",
                    resolvedSafeArea === 'left' && "bg-gradient-to-r from-black/60 via-zinc-900/10 to-transparent",
                    resolvedSafeArea === 'right' && "bg-gradient-to-l from-black/60 via-zinc-900/10 to-transparent",
                    resolvedSafeArea === 'center' && "bg-black/40",
                    resolvedSafeArea === 'none' && "bg-transparent opacity-0"
                  )} />

                  {/* Preview Sidebar */}
                  <div className={cn(
                    "absolute z-10 inset-y-0 left-0 flex w-[22%] flex-col gap-2.5 pt-[12%] px-2 backdrop-blur-[1px] transition-colors duration-300",
                    resolvedAppearance === 'light' ? "bg-white/45" : "bg-black/45"
                  )}>
                    <i className={cn("w-[70%] h-1 ml-[12%] rounded-full transition-colors duration-300", resolvedAppearance === 'light' ? "bg-zinc-800/60" : "bg-white/60")} />
                    <i className={cn("w-[50%] h-1 ml-[12%] rounded-full transition-colors duration-300", resolvedAppearance === 'light' ? "bg-zinc-800/60" : "bg-white/60")} />
                    <i className={cn("w-[60%] h-1 ml-[12%] rounded-full transition-colors duration-300", resolvedAppearance === 'light' ? "bg-zinc-800/60" : "bg-white/60")} />
                    <i className={cn("w-[45%] h-1 ml-[12%] rounded-full transition-colors duration-300", resolvedAppearance === 'light' ? "bg-zinc-800/60" : "bg-white/60")} />
                  </div>

                  {/* Preview Main */}
                  <div className="absolute z-10 inset-y-0 left-[22%] right-0 flex items-center justify-center">
                    <div className={cn(
                      "text-base font-bold tracking-wide drop-shadow-md select-none opacity-90 transition-colors duration-300",
                      resolvedAppearance === 'light' ? "text-zinc-900" : "text-white"
                    )}>
                      Codex
                    </div>
                  </div>

                  {/* Preview Change Summary */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute z-20 right-[36%] bottom-[34%] left-[28%] flex h-[24%] flex-col overflow-hidden border transition-all duration-300",
                      selected.changeSummary.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                    )}
                    style={{
                      background: `color-mix(in oklab, ${previewChangeSummaryColor} ${Math.round(selected.changeSummary.opacity * 100)}%, transparent)`,
                      borderColor: `color-mix(in oklab, ${resolvedAppearance === 'light' ? '#94a3b8' : '#64748b'} ${Math.round(selected.changeSummary.borderOpacity * 100)}%, transparent)`,
                      borderRadius: `${selected.changeSummary.radius}px`,
                      backdropFilter: `blur(${selected.changeSummary.blur}px) saturate(1.04)`,
                      boxShadow: previewChangeSummaryShadow,
                    }}
                  >
                    <div className="flex h-1/2 items-center justify-between border-b border-white/10 px-2">
                      <div className="flex items-center gap-1.5">
                        <i className="h-2 w-2 rounded-sm bg-emerald-500/80" />
                        <span className={cn(
                          "h-1 w-10 rounded-full",
                          resolvedAppearance === 'light' ? "bg-zinc-700/65" : "bg-zinc-300/65"
                        )} />
                      </div>
                      <span className={cn(
                        "h-1 w-5 rounded-full",
                        resolvedAppearance === 'light' ? "bg-zinc-500/55" : "bg-zinc-400/55"
                      )} />
                    </div>
                    <div className="flex flex-1 items-center justify-between px-2">
                      <span className={cn(
                        "h-1 w-[58%] rounded-full",
                        resolvedAppearance === 'light' ? "bg-zinc-600/50" : "bg-zinc-400/50"
                      )} />
                      <i className="h-1 w-3 rounded-full bg-emerald-500/70" />
                    </div>
                  </div>

                  {/* Preview Environment Panel */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute z-20 top-[8%] right-[5%] flex h-[45%] w-[28%] flex-col gap-2 border p-2 transition-all duration-300",
                      selected.environment.visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
                    )}
                    style={{
                      background: `color-mix(in oklab, ${previewEnvironmentColor} ${Math.round(selected.environment.opacity * 100)}%, transparent)`,
                      borderColor: `color-mix(in oklab, ${resolvedAppearance === 'light' ? '#94a3b8' : '#64748b'} ${Math.round(selected.environment.borderOpacity * 100)}%, transparent)`,
                      borderRadius: `${selected.environment.radius}px`,
                      backdropFilter: `blur(${selected.environment.blur}px) saturate(1.06)`,
                      boxShadow: previewEnvironmentShadow,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "h-1 w-[46%] rounded-full",
                        resolvedAppearance === 'light' ? "bg-zinc-600/60" : "bg-white/60"
                      )} />
                      <b className={cn(
                        "h-2 w-2 rounded-full",
                        resolvedAppearance === 'light' ? "bg-zinc-500/70" : "bg-zinc-400/70"
                      )} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded bg-emerald-500/80" />
                      <span className={cn(
                        "h-1 w-[55%] rounded-full",
                        resolvedAppearance === 'light' ? "bg-zinc-700/65" : "bg-zinc-300/65"
                      )} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <i className={cn(
                        "h-2 w-2 rounded-full border",
                        resolvedAppearance === 'light' ? "border-zinc-500" : "border-zinc-400"
                      )} />
                      <span className={cn(
                        "h-1 w-[68%] rounded-full",
                        resolvedAppearance === 'light' ? "bg-zinc-700/55" : "bg-zinc-300/55"
                      )} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <i className={cn(
                        "h-2 w-2 rounded-full border",
                        resolvedAppearance === 'light' ? "border-zinc-500" : "border-zinc-400"
                      )} />
                      <span className={cn(
                        "h-1 w-[48%] rounded-full",
                        resolvedAppearance === 'light' ? "bg-zinc-700/55" : "bg-zinc-300/55"
                      )} />
                    </div>
                  </div>

                  {/* Preview Footer Backdrop */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute right-[8%] bottom-0 left-[8%] h-[30%] transition-opacity duration-300"
                    style={{
                      opacity: selected.composer.showFooterBackdrop ? 1 : 0,
                      background: resolvedAppearance === 'light'
                        ? 'linear-gradient(to top, rgba(248, 250, 252, 0.96), rgba(248, 250, 252, 0.78) 55%, transparent)'
                        : 'linear-gradient(to top, rgba(9, 9, 11, 0.96), rgba(9, 9, 11, 0.78) 55%, transparent)',
                    }}
                  />

                  {/* Preview Composer */}
                  <div
                    className={cn(
                      "absolute z-10 right-[11%] bottom-[10%] left-[11%] flex h-[18%] items-center justify-between px-3 border rounded-md transition-all duration-300",
                      resolvedAppearance === 'light' ? "text-zinc-900" : "text-white"
                    )}
                    style={{
                      background: `color-mix(in oklab, ${previewComposerColor} ${Math.round(selected.composer.opacity * 100)}%, transparent)`,
                      borderColor: `color-mix(in oklab, ${resolvedAppearance === 'light' ? '#94a3b8' : '#64748b'} ${Math.round(selected.composer.borderOpacity * 100)}%, transparent)`,
                      backdropFilter: `blur(${selected.composer.blur}px) saturate(1.06)`,
                      boxShadow: previewComposerShadow,
                    }}
                  >
                    <span className={cn("w-[42%] h-1 rounded-full", resolvedAppearance === 'light' ? "bg-zinc-400" : "bg-zinc-600")} />
                    <b className="w-2 h-2 rounded-full" style={{ backgroundColor: selected?.accent }} />
                  </div>
                </div>

                {/* Theme Title Header */}
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                  <div>
                    <h2 className="text-base font-bold text-zinc-50">{selected.name}</h2>
                    <p className="text-[10px] text-zinc-400 font-mono mt-1 select-all">{selected.id}</p>
                  </div>
                  {!selected.builtIn && (
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      title="删除主题"
                      onClick={() => void run('delete', () => invoke('delete_theme', { themeId: selected.id }), '主题已删除')}
                      className="cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>

                {/* Appearance Settings */}
                <div className="flex flex-col gap-2.5 pb-4 border-b border-zinc-800">
                  <label className="flex gap-2 items-center text-xs font-bold text-zinc-400 tracking-wide uppercase">
                    <Settings2 size={13} className="text-zinc-500" />
                    <span>外观</span>
                  </label>
                  {/* Segmented control */}
                  <div className="flex rounded-lg bg-zinc-950 p-1 gap-1 w-full">
                    {(['auto', 'light', 'dark'] as const).map((value) => (
                      <button
                        key={value}
                        className={cn(
                          "flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
                          selected.appearance === value
                            ? "bg-zinc-800 text-zinc-50 shadow-sm"
                            : "text-zinc-400 hover:text-zinc-100"
                        )}
                        onClick={() => void updateSelected({ appearance: value })}
                      >
                        {value === 'auto' ? '跟随系统' : value === 'light' ? '浅色' : '深色'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select dropdown fields */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-zinc-800">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-zinc-400 tracking-wide uppercase">
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
                    <label className="text-xs font-bold text-zinc-400 tracking-wide uppercase">
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

                {/* Sliders */}
                <div className="flex flex-col gap-3 pb-4 border-b border-zinc-800">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-400 tracking-wide uppercase">
                      水平焦点
                    </label>
                    <output className="text-xs font-mono text-zinc-500" style={{ fontWeight: 600 }}>
                      {Math.round(selected.art.focusX * 100)}%
                    </output>
                  </div>
                  <Slider
                    value={[selected.art.focusX]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={(val) => {
                      const valArray = Array.isArray(val) ? val : [val];
                      void updateSelected({ art: { ...selected.art, focusX: valArray[0] } });
                    }}
                    className="w-full cursor-pointer py-2"
                  />
                </div>

                {/* Composer Settings */}
                <div className="flex flex-col gap-4 pb-5 border-b border-zinc-800">
                  <label className="flex gap-2 items-center text-xs font-bold text-zinc-400 tracking-wide uppercase">
                    <PanelBottom size={13} className="text-zinc-500" />
                    <span>输入框</span>
                  </label>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-zinc-300">背景</span>
                    <div className="flex min-w-0 items-center gap-2">
                      <label
                        className="relative h-7 w-7 flex-none overflow-hidden rounded-md border border-zinc-700 ring-1 ring-black/20 cursor-pointer"
                        title="选择输入框背景色"
                      >
                        <span className="absolute inset-0" style={{ backgroundColor: previewComposerColor }} />
                        <input
                          type="color"
                          aria-label="输入框背景色"
                          className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                          value={previewComposerColor}
                          onChange={(event) => void updateSelected({
                            composer: { ...selected.composer, background: event.target.value },
                          })}
                        />
                      </label>
                      <code className="w-[74px] truncate text-right text-[10px] font-semibold text-zinc-500">
                        {selected.composer.background === 'auto'
                          ? '跟随主题'
                          : selected.composer.background.toUpperCase()}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="恢复自动背景"
                        aria-label="恢复自动背景"
                        disabled={selected.composer.background === 'auto'}
                        onClick={() => void updateSelected({
                          composer: { ...selected.composer, background: 'auto' },
                        })}
                        className="text-zinc-500 hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
                      >
                        <RotateCcw size={12} />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-300">不透明度</label>
                      <output className="text-[10px] font-mono font-semibold text-zinc-500">
                        {Math.round(selected.composer.opacity * 100)}%
                      </output>
                    </div>
                    <Slider
                      value={[selected.composer.opacity]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={(value) => void updateSelected({
                        composer: { ...selected.composer, opacity: sliderValue(value) },
                      })}
                      className="w-full cursor-pointer py-1"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-300">背景模糊</label>
                      <output className="text-[10px] font-mono font-semibold text-zinc-500">
                        {selected.composer.blur}px
                      </output>
                    </div>
                    <Slider
                      value={[selected.composer.blur]}
                      min={0}
                      max={32}
                      step={1}
                      onValueChange={(value) => void updateSelected({
                        composer: { ...selected.composer, blur: sliderValue(value) },
                      })}
                      className="w-full cursor-pointer py-1"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-300">边框强度</label>
                      <output className="text-[10px] font-mono font-semibold text-zinc-500">
                        {Math.round(selected.composer.borderOpacity * 100)}%
                      </output>
                    </div>
                    <Slider
                      value={[selected.composer.borderOpacity]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={(value) => void updateSelected({
                        composer: { ...selected.composer, borderOpacity: sliderValue(value) },
                      })}
                      className="w-full cursor-pointer py-1"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-zinc-300">阴影</label>
                    <div className="flex w-full gap-1 rounded-lg bg-zinc-950 p-1">
                      {(['none', 'soft', 'strong'] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={cn(
                            "flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                            selected.composer.shadow === value
                              ? "bg-zinc-800 text-zinc-50 shadow-sm"
                              : "text-zinc-500 hover:text-zinc-200"
                          )}
                          onClick={() => void updateSelected({
                            composer: { ...selected.composer, shadow: value },
                          })}
                        >
                          {value === 'none' ? '关闭' : value === 'soft' ? '柔和' : '强调'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-xs font-semibold text-zinc-300">底部遮罩</span>
                      <small className="text-[10px] font-medium text-zinc-500">
                        {selected.composer.showFooterBackdrop ? '显示' : '隐藏'}
                      </small>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={selected.composer.showFooterBackdrop}
                      aria-label="显示底部遮罩"
                      title={selected.composer.showFooterBackdrop ? '隐藏底部遮罩' : '显示底部遮罩'}
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
                </div>

                {/* Environment Panel Settings */}
                <div className="flex flex-col gap-4 pb-5 border-b border-zinc-800">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex gap-2 items-center text-xs font-bold text-zinc-400 tracking-wide uppercase">
                      <PanelRight size={13} className="text-zinc-500" />
                      <span>环境面板</span>
                    </label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={selected.environment.visible}
                      aria-label="显示环境面板"
                      title={selected.environment.visible ? '隐藏环境面板' : '显示环境面板'}
                      onClick={() => void updateSelected({
                        environment: {
                          ...selected.environment,
                          visible: !selected.environment.visible,
                        },
                      })}
                      className={cn(
                        "relative h-5 w-9 flex-none rounded-full border transition-colors cursor-pointer",
                        selected.environment.visible
                          ? "border-emerald-400/40 bg-emerald-500"
                          : "border-zinc-700 bg-zinc-800"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                        selected.environment.visible ? "translate-x-4" : "translate-x-0"
                      )} />
                    </button>
                  </div>

                  {selected.environment.visible && (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-zinc-300">背景</span>
                        <div className="flex min-w-0 items-center gap-2">
                          <label
                            className="relative h-7 w-7 flex-none overflow-hidden rounded-md border border-zinc-700 ring-1 ring-black/20 cursor-pointer"
                            title="选择环境面板背景色"
                          >
                            <span className="absolute inset-0" style={{ backgroundColor: previewEnvironmentColor }} />
                            <input
                              type="color"
                              aria-label="环境面板背景色"
                              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                              value={previewEnvironmentColor}
                              onChange={(event) => void updateSelected({
                                environment: { ...selected.environment, background: event.target.value },
                              })}
                            />
                          </label>
                          <code className="w-[74px] truncate text-right text-[10px] font-semibold text-zinc-500">
                            {selected.environment.background === 'auto'
                              ? '跟随主题'
                              : selected.environment.background.toUpperCase()}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="恢复自动背景"
                            aria-label="恢复环境面板自动背景"
                            disabled={selected.environment.background === 'auto'}
                            onClick={() => void updateSelected({
                              environment: { ...selected.environment, background: 'auto' },
                            })}
                            className="text-zinc-500 hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
                          >
                            <RotateCcw size={12} />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-300">不透明度</label>
                          <output className="text-[10px] font-mono font-semibold text-zinc-500">
                            {Math.round(selected.environment.opacity * 100)}%
                          </output>
                        </div>
                        <Slider
                          value={[selected.environment.opacity]}
                          min={0}
                          max={1}
                          step={0.01}
                          onValueChange={(value) => void updateSelected({
                            environment: { ...selected.environment, opacity: sliderValue(value) },
                          })}
                          className="w-full cursor-pointer py-1"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-300">背景模糊</label>
                          <output className="text-[10px] font-mono font-semibold text-zinc-500">
                            {selected.environment.blur}px
                          </output>
                        </div>
                        <Slider
                          value={[selected.environment.blur]}
                          min={0}
                          max={32}
                          step={1}
                          onValueChange={(value) => void updateSelected({
                            environment: { ...selected.environment, blur: sliderValue(value) },
                          })}
                          className="w-full cursor-pointer py-1"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-300">边框强度</label>
                          <output className="text-[10px] font-mono font-semibold text-zinc-500">
                            {Math.round(selected.environment.borderOpacity * 100)}%
                          </output>
                        </div>
                        <Slider
                          value={[selected.environment.borderOpacity]}
                          min={0}
                          max={1}
                          step={0.01}
                          onValueChange={(value) => void updateSelected({
                            environment: { ...selected.environment, borderOpacity: sliderValue(value) },
                          })}
                          className="w-full cursor-pointer py-1"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-300">圆角</label>
                          <output className="text-[10px] font-mono font-semibold text-zinc-500">
                            {selected.environment.radius}px
                          </output>
                        </div>
                        <Slider
                          value={[selected.environment.radius]}
                          min={8}
                          max={32}
                          step={1}
                          onValueChange={(value) => void updateSelected({
                            environment: { ...selected.environment, radius: sliderValue(value) },
                          })}
                          className="w-full cursor-pointer py-1"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-zinc-300">阴影</label>
                        <div className="flex w-full gap-1 rounded-lg bg-zinc-950 p-1">
                          {(['none', 'soft', 'strong'] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={cn(
                                "flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                                selected.environment.shadow === value
                                  ? "bg-zinc-800 text-zinc-50 shadow-sm"
                                  : "text-zinc-500 hover:text-zinc-200"
                              )}
                              onClick={() => void updateSelected({
                                environment: { ...selected.environment, shadow: value },
                              })}
                            >
                              {value === 'none' ? '关闭' : value === 'soft' ? '柔和' : '强调'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Change Summary Settings */}
                <div className="flex flex-col gap-4 pb-5 border-b border-zinc-800">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex gap-2 items-center text-xs font-bold text-zinc-400 tracking-wide uppercase">
                      <Files size={13} className="text-zinc-500" />
                      <span>变更摘要</span>
                    </label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={selected.changeSummary.visible}
                      aria-label="显示变更摘要"
                      title={selected.changeSummary.visible ? '隐藏变更摘要' : '显示变更摘要'}
                      onClick={() => void updateSelected({
                        changeSummary: {
                          ...selected.changeSummary,
                          visible: !selected.changeSummary.visible,
                        },
                      })}
                      className={cn(
                        "relative h-5 w-9 flex-none rounded-full border transition-colors cursor-pointer",
                        selected.changeSummary.visible
                          ? "border-emerald-400/40 bg-emerald-500"
                          : "border-zinc-700 bg-zinc-800"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                        selected.changeSummary.visible ? "translate-x-4" : "translate-x-0"
                      )} />
                    </button>
                  </div>

                  {selected.changeSummary.visible && (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-zinc-300">背景</span>
                        <div className="flex min-w-0 items-center gap-2">
                          <label
                            className="relative h-7 w-7 flex-none overflow-hidden rounded-md border border-zinc-700 ring-1 ring-black/20 cursor-pointer"
                            title="选择变更摘要背景色"
                          >
                            <span className="absolute inset-0" style={{ backgroundColor: previewChangeSummaryColor }} />
                            <input
                              type="color"
                              aria-label="变更摘要背景色"
                              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                              value={previewChangeSummaryColor}
                              onChange={(event) => void updateSelected({
                                changeSummary: { ...selected.changeSummary, background: event.target.value },
                              })}
                            />
                          </label>
                          <code className="w-[74px] truncate text-right text-[10px] font-semibold text-zinc-500">
                            {selected.changeSummary.background === 'auto'
                              ? '跟随主题'
                              : selected.changeSummary.background.toUpperCase()}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="恢复自动背景"
                            aria-label="恢复变更摘要自动背景"
                            disabled={selected.changeSummary.background === 'auto'}
                            onClick={() => void updateSelected({
                              changeSummary: { ...selected.changeSummary, background: 'auto' },
                            })}
                            className="text-zinc-500 hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
                          >
                            <RotateCcw size={12} />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-300">不透明度</label>
                          <output className="text-[10px] font-mono font-semibold text-zinc-500">
                            {Math.round(selected.changeSummary.opacity * 100)}%
                          </output>
                        </div>
                        <Slider
                          value={[selected.changeSummary.opacity]}
                          min={0}
                          max={1}
                          step={0.01}
                          onValueChange={(value) => void updateSelected({
                            changeSummary: { ...selected.changeSummary, opacity: sliderValue(value) },
                          })}
                          className="w-full cursor-pointer py-1"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-300">背景模糊</label>
                          <output className="text-[10px] font-mono font-semibold text-zinc-500">
                            {selected.changeSummary.blur}px
                          </output>
                        </div>
                        <Slider
                          value={[selected.changeSummary.blur]}
                          min={0}
                          max={32}
                          step={1}
                          onValueChange={(value) => void updateSelected({
                            changeSummary: { ...selected.changeSummary, blur: sliderValue(value) },
                          })}
                          className="w-full cursor-pointer py-1"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-300">边框强度</label>
                          <output className="text-[10px] font-mono font-semibold text-zinc-500">
                            {Math.round(selected.changeSummary.borderOpacity * 100)}%
                          </output>
                        </div>
                        <Slider
                          value={[selected.changeSummary.borderOpacity]}
                          min={0}
                          max={1}
                          step={0.01}
                          onValueChange={(value) => void updateSelected({
                            changeSummary: { ...selected.changeSummary, borderOpacity: sliderValue(value) },
                          })}
                          className="w-full cursor-pointer py-1"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-300">圆角</label>
                          <output className="text-[10px] font-mono font-semibold text-zinc-500">
                            {selected.changeSummary.radius}px
                          </output>
                        </div>
                        <Slider
                          value={[selected.changeSummary.radius]}
                          min={8}
                          max={32}
                          step={1}
                          onValueChange={(value) => void updateSelected({
                            changeSummary: { ...selected.changeSummary, radius: sliderValue(value) },
                          })}
                          className="w-full cursor-pointer py-1"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-zinc-300">阴影</label>
                        <div className="flex w-full gap-1 rounded-lg bg-zinc-950 p-1">
                          {(['none', 'soft', 'strong'] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={cn(
                                "flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                                selected.changeSummary.shadow === value
                                  ? "bg-zinc-800 text-zinc-50 shadow-sm"
                                  : "text-zinc-500 hover:text-zinc-200"
                              )}
                              onClick={() => void updateSelected({
                                changeSummary: { ...selected.changeSummary, shadow: value },
                              })}
                            >
                              {value === 'none' ? '关闭' : value === 'soft' ? '柔和' : '强调'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Advanced UI Settings */}
                <div className="flex flex-col gap-2 pb-5 border-b border-zinc-800">
                  <label className="mb-1 flex items-center gap-2 text-xs font-bold text-zinc-400 tracking-wide uppercase">
                    <SlidersHorizontal size={13} className="text-zinc-500" />
                    <span>界面元素</span>
                  </label>

                  <ConfigSection title="左侧边栏">
                    <SurfaceStyleEditor
                      value={selected.ui.sidebar}
                      autoColor={resolvedAppearance === 'light' ? '#f1f5f9' : '#0e121c'}
                      onChange={(value) => void updateUi('sidebar', value)}
                    />
                  </ConfigSection>

                  <ConfigSection title="顶部标题栏">
                    <SurfaceStyleEditor
                      value={selected.ui.header}
                      autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#121620'}
                      onChange={(value) => void updateUi('header', value)}
                    />
                  </ConfigSection>

                  <ConfigSection title="用户消息气泡">
                    <SurfaceStyleEditor
                      value={selected.ui.userBubble}
                      autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                      onChange={(value) => void updateUi('userBubble', value)}
                    />
                  </ConfigSection>

                  <ConfigSection title="代码块">
                    <SurfaceStyleEditor
                      value={selected.ui.codeBlock}
                      autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                      onChange={(value) => void updateUi('codeBlock', value)}
                    />
                  </ConfigSection>

                  <ConfigSection title="工具活动卡片">
                    <SurfaceStyleEditor
                      value={selected.ui.activityCard}
                      autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                      onChange={(value) => void updateUi('activityCard', value)}
                    />
                  </ConfigSection>

                  <ConfigSection title="任务列表行">
                    <RowStyleEditor
                      value={selected.ui.threadRows}
                      autoColor={selected.accent}
                      onChange={(value) => void updateUi('threadRows', value)}
                    />
                  </ConfigSection>

                  <ConfigSection title="环境面板项目">
                    <RowStyleEditor
                      value={selected.ui.summaryRows}
                      autoColor={selected.accent}
                      onChange={(value) => void updateUi('summaryRows', value)}
                    />
                  </ConfigSection>

                  <ConfigSection title="导航轨与滚动条">
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
                        output={`${Math.round(selected.ui.navigationRailOpacity * 100)}%`}
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
                          output={`${Math.round(selected.ui.scrollbar.opacity * 100)}%`}
                          onChange={(opacity) => void updateUi('scrollbar', { ...selected.ui.scrollbar, opacity })}
                        />
                        <SliderSetting
                          label="宽度"
                          value={selected.ui.scrollbar.width}
                          min={4}
                          max={16}
                          step={1}
                          output={`${selected.ui.scrollbar.width}px`}
                          onChange={(width) => void updateUi('scrollbar', { ...selected.ui.scrollbar, width })}
                        />
                        <SliderSetting
                          label="圆角"
                          value={selected.ui.scrollbar.radius}
                          min={0}
                          max={16}
                          step={1}
                          output={`${selected.ui.scrollbar.radius}px`}
                          onChange={(radius) => void updateUi('scrollbar', { ...selected.ui.scrollbar, radius })}
                        />
                      </>
                    )}
                  </ConfigSection>

                  <ConfigSection title="Diff 文件行">
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
                          label="背景强度"
                          value={selected.ui.diff.opacity}
                          min={0}
                          max={1}
                          step={0.01}
                          output={`${Math.round(selected.ui.diff.opacity * 100)}%`}
                          onChange={(opacity) => void updateUi('diff', { ...selected.ui.diff, opacity })}
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
                          output={`${selected.ui.diff.radius}px`}
                          onChange={(radius) => void updateUi('diff', { ...selected.ui.diff, radius })}
                        />
                      </>
                    )}
                  </ConfigSection>

                  <ConfigSection title="正文布局">
                    <SliderSetting
                      label="内容宽度"
                      value={selected.ui.content.maxWidth}
                      min={560}
                      max={1200}
                      step={8}
                      output={`${selected.ui.content.maxWidth}px`}
                      onChange={(maxWidth) => void updateUi('content', { ...selected.ui.content, maxWidth })}
                    />
                    <SliderSetting
                      label="字体缩放"
                      value={selected.ui.content.fontScale}
                      min={0.8}
                      max={1.3}
                      step={0.01}
                      output={`${Math.round(selected.ui.content.fontScale * 100)}%`}
                      onChange={(fontScale) => void updateUi('content', { ...selected.ui.content, fontScale })}
                    />
                    <SliderSetting
                      label="消息间距"
                      value={selected.ui.content.messageGap}
                      min={4}
                      max={32}
                      step={1}
                      output={`${selected.ui.content.messageGap}px`}
                      onChange={(messageGap) => void updateUi('content', { ...selected.ui.content, messageGap })}
                    />
                  </ConfigSection>

                  <ConfigSection title="富文本内容">
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
                      output={`${Math.round(selected.ui.richText.inlineCodeOpacity * 100)}%`}
                      onChange={(inlineCodeOpacity) => void updateUi('richText', { ...selected.ui.richText, inlineCodeOpacity })}
                    />
                    <SliderSetting
                      label="行内代码圆角"
                      value={selected.ui.richText.inlineCodeRadius}
                      min={0}
                      max={24}
                      step={1}
                      output={`${selected.ui.richText.inlineCodeRadius}px`}
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
                      output={`${Math.round(selected.ui.richText.quoteOpacity * 100)}%`}
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
                      output={`${Math.round(selected.ui.richText.tableOpacity * 100)}%`}
                      onChange={(tableOpacity) => void updateUi('richText', { ...selected.ui.richText, tableOpacity })}
                    />
                    <SliderSetting
                      label="表格圆角"
                      value={selected.ui.richText.tableRadius}
                      min={0}
                      max={24}
                      step={1}
                      output={`${selected.ui.richText.tableRadius}px`}
                      onChange={(tableRadius) => void updateUi('richText', { ...selected.ui.richText, tableRadius })}
                    />
                    <SliderSetting
                      label="图片圆角"
                      value={selected.ui.richText.imageRadius}
                      min={0}
                      max={32}
                      step={1}
                      output={`${selected.ui.richText.imageRadius}px`}
                      onChange={(imageRadius) => void updateUi('richText', { ...selected.ui.richText, imageRadius })}
                    />
                  </ConfigSection>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-center text-zinc-500">
                <Library size={32} strokeWidth={1.5} className="text-zinc-700" />
                <span className="text-xs font-semibold">主题库为空</span>
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
      </main>

      {/* Sonner Toaster component */}
      <Toaster position="bottom-right" />

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
