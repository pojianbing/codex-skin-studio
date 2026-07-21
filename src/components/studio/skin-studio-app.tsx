import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import {
  Download, ImagePlus, Library, LoaderCircle, Pause, Play,
  RotateCcw, ShieldCheck, Trash2, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { AppUpdater } from '@/components/app-updater'
import { AppearanceToggle } from '@/components/appearance-toggle'
import { ThemeStore } from '@/components/theme-store'
import { ThemeDnaEasterEgg } from '@/components/theme-dna-easter-egg'
import { ThemeInspector } from '@/components/studio/theme-inspector'
import { ThemeLibraryPanel } from '@/components/studio/theme-library-panel'
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
import {
  type ApplyPlan,
  type Dashboard,
  type ThemeFilter,
  type ThemeRecord,
  type ThemeUpdate,
  type UiConfig,
  fallbackDashboard,
  mergeThemeUpdate,
  themeBundleFilename,
} from '@/lib/theme-types'

export function SkinStudioApp() {
  const [activeView, setActiveView] = useState<'library' | 'store'>('library')
  const [dashboard, setDashboard] = useState<Dashboard>(fallbackDashboard)
  const [selectedId, setSelectedId] = useState<string>()
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>('all')
  const [working, setWorking] = useState<string>()
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [restoreBuiltinTarget, setRestoreBuiltinTarget] = useState<ThemeRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ThemeRecord | null>(null)
  const [elementTab, setElementTab] = useState<ElementTab>('shell')
  const [openConfigSections, setOpenConfigSections] = useState<Set<PreviewElementId>>(() => new Set())
  const [hoveredElement, setHoveredElement] = useState<PreviewElementId | null>(null)
  const [selectedElement, setSelectedElement] = useState<PreviewElementId | null>(null)
  const [pendingScrollElement, setPendingScrollElement] = useState<PreviewElementId | null>(null)
  const [isThemeDnaOpen, setIsThemeDnaOpen] = useState(false)
  const configSectionRefs = useRef(new Map<PreviewElementId, HTMLDetailsElement>())
  const brandClickRef = useRef({ count: 0, startedAt: 0 })
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

  const handleBrandMarkClick = () => {
    if (!selected) return

    const now = Date.now()
    const clicks = brandClickRef.current
    if (now - clicks.startedAt > 3000) {
      clicks.count = 0
      clicks.startedAt = now
    }
    if (clicks.count === 0) clicks.startedAt = now

    clicks.count += 1
    if (clicks.count === 7) {
      clicks.count = 0
      clicks.startedAt = 0
      setIsThemeDnaOpen(true)
    }
  }

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

  const exportTheme = async (themeToExport?: ThemeRecord) => {
    const target = themeToExport ?? selected
    if (!target) return
    const selectedPath = await save({
      title: `导出主题包 - ${target.name}`,
      defaultPath: themeBundleFilename(target),
      filters: [{ name: 'Codex Skin Studio 主题包', extensions: ['codex-theme'] }],
    })
    if (!selectedPath) return
    const path = selectedPath.toLowerCase().endsWith('.codex-theme')
      ? selectedPath
      : `${selectedPath}.codex-theme`
    await run(
      'export',
      () => invoke('export_theme', { themeId: target.id, path }),
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

  const updateSelected = async (patch: ThemeUpdate) => {
    if (!selected) return
    const next = mergeThemeUpdate(selected, patch)
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
    <div className="skin-studio flex w-full h-full min-h-0 overflow-hidden bg-transparent text-foreground font-sans selection:bg-primary/20">
      {/* Sidebar */}
      <aside className="w-[218px] flex-none flex flex-col p-5 bg-zinc-900/35 backdrop-blur-xl text-zinc-200 border-r border-zinc-850/40">
        {/* Brand mark */}
        <button
          type="button"
          onClick={handleBrandMarkClick}
          aria-label="Skin Studio"
          className="group flex w-full items-center gap-3 border-b border-zinc-850/40 px-2 pb-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <img
            src="/app-icon.png"
            className="w-9 h-9 select-none object-contain transition-all duration-300 group-hover:scale-[1.04]"
            alt="Codex Skin Studio Logo"
          />
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm text-zinc-50">Skin Studio</span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mt-1">Codex themes</span>
          </div>
        </button>

        {/* Navigation list */}
        <nav className="flex-1 flex flex-col gap-1 pt-3" aria-label="主导航">
          <button
            type="button"
            aria-pressed={activeView === 'library'}
            onClick={() => setActiveView('library')}
            className={cn(
              'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50',
              activeView === 'library' 
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <Library size={16} />
            <span>主题库</span>
          </button>
          <button
            type="button"
            aria-pressed={activeView === 'store'}
            onClick={() => setActiveView('store')}
            className={cn(
              'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50',
              activeView === 'store' 
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <Download size={16} />
            <span>主题商店</span>
          </button>
        </nav>

        {/* Compact app information */}
        <div className="mt-auto pt-3 border-t border-zinc-850/40 flex items-center justify-between gap-2 px-1 text-[10px]">
          <span className="shrink-0 text-zinc-500">应用版本</span>
          <div className="flex items-center gap-1.5">
            <AppearanceToggle />
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
              size="sm"
              onClick={() => void importWallpaper()}
              disabled={Boolean(working)}
              className="border-zinc-800/60 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-50 hover:border-zinc-700/60 cursor-pointer transition-all duration-300 active:scale-95"
            >
              {working === 'import' ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <ImagePlus size={15} />
              )}
              导入背景
            </Button>
            <Button
              onClick={() => void importThemeBundle()}
              disabled={Boolean(working)}
              size="sm"
              className="bg-gradient-to-br from-zinc-50 to-zinc-200 text-zinc-950 hover:from-white hover:to-zinc-100 shadow-[0_2px_8px_rgba(255,255,255,0.03)] cursor-pointer transition-all duration-300 active:scale-95 font-semibold"
            >
              {working === 'import-theme' ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <Upload size={15} />
              )}
              导入主题包
            </Button>
          </div>
        </header>

        {/* Content grid */}
        <section className="grid min-h-0 flex-1 grid-cols-[minmax(360px,1.05fr)_minmax(320px,0.95fr)] overflow-hidden">
          <ThemeLibraryPanel
            filteredThemes={filteredThemes}
            selected={selected}
            themeFilter={themeFilter}
            working={working}
            onThemeFilterChange={setThemeFilter}
            onSelectTheme={setSelectedId}
            onImportWallpaper={importWallpaper}
            onExportTheme={exportTheme}
          />


          <ThemeInspector
            selected={selected}
            themeFilter={themeFilter}
            showPreview={showPreview}
            resolvedAppearance={resolvedAppearance}
            resolvedSafeArea={resolvedSafeArea}
            activeElement={activeElement}
            elementTab={elementTab}
            working={working}
            configSectionProps={configSectionProps}
            onTogglePreview={togglePreview}
            onSelectPreviewElement={selectPreviewElement}
            onSelectElementTab={selectElementTab}
            onConfigureDiff={() => {
              selectElementTab('styles')
              setSelectedElement('diff')
            }}
            onExportTheme={() => void exportTheme()}
            onRestoreBuiltinTheme={setRestoreBuiltinTarget}
            onDeleteTheme={setDeleteTarget}
            updateSelected={updateSelected}
            updateUi={updateUi}
          />
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

      <ThemeDnaEasterEgg
        open={isThemeDnaOpen}
        onOpenChange={setIsThemeDnaOpen}
        theme={selected}
      />

      {/* Sonner Toaster component */}
      <Toaster position="top-right" />

      {/* Confirm Restart Dialog */}
      <Dialog open={confirmRestart} onOpenChange={setConfirmRestart}>
        <DialogContent className="studio-dialog max-w-sm">
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
        <DialogContent className="studio-dialog max-w-sm">
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

      <Dialog open={restoreBuiltinTarget !== null} onOpenChange={(open) => { if (!open) setRestoreBuiltinTarget(null) }}>
        <DialogContent className="studio-dialog max-w-sm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-2">
              <RotateCcw size={20} />
            </div>
            <DialogTitle>恢复“{restoreBuiltinTarget?.name}”默认设置？</DialogTitle>
            <DialogDescription>
              将还原这个内置主题的全部设置和背景图片，当前调整将无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreBuiltinTarget(null)} className="cursor-pointer">
              取消
            </Button>
            <Button
              onClick={() => {
                const target = restoreBuiltinTarget
                setRestoreBuiltinTarget(null)
                if (target) void run('restore-builtin', () => invoke('restore_builtin_theme', { themeId: target.id }), '内置主题已恢复默认设置')
              }}
              className="cursor-pointer"
            >
              恢复默认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Restore Dialog */}
      <Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <DialogContent className="studio-dialog max-w-sm">
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
