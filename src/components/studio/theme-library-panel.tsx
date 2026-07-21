import { Check, Download, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type ThemeFilter, type ThemeRecord } from '@/lib/theme-types'

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
          <div className="overflow-y-auto p-6 border-r border-zinc-850/40 bg-zinc-900/10">
            <div className="mb-4 flex items-center gap-3">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">主题类型</span>
              <div className="flex min-w-0 flex-1 rounded-lg border border-zinc-800/70 bg-zinc-950/45 p-0.5" role="group" aria-label="主题类型筛选">
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
                      'h-6 min-w-0 flex-1 rounded-md px-2 text-[10px] font-semibold transition-colors cursor-pointer',
                      themeFilter === filter
                        ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                        : 'text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-200',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {filteredThemes.map((theme) => (
                <div
                  key={theme.id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden text-left border rounded-xl bg-gradient-to-b from-zinc-900/60 to-zinc-950/80 backdrop-blur-sm transition-colors duration-150 cursor-pointer shadow-sm",
                    selected?.id === theme.id
                      ? "border-zinc-250 shadow-[0_0_12px_rgba(255,255,255,0.06)] ring-1 ring-zinc-200/50"
                      : "border-zinc-800/80 hover:border-zinc-700"
                  )}
                  onClick={() => onSelectTheme(theme.id)}
                >
                  <span
                    className="relative block w-full aspect-video bg-zinc-950 bg-center bg-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                    style={{ backgroundImage: `url(${theme.previewDataUrl})` }}
                  >
                    {/* Shadow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-90 transition-opacity" />
                    
                    {/* 选中指示标记 */}
                    {selected?.id === theme.id && (
                      <i className="absolute z-10 top-2.5 left-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-zinc-50 text-zinc-950 shadow-md border border-white/20">
                        <Check size={13} strokeWidth={3.5} />
                      </i>
                    )}

                    {/* 快捷导出按钮 */}
                    <button
                      type="button"
                      title={`导出主题包 ${theme.name}`}
                      aria-label={`导出主题包 ${theme.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        void onExportTheme(theme)
                      }}
                      disabled={Boolean(working)}
                      className="absolute z-20 top-2.5 right-2.5 flex items-center gap-1 rounded-md border border-zinc-700/60 bg-zinc-950/85 px-2 py-1 text-[10px] font-semibold text-zinc-200 backdrop-blur-md opacity-0 group-hover:opacity-100 hover:bg-zinc-800 hover:text-white hover:border-zinc-500 transition-all duration-200 shadow-md cursor-pointer active:scale-95"
                    >
                      <Download size={11} />
                      <span>导出</span>
                    </button>
                  </span>
                  <span className="flex flex-col p-3.5">
                    <b className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">{theme.name}</b>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={cn(
                        "rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase",
                        theme.builtIn 
                          ? "bg-zinc-800/80 text-zinc-400 border border-zinc-700/30"
                          : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                      )}>
                        {theme.builtIn ? '内置' : '自定义'}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">v{theme.version}</span>
                    </div>
                  </span>
                </div>
              ))}
              {filteredThemes.length > 0 ? (
                <button
                  className="flex flex-col items-center justify-center min-h-[160px] gap-2.5 border border-dashed border-zinc-800 hover:border-zinc-700/60 rounded-xl bg-zinc-900/10 hover:bg-zinc-900/30 transition-colors duration-150 cursor-pointer text-zinc-500 hover:text-zinc-200 group"
                  onClick={() => void onImportWallpaper()}
                >
                  <ImagePlus size={20} className="transition-colors duration-150 text-zinc-500 group-hover:text-zinc-300" />
                  <span className="text-xs font-semibold">导入背景图片</span>
                </button>
              ) : (
                <div className="col-span-2 flex min-h-[190px] flex-col items-center justify-center gap-3 border border-dashed border-zinc-800 bg-zinc-900/10 px-6 text-center">
                  <ImagePlus size={24} strokeWidth={1.5} className="text-zinc-600" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-300">
                      {themeFilter === 'custom' ? '还没有自定义主题' : '主题库暂时为空'}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {themeFilter === 'custom' ? '导入背景图片或主题包后会显示在这里' : '正在读取本地主题'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void onImportWallpaper()}
                    className="border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 cursor-pointer"
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
