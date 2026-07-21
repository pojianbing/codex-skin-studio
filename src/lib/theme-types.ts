export type EngineMode = 'official' | 'active' | 'paused' | 'error'

export type ArtConfig = {
  focusX: number
  focusY: number
  safeArea: 'auto' | 'left' | 'right' | 'center' | 'none'
  taskMode: 'auto' | 'ambient' | 'banner' | 'off'
}

export type ComposerConfig = {
  background: string
  opacity: number
  blur: number
  borderOpacity: number
  shadow: 'none' | 'soft' | 'strong'
  showFooterBackdrop: boolean
  radius: number
  placeholderColor: string
  controlColor: string
  controlOpacity: number
  controlRadius: number
  primaryActionColor: string
  primaryActionText: string
}

export type SurfaceStyle = {
  visible: boolean
  background: string
  opacity: number
  blur: number
  borderOpacity: number
  shadow: 'none' | 'soft' | 'strong'
  radius: number
}

export type EnvironmentConfig = SurfaceStyle
export type ChangeSummaryConfig = SurfaceStyle

export type LevelSliderConfig = {
  enabled: boolean
  levelColors: [string, string, string, string, string]
  thumbColor: string
}

export type RowStyle = {
  visible: boolean
  background: string
  opacity: number
  hoverOpacity: number
  selectedOpacity: number
  radius: number
}

export type ScrollbarStyle = {
  visible: boolean
  color: string
  opacity: number
  width: number
  radius: number
}

export type DiffStyle = {
  visible: boolean
  background: string
  opacity: number
  hoverOpacity: number
  addedColor: string
  deletedColor: string
  radius: number
}

export type ContentLayoutStyle = {
  maxWidth: number
  fontScale: number
  messageGap: number
}

export type RichTextStyle = {
  linkColor: string
  inlineCodeBackground: string
  inlineCodeOpacity: number
  inlineCodeRadius: number
  quoteAccent: string
  quoteBackground: string
  quoteOpacity: number
  tableBorder: string
  tableBackground: string
  tableOpacity: number
  tableRadius: number
  imageRadius: number
}

export type HomeWelcomeStyle = {
  iconVisible: boolean
  titleVisible: boolean
}

export type SemanticTokens = {
  textPrimary: string
  textSecondary: string
  textMuted: string
  textDisabled: string
  textInverse: string
  border: string
  focusRing: string
  success: string
  warning: string
  danger: string
}

export type UiConfig = {
  sidebar: SurfaceStyle
  header: SurfaceStyle
  userBubble: SurfaceStyle
  codeBlock: SurfaceStyle
  activityCard: SurfaceStyle
  homeWelcome: HomeWelcomeStyle
  homeSuggestions: SurfaceStyle
  overlays: SurfaceStyle
  threadRows: RowStyle
  summaryRows: RowStyle
  navigationRailVisible: boolean
  navigationRailOpacity: number
  scrollbar: ScrollbarStyle
  diff: DiffStyle
  content: ContentLayoutStyle
  richText: RichTextStyle
}

export type ThemeRecord = {
  id: string
  name: string
  version: string
  appearance: 'auto' | 'light' | 'dark'
  accent: string
  levelSlider: LevelSliderConfig
  art: ArtConfig
  composer: ComposerConfig
  environment: EnvironmentConfig
  changeSummary: ChangeSummaryConfig
  tokens: SemanticTokens
  ui: UiConfig
  backgroundKind: 'image' | 'video'
  previewDataUrl: string
  backgroundPath?: string
  builtIn: boolean
}

export type Dashboard = {
  platform: string
  codexFound: boolean
  codexVersion?: string
  mode: EngineMode
  activeThemeId?: string
  port?: number
  message: string
  autostartEnabled: boolean
  launchCodexOnOpen: boolean
  themes: ThemeRecord[]
}

export type ApplyPlan = { action: 'hotSwitch' | 'launch' | 'restart' }
export type ThemeFilter = 'all' | 'builtIn' | 'custom'
export type ThemeUpdate = Partial<Pick<ThemeRecord,
  'appearance' | 'art' | 'levelSlider' | 'composer' | 'environment' | 'changeSummary' | 'tokens' | 'ui'
>>

export const fallbackDashboard: Dashboard = {
  platform: 'desktop',
  codexFound: false,
  mode: 'official',
  message: '正在连接本地引擎',
  autostartEnabled: false,
  launchCodexOnOpen: false,
  themes: [],
}

export const themeBundleFilename = (theme: ThemeRecord) => {
  const name = theme.name
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .replace(/\.+$/, '')
  return `${name || theme.id}.codex-theme`
}

export const mergeThemeUpdate = (theme: ThemeRecord, update: ThemeUpdate): ThemeRecord => ({
  ...theme,
  ...update,
  art: update.art ? { ...theme.art, ...update.art } : theme.art,
  levelSlider: update.levelSlider ? { ...theme.levelSlider, ...update.levelSlider } : theme.levelSlider,
  composer: update.composer ? { ...theme.composer, ...update.composer } : theme.composer,
  environment: update.environment ? { ...theme.environment, ...update.environment } : theme.environment,
  changeSummary: update.changeSummary ? { ...theme.changeSummary, ...update.changeSummary } : theme.changeSummary,
  tokens: update.tokens ? { ...theme.tokens, ...update.tokens } : theme.tokens,
  ui: update.ui ? { ...theme.ui, ...update.ui } : theme.ui,
})
