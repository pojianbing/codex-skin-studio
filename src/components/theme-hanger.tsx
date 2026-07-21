import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  AppWindow, Check, Feather, Flame, GripVertical, Leaf, LoaderCircle,
  Moon, Mountain, Palette, RefreshCw, RotateCcw, Sparkles, Sprout,
  Trees, Zap
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window'

type ThemeRecord = {
  id: string
  name: string
  accent: string
  previewDataUrl: string
}

type Dashboard = {
  mode: 'active' | 'paused' | 'official' | 'error'
  activeThemeId?: string
  message: string
  themes: ThemeRecord[]
}

type ApplyPlan = { action: 'hotSwitch' | 'launch' | 'restart' }

const compactSize = new LogicalSize(44, 44)
const expandedSize = new LogicalSize(360, 580)
const hangerWindow = getCurrentWindow()

function getThemeMeta(theme: ThemeRecord) {
  const name = theme.name.toLowerCase()
  const id = theme.id.toLowerCase()

  if (name.includes('墨影') || name.includes('silhouette') || id.includes('ink')) {
    return {
      Icon: Feather,
      gradient: 'from-violet-600 via-indigo-600 to-purple-800',
      accentColor: '#8b5cf6',
      tag: '墨韵暗调',
    }
  }
  if (name.includes('星河') || name.includes('starlit') || id.includes('star')) {
    return {
      Icon: Moon,
      gradient: 'from-blue-600 via-indigo-600 to-cyan-500',
      accentColor: '#3b82f6',
      tag: '璀璨星空',
    }
  }
  if (name.includes('竹影') || name.includes('bamboo')) {
    return {
      Icon: Leaf,
      gradient: 'from-emerald-600 via-teal-600 to-cyan-700',
      accentColor: '#10b981',
      tag: '竹意清幽',
    }
  }
  if (name.includes('绿野') || name.includes('greenwood') || id.includes('forest')) {
    return {
      Icon: Sprout,
      gradient: 'from-emerald-500 via-green-600 to-lime-600',
      accentColor: '#22c55e',
      tag: '生机盎然',
    }
  }
  if (name.includes('翠谷') || name.includes('summit') || name.includes('mountain')) {
    return {
      Icon: Mountain,
      gradient: 'from-teal-600 via-emerald-700 to-green-800',
      accentColor: '#14b8a6',
      tag: '青翠峰峦',
    }
  }
  if (name.includes('琥珀') || name.includes('amber') || name.includes('dusk')) {
    return {
      Icon: Flame,
      gradient: 'from-amber-500 via-orange-600 to-rose-600',
      accentColor: '#f59e0b',
      tag: '暖阳落日',
    }
  }
  if (name.includes('赛博') || name.includes('cyber') || name.includes('neon')) {
    return {
      Icon: Zap,
      gradient: 'from-fuchsia-600 via-purple-600 to-cyan-500',
      accentColor: '#d946ef',
      tag: '赛博霓虹',
    }
  }
  if (name.includes('高山') || name.includes('alpine') || name.includes('lake')) {
    return {
      Icon: Trees,
      gradient: 'from-sky-500 via-blue-600 to-indigo-700',
      accentColor: '#0ea5e9',
      tag: '雪山清泉',
    }
  }

  const color = theme.accent || '#10b981'
  return {
    Icon: Sparkles,
    gradient: 'from-emerald-600 via-teal-600 to-cyan-600',
    accentColor: color,
    customStyle: {
      background: `linear-gradient(135deg, ${color}, #0f766e)`
    },
    tag: '主题精选',
  }
}

