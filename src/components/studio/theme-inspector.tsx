import { type ComponentProps } from 'react'
import { ChevronDown, Download, Library, LoaderCircle, PanelRight, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CodexPreview } from '@/components/codex-preview'
import { cn } from '@/lib/utils'
import { type ElementTab, type PreviewElementId } from '@/lib/preview-elements'
import {
  type ArtConfig,
  type LevelSliderConfig,
  type ThemeFilter,
  type ThemeRecord,
  type ThemeUpdate,
  type UiConfig,
} from '@/lib/theme-types'
import {
  ColorSetting,
  ConfigSection,
  ElementTabSelector,
  OverlayStyleEditor,
  RowStyleEditor,
  SemanticTokensEditor,
  ShadowSetting,
  SliderSetting,
  SurfaceStyleEditor,
  ToggleSetting,
} from '@/components/studio/theme-settings'

const levelSliderLabels = ['低', '标准', '高', '超高', '极高'] as const

type ConfigSectionProps = Omit<ComponentProps<typeof ConfigSection>, 'title' | 'children'>

type ThemeInspectorProps = {
  selected?: ThemeRecord
  themeFilter: ThemeFilter
  showPreview: boolean
  resolvedAppearance: 'light' | 'dark'
  resolvedSafeArea: ArtConfig['safeArea']
  activeElement: PreviewElementId | null
  elementTab: ElementTab
  working?: string
  configSectionProps: (element: PreviewElementId) => ConfigSectionProps
  onTogglePreview: () => void
  onSelectPreviewElement: (element: PreviewElementId) => void
  onSelectElementTab: (tab: ElementTab) => void
  onConfigureDiff: () => void
  onExportTheme: () => void
  onRestoreBuiltinTheme: (theme: ThemeRecord) => void
  onDeleteTheme: (theme: ThemeRecord) => void
  updateSelected: (patch: ThemeUpdate) => Promise<void>
  updateUi: <Key extends keyof UiConfig>(key: Key, value: UiConfig[Key]) => Promise<void>
}

