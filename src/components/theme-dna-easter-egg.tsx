import type { CSSProperties } from 'react'
import { ExternalLink, Fingerprint, Github, ScanLine, Sparkles } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ThemeDna = {
  id: string
  name: string
  appearance: 'auto' | 'light' | 'dark'
  accent: string
  art: {
    focusX: number
    focusY: number
  }
  composer: {
    blur: number
  }
  tokens: {
    focusRing: string
    success: string
    warning: string
    danger: string
  }
  ui: {
    content: {
      fontScale: number
      maxWidth: number
    }
  }
}

type SignalBar = {
  color: string
  delay: number
  duration: number
  height: number
  opacity: number
}

const githubUrl = 'https://github.com/pojianbing'

async function openGithub() {
  try {
    await openUrl(githubUrl)
  } catch {
    const externalWindow = window.open(githubUrl, '_blank', 'noopener,noreferrer')
    if (!externalWindow) toast.error('无法打开 GitHub 链接')
  }
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createSignalBars(id: string, colors: string[]): SignalBar[] {
  let state = hashString(id)
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }

  return Array.from({ length: 28 }, () => ({
    color: colors[Math.floor(random() * colors.length)],
    delay: Number((random() * -2.4).toFixed(2)),
    duration: Number((2.8 + random() * 1.8).toFixed(2)),
    height: Math.round(20 + random() * 72),
    opacity: Number((0.45 + random() * 0.5).toFixed(2)),
  }))
}