export function ThemeHanger() {
  const [dashboard, setDashboard] = useState<Dashboard>()
  const [expanded, setExpanded] = useState(false)
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [workingThemeId, setWorkingThemeId] = useState<string>()
  const [restartTheme, setRestartTheme] = useState<ThemeRecord>()
  const [error, setError] = useState<string>()
  const [previewThemeId, setPreviewThemeId] = useState<string>()
  const dragRef = useRef<{
    startScreenX: number
    startScreenY: number
    windowX: number
    windowY: number
    moved: boolean
  } | null>(null)
  const draggedRef = useRef(false)

  const activeTheme = dashboard?.themes.find((t) => t.id === dashboard.activeThemeId)
  const previewTheme = dashboard?.themes.find((theme) => theme.id === previewThemeId)
    ?? activeTheme
    ?? dashboard?.themes[0]
  const activeAccent = activeTheme?.accent || '#10b981'

  const refresh = useCallback(async () => {
    try {
      const next = await invoke<Dashboard>('get_dashboard')
      setDashboard(next)
      setError(undefined)
    } catch (reason) {
      setError(String(reason))
    }
  }, [])

  const resize = useCallback(async (nextExpanded: boolean) => {
    setExpanded(nextExpanded)
    setContextMenuOpen(false)
    if (!nextExpanded) setRestartTheme(undefined)
    try {
      await hangerWindow.setSize(nextExpanded ? expandedSize : compactSize)
    } catch (reason) {
      setError(String(reason))
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    const collapse = () => {
      if (dragRef.current) return
      if (expanded || contextMenuOpen) void resize(false)
    }
    window.addEventListener('blur', collapse)
    return () => window.removeEventListener('blur', collapse)
  }, [contextMenuOpen, expanded, resize])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    void listen('theme-hanger-reset', () => void resize(false)).then((cleanup) => {
      unlisten = cleanup
    })
    return () => unlisten?.()
  }, [resize])

  const showContextMenu = async () => {
    setExpanded(false)
    setContextMenuOpen(true)
    try {
      await hangerWindow.setSize(expandedSize)
    } catch (reason) {
      setError(String(reason))
    }
  }

  const handleDragPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    draggedRef.current = false
    dragRef.current = {
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      windowX: event.screenX - event.clientX,
      windowY: event.screenY - event.clientY,
      moved: false,
    }
  }

  const handleDragPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.screenX - drag.startScreenX
    const dy = event.screenY - drag.startScreenY
    if (!drag.moved && Math.hypot(dx, dy) < 5) return
    drag.moved = true
    void hangerWindow.setPosition(
      new LogicalPosition(drag.windowX + dx, drag.windowY + dy)
    )
  }

  const handleDragPointerUp = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* already released */ }
    draggedRef.current = drag?.moved ?? false
  }

  const handleCollapsedClick = () => {
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    void resize(true)
  }

  const completeApply = async (theme: ThemeRecord, restartExisting: boolean) => {
    setWorkingThemeId(theme.id)
    setError(undefined)
    try {
      await invoke('apply_theme', { themeId: theme.id, restartExisting })
      try {
        await invoke('activate_codex')
      } catch {
        // Applying the theme is still successful when Codex cannot be foregrounded.
      }
      await refresh()
      await resize(false)
    } catch (reason) {
      setError(String(reason))
    } finally {
      setWorkingThemeId(undefined)
    }
  }

  const requestApply = async (theme: ThemeRecord) => {
    if (workingThemeId || theme.id === dashboard?.activeThemeId) return
    setWorkingThemeId(theme.id)
    setError(undefined)
    try {
      const plan = await invoke<ApplyPlan>('get_apply_plan', { themeId: theme.id })
      if (plan.action === 'restart') {
        setRestartTheme(theme)
        return
      }
      await completeApply(theme, false)
    } catch (reason) {
      setError(String(reason))
    } finally {
      setWorkingThemeId((current) => (current === theme.id ? undefined : current))
    }
  }

  const openMainWindow = async () => {
    try {
      await invoke('open_main_window')
    } catch (reason) {
      setError(String(reason))
    }
  }

  // 收起态悬浮球
  if (!expanded && !contextMenuOpen) {
    return (
      <div
        className="theme-hanger flex cursor-grab items-center justify-center p-0.5 active:cursor-grabbing"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        onPointerCancel={handleDragPointerUp}
      >
        <button
          type="button"
          aria-label="展开主题挂件"
          title="右键打开菜单"
          onClick={handleCollapsedClick}
          onContextMenu={(event) => {
            event.preventDefault()
            void showContextMenu()
          }}
          className="group relative flex h-10 w-10 items-center justify-center bg-transparent transition-transform duration-300 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          {/* 应用图标 */}
          <img
            src="/app-icon.png"
            alt="Theme Hanger"
            draggable={false}
            className="pointer-events-none h-9 w-9 select-none object-contain transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
          />
        </button>
      </div>
    )
  }

  // 展开态面板
  return (
    <div className="theme-hanger flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.65)]">
      {/* 顶部 Header */}
      <header className="flex h-13 shrink-0 items-center border-b border-zinc-800/80 bg-zinc-900/50">
        <div
          aria-label="拖动主题挂件"
          title="按住拖拽窗口"
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          onPointerCancel={handleDragPointerUp}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2.5 px-3 active:cursor-grabbing self-stretch"
        >
          <GripVertical size={14} className="shrink-0 text-zinc-500" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-semibold text-zinc-100">
                {contextMenuOpen ? '快捷菜单' : '主题挂件'}
              </span>
              <span
                className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: activeAccent }}
              />
            </div>
            <p className="truncate text-[10px] text-zinc-400/90">
              {dashboard?.message ?? '正在读取主题库...'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 pr-3">
          <button
            type="button"
            aria-label="刷新主题列表"
            title="刷新主题"
            onClick={() => void refresh()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <RefreshCw size={14} />
          </button>

          <button
            type="button"
            aria-label="收起主题挂件"
            title="收起悬浮球"
            onClick={() => void resize(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <Palette size={14} />
          </button>
        </div>
      </header>

      {/* 主体区 */}
      {restartTheme ? (
        <section className="flex flex-1 flex-col items-center justify-center p-5 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <RotateCcw size={22} className="animate-spin-slow" />
          </div>
          <p className="text-sm font-bold text-zinc-100">需要重启 Codex</p>
          <p className="mt-1.5 text-xs leading-5 text-zinc-400">
            Codex 正在普通模式下运行。应用“<span className="font-medium text-zinc-200">{restartTheme.name}</span>”需重新启动软件。
          </p>

          <div className="mt-6 flex w-full gap-2.5">
            <button
              type="button"
              onClick={() => setRestartTheme(undefined)}
              className="h-8 flex-1 rounded-lg border border-zinc-700/80 bg-zinc-900/60 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void completeApply(restartTheme, true)}
              disabled={Boolean(workingThemeId)}
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-100 text-xs font-bold text-zinc-950 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition active:scale-95 cursor-pointer"
            >
              {workingThemeId ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              重启并切换
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/60 p-2.5">
            {previewTheme?.previewDataUrl ? (
              <div className="relative aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                <img
                  src={previewTheme.previewDataUrl}
                  alt={`${previewTheme.name} 主题预览`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-zinc-950/78 px-3 py-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-zinc-100">{previewTheme.name}</span>
                  {previewTheme.id === dashboard?.activeThemeId && (
                    <span className="shrink-0 text-[10px] font-medium text-emerald-300">当前主题</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-500">
                主题预览不可用
              </div>
            )}
          </section>

          <section className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {dashboard?.themes.map((theme) => {
            const active = theme.id === dashboard.activeThemeId
            const working = theme.id === workingThemeId
            const meta = getThemeMeta(theme)
            const ThemeIcon = meta.Icon
            const accent = theme.accent || meta.accentColor

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => void requestApply(theme)}
                onFocus={() => setPreviewThemeId(theme.id)}
                onPointerEnter={() => setPreviewThemeId(theme.id)}
                disabled={active || Boolean(workingThemeId)}
                className={`group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-zinc-400 ${
                  active
                    ? 'border-zinc-600 bg-gradient-to-r from-zinc-800/90 via-zinc-900/90 to-zinc-900/50 shadow-md'
                    : 'border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/80 hover:bg-zinc-800/60 hover:shadow-md active:scale-[0.99]'
                }`}
              >
                {/* 激活指示条 */}
                {active && (
                  <span
                    className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full shadow-[0_0_10px_rgba(16,185,129,0.8)]"
                    style={{ backgroundColor: accent }}
                  />
                )}

                {/* 主题 DNA 胶囊色块 (绚丽多姿) */}
                <div
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 shadow-md bg-gradient-to-br ${meta.gradient} transition-transform duration-200 group-hover:scale-105`}
                  style={meta.customStyle}
                >
                  <ThemeIcon size={14} className="text-white drop-shadow" />
                </div>

                {/* 主题名字与标签 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`truncate text-xs ${
                        active ? 'font-bold text-zinc-100' : 'font-medium text-zinc-200 group-hover:text-zinc-100'
                      }`}
                    >
                      {theme.name}
                    </p>
                  </div>
                  <p className="truncate text-[10px] text-zinc-400/80 mt-0.5">
                    {meta.tag}
                  </p>
                </div>

                {/* 状态标志 */}
                <div className="flex shrink-0 items-center justify-center">
                  {working ? (
                    <LoaderCircle size={15} className="animate-spin text-emerald-400" />
                  ) : active ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                      <Check size={12} strokeWidth={2.5} />
                    </div>
                  ) : (
                    <span className="rounded-md border border-zinc-700/80 bg-zinc-800/50 px-2 py-0.5 text-[10px] font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:border-zinc-600 hover:text-zinc-200">
                      切换
                    </span>
                  )}
                </div>
              </button>
            )
          })}

          {!dashboard?.themes.length && !error && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-zinc-500">
              <Palette size={26} strokeWidth={1.5} className="opacity-60" />
              <p className="text-xs">暂无可用主题</p>
            </div>
          )}

          {error && (
            <div className="m-2 rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-[11px] leading-4 text-rose-300">
              {error}
            </div>
          )}
          </section>

        </>
      )}

      <footer className="shrink-0 border-t border-zinc-800/80 bg-zinc-900/45 p-2.5">
        <button
          type="button"
          onClick={() => void openMainWindow()}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          <AppWindow size={15} />
          打开主界面
        </button>
      </footer>
    </div>
  )
}