export function ThemeInspector({
  selected,
  themeFilter,
  showPreview,
  resolvedAppearance,
  resolvedSafeArea,
  activeElement,
  elementTab,
  working,
  configSectionProps,
  onTogglePreview,
  onSelectPreviewElement,
  onSelectElementTab,
  onConfigureDiff,
  onExportTheme,
  onRestoreBuiltinTheme,
  onDeleteTheme,
  updateSelected,
  updateUi,
}: ThemeInspectorProps) {
  return (
          <aside className="flex min-h-0 flex-col overflow-hidden bg-zinc-900/20 backdrop-blur-xl border-l border-zinc-800/40">
            {selected ? (
              <>
                <div className="shrink-0 border-b border-zinc-850/40 bg-zinc-900/15 px-5 pt-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-all duration-300">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <button
                      onClick={onTogglePreview}
                      className="flex min-w-0 items-center gap-2 hover:text-zinc-50 transition-colors cursor-pointer group"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800/80 text-zinc-300 group-hover:bg-zinc-700 transition-colors">
                        <PanelRight size={11} />
                      </span>
                      <span className="text-[11px] font-bold text-zinc-300 group-hover:text-zinc-50 transition-colors">Codex 实时预览</span>
                      <ChevronDown
                        size={11}
                        className={cn(
                          "text-zinc-500 group-hover:text-zinc-300 transition-transform duration-300",
                          showPreview ? "rotate-0" : "-rotate-90"
                        )}
                      />
                    </button>
                    <span className="max-w-[48%] truncate text-right text-[10px] font-medium text-zinc-500">
                      {selected.name}
                    </span>
                  </div>
                  <div className={cn(
                    "grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-in-out",
                    showPreview ? "grid-rows-[1fr] opacity-100 pb-4" : "grid-rows-[0fr] opacity-0 pb-0 pointer-events-none"
                  )}>
                    <div className="overflow-hidden">
                      <div className="max-w-[780px] mx-auto w-full">
                        <CodexPreview
                          theme={selected}
                          appearance={resolvedAppearance}
                          safeArea={resolvedSafeArea}
                          activeElement={activeElement}
                          onSelectElement={onSelectPreviewElement}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
                  {/* Theme Title Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                    <div>
                      <h2 className="text-base font-bold text-zinc-50">{selected.name}</h2>

                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        title="导出当前主题包"
                        aria-label="导出当前主题包"
                        onClick={onExportTheme}
                        disabled={Boolean(working)}
                        className="cursor-pointer"
                      >
                        {working === 'export' ? (
                          <LoaderCircle className="animate-spin" size={13} />
                        ) : (
                          <Download size={13} />
                        )}
                        <span>导出主题包</span>
                      </Button>
                      {selected.builtIn && (
                        <Button
                          variant="outline"
                          size="sm"
                          title="恢复内置主题默认设置"
                          aria-label={`恢复 ${selected.name} 默认设置`}
                          onClick={() => onRestoreBuiltinTheme(selected)}
                          disabled={Boolean(working)}
                          className="border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 cursor-pointer"
                        >
                          <RotateCcw size={13} />
                          <span>恢复默认</span>
                        </Button>
                      )}
                      {!selected.builtIn && (
                        <Button
                          variant="destructive"
                          size="icon-xs"
                          title="删除主题"
                          aria-label={`删除主题 ${selected.name}`}
                          onClick={() => onDeleteTheme(selected)}
                          disabled={Boolean(working)}
                          className="cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </div>


                  {/* Advanced UI Settings */}
                  <div className="flex flex-col gap-2 pb-5 border-b border-zinc-800/40">
                    <label className="mb-1 flex items-center gap-2 text-xs font-bold text-zinc-450 tracking-wide uppercase">
                      <SlidersHorizontal size={13} className="text-zinc-550" />
                      <span>界面元素</span>
                    </label>

                    <ElementTabSelector value={elementTab} onChange={onSelectElementTab} />

                    {elementTab === 'shell' && (
                      <>
                        <ConfigSection title="画布与焦点" {...configSectionProps('canvas')}>
                          <div className="grid grid-cols-1 gap-4 pb-1 md:grid-cols-2">
                            <div className="flex flex-col gap-2">
                              <label className="text-[10px] font-bold text-zinc-400 tracking-wide uppercase">
                                内容安全区
                              </label>
                              <Select
                                value={selected.art.safeArea}
                                onValueChange={(val) => void updateSelected({ art: { ...selected.art, safeArea: val as ArtConfig['safeArea'] } })}
                              >
                                <SelectTrigger className="w-full h-8 text-xs cursor-pointer bg-zinc-900 border-zinc-800">
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
                              <label className="text-[10px] font-bold text-zinc-400 tracking-wide uppercase">
                                任务页背景
                              </label>
                              <Select
                                value={selected.art.taskMode}
                                onValueChange={(val) => void updateSelected({ art: { ...selected.art, taskMode: val as ArtConfig['taskMode'] } })}
                              >
                                <SelectTrigger className="w-full h-8 text-xs cursor-pointer bg-zinc-900 border-zinc-800">
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

                          <SliderSetting
                            label="水平焦点"
                            value={selected.art.focusX}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(focusX) => void updateSelected({ art: { ...selected.art, focusX } })}
                          />
                        </ConfigSection>

                        <ConfigSection title="输入框" {...configSectionProps('composer')}>
                          <ColorSetting
                            label="背景色"
                            value={selected.composer.background}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#121620'}
                            onChange={(background) => void updateSelected({
                              composer: { ...selected.composer, background },
                            })}
                          />
                          <SliderSetting
                            label="不透明度"
                            value={selected.composer.opacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(opacity) => void updateSelected({
                              composer: { ...selected.composer, opacity },
                            })}
                          />
                          <SliderSetting
                            label="背景模糊"
                            value={selected.composer.blur}
                            min={0}
                            max={32}
                            step={1}
                            unit="px"
                            onChange={(blur) => void updateSelected({
                              composer: { ...selected.composer, blur },
                            })}
                          />
                          <SliderSetting
                            label="边框强度"
                            value={selected.composer.borderOpacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(borderOpacity) => void updateSelected({
                              composer: { ...selected.composer, borderOpacity },
                            })}
                          />
                          <ShadowSetting
                            value={selected.composer.shadow}
                            onChange={(shadow) => void updateSelected({
                              composer: { ...selected.composer, shadow },
                            })}
                          />
                          <SliderSetting
                            label="输入框圆角"
                            value={selected.composer.radius}
                            min={8}
                            max={32}
                            step={1}
                            unit="px"
                            onChange={(radius) => void updateSelected({
                              composer: { ...selected.composer, radius },
                            })}
                          />
                          <div className="h-px bg-zinc-800" />
                          <ColorSetting
                            label="占位文字"
                            value={selected.composer.placeholderColor}
                            autoColor={resolvedAppearance === 'light' ? '#475569' : '#B8C0CA'}
                            onChange={(placeholderColor) => void updateSelected({
                              composer: { ...selected.composer, placeholderColor },
                            })}
                          />
                          <ColorSetting
                            label="内部控件颜色"
                            value={selected.composer.controlColor}
                            autoColor={selected.accent}
                            onChange={(controlColor) => void updateSelected({
                              composer: { ...selected.composer, controlColor },
                            })}
                          />
                          <SliderSetting
                            label="内部控件强度"
                            value={selected.composer.controlOpacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(controlOpacity) => void updateSelected({
                              composer: { ...selected.composer, controlOpacity },
                            })}
                          />
                          <SliderSetting
                            label="内部控件圆角"
                            value={selected.composer.controlRadius}
                            min={0}
                            max={24}
                            step={1}
                            unit="px"
                            onChange={(controlRadius) => void updateSelected({
                              composer: { ...selected.composer, controlRadius },
                            })}
                          />
                          <ColorSetting
                            label="主操作颜色"
                            value={selected.composer.primaryActionColor}
                            autoColor={selected.accent}
                            onChange={(primaryActionColor) => void updateSelected({
                              composer: { ...selected.composer, primaryActionColor },
                            })}
                          />
                          <ColorSetting
                            label="主操作文字"
                            value={selected.composer.primaryActionText}
                            autoColor={resolvedAppearance === 'light' ? '#FFFFFF' : '#101318'}
                            onChange={(primaryActionText) => void updateSelected({
                              composer: { ...selected.composer, primaryActionText },
                            })}
                          />
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-xs font-semibold text-zinc-300">底部浮层渐变</span>
                              <small className="text-[10px] font-medium text-zinc-500">
                                {selected.composer.showFooterBackdrop ? '显示' : '隐藏'}
                              </small>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={selected.composer.showFooterBackdrop}
                              aria-label="显示底部浮层渐变"
                              title={selected.composer.showFooterBackdrop ? '隐藏底部浮层渐变' : '显示底部浮层渐变'}
                              onClick={() => void updateSelected({
                                composer: {
                                  ...selected.composer,
                                  showFooterBackdrop: !selected.composer.showFooterBackdrop,
                                },
                              })}
                              className={cn(
                                "relative h-5 w-9 flex-none rounded-full border transition-colors cursor-pointer",
                                selected.composer.showFooterBackdrop
                                  ? "border-emerald-400/40 bg-emerald-500"
                                  : "border-zinc-700 bg-zinc-800"
                              )}
                            >
                              <span className={cn(
                                "absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                                selected.composer.showFooterBackdrop ? "translate-x-4" : "translate-x-0"
                              )} />
                            </button>
                          </div>
                        </ConfigSection>

                        <ConfigSection title="环境面板" {...configSectionProps('environment')}>
                          <ToggleSetting
                            label="显示"
                            checked={selected.environment.visible}
                            onChange={(visible) => void updateSelected({
                              environment: { ...selected.environment, visible },
                            })}
                          />
                          {selected.environment.visible && (
                            <>
                              <ColorSetting
                                label="背景色"
                                value={selected.environment.background}
                                autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                                onChange={(background) => void updateSelected({
                                  environment: { ...selected.environment, background },
                                })}
                              />
                              <SliderSetting
                                label="不透明度"
                                value={selected.environment.opacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(opacity) => void updateSelected({
                                  environment: { ...selected.environment, opacity },
                                })}
                              />
                              <SliderSetting
                                label="背景模糊"
                                value={selected.environment.blur}
                                min={0}
                                max={32}
                                step={1}
                                unit="px"
                                onChange={(blur) => void updateSelected({
                                  environment: { ...selected.environment, blur },
                                })}
                              />
                              <SliderSetting
                                label="边框强度"
                                value={selected.environment.borderOpacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(borderOpacity) => void updateSelected({
                                  environment: { ...selected.environment, borderOpacity },
                                })}
                              />
                              <SliderSetting
                                label="圆角"
                                value={selected.environment.radius}
                                min={8}
                                max={32}
                                step={1}
                                unit="px"
                                onChange={(radius) => void updateSelected({
                                  environment: { ...selected.environment, radius },
                                })}
                              />
                              <ShadowSetting
                                value={selected.environment.shadow}
                                onChange={(shadow) => void updateSelected({
                                  environment: { ...selected.environment, shadow },
                                })}
                              />
                            </>
                          )}
                        </ConfigSection>

                        <ConfigSection title="变更摘要" {...configSectionProps('changeSummary')}>
                          <ToggleSetting
                            label="显示"
                            checked={selected.changeSummary.visible}
                            onChange={(visible) => void updateSelected({
                              changeSummary: { ...selected.changeSummary, visible },
                            })}
                          />
                          {selected.changeSummary.visible && (
                            <>
                              <ColorSetting
                                label="背景色"
                                value={selected.changeSummary.background}
                                autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                                onChange={(background) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, background },
                                })}
                              />
                              <SliderSetting
                                label="不透明度"
                                value={selected.changeSummary.opacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(opacity) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, opacity },
                                })}
                              />
                              <SliderSetting
                                label="背景模糊"
                                value={selected.changeSummary.blur}
                                min={0}
                                max={32}
                                step={1}
                                unit="px"
                                onChange={(blur) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, blur },
                                })}
                              />
                              <SliderSetting
                                label="边框强度"
                                value={selected.changeSummary.borderOpacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(borderOpacity) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, borderOpacity },
                                })}
                              />
                              <SliderSetting
                                label="圆角"
                                value={selected.changeSummary.radius}
                                min={8}
                                max={32}
                                step={1}
                                unit="px"
                                onChange={(radius) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, radius },
                                })}
                              />
                              <ShadowSetting
                                value={selected.changeSummary.shadow}
                                onChange={(shadow) => void updateSelected({
                                  changeSummary: { ...selected.changeSummary, shadow },
                                })}
                              />
                              <button
                                type="button"
                                onClick={onConfigureDiff}
                                className="flex h-9 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900 cursor-pointer"
                              >
                                <span>配置文件内容区域</span>
                                <span className="text-zinc-500">背景、行状态与增删颜色</span>
                              </button>
                            </>
                          )}
                        </ConfigSection>

                        <ConfigSection title="左侧边栏" {...configSectionProps('sidebar')}>
                          <SurfaceStyleEditor
                            value={selected.ui.sidebar}
                            autoColor={resolvedAppearance === 'light' ? '#f1f5f9' : '#0e121c'}
                            onChange={(value) => void updateUi('sidebar', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="顶部标题栏" {...configSectionProps('header')}>
                          <SurfaceStyleEditor
                            value={selected.ui.header}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#121620'}
                            onChange={(value) => void updateUi('header', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="正文布局" {...configSectionProps('content')}>
                          <SliderSetting
                            label="内容宽度"
                            value={selected.ui.content.maxWidth}
                            min={560}
                            max={1200}
                            step={8}
                            unit="px"
                            onChange={(maxWidth) => void updateUi('content', { ...selected.ui.content, maxWidth })}
                          />
                          <SliderSetting
                            label="字体缩放"
                            value={selected.ui.content.fontScale}
                            min={0.8}
                            max={1.3}
                            step={0.01}
                            unit="%"
                            onChange={(fontScale) => void updateUi('content', { ...selected.ui.content, fontScale })}
                          />
                          <SliderSetting
                            label="消息间距"
                            value={selected.ui.content.messageGap}
                            min={4}
                            max={32}
                            step={1}
                            unit="px"
                            onChange={(messageGap) => void updateUi('content', { ...selected.ui.content, messageGap })}
                          />
                        </ConfigSection>
                      </>
                    )}

                    {elementTab === 'components' && (
                      <>
                        <ConfigSection title="用户消息气泡" {...configSectionProps('userBubble')}>
                          <SurfaceStyleEditor
                            value={selected.ui.userBubble}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                            onChange={(value) => void updateUi('userBubble', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="代码块" {...configSectionProps('codeBlock')}>
                          <SurfaceStyleEditor
                            value={selected.ui.codeBlock}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                            onChange={(value) => void updateUi('codeBlock', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="工具活动卡片" {...configSectionProps('activityCard')}>
                          <SurfaceStyleEditor
                            value={selected.ui.activityCard}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                            onChange={(value) => void updateUi('activityCard', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="弹层与菜单" {...configSectionProps('overlays')}>
                          <OverlayStyleEditor
                            value={selected.ui.overlays}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                            onChange={(value) => void updateUi('overlays', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="级别滑块" {...configSectionProps('levelSlider')}>
                          <ToggleSetting
                            label="自定义轨道"
                            checked={selected.levelSlider.enabled}
                            onChange={(enabled) => void updateSelected({
                              levelSlider: { ...selected.levelSlider, enabled },
                            })}
                          />
                          {selected.levelSlider.enabled && (
                            <>
                              <div className="h-px bg-zinc-800" />
                              {levelSliderLabels.map((label, index) => (
                                <ColorSetting
                                  key={label}
                                  label={`级别 ${index + 1} · ${label}`}
                                  value={selected.levelSlider.levelColors[index]}
                                  autoColor={selected.levelSlider.levelColors[index]}
                                  allowAuto={false}
                                  onChange={(color) => {
                                    const levelColors = selected.levelSlider.levelColors.map(
                                      (current, currentIndex) => currentIndex === index ? color : current,
                                    ) as LevelSliderConfig['levelColors']
                                    void updateSelected({
                                      levelSlider: { ...selected.levelSlider, levelColors },
                                    })
                                  }}
                                />
                              ))}
                              <div className="h-px bg-zinc-800" />
                              <ColorSetting
                                label="拖块颜色"
                                value={selected.levelSlider.thumbColor}
                                autoColor="#ffffff"
                                allowAuto={false}
                                onChange={(thumbColor) => void updateSelected({
                                  levelSlider: { ...selected.levelSlider, thumbColor },
                                })}
                              />
                            </>
                          )}
                        </ConfigSection>

                        <ConfigSection title="任务列表行" {...configSectionProps('threadRows')}>
                          <RowStyleEditor
                            value={selected.ui.threadRows}
                            autoColor={selected.accent}
                            onChange={(value) => void updateUi('threadRows', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="环境面板项目" {...configSectionProps('summaryRows')}>
                          <RowStyleEditor
                            value={selected.ui.summaryRows}
                            autoColor={selected.accent}
                            onChange={(value) => void updateUi('summaryRows', value)}
                          />
                        </ConfigSection>

                        <ConfigSection title="主页建议卡片" {...configSectionProps('homeSuggestions')}>
                          <SurfaceStyleEditor
                            value={selected.ui.homeSuggestions}
                            autoColor={resolvedAppearance === 'light' ? '#ffffff' : '#121620'}
                            onChange={(value) => void updateUi('homeSuggestions', value)}
                          />
                          <p className="text-[11px] leading-relaxed text-zinc-500">
                            卡片文字继承“主文字”语义色，图标颜色由 Codex 保持原生状态色。
                          </p>
                        </ConfigSection>
                      </>
                    )}

                    {elementTab === 'styles' && (
                      <>
                        <ConfigSection title="语义文字与状态" {...configSectionProps('tokens')}>
                          <SemanticTokensEditor
                            value={selected.tokens}
                            appearance={resolvedAppearance}
                            onChange={(tokens) => void updateSelected({ tokens })}
                          />
                        </ConfigSection>

                        <ConfigSection title="导航轨与滚动条" {...configSectionProps('navigation')}>
                          <ToggleSetting
                            label="消息导航轨"
                            checked={selected.ui.navigationRailVisible}
                            onChange={(value) => void updateUi('navigationRailVisible', value)}
                          />
                          {selected.ui.navigationRailVisible && (
                            <SliderSetting
                              label="导航轨不透明度"
                              value={selected.ui.navigationRailOpacity}
                              min={0}
                              max={1}
                              step={0.01}
                              unit="%"
                              onChange={(value) => void updateUi('navigationRailOpacity', value)}
                            />
                          )}
                          <div className="h-px bg-zinc-800" />
                          <ToggleSetting
                            label="滚动条"
                            checked={selected.ui.scrollbar.visible}
                            onChange={(visible) => void updateUi('scrollbar', { ...selected.ui.scrollbar, visible })}
                          />
                          {selected.ui.scrollbar.visible && (
                            <>
                              <ColorSetting
                                label="滚动条颜色"
                                value={selected.ui.scrollbar.color}
                                autoColor={resolvedAppearance === 'light' ? '#94a3b8' : '#64748b'}
                                onChange={(color) => void updateUi('scrollbar', { ...selected.ui.scrollbar, color })}
                              />
                              <SliderSetting
                                label="不透明度"
                                value={selected.ui.scrollbar.opacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(opacity) => void updateUi('scrollbar', { ...selected.ui.scrollbar, opacity })}
                              />
                              <SliderSetting
                                label="宽度"
                                value={selected.ui.scrollbar.width}
                                min={4}
                                max={16}
                                step={1}
                                unit="px"
                                onChange={(width) => void updateUi('scrollbar', { ...selected.ui.scrollbar, width })}
                              />
                              <SliderSetting
                                label="圆角"
                                value={selected.ui.scrollbar.radius}
                                min={0}
                                max={16}
                                step={1}
                                unit="px"
                                onChange={(radius) => void updateUi('scrollbar', { ...selected.ui.scrollbar, radius })}
                              />
                            </>
                          )}
                        </ConfigSection>

                        <ConfigSection title="变更摘要文件区" {...configSectionProps('diff')}>
                          <ToggleSetting
                            label="显示"
                            checked={selected.ui.diff.visible}
                            onChange={(visible) => void updateUi('diff', { ...selected.ui.diff, visible })}
                          />
                          {selected.ui.diff.visible && (
                            <>
                              <ColorSetting
                                label="背景色"
                                value={selected.ui.diff.background}
                                autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                                onChange={(background) => void updateUi('diff', { ...selected.ui.diff, background })}
                              />
                              <SliderSetting
                                label="背景不透明度"
                                value={selected.ui.diff.opacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(opacity) => void updateUi('diff', { ...selected.ui.diff, opacity })}
                              />
                              <SliderSetting
                                label="悬停背景不透明度"
                                value={selected.ui.diff.hoverOpacity}
                                min={0}
                                max={1}
                                step={0.01}
                                unit="%"
                                onChange={(hoverOpacity) => void updateUi('diff', { ...selected.ui.diff, hoverOpacity })}
                              />
                              <ColorSetting
                                label="新增颜色"
                                value={selected.ui.diff.addedColor}
                                autoColor="#22c55e"
                                allowAuto={false}
                                onChange={(addedColor) => void updateUi('diff', { ...selected.ui.diff, addedColor })}
                              />
                              <ColorSetting
                                label="删除颜色"
                                value={selected.ui.diff.deletedColor}
                                autoColor="#ef4444"
                                allowAuto={false}
                                onChange={(deletedColor) => void updateUi('diff', { ...selected.ui.diff, deletedColor })}
                              />
                              <SliderSetting
                                label="圆角"
                                value={selected.ui.diff.radius}
                                min={0}
                                max={24}
                                step={1}
                                unit="px"
                                onChange={(radius) => void updateUi('diff', { ...selected.ui.diff, radius })}
                              />
                            </>
                          )}
                        </ConfigSection>

                        <ConfigSection title="富文本内容" {...configSectionProps('richText')}>
                          <ColorSetting
                            label="链接颜色"
                            value={selected.ui.richText.linkColor}
                            autoColor={selected.accent}
                            onChange={(linkColor) => void updateUi('richText', { ...selected.ui.richText, linkColor })}
                          />
                          <ColorSetting
                            label="行内代码背景"
                            value={selected.ui.richText.inlineCodeBackground}
                            autoColor={resolvedAppearance === 'light' ? '#f1f5f9' : '#18181b'}
                            onChange={(inlineCodeBackground) => void updateUi('richText', { ...selected.ui.richText, inlineCodeBackground })}
                          />
                          <SliderSetting
                            label="行内代码强度"
                            value={selected.ui.richText.inlineCodeOpacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(inlineCodeOpacity) => void updateUi('richText', { ...selected.ui.richText, inlineCodeOpacity })}
                          />
                          <SliderSetting
                            label="行内代码圆角"
                            value={selected.ui.richText.inlineCodeRadius}
                            min={0}
                            max={24}
                            step={1}
                            unit="px"
                            onChange={(inlineCodeRadius) => void updateUi('richText', { ...selected.ui.richText, inlineCodeRadius })}
                          />
                          <ColorSetting
                            label="引用强调色"
                            value={selected.ui.richText.quoteAccent}
                            autoColor={selected.accent}
                            onChange={(quoteAccent) => void updateUi('richText', { ...selected.ui.richText, quoteAccent })}
                          />
                          <ColorSetting
                            label="引用背景"
                            value={selected.ui.richText.quoteBackground}
                            autoColor={resolvedAppearance === 'light' ? '#f1f5f9' : '#18181b'}
                            onChange={(quoteBackground) => void updateUi('richText', { ...selected.ui.richText, quoteBackground })}
                          />
                          <SliderSetting
                            label="引用背景强度"
                            value={selected.ui.richText.quoteOpacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(quoteOpacity) => void updateUi('richText', { ...selected.ui.richText, quoteOpacity })}
                          />
                          <ColorSetting
                            label="表格边框"
                            value={selected.ui.richText.tableBorder}
                            autoColor={resolvedAppearance === 'light' ? '#cbd5e1' : '#475569'}
                            onChange={(tableBorder) => void updateUi('richText', { ...selected.ui.richText, tableBorder })}
                          />
                          <ColorSetting
                            label="表格背景"
                            value={selected.ui.richText.tableBackground}
                            autoColor={resolvedAppearance === 'light' ? '#f8fafc' : '#18181b'}
                            onChange={(tableBackground) => void updateUi('richText', { ...selected.ui.richText, tableBackground })}
                          />
                          <SliderSetting
                            label="表格背景强度"
                            value={selected.ui.richText.tableOpacity}
                            min={0}
                            max={1}
                            step={0.01}
                            unit="%"
                            onChange={(tableOpacity) => void updateUi('richText', { ...selected.ui.richText, tableOpacity })}
                          />
                          <SliderSetting
                            label="表格圆角"
                            value={selected.ui.richText.tableRadius}
                            min={0}
                            max={24}
                            step={1}
                            unit="px"
                            onChange={(tableRadius) => void updateUi('richText', { ...selected.ui.richText, tableRadius })}
                          />
                          <SliderSetting
                            label="图片圆角"
                            value={selected.ui.richText.imageRadius}
                            min={0}
                            max={32}
                            step={1}
                            unit="px"
                            onChange={(imageRadius) => void updateUi('richText', { ...selected.ui.richText, imageRadius })}
                          />
                        </ConfigSection>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-center text-zinc-500">
                <Library size={32} strokeWidth={1.5} className="text-zinc-700" />
                <span className="text-xs font-semibold">
                  {themeFilter === 'custom' ? '没有可编辑的自定义主题' : '主题库为空'}
                </span>
              </div>
            )}
          </aside>
  )
}
