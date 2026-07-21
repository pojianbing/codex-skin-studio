import { type ReactNode, useEffect, useId, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { type ElementTab, type PreviewElementId } from '@/lib/preview-elements'
import { type RowStyle, type SemanticTokens, type SurfaceStyle } from '@/lib/theme-types'

const sliderValue = (value: number | readonly number[]) => (
  typeof value === 'number' ? value : value[0]
)

export function ToggleSetting({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const labelId = useId()
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={labelId} className="text-xs font-medium text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-labelledby={labelId} />
    </div>
  )
}

export function SliderSetting({ label, value, min, max, step, unit = '', onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}) {
  const labelId = useId()
  const inputId = useId()
  const displayValue = useMemo(() => unit === '%' ? Math.round(value * 100) : value, [value, unit])
  const [localText, setLocalText] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) setLocalText(`${displayValue}${unit}`)
  }, [displayValue, unit, isFocused])

  const normalize = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next))
    const decimals = (String(step).split('.')[1] || '').length
    return parseFloat(clamped.toFixed(decimals))
  }

  const commitInput = (text: string) => {
    let next = parseFloat(text.replace(/[^\d.-]/g, ''))
    if (Number.isNaN(next)) {
      setLocalText(`${displayValue}${unit}`)
      return
    }
    if (unit === '%') next /= 100
    onChange(normalize(next))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label id={labelId} htmlFor={inputId} className="text-xs font-medium text-foreground">{label}</label>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-xs" onClick={() => onChange(normalize(value - step))} disabled={value <= min} title={`减少${label}`} aria-label={`减少${label}`}>
            -
          </Button>
          <input
            id={inputId}
            type="text"
            value={localText}
            onChange={(event) => setLocalText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitInput(localText)
                event.currentTarget.blur()
              } else if (event.key === 'Escape') {
                setLocalText(`${displayValue}${unit}`)
                event.currentTarget.blur()
              }
            }}
            onBlur={() => {
              setIsFocused(false)
              commitInput(localText)
            }}
            onFocus={() => {
              setIsFocused(true)
              setLocalText(String(displayValue))
            }}
            className="h-6 w-12 rounded-md border border-input bg-background text-center text-[10px] font-mono font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <Button type="button" variant="outline" size="icon-xs" onClick={() => onChange(normalize(value + step))} disabled={value >= max} title={`增加${label}`} aria-label={`增加${label}`}>
            +
          </Button>
        </div>
      </div>
      <Slider aria-labelledby={labelId} value={[value]} min={min} max={max} step={step} onValueChange={(next) => onChange(sliderValue(next))} className="w-full cursor-pointer py-1" />
    </div>
  )
}

export function ColorSetting({ label, value, autoColor, allowAuto = true, onChange }: {
  label: string
  value: string
  autoColor: string
  allowAuto?: boolean
  onChange: (value: string) => void
}) {
  const isAuto = value === 'auto'
  const resolved = isAuto ? autoColor : value
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-zinc-300">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        {allowAuto && <label className="flex items-center gap-1 cursor-pointer select-none text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"><input type="checkbox" checked={isAuto} onChange={(event) => onChange(event.target.checked ? 'auto' : resolved)} className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-950 w-3 h-3 cursor-pointer" /><span>跟随主题</span></label>}
        <div className={cn('flex items-center gap-1.5 transition-all duration-200', isAuto && allowAuto ? 'opacity-40 pointer-events-none' : 'opacity-100')}>
          <label className="relative h-6 w-6 flex-none overflow-hidden rounded border border-zinc-700 ring-1 ring-black/20 cursor-pointer hover:border-zinc-500 transition-colors" title={`选择${label}`}>
            <span className="absolute inset-0" style={{ backgroundColor: resolved }} />
            <input type="color" aria-label={label} disabled={isAuto && allowAuto} className="absolute inset-0 h-full w-full opacity-0 cursor-pointer" value={resolved} onChange={(event) => onChange(event.target.value)} />
          </label>
          <code className="w-[50px] truncate text-right text-[10px] font-semibold text-zinc-500">{resolved.toUpperCase()}</code>
        </div>
      </div>
    </div>
  )
}

