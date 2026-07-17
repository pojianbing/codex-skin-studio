import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import {
  Check, CircleAlert, Download, ImagePlus, Library, LoaderCircle, MonitorCog,
  Pause, Play, RefreshCw, RotateCcw, Settings2, ShieldCheck, Trash2, X,
} from 'lucide-react'
import './App.css'

type EngineMode = 'official' | 'active' | 'paused' | 'error'
type ArtConfig = {
  focusX: number
  focusY: number
  safeArea: 'auto' | 'left' | 'right' | 'center' | 'none'
  taskMode: 'auto' | 'ambient' | 'banner' | 'off'
}
type ThemeRecord = {
  id: string
  name: string
  version: string
  appearance: 'auto' | 'light' | 'dark'
  accent: string
  art: ArtConfig
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
  themes: ThemeRecord[]
}
type Notice = { tone: 'success' | 'error' | 'info'; text: string }

const fallbackDashboard: Dashboard = {
  platform: 'desktop', codexFound: false, mode: 'official',
  message: '正在连接本地引擎', themes: [],
}

function App() {
  const [dashboard, setDashboard] = useState<Dashboard>(fallbackDashboard)
  const [selectedId, setSelectedId] = useState<string>()
  const [working, setWorking] = useState<string>()
  const [notice, setNotice] = useState<Notice>()
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)

  const selected = useMemo(
    () => dashboard.themes.find((theme) => theme.id === selectedId) ?? dashboard.themes[0],
    [dashboard.themes, selectedId],
  )

  const refresh = async () => {
    try {
      const next = await invoke<Dashboard>('get_dashboard')
      setDashboard(next)
      setSelectedId((current) => current ?? next.activeThemeId ?? next.themes[0]?.id)
    } catch (error) {
      setNotice({ tone: 'error', text: String(error) })
    }
  }

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(interval)
  }, [])

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setWorking(key)
    setNotice(undefined)
    try {
      await action()
      await refresh()
      setNotice({ tone: 'success', text: success })
    } catch (error) {
      setNotice({ tone: 'error', text: String(error) })
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

  const updateSelected = async (patch: Partial<Pick<ThemeRecord, 'appearance' | 'art'>>) => {
    if (!selected) return
    const next = { ...selected, ...patch, art: patch.art ?? selected.art }
    setDashboard((current) => ({
      ...current,
      themes: current.themes.map((theme) => (theme.id === next.id ? next : theme)),
    }))
    try {
      await invoke('update_theme', {
        themeId: next.id, appearance: next.appearance, art: next.art,
      })
      if (dashboard.activeThemeId === next.id) {
        await invoke('apply_theme', { themeId: next.id, restartExisting: false })
      }
    } catch (error) {
      setNotice({ tone: 'error', text: String(error) })
      await refresh()
    }
  }

  const modeLabel = dashboard.mode === 'active' ? '主题运行中'
    : dashboard.mode === 'paused' ? '主题已暂停'
      : dashboard.mode === 'error' ? '需要处理' : '官方主题'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark" aria-label="Codex Skin Studio">
          <span className="brand-glyph">CS</span>
          <span><b>Skin Studio</b><small>Codex themes</small></span>
        </div>
        <nav className="nav-list" aria-label="主导航">
          <button className="nav-item active"><Library size={18} />主题库</button>
          <button className="nav-item" disabled><Download size={18} />主题商店<span>稍后</span></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="runtime-block">
          <div className={`status-dot ${dashboard.mode}`} />
          <div><b>{modeLabel}</b><small>{dashboard.codexFound ? `Codex ${dashboard.codexVersion ?? ''}` : '未找到 Codex'}</small></div>
        </div>
        <div className="platform-line"><MonitorCog size={15} />{dashboard.platform}</div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><h1>主题库</h1><p>{dashboard.themes.length} 个本地主题</p></div>
          <div className="toolbar">
            <button className="icon-button" title="刷新" onClick={() => void refresh()} disabled={Boolean(working)}><RefreshCw size={18} /></button>
            <button className="primary-button" onClick={() => void importWallpaper()} disabled={Boolean(working)}>
              {working === 'import' ? <LoaderCircle className="spin" size={18} /> : <ImagePlus size={18} />}导入背景
            </button>
          </div>
        </header>

        <section className="content-grid">
          <div className="theme-browser">
            <div className="section-label"><span>已安装</span><span>选择主题</span></div>
            <div className="theme-grid">
              {dashboard.themes.map((theme) => (
                <button key={theme.id} className={`theme-card ${selected?.id === theme.id ? 'selected' : ''}`} onClick={() => setSelectedId(theme.id)}>
                  <span className="theme-thumb" style={{ backgroundImage: `url(${theme.previewDataUrl})` }}>
                    {selected?.id === theme.id && <i><Check size={15} /></i>}
                  </span>
                  <span className="theme-meta"><b>{theme.name}</b><small>{theme.builtIn ? '内置主题' : '本地主题'} · {theme.version}</small></span>
                </button>
              ))}
              <button className="add-card" onClick={() => void importWallpaper()}><ImagePlus size={22} /><span>导入背景</span></button>
            </div>
          </div>

          <aside className="inspector">
            {selected ? <>
              <div className={`live-preview safe-${selected.art.safeArea}`} style={{ backgroundImage: `url(${selected.previewDataUrl})` }}>
                <div className="preview-sidebar"><i /><i /><i /><i /></div>
                <div className="preview-main"><div className="preview-heading">Codex</div><div className="preview-composer"><span /><b /></div></div>
              </div>
              <div className="inspector-heading">
                <div><h2>{selected.name}</h2><p>{selected.id}</p></div>
                {!selected.builtIn && <button className="icon-button danger-quiet" title="删除主题" onClick={() => void run('delete', () => invoke('delete_theme', { themeId: selected.id }), '主题已删除')}><Trash2 size={17} /></button>}
              </div>
              <div className="control-group">
                <label><Settings2 size={15} />外观</label>
                <div className="segmented">
                  {(['auto', 'light', 'dark'] as const).map((value) => <button key={value} className={selected.appearance === value ? 'active' : ''} onClick={() => void updateSelected({ appearance: value })}>{value === 'auto' ? '跟随系统' : value === 'light' ? '浅色' : '深色'}</button>)}
                </div>
              </div>
              <div className="control-row">
                <label>内容安全区<select value={selected.art.safeArea} onChange={(event) => void updateSelected({ art: { ...selected.art, safeArea: event.target.value as ArtConfig['safeArea'] } })}>
                  <option value="auto">自动</option><option value="left">左侧</option><option value="right">右侧</option><option value="center">居中</option><option value="none">关闭</option>
                </select></label>
                <label>任务页背景<select value={selected.art.taskMode} onChange={(event) => void updateSelected({ art: { ...selected.art, taskMode: event.target.value as ArtConfig['taskMode'] } })}>
                  <option value="auto">自动</option><option value="ambient">氛围</option><option value="banner">横幅</option><option value="off">关闭</option>
                </select></label>
              </div>
              <div className="slider-row">
                <label><span>水平焦点</span><output>{Math.round(selected.art.focusX * 100)}%</output></label>
                <input type="range" min="0" max="1" step="0.01" value={selected.art.focusX} onChange={(event) => void updateSelected({ art: { ...selected.art, focusX: Number(event.target.value) } })} />
              </div>
            </> : <div className="empty-state"><Library size={28} /><span>主题库为空</span></div>}
          </aside>
        </section>

        <footer className="actionbar">
          <div className="action-status"><ShieldCheck size={18} /><span><b>{modeLabel}</b><small>{dashboard.message}</small></span></div>
          <div className="action-buttons">
            {dashboard.mode === 'active' && <button className="secondary-button" onClick={() => void run('pause', () => invoke('pause_skin'), '主题已暂停')} disabled={Boolean(working)}><Pause size={17} />暂停</button>}
            <button className="restore-button" onClick={() => setConfirmRestore(true)} disabled={Boolean(working) || dashboard.mode === 'official'}><RotateCcw size={17} />恢复官方主题</button>
            <button className="apply-button" onClick={() => setConfirmRestart(true)} disabled={!selected || Boolean(working)}>{working === 'apply' ? <LoaderCircle className="spin" size={18} /> : <Play size={18} />}应用主题</button>
          </div>
        </footer>
      </main>

      {notice && <div className={`toast ${notice.tone}`}>
        {notice.tone === 'success' ? <Check size={18} /> : notice.tone === 'error' ? <CircleAlert size={18} /> : <ShieldCheck size={18} />}
        <span>{notice.text}</span><button onClick={() => setNotice(undefined)}><X size={15} /></button>
      </div>}

      {confirmRestart && <div className="modal-backdrop" onMouseDown={() => setConfirmRestart(false)}><div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-icon"><Play size={20} /></div><h3>应用“{selected?.name}”</h3><p>Codex 需要使用本机调试端口启动。未发送的输入可能丢失。</p>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setConfirmRestart(false)}>取消</button><button className="apply-button" onClick={() => { setConfirmRestart(false); void applySelected(true) }}>重启并应用</button></div>
      </div></div>}

      {confirmRestore && <div className="modal-backdrop" onMouseDown={() => setConfirmRestore(false)}><div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-icon warning"><RotateCcw size={20} /></div><h3>恢复官方主题</h3><p>当前皮肤和调试会话将被移除，Codex 会以普通模式重新启动。</p>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setConfirmRestore(false)}>取消</button><button className="restore-confirm" onClick={() => { setConfirmRestore(false); void run('restore', () => invoke('restore_official', { restartCodex: true }), '已恢复官方主题') }}>恢复官方主题</button></div>
      </div></div>}
    </div>
  )
}

export default App