export function ThemeDnaEasterEgg({
  open,
  onOpenChange,
  theme,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme: ThemeDna | undefined
}) {
  if (!theme) return null

  const colors = [
    theme.accent,
    theme.tokens.focusRing,
    theme.tokens.success,
    theme.tokens.warning,
    theme.tokens.danger,
  ]
  const signalBars = createSignalBars(theme.id, colors)
  const samples = [
    ['强调', theme.accent],
    ['焦点', theme.tokens.focusRing],
    ['成功', theme.tokens.success],
    ['警告', theme.tokens.warning],
    ['危险', theme.tokens.danger],
  ] as const
  const details = [
    ['焦点坐标', `${Math.round(theme.art.focusX * 100)} / ${Math.round(theme.art.focusY * 100)}`],
    ['面板模糊', `${theme.composer.blur}px`],
    ['内容宽度', `${theme.ui.content.maxWidth}px`],
    ['文字比例', `${Math.round(theme.ui.content.fontScale * 100)}%`],
  ] as const
  const appearance = theme.appearance === 'auto' ? '自动' : theme.appearance === 'light' ? '浅色' : '深色'

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      toast.success(`已复制 ${label} 色值: ${text.toUpperCase()}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-dna-dialog max-w-[560px] gap-0 overflow-hidden border-zinc-800/80 bg-zinc-950 p-0 text-zinc-100 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]">
        {/* 背景径向极光氛围 blur */}
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full opacity-25 blur-3xl transition-all duration-700"
          style={{ backgroundColor: theme.accent }}
        />

        {/* Modal Header */}
        <DialogHeader className="relative z-10 gap-1.5 border-b border-zinc-800/80 bg-zinc-950/80 px-6 pb-5 pt-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
              <Sparkles size={13} style={{ color: theme.accent }} className="animate-pulse" />
              <span>DNA SIGNATURE</span>
              <span className="text-zinc-700">//</span>
              <span className="text-zinc-300 font-mono">{appearance}</span>
            </div>
            <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-0.5 font-mono text-[10px] font-medium text-zinc-400">
              {theme.appearance.toUpperCase()}
            </span>
          </div>

          <DialogTitle className="mt-1 flex items-center gap-3 text-xl font-extrabold text-zinc-50 tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/90 shadow-inner">
              <Fingerprint size={20} style={{ color: theme.accent }} />
            </div>
            <span>主题 DNA</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 font-medium">
            <span className="text-zinc-200 font-semibold">{theme.name}</span> 的色彩直方与结构布局指纹
          </DialogDescription>
        </DialogHeader>

        {/* Signal Bars Visualizer Section */}
        <section
          className="theme-dna-field relative overflow-hidden border-b border-zinc-800/80 bg-zinc-950/90 px-6 py-6"
          aria-label={`${theme.name} 的主题 DNA 图谱`}
        >
          <div className="theme-dna-grid" aria-hidden="true" />
          
          {/* 四角高科技装饰锚点 */}
          <div className="pointer-events-none absolute top-2 left-2 text-[9px] font-mono text-zinc-700 select-none">+[0,0]</div>
          <div className="pointer-events-none absolute top-2 right-2 text-[9px] font-mono text-zinc-700 select-none">[100,0]+</div>
          
          <div className="relative z-10 flex items-center justify-between gap-5">
            <div className="flex items-center gap-2">
              <ScanLine size={13} className="text-zinc-400" />
              <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">CHROMATIC READOUT</span>
            </div>
            <div className="rounded border border-zinc-800/80 bg-zinc-900/70 px-2 py-0.5 font-mono text-[10px] text-zinc-400 shadow-inner">
              ID: {theme.id}
            </div>
          </div>

          {/* 直方图柱体排布 */}
          <div className="theme-dna-signal relative z-10 mt-6 flex h-24 items-end gap-[3.5px] rounded-sm p-1" aria-hidden="true">
            {signalBars.map((bar, index) => (
              <span
                key={`${theme.id}-${index}`}
                title={`色值: ${bar.color}`}
                className="theme-dna-signal-bar min-w-0 flex-1 rounded-t-[2px] cursor-pointer"
                style={{
                  animationDelay: `${bar.delay}s`,
                  animationDuration: `${bar.duration}s`,
                  backgroundColor: bar.color,
                  height: `${bar.height}%`,
                  opacity: bar.opacity,
                  boxShadow: `0 0 10px ${bar.color}33`,
                } as CSSProperties}
              />
            ))}
          </div>
        </section>

        {/* Data Grid Section */}
        <div className="grid grid-cols-[1.1fr_1fr] divide-x divide-zinc-800/80 bg-zinc-950/60 backdrop-blur-md">
          {/* 核心色序列表 */}
          <section className="px-6 py-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">核心色序</p>
              <span className="text-[9px] text-zinc-500 font-mono">点击可复制 HEX</span>
            </div>
            <div className="flex flex-col gap-2">
              {samples.map(([label, color]) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => copyToClipboard(color, label)}
                  title={`点击复制 ${label} 色值 ${color}`}
                  className="group flex items-center justify-between rounded-md border border-transparent px-2.5 py-1.5 text-[11px] transition-all hover:border-zinc-800 hover:bg-zinc-900/80 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 text-zinc-300 group-hover:text-zinc-100 font-medium">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-white/20 shadow-sm transition-transform group-hover:scale-110"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </span>
                  <code className="font-mono text-[10px] font-semibold text-zinc-400 group-hover:text-zinc-200 transition-colors">
                    {color.toUpperCase()}
                  </code>
                </button>
              ))}
            </div>
          </section>

          {/* 结构读数 */}
          <section className="px-6 py-5">
            <p className="mb-3 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">结构读数</p>
            <div className="flex flex-col gap-2">
              {details.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] hover:bg-zinc-900/40 transition-colors"
                >
                  <span className="text-zinc-400 font-medium">{label}</span>
                  <code className="font-mono text-[10px] font-bold text-zinc-200 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800/50">
                    {value}
                  </code>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="relative z-10 flex items-center justify-between gap-4 border-t border-zinc-800/80 bg-zinc-950/90 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 font-bold text-xs shadow-inner">
              PJ
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase">DESIGNED & CREATED BY</p>
              <p className="text-xs font-extrabold text-zinc-100 font-mono tracking-tight">pojianbing</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void openGithub()}
            aria-label="打开 pojianbing 的 GitHub"
            className="group flex shrink-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3.5 py-2 text-[11px] font-semibold text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-50 active:scale-95 cursor-pointer shadow-sm"
          >
            <Github size={14} className="text-zinc-400 group-hover:text-zinc-100 transition-colors" />
            <span className="font-mono">github.com/pojianbing</span>
            <ExternalLink size={12} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
