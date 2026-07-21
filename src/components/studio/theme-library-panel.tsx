import { Check, Download, ImagePlus, Video } from 'lucide-react'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type ThemeFilter, type ThemeRecord } from '@/lib/theme-types'

const capturedVideoPreviews = new Map<string, string>()

function VideoPreview({ theme }: { theme: ThemeRecord }) {
  const [previewDataUrl, setPreviewDataUrl] = useState(
    () => capturedVideoPreviews.get(theme.id) ?? theme.previewDataUrl,
  )
  const videoSource = useMemo(
    () => theme.backgroundPath ? convertFileSrc(theme.backgroundPath) : undefined,
    [theme.backgroundPath],
  )

  useEffect(() => {
    setPreviewDataUrl(capturedVideoPreviews.get(theme.id) ?? theme.previewDataUrl)
  }, [theme.id, theme.previewDataUrl])

  const captureFirstFrame = (video: HTMLVideoElement) => {
    if (!video.videoWidth || !video.videoHeight || capturedVideoPreviews.has(theme.id)) return

    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 360
    const context = canvas.getContext('2d')
    if (!context) return

    const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight)
    const width = video.videoWidth * scale
    const height = video.videoHeight * scale
    context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)

    try {
      const thumbnail = canvas.toDataURL('image/jpeg', 0.84)
      capturedVideoPreviews.set(theme.id, thumbnail)
      setPreviewDataUrl(thumbnail)
      void invoke('save_video_thumbnail', { themeId: theme.id, thumbnailDataUrl: thumbnail })
    } catch {
      // Keep the existing thumbnail when the platform does not permit canvas capture.
    }
  }

  const capturePresentedFrame = (video: HTMLVideoElement) => {
    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => captureFirstFrame(video))
      return
    }
    window.requestAnimationFrame(() => captureFirstFrame(video))
  }

  return (
    <span
      className="relative z-0 block w-full aspect-video pointer-events-none bg-muted bg-center bg-cover"
      style={{ backgroundImage: `url(${previewDataUrl})` }}
    >
      {videoSource && (
        <video
          key={`first-frame-v2-${theme.id}`}
          aria-hidden="true"
          className="absolute size-px opacity-0"
          crossOrigin="anonymous"
          muted
          playsInline
          preload="metadata"
          src={videoSource}
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = Math.min(0.001, event.currentTarget.duration || 0.001)
          }}
          onLoadedData={(event) => capturePresentedFrame(event.currentTarget)}
          onSeeked={(event) => capturePresentedFrame(event.currentTarget)}
        />
      )}
      <div className="absolute inset-0 bg-black/30" />
      <span className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-md border border-white/20 bg-zinc-950/70 text-white shadow-sm">
        <Video size={13} aria-label="视频背景" />
      </span>
    </span>
  )
}

type ThemeLibraryPanelProps = {
  filteredThemes: ThemeRecord[]
  selected?: ThemeRecord
  themeFilter: ThemeFilter
  working?: string
  onThemeFilterChange: (filter: ThemeFilter) => void
  onSelectTheme: (themeId: string) => void
  onImportWallpaper: () => Promise<void>
  onExportTheme: (theme: ThemeRecord) => Promise<void>
}

export function ThemeLibraryPanel({
  filteredThemes,
  selected,
  themeFilter,
  working,
  onThemeFilterChange,
  onSelectTheme,
  onImportWallpaper,
  onExportTheme,
}: ThemeLibraryPanelProps) {
  return (
          <div className="overflow-y-auto border-r border-border bg-background p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground">主题类型</span>
              <div className="flex min-w-0 flex-1 rounded-md bg-muted p-1" role="group" aria-label="主题类型筛选">
                {([
                  ['all', '全部'],
                  ['builtIn', '内置'],
                  ['custom', '自定义'],
                ] as const).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={themeFilter === filter}
                    onClick={() => onThemeFilterChange(filter)}
                    className={cn(
                      'h-6 min-w-0 flex-1 rounded-sm px-2 text-[10px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      themeFilter === filter
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filteredThemes.map((theme) => (
                <article
                  key={theme.id}
                  className={cn(
                    'group relative flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground transition-colors',
                    selected?.id === theme.id
                      ? 'border-ring ring-2 ring-ring/30'
                      : 'border-border hover:border-ring/50',
                  )}
                >
                  <button
                    type="button"
                    aria-label={`选择主题 ${theme.name}`}
                    aria-pressed={selected?.id === theme.id}
                    onClick={() => onSelectTheme(theme.id)}
                    className="absolute inset-0 z-10 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  {theme.backgroundKind === 'video' ? (
                    <VideoPreview theme={theme} />
                  ) : (
                    <span
                      className="relative z-0 block w-full aspect-video pointer-events-none bg-muted bg-center bg-cover"
                      style={{ backgroundImage: `url(${theme.previewDataUrl})` }}
                    >
                      <div className="absolute inset-0 bg-black/30" />
                    </span>
                  )}
                  {selected?.id === theme.id && (
                    <i className="absolute left-2.5 top-2.5 z-10 flex size-6 items-center justify-center rounded-full border border-background/40 bg-primary text-primary-foreground shadow-sm pointer-events-none">
                      <Check size={13} strokeWidth={3.5} />
                    </i>
                  )}
                  <button
                    type="button"
                    title={`导出主题包 ${theme.name}`}
                    aria-label={`导出主题包 ${theme.name}`}
                    onClick={() => void onExportTheme(theme)}
                    disabled={Boolean(working)}
                    className="absolute right-2.5 top-2.5 z-20 flex h-7 items-center gap-1 rounded-md border border-border/80 bg-popover/90 px-2 text-[10px] font-medium text-popover-foreground opacity-0 shadow-sm transition-all duration-200 group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download size={11} />
                    <span>导出</span>
                  </button>
                  <span className="relative z-0 flex flex-col pointer-events-none p-3.5">
                    <b className="truncate text-sm font-medium text-card-foreground">{theme.name}</b>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={cn(
                        'rounded-sm border px-1.5 py-0.5 text-[9px] font-medium',
                        theme.builtIn 
                          ? 'border-border bg-muted text-muted-foreground'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      )}>
                        {theme.builtIn ? '内置' : '自定义'}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">v{theme.version}</span>
                      {theme.backgroundKind === 'video' && (
                        <span className="rounded-sm border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-medium text-sky-700 dark:text-sky-300">视频</span>
                      )}
                    </div>
                  </span>
                </article>
              ))}
              {filteredThemes.length > 0 ? (
                <button
                  className="group flex min-h-[160px] flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => void onImportWallpaper()}
                >
                  <ImagePlus size={20} />
                  <span className="text-xs font-medium">导入图片或视频背景</span>
                </button>
              ) : (
                <div className="col-span-full flex min-h-[190px] flex-col items-center justify-center gap-3 border border-dashed border-border bg-muted/30 px-6 text-center">
                  <ImagePlus size={24} strokeWidth={1.5} className="text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      {themeFilter === 'custom' ? '还没有自定义主题' : '主题库暂时为空'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {themeFilter === 'custom' ? '导入图片、MP4 视频或主题包后会显示在这里' : '正在读取本地主题'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void onImportWallpaper()}
                    className="cursor-pointer"
                  >
                    <ImagePlus size={13} />
                    导入背景
                  </Button>
                </div>
              )}
            </div>
          </div>
  )
}
