import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import {
  Check, Download, ImagePlus, Library, LoaderCircle, MonitorCog,
  Pause, Play, RefreshCw, RotateCcw, Settings2, ShieldCheck, Trash2,
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

const fallbackDashboard: Dashboard = {
  platform: 'desktop', codexFound: false, mode: 'official',
  message: '正在连接本地引擎', themes: [],
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
      toast.error(String(error))
      await refresh()
    }
  }

  const modeLabel = dashboard.mode === 'active' ? '主题运行中'
    : dashboard.mode === 'paused' ? '主题已暂停'
      : dashboard.mode === 'error' ? '需要处理' : '官方主题'

  return (
    <div className="flex w-full h-full min-h-0 overflow-hidden bg-[#f4f6f4] text-[#1c211d] font-sans selection:bg-primary/20">
      {/* Sidebar */}
      <aside className="w-[218px] flex-none flex flex-col p-5 bg-[#141815] text-[#e3e8e4] border-r border-[#262d28]">
        {/* Brand mark */}
        <div className="flex gap-3 align-middle items-center px-2 pb-6 border-b border-[#222a24] mb-4" aria-label="Codex Skin Studio">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#539775] text-[#141815] font-extrabold text-sm tracking-wider shadow-inner select-none">
            CS
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm text-[#f0f4f1]">Skin Studio</span>
            <span className="text-[10px] text-[#718276] uppercase tracking-wider font-semibold mt-1">Codex themes</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 flex flex-col gap-1" aria-label="主导航">
          <button className="flex items-center gap-3 w-full h-10 px-3 rounded-lg text-sm font-medium transition-all text-white bg-[#222a24] shadow-sm border border-[#2a352c] cursor-pointer">
            <Library size={16} />
            <span>主题库</span>
          </button>
          <button className="flex items-center gap-3 w-full h-10 px-3 rounded-lg text-sm font-medium transition-all text-[#6b7b70] bg-transparent cursor-not-allowed opacity-50" disabled>
            <Download size={16} />
            <span>主题商店</span>
            <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#1d231f] text-[#4d5a50]">稍后</span>
          </button>
        </nav>

        {/* Runtime info block */}
        <div className="mt-auto pt-4 border-t border-[#222a24]">
          <div className="flex gap-3 items-center p-3 rounded-lg bg-[#19201b] border border-[#222a24] mb-3">
            <span className={cn(
              "w-2 h-2 rounded-full ring-4 flex-none",
              dashboard.mode === 'active' ? "bg-emerald-400 ring-emerald-950/40"
                : dashboard.mode === 'paused' ? "bg-amber-400 ring-amber-950/40"
                  : dashboard.mode === 'error' ? "bg-rose-400 ring-rose-950/40"
                    : "bg-zinc-400 ring-zinc-950/40"
            )} />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[#f0f4f1] truncate">{modeLabel}</span>
              <span className="text-[10px] text-[#718276] truncate mt-0.5">
                {dashboard.codexFound ? `Codex ${dashboard.codexVersion ?? ''}` : '未找到 Codex'}
              </span>
            </div>
          </div>
          <div className="flex gap-2 items-center px-2 text-[10px] text-[#556359] font-medium tracking-wide uppercase">
            <MonitorCog size={13} className="text-[#3c473f]" />
            <span>{dashboard.platform}</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#f6f8f6]">
        {/* Topbar */}
        <header className="h-[68px] border-b border-[#e1e6e2] bg-white/80 backdrop-blur-md px-6 flex items-center justify-between flex-none">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#141815]">主题库</h1>
            <p className="text-xs text-[#5f6e62] mt-0.5">{dashboard.themes.length} 个本地主题</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="icon-sm"
              title="刷新"
              onClick={() => void refresh()}
              disabled={Boolean(working)}
              className="text-[#3c473f] hover:text-[#141815] bg-white cursor-pointer"
            >
              <RefreshCw size={15} />
            </Button>
            <Button
              onClick={() => void importWallpaper()}
              disabled={Boolean(working)}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer"
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
          <div className="overflow-y-auto p-6 border-r border-[#e1e6e2] bg-[#f8faf8]">
            <div className="flex justify-between items-center mb-4 text-xs font-semibold uppercase tracking-wider text-[#5f6e62]">
              <span>已安装</span>
              <span>选择主题</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {dashboard.themes.map((theme) => (
                <button
                  key={theme.id}
                  className={cn(
                    "flex flex-col overflow-hidden text-left border rounded-lg bg-white transition-all cursor-pointer group shadow-sm hover:shadow-md hover:-translate-y-0.5",
                    selected?.id === theme.id
                      ? "border-primary ring-1 ring-primary"
                      : "border-[#d8ded9] hover:border-[#b9c4bb]"
                  )}
                  onClick={() => setSelectedId(theme.id)}
                >
                  <span
                    className="relative block w-full aspect-video bg-[#d7ddd8] bg-center bg-cover"
                    style={{ backgroundImage: `url(${theme.previewDataUrl})` }}
                  >
                    {/* Shadow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                    {selected?.id === theme.id && (
                      <i className="absolute z-10 top-2.5 right-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-md">
                        <Check size={13} strokeWidth={3} />
                      </i>
                    )}
                  </span>
                  <span className="flex flex-col p-3.5">
                    <b className="text-sm font-semibold text-[#141815] truncate">{theme.name}</b>
                    <small className="text-[10px] text-[#6d7c71] mt-1.5 flex items-center gap-1.5">
                      <span>{theme.builtIn ? '内置主题' : '本地主题'}</span>
                      <span>·</span>
                      <span>{theme.version}</span>
                    </small>
                  </span>
                </button>
              ))}
              <button
                className="flex flex-col items-center justify-center min-h-[160px] gap-2.5 border border-dashed border-[#b9c4bb] rounded-lg bg-white/40 hover:bg-[#e4ece5]/50 hover:border-primary/60 transition-all cursor-pointer text-[#4e5c52] hover:text-primary"
                onClick={() => void importWallpaper()}
              >
                <ImagePlus size={20} />
                <span className="text-xs font-semibold">导入背景</span>
              </button>
            </div>
          </div>

          {/* Right panel: Inspector */}
          <aside className="overflow-y-auto p-6 bg-white flex flex-col gap-6">
            {selected ? (
              <>
                {/* Live Preview */}
                <div
                  className="relative overflow-hidden w-full aspect-[16/10] border border-[#cbd2cd] rounded-lg bg-[#2a312c] bg-center bg-cover shadow-md"
                  style={{ backgroundImage: `url(${selected.previewDataUrl})` }}
                >
                  {/* Overlay Gradient depending on safeArea */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-r from-black/60 via-zinc-900/10 to-transparent pointer-events-none transition-all duration-300",
                    selected.art.safeArea === 'right' && "bg-gradient-to-l"
                  )} />

                  {/* Preview Sidebar */}
                  <div className="absolute z-10 inset-y-0 left-0 flex w-[22%] flex-col gap-2.5 pt-[12%] px-2 bg-black/45 backdrop-blur-[1px]">
                    <i className="w-[70%] h-1 ml-[12%] rounded-full bg-white/60" />
                    <i className="w-[50%] h-1 ml-[12%] rounded-full bg-white/60" />
                    <i className="w-[60%] h-1 ml-[12%] rounded-full bg-white/60" />
                    <i className="w-[45%] h-1 ml-[12%] rounded-full bg-white/60" />
                  </div>

                  {/* Preview Main */}
                  <div className="absolute z-10 inset-y-0 left-[22%] right-0 flex items-center justify-center">
                    <div className="text-white text-base font-bold tracking-wide drop-shadow-md select-none opacity-90">
                      Codex
                    </div>
                  </div>

                  {/* Preview Composer */}
                  <div className="absolute right-[11%] bottom-[10%] left-[11%] flex h-[18%] items-center justify-between px-3 border border-white/20 rounded-md bg-white/85 shadow-sm backdrop-blur-[2px]">
                    <span className="w-[42%] h-1 rounded-full bg-zinc-400" />
                    <b className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                </div>

                {/* Theme Title Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#eef1ef]">
                  <div>
                    <h2 className="text-base font-bold text-[#141815]">{selected.name}</h2>
                    <p className="text-[10px] text-[#6d7c71] font-mono mt-1 select-all">{selected.id}</p>
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
                <div className="flex flex-col gap-2.5 pb-4 border-b border-[#eef1ef]">
                  <label className="flex gap-2 items-center text-xs font-bold text-[#3c473f] tracking-wide uppercase">
                    <Settings2 size={13} className="text-[#6d7c71]" />
                    <span>外观</span>
                  </label>
                  {/* Segmented control */}
                  <div className="flex rounded-lg bg-[#eef1ef] p-1 gap-1 w-full">
                    {(['auto', 'light', 'dark'] as const).map((value) => (
                      <button
                        key={value}
                        className={cn(
                          "flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
                          selected.appearance === value
                            ? "bg-white text-primary shadow-sm"
                            : "text-[#5f6e62] hover:text-[#141815]"
                        )}
                        onClick={() => void updateSelected({ appearance: value })}
                      >
                        {value === 'auto' ? '跟随系统' : value === 'light' ? '浅色' : '深色'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select dropdown fields */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#eef1ef]">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#3c473f] tracking-wide uppercase">
                      内容安全区
                    </label>
                    <Select
                      value={selected.art.safeArea}
                      onValueChange={(val) => void updateSelected({ art: { ...selected.art, safeArea: val as ArtConfig['safeArea'] } })}
                    >
                      <SelectTrigger className="w-full h-8 text-xs cursor-pointer bg-white">
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
                    <label className="text-xs font-bold text-[#3c473f] tracking-wide uppercase">
                      任务页背景
                    </label>
                    <Select
                      value={selected.art.taskMode}
                      onValueChange={(val) => void updateSelected({ art: { ...selected.art, taskMode: val as ArtConfig['taskMode'] } })}
                    >
                      <SelectTrigger className="w-full h-8 text-xs cursor-pointer bg-white">
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
                <div className="flex flex-col gap-3 pb-4 border-b border-[#eef1ef]">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-[#3c473f] tracking-wide uppercase">
                      水平焦点
                    </label>
                    <output className="text-xs font-mono text-[#5f6e62] font-semibold">
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
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-center text-[#6d7c71]">
                <Library size={32} strokeWidth={1.5} className="text-[#aebcb1]" />
                <span className="text-xs font-semibold">主题库为空</span>
              </div>
            )}
          </aside>
        </section>

        {/* Footer actions */}
        <footer className="h-[76px] px-6 border-t border-[#e1e6e2] bg-white flex items-center justify-between flex-none">
          <div className="flex gap-2.5 items-center text-primary">
            <ShieldCheck size={18} strokeWidth={2.5} className="text-[#3c9f6e]" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#141815]">{modeLabel}</span>
              <small className="text-[10px] text-[#5f6e62] mt-0.5 max-w-[360px] truncate">
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
                className="text-[#3c473f] bg-white cursor-pointer"
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
              className="text-[#725b3b] bg-amber-50/40 border-amber-200/60 hover:bg-amber-50 hover:border-amber-300 cursor-pointer"
            >
              <RotateCcw size={15} />
              恢复官方主题
            </Button>
            <Button
              onClick={() => setConfirmRestart(true)}
              disabled={!selected || Boolean(working)}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/95 font-semibold cursor-pointer shadow-md"
            >
              {working === 'apply' ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <Play size={15} />
              )}
              应用主题
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