export function ShadowSetting({ value, onChange }: { value: SurfaceStyle['shadow'], onChange: (value: SurfaceStyle['shadow']) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">阴影</span>
      <div className="flex w-full gap-1 rounded-md bg-muted p-1" role="group" aria-label="阴影强度">
        {(['none', 'soft', 'strong'] as const).map((option) => <button key={option} type="button" aria-pressed={value === option} className={cn('flex-1 rounded-sm py-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50', value === option ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground')} onClick={() => onChange(option)}>{option === 'none' ? '关闭' : option === 'soft' ? '柔和' : '强调'}</button>)}
      </div>
    </div>
  )
}

export function ConfigSection({ element, title, children, open, active, onOpenChange, onHoverChange, sectionRef }: {
  element: PreviewElementId
  title: string
  children: ReactNode
  open: boolean
  active: boolean
  onOpenChange: (open: boolean) => void
  onHoverChange: (active: boolean) => void
  sectionRef: (node: HTMLDetailsElement | null) => void
}) {
  return (
    <details ref={sectionRef} open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)} onMouseEnter={() => onHoverChange(true)} onMouseLeave={() => onHoverChange(false)} className={cn('config-section-link group border-t border-zinc-800 first:border-t-0', active && 'config-section-link--active')} data-config-element={element}>
      <summary className="flex h-10 list-none items-center justify-between gap-3 text-xs font-semibold text-zinc-300 cursor-pointer select-none [&::-webkit-details-marker]:hidden"><span>{title}</span><ChevronDown size={13} className="text-zinc-600 transition-transform group-open:rotate-180" /></summary>
      <div className="flex flex-col gap-4 pb-4">{children}</div>
    </details>
  )
}

export function SurfaceStyleEditor({ value, autoColor, onChange }: { value: SurfaceStyle, autoColor: string, onChange: (value: SurfaceStyle) => void }) {
  const patch = (next: Partial<SurfaceStyle>) => onChange({ ...value, ...next })
  return <><ToggleSetting label="显示" checked={value.visible} onChange={(visible) => patch({ visible })} />{value.visible && <><ColorSetting label="背景色" value={value.background} autoColor={autoColor} onChange={(background) => patch({ background })} /><SliderSetting label="不透明度" value={value.opacity} min={0} max={1} step={0.01} unit="%" onChange={(opacity) => patch({ opacity })} /><SliderSetting label="背景模糊" value={value.blur} min={0} max={32} step={1} unit="px" onChange={(blur) => patch({ blur })} /><SliderSetting label="边框强度" value={value.borderOpacity} min={0} max={1} step={0.01} unit="%" onChange={(borderOpacity) => patch({ borderOpacity })} /><SliderSetting label="圆角" value={value.radius} min={0} max={32} step={1} unit="px" onChange={(radius) => patch({ radius })} /><ShadowSetting value={value.shadow} onChange={(shadow) => patch({ shadow })} /></>}</>
}

export function ElementTabSelector({ value, onChange }: { value: ElementTab, onChange: (tab: ElementTab) => void }) {
  const tabs: Array<{ value: ElementTab, label: string }> = [{ value: 'shell', label: '基础框架' }, { value: 'components', label: '视图组件' }, { value: 'styles', label: '辅助样式' }]
  return <div className="mb-2 flex rounded-md bg-muted p-1" role="group" aria-label="界面元素分类">{tabs.map((tab) => <button key={tab.value} type="button" aria-pressed={value === tab.value} onClick={() => onChange(tab.value)} className={cn('flex-1 rounded-sm py-1.5 text-center text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50', value === tab.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground')}>{tab.label}</button>)}</div>
}

export function OverlayStyleEditor({ value, autoColor, onChange }: { value: SurfaceStyle, autoColor: string, onChange: (value: SurfaceStyle) => void }) {
  const patch = (next: Partial<SurfaceStyle>) => onChange({ ...value, visible: true, ...next })
  return <><ColorSetting label="背景色" value={value.background} autoColor={autoColor} onChange={(background) => patch({ background })} /><SliderSetting label="不透明度" value={value.opacity} min={0} max={1} step={0.01} unit="%" onChange={(opacity) => patch({ opacity })} /><SliderSetting label="背景模糊" value={value.blur} min={0} max={32} step={1} unit="px" onChange={(blur) => patch({ blur })} /><SliderSetting label="边框强度" value={value.borderOpacity} min={0} max={1} step={0.01} unit="%" onChange={(borderOpacity) => patch({ borderOpacity })} /><SliderSetting label="圆角" value={value.radius} min={0} max={32} step={1} unit="px" onChange={(radius) => patch({ radius })} /><ShadowSetting value={value.shadow} onChange={(shadow) => patch({ shadow })} /></>
}

export function SemanticTokensEditor({ value, appearance, onChange }: { value: SemanticTokens, appearance: 'light' | 'dark', onChange: (value: SemanticTokens) => void }) {
  const automatic: SemanticTokens = appearance === 'light'
    ? { textPrimary: '#0F172A', textSecondary: '#334155', textMuted: '#475569', textDisabled: '#94A3B8', textInverse: '#FFFFFF', border: '#94A3B8', focusRing: '#2563EB', success: '#16A34A', warning: '#D97706', danger: '#DC2626' }
    : { textPrimary: '#F4F4F5', textSecondary: '#D4D4D8', textMuted: '#B8C0CA', textDisabled: '#6F7885', textInverse: '#101318', border: '#64748B', focusRing: '#60A5FA', success: '#4ADE80', warning: '#FBBF24', danger: '#FB7185' }
  const fields: Array<[keyof SemanticTokens, string]> = [['textPrimary', '主文字'], ['textSecondary', '次级文字'], ['textMuted', '弱化文字'], ['textDisabled', '禁用文字'], ['textInverse', '反色文字'], ['border', '语义边框'], ['focusRing', '焦点环'], ['success', '成功状态'], ['warning', '警告状态'], ['danger', '危险状态']]
  return <div className="flex flex-col gap-3">{fields.map(([key, label], index) => <div key={key}>{index === 5 && <div className="mb-3 h-px bg-zinc-800" />}<ColorSetting label={label} value={value[key]} autoColor={automatic[key]} onChange={(next) => onChange({ ...value, [key]: next })} /></div>)}</div>
}

export function RowStyleEditor({ value, autoColor, onChange }: { value: RowStyle, autoColor: string, onChange: (value: RowStyle) => void }) {
  const patch = (next: Partial<RowStyle>) => onChange({ ...value, ...next })
  return <><ToggleSetting label="显示" checked={value.visible} onChange={(visible) => patch({ visible })} />{value.visible && <><ColorSetting label="背景色" value={value.background} autoColor={autoColor} onChange={(background) => patch({ background })} /><SliderSetting label="常态强度" value={value.opacity} min={0} max={1} step={0.01} unit="%" onChange={(opacity) => patch({ opacity })} /><SliderSetting label="悬停强度" value={value.hoverOpacity} min={0} max={1} step={0.01} unit="%" onChange={(hoverOpacity) => patch({ hoverOpacity })} /><SliderSetting label="选中强度" value={value.selectedOpacity} min={0} max={1} step={0.01} unit="%" onChange={(selectedOpacity) => patch({ selectedOpacity })} /><SliderSetting label="圆角" value={value.radius} min={0} max={24} step={1} unit="px" onChange={(radius) => patch({ radius })} /></>}</>
}
