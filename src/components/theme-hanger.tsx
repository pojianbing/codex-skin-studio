import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { AppWindow, Check, GripVertical, LoaderCircle, Palette, RefreshCw, RotateCcw } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'

type ThemeRecord = {
  id: string
  name: string
  accent: string
}

type Dashboard = {
  mode: 'active' | 'paused' | 'official' | 'error'
  activeThemeId?: string
  message: string
  themes: ThemeRecord[]
}

type ApplyPlan = { action: 'hotSwitch' | 'launch' | 'restart' }

const compactSize = new LogicalSize(44, 44)
const expandedSize = new LogicalSize(312, 420)
const hangerWindow = getCurrentWindow()

export function ThemeHanger() {
  const [dashboard, setDashboard] = useState<Dashboard>()
  const [expanded, setExpanded] = useState(false)
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [workingThemeId, setWorkingThemeId] = useState<string>()
  const [restartTheme, setRestartTheme] = useState<ThemeRecord>()
  const [error, setError] = useState<string>()
  const dragOriginRef = useRef<{ x: number, y: number } | null>(null)
  const draggedRef = useRef(false)

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

  const startDragging = () => {
    void hangerWindow.startDragging().catch((reason) => setError(String(reason)))
  }

  const showContextMenu = async () => {
    setExpanded(false)
    setContextMenuOpen(true)
    try {
      await hangerWindow.setSize(expandedSize)
    } catch (reason) {
      setError(String(reason))
    }
  }

  const handleCollapsedPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOriginRef.current = { x: event.clientX, y: event.clientY }
    draggedRef.current = false
  }

  const handleCollapsedPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = dragOriginRef.current
    if (!origin) return
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 5) return
    dragOriginRef.current = null
    draggedRef.current = true
    startDragging()
  }

  const handleCollapsedPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    dragOriginRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
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
      setWorkingThemeId((current) => current === theme.id ? undefined : current)
    }
  }

  if (!expanded && !contextMenuOpen) {
    return (
      <div className="theme-hanger flex items-center justify-center">
        <button
          type="button"
          aria-label="展开或拖动主题挂件"
          title="单击展开，拖动移动，右键打开菜单"
          onClick={handleCollapsedClick}
          onContextMenu={(event) => { event.preventDefault(); void showContextMenu() }}
          onPointerDown={handleCollapsedPointerDown}
          onPointerMove={handleCollapsedPointerMove}
          onPointerUp={handleCollapsedPointerUp}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/95 shadow-[0_10px_28px_rgba(0,0,0,0.42)] transition hover:border-emerald-300/75 hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          <img src="/app-icon.png" alt="" className="h-7 w-7 select-none object-contain" />
        </button>
      </div>
    )
  }

  return (
    <div className="theme-hanger overflow-hidden rounded-lg border border-zinc-700/90 bg-zinc-950/98 shadow-[0_18px_45px_rgba(0,0,0,0.52)]">
      <header className="flex h-14 items-center gap-3 border-b border-zinc-800 px-3.5">
        <button
          type="button"
          aria-label="拖动主题挂件"
          title="拖动"
          onPointerDown={startDragging}
          className="flex h-7 w-5 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-emerald-300"
        >
          <GripVertical size={15} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-zinc-100">{contextMenuOpen ? '主题菜单' : '主题挂件'}</p>
          <p className="truncate text-[10px] text-zinc-500">{dashboard?.message ?? '正在读取主题库'}</p>
        </div>
        {contextMenuOpen && (
          <button
            type="button"
            aria-label="打开 Skin Studio"
            title="打开 Skin Studio"
            onClick={() => void invoke('open_main_window')}
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <AppWindow size={14} />
          </button>
        )}
        <button
          type="button"
          aria-label="刷新主题列表"
          title="刷新"
          onClick={() => void refresh()}
          className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-300"
        >
          <RefreshCw size={14} />
        </button>
        <button
          type="button"
          aria-label="收起主题挂件"
          title="收起"
          onClick={() => void resize(false)}
          className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          <Palette size={14} />
        </button>
      </header>

      {restartTheme ? (
        <section className="flex h-[364px] flex-col justify-center px-5 text-center">
          <RotateCcw size={26} className="mx-auto mb-3 text-amber-300" />
          <p className="text-sm font-semibold text-zinc-100">需要重启 Codex</p>
          <p className="mt-1.5 text-xs leading-5 text-zinc-400">
            Codex 正在普通模式运行。重启后将应用“{restartTheme.name}”。
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setRestartTheme(undefined)}
              className="h-9 flex-1 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-emerald-300"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void completeApply(restartTheme, true)}
              disabled={Boolean(workingThemeId)}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-zinc-100 text-xs font-semibold text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              {workingThemeId ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              重启并切换
            </button>
          </div>
        </section>
      ) : (
        <section className="h-[364px] overflow-y-auto p-2">
          {dashboard?.themes.map((theme) => {
            const active = theme.id === dashboard.activeThemeId
            const working = theme.id === workingThemeId
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => void requestApply(theme)}
                disabled={active || Boolean(workingThemeId)}
                className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-zinc-900 disabled:cursor-default disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-300"
              >
                <span className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-white/15" style={{ backgroundColor: theme.accent }} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">{theme.name}</span>
                {working ? (
                  <LoaderCircle size={15} className="shrink-0 animate-spin text-emerald-300" />
                ) : active ? (
                  <Check size={16} className="shrink-0 text-emerald-300" aria-label="当前主题" />
                ) : null}
              </button>
            )
          })}
          {!dashboard?.themes.length && !error && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500">
              <Palette size={24} strokeWidth={1.5} />
              <p className="text-xs">没有可用主题</p>
            </div>
          )}
          {error && <p className="m-2 rounded-md border border-rose-900/60 bg-rose-950/50 px-3 py-2 text-[11px] leading-4 text-rose-200">{error}</p>}
        </section>
      )}
    </div>
  )
}
