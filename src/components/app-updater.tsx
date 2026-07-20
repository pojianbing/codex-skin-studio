import { useCallback, useEffect, useRef, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { Download, LoaderCircle, RefreshCw, RotateCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready'

const fallbackVersion = '0.2.1'

function formatUpdateDate(value?: string) {
  if (!value) return '刚刚发布'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function AppUpdater() {
  const [currentVersion, setCurrentVersion] = useState(fallbackVersion)
  const [state, setState] = useState<UpdateState>('idle')
  const [update, setUpdate] = useState<Update | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [downloadedBytes, setDownloadedBytes] = useState(0)
  const [contentLength, setContentLength] = useState<number | undefined>()
  const checkInFlight = useRef(false)

  useEffect(() => {
    void getVersion().then(setCurrentVersion).catch(() => undefined)
  }, [])

  const checkForUpdate = useCallback(async (interactive: boolean) => {
    if (checkInFlight.current) return

    checkInFlight.current = true
    setState('checking')
    try {
      const availableUpdate = await check()
      if (!availableUpdate) {
        setState('idle')
        if (interactive) toast.success('已是最新版本')
        return
      }

      setUpdate(availableUpdate)
      setState('available')
      setDialogOpen(true)
    } catch (error) {
      setState('idle')
      if (interactive) toast.error(`检查更新失败：${String(error)}`)
    } finally {
      checkInFlight.current = false
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void checkForUpdate(false), 10_000)
    return () => window.clearTimeout(timer)
  }, [checkForUpdate])

  const downloadAndInstall = async () => {
    if (!update) return

    setDownloadedBytes(0)
    setContentLength(undefined)
    setState('downloading')

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setContentLength(event.data.contentLength)
        }
        if (event.event === 'Progress') {
          setDownloadedBytes((current) => current + event.data.chunkLength)
        }
      })
      setState('ready')
    } catch (error) {
      setState('available')
      toast.error(`安装更新失败：${String(error)}`)
    }
  }

  const progress = contentLength && contentLength > 0
    ? Math.min(100, Math.round((downloadedBytes / contentLength) * 100))
    : undefined

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (state === 'available' || state === 'ready') {
            setDialogOpen(true)
            return
          }
          void checkForUpdate(true)
        }}
        disabled={state === 'checking' || state === 'downloading'}
        title="点击检查更新"
        className={cn(
          'group flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 select-none',
          state === 'available' || state === 'ready'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 animate-pulse'
            : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border',
        )}
      >
        {state === 'checking' || state === 'downloading' ? (
          <LoaderCircle size={10} className="animate-spin text-zinc-400" />
        ) : state === 'available' || state === 'ready' ? (
          <Sparkles size={10} className="text-emerald-400" />
        ) : (
          <RefreshCw size={10} className="text-zinc-500 group-hover:rotate-180 transition-transform duration-300" />
        )}
        <span>
          {state === 'available' ? `v${update?.version} 可更新`
            : state === 'ready' ? '就绪'
              : state === 'checking' ? '检查中'
                : `v${currentVersion}`}
        </span>
      </button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (state !== 'downloading') setDialogOpen(open)
        }}
      >
        <DialogContent className="studio-dialog max-w-sm border-emerald-500/20 bg-zinc-950 p-0 text-zinc-100" showCloseButton={state !== 'downloading'}>
          <DialogHeader className="gap-3 border-b border-zinc-800 px-5 pt-5 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
              {state === 'ready' ? <RotateCw size={19} /> : <Download size={19} />}
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-zinc-50">
                {state === 'ready' ? '更新已经准备好' : `Skin Studio v${update?.version} 已发布`}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {state === 'ready'
                  ? '重启应用以完成安装。'
                  : `${formatUpdateDate(update?.date)}，当前版本 v${currentVersion}`}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-3 px-5 pb-1">
            {state === 'downloading' ? (
              <div className="space-y-2" aria-live="polite">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span>正在下载并验证更新</span>
                  <span className="font-mono text-emerald-300">{progress === undefined ? '...' : `${progress}%`}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-[width] duration-200"
                    style={{ width: `${progress ?? 12}%` }}
                  />
                </div>
              </div>
            ) : update?.body ? (
              <div className="max-h-32 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-xs leading-5 whitespace-pre-wrap text-zinc-400">
                {update.body}
              </div>
            ) : (
              <p className="text-xs leading-5 text-zinc-400">此版本包含稳定性改进与功能更新。</p>
            )}
          </div>

          <DialogFooter className="mt-3 border-zinc-800 bg-zinc-900/50 px-5 py-4">
            {state !== 'downloading' && state !== 'ready' && (
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50">
                稍后
              </Button>
            )}
            {state === 'ready' ? (
              <Button onClick={() => void relaunch()} className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                <RotateCw size={15} />
                重启并完成更新
              </Button>
            ) : (
              <Button
                onClick={() => void downloadAndInstall()}
                disabled={state === 'downloading'}
                className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
              >
                {state === 'downloading' ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
                下载并安装
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
