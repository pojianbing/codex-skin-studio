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
  ]
  const details = [
    ['焦点坐标', `${Math.round(theme.art.focusX * 100)} / ${Math.round(theme.art.focusY * 100)}`],
    ['面板模糊', `${theme.composer.blur}px`],
    ['内容宽度', `${theme.ui.content.maxWidth}px`],
    ['文字比例', `${Math.round(theme.ui.content.fontScale * 100)}%`],
  ]
  const appearance = theme.appearance === 'auto' ? '自动' : theme.appearance === 'light' ? '浅色' : '深色'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="studio-dialog theme-dna-dialog max-w-[560px] gap-0 overflow-hidden border-zinc-700/80 bg-zinc-950 p-0 text-zinc-100 shadow-2xl">
        <DialogHeader className="gap-1 border-b border-zinc-800 px-6 pb-5 pt-6">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold text-zinc-500">
            <Sparkles size={12} className="text-emerald-300" />
            <span>HIDDEN SIGNATURE</span>
            <span className="text-zinc-700">//</span>
            <span>{appearance}</span>
          </div>
          <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-zinc-50">
            <Fingerprint size={21} style={{ color: theme.accent }} />
            主题 DNA
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            {theme.name} 的色彩与布局指纹
          </DialogDescription>
        </DialogHeader>

        <section className="theme-dna-field relative overflow-hidden border-b border-zinc-800 px-6 py-5" aria-label={`${theme.name} 的主题 DNA 图谱`}>
          <div className="theme-dna-grid" aria-hidden="true" />
          <div className="relative z-10 flex items-center justify-between gap-5">
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                <ScanLine size={12} />
                <span>CHROMATIC READOUT</span>
              </div>
              <div className="font-mono text-[11px] text-zinc-300">{theme.id}</div>
            </div>
            <span className="rounded border border-zinc-700/80 bg-zinc-950/75 px-2 py-1 font-mono text-[10px] text-zinc-400">
              {theme.appearance.toUpperCase()}
            </span>
          </div>
          <div className="theme-dna-signal relative z-10 mt-5 flex h-24 items-end gap-[3px]" aria-hidden="true">
            {signalBars.map((bar, index) => (
              <span
                key={`${theme.id}-${index}`}
                className="theme-dna-signal-bar min-w-0 flex-1 rounded-t-sm"
                style={{
                  animationDelay: `${bar.delay}s`,
                  animationDuration: `${bar.duration}s`,
                  backgroundColor: bar.color,
                  height: `${bar.height}%`,
                  opacity: bar.opacity,
                } as CSSProperties}
              />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-[1.1fr_1fr] divide-x divide-zinc-800">
          <section className="px-6 py-5">
            <p className="mb-3 text-[10px] font-bold text-zinc-500">核心色序</p>
            <div className="flex flex-col gap-2.5">
              {samples.map(([label, color]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="flex items-center gap-2 text-zinc-400">
                    <span className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-white/15" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                  <code className="text-[10px] font-semibold text-zinc-300">{color.toUpperCase()}</code>
                </div>
              ))}
            </div>
          </section>

          <section className="px-6 py-5">
            <p className="mb-3 text-[10px] font-bold text-zinc-500">结构读数</p>
            <div className="flex flex-col gap-2.5">
              {details.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-zinc-500">{label}</span>
                  <code className="text-[10px] font-semibold text-zinc-300">{value}</code>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-zinc-800 bg-zinc-900/45 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-zinc-500">CREATED BY</p>
            <p className="mt-0.5 text-sm font-bold text-zinc-100">pojianbing</p>
          </div>
          <button
            type="button"
            onClick={() => void openGithub()}
            aria-label="打开 pojianbing 的 GitHub"
            className="flex shrink-0 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            <Github size={14} />
            <span>github.com/pojianbing</span>
            <ExternalLink size={12} className="text-zinc-500" />
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
