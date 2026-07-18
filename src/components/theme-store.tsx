import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Check, CloudOff, Download, LoaderCircle, RefreshCw, ShieldCheck,
} from 'lucide-react'
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
import { toast } from 'sonner'

type StoreTheme = {
  id: string
  name: string
  version: string
  author: string
  description: string
  tags: string[]
  license: string
  licenseUrl: string
  sourceUrl?: string
  previewUrl: string
  publishedAt: string
  installStatus: 'notInstalled' | 'installed' | 'updateAvailable'
  localThemeId?: string
}

type StoreCatalog = {
  releaseTag: string
  storeVersion: string
  fetchedAt: string
  source: 'network' | 'cache'
  themes: StoreTheme[]
}

type InstalledTheme = { id: string; name: string }

type ThemeStoreProps = {
  onInstalled: (themeId: string) => Promise<void>
}

const installationLabel = (status: StoreTheme['installStatus']) => {
  if (status === 'installed') return '已安装'
  if (status === 'updateAvailable') return '更新'
  return '安装'
}

export function ThemeStore({ onInstalled }: ThemeStoreProps) {
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [updateTarget, setUpdateTarget] = useState<StoreTheme | null>(null)

  const loadCatalog = async (refresh = false) => {
    setLoading(true)
    try {
      setCatalog(await invoke<StoreCatalog>('get_store_catalog', { refresh }))
    } catch (error) {
      toast.error(String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCatalog()
  }, [])

  const tags = useMemo(
    () => [...new Set(catalog?.themes.flatMap((theme) => theme.tags) ?? [])].sort(),
    [catalog],
  )

  const visibleThemes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return (catalog?.themes ?? []).filter((theme) => {
      const matchesQuery = !normalized || [theme.name, theme.author, theme.description, ...theme.tags]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalized)
      return matchesQuery && (!tag || theme.tags.includes(tag))
    })
  }, [catalog, query, tag])

  const install = async (theme: StoreTheme) => {
    setUpdateTarget(null)
    setInstallingId(theme.id)
    try {
      const installed = await invoke<InstalledTheme>('install_store_theme', { storeId: theme.id })
      await onInstalled(installed.id)
      await loadCatalog()
      toast.success(`${installed.name} 已加入主题库`)
    } catch (error) {
      toast.error(String(error))
    } finally {
      setInstallingId(null)
    }
  }

  return (
    <>
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-zinc-50">主题商店</h1>
          <p className="mt-0.5 text-xs text-zinc-400">
            {catalog ? `${catalog.themes.length} 个已审核主题` : 'GitHub Releases'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {catalog && (
            <span className={cn(
              'hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium sm:flex',
              catalog.source === 'network'
                ? 'border-emerald-900/60 bg-emerald-950/20 text-emerald-300'
                : 'border-amber-900/60 bg-amber-950/20 text-amber-300',
            )}>
              <ShieldCheck size={12} />
              {catalog.source === 'network' ? catalog.releaseTag : '离线目录'}
            </span>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            title="刷新主题商店"
            aria-label="刷新主题商店"
            onClick={() => void loadCatalog(true)}
            disabled={loading || installingId !== null}
            className="border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : undefined} />
          </Button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-900/40 px-6 py-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索主题、作者或风格"
            aria-label="搜索主题"
            className="h-8 w-56 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
          />
          <button
            type="button"
            onClick={() => setTag(null)}
            className={cn(
              'h-7 rounded-md border px-2.5 text-[11px] font-semibold transition-colors cursor-pointer',
              tag === null
                ? 'border-zinc-500 bg-zinc-100 text-zinc-950'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100',
            )}
          >
            全部
          </button>
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTag((current) => current === item ? null : item)}
              className={cn(
                'h-7 rounded-md border px-2.5 text-[11px] font-semibold transition-colors cursor-pointer',
                tag === item
                  ? 'border-amber-500/70 bg-amber-400 text-zinc-950'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100',
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading && !catalog ? (
            <div className="flex h-full min-h-[280px] items-center justify-center gap-2 text-xs font-semibold text-zinc-500">
              <LoaderCircle size={18} className="animate-spin" />
              正在读取主题目录
            </div>
          ) : catalog ? (
            visibleThemes.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                {visibleThemes.map((theme) => (
                  <article key={theme.id} className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm transition-colors hover:border-zinc-700">
                    <div className="relative aspect-video overflow-hidden bg-zinc-950">
                      <img
                        src={theme.previewUrl}
                        alt={`${theme.name} 预览`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-transparent to-transparent" />
                      {theme.installStatus === 'installed' && (
                        <span className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full bg-emerald-400 text-zinc-950 shadow-md" title="已安装">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                      {theme.installStatus === 'updateAvailable' && (
                        <span className="absolute right-2.5 top-2.5 rounded-md border border-amber-300/40 bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950 shadow-md">
                          有更新
                        </span>
                      )}
                    </div>
                    <div className="flex min-h-[154px] flex-col p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-bold text-zinc-100">{theme.name}</h2>
                          <p className="mt-1 truncate text-[10px] text-zinc-500">{theme.author} · v{theme.version}</p>
                        </div>
                        <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400">{theme.license}</span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-zinc-400">{theme.description}</p>
                      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {theme.tags.slice(0, 3).map((item) => (
                            <span key={item} className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">{item}</span>
                          ))}
                        </div>
                        {theme.installStatus === 'installed' ? (
                          <Button
                            variant="outline"
                            size="xs"
                            disabled
                            className="border-emerald-900/60 bg-emerald-950/20 text-emerald-300"
                          >
                            <Check size={12} />
                            已安装
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            onClick={() => theme.installStatus === 'updateAvailable' ? setUpdateTarget(theme) : void install(theme)}
                            disabled={installingId !== null}
                            className="bg-zinc-100 text-zinc-950 hover:bg-white cursor-pointer"
                          >
                            {installingId === theme.id ? <LoaderCircle size={12} className="animate-spin" /> : <Download size={12} />}
                            {installationLabel(theme.installStatus)}
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-center text-zinc-500">
                <CloudOff size={28} strokeWidth={1.5} className="text-zinc-700" />
                <span className="text-xs font-semibold">没有匹配的主题</span>
              </div>
            )
          ) : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-center text-zinc-500">
              <CloudOff size={30} strokeWidth={1.5} className="text-zinc-700" />
              <span className="text-xs font-semibold">主题商店暂不可用</span>
              <Button variant="outline" size="sm" onClick={() => void loadCatalog(true)} className="cursor-pointer border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800">
                <RefreshCw size={13} />
                重试
              </Button>
            </div>
          )}
        </div>
      </section>

      <Dialog open={updateTarget !== null} onOpenChange={(open) => { if (!open) setUpdateTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-amber-950/60 text-amber-300">
              <Download size={19} />
            </div>
            <DialogTitle>更新“{updateTarget?.name}”</DialogTitle>
            <DialogDescription>
              新版本会替换当前主题的本地配置和背景。主题正在使用时会自动热更新。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateTarget(null)} className="cursor-pointer">取消</Button>
            <Button onClick={() => updateTarget && void install(updateTarget)} className="cursor-pointer">
              <Download size={14} />
              更新主题
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
