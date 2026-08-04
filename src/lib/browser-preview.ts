import { type Dashboard, type DiagramStyle, type RowStyle, type SurfaceStyle, type ThemeRecord } from '@/lib/theme-types'

const surface = (background = 'auto'): SurfaceStyle => ({
  visible: true,
  background,
  opacity: 0.78,
  blur: 10,
  borderOpacity: 0.28,
  shadow: 'soft',
  radius: 12,
})

const rows = (): RowStyle => ({
  visible: true,
  background: 'auto',
  opacity: 0.08,
  hoverOpacity: 0.16,
  selectedOpacity: 0.22,
  radius: 8,
})

const diagram = (): DiagramStyle => ({
  visible: true,
  background: '#10161d',
  opacity: 0.94,
  blur: 8,
  borderOpacity: 0.35,
  shadow: 'soft',
  radius: 12,
  padding: 16,
  nodeBackground: '#26313a',
  nodeBorder: '#6d8794',
  nodeText: 'auto',
  connector: '#91aab2',
  emphasis: '#9ab96a',
})

const previewTheme: ThemeRecord = {
  id: 'preview-bamboo-skylight',
  name: '竹影天光',
  version: '1.3.4',
  appearance: 'dark',
  accent: '#9ab96a',
  levelSlider: {
    enabled: true,
    levelColors: ['#8fbc8f', '#9ab96a', '#bdd88b', '#e0c77b', '#d98c74'],
    thumbColor: '#f1f4ef',
  },
  art: {
    focusX: 0.35,
    focusY: 0.48,
    safeArea: 'left',
    taskMode: 'ambient',
  },
  composer: {
    background: 'auto',
    opacity: 0.84,
    blur: 14,
    borderOpacity: 0.35,
    shadow: 'soft',
    showFooterBackdrop: true,
    radius: 14,
    placeholderColor: 'auto',
    controlColor: 'auto',
    controlOpacity: 0.78,
    controlRadius: 9,
    primaryActionColor: 'auto',
    primaryActionText: 'auto',
  },
  environment: surface(),
  changeSummary: surface(),
  tokens: {
    textPrimary: 'auto',
    textSecondary: 'auto',
    textMuted: 'auto',
    textDisabled: 'auto',
    textInverse: 'auto',
    border: 'auto',
    focusRing: 'auto',
    success: 'auto',
    warning: 'auto',
    danger: 'auto',
  },
  ui: {
    sidebar: surface(),
    header: surface(),
    userBubble: surface(),
    codeBlock: surface('#121820'),
    activityCard: surface(),
    diagram: diagram(),
    homeWelcome: {
      iconVisible: true,
      titleVisible: true,
    },
    homeSuggestions: surface(),
    overlays: surface(),
    threadRows: rows(),
    summaryRows: rows(),
    navigationRailVisible: true,
    navigationRailOpacity: 0.64,
    scrollbar: {
      visible: true,
      color: 'auto',
      opacity: 0.72,
      width: 8,
      radius: 8,
    },
    diff: {
      visible: true,
      background: 'auto',
      opacity: 0.14,
      hoverOpacity: 0.22,
      addedColor: '#63a85d',
      deletedColor: '#d66c6c',
      radius: 8,
    },
    content: {
      maxWidth: 760,
      fontScale: 1,
      messageGap: 16,
    },
    richText: {
      linkColor: 'auto',
      inlineCodeBackground: 'auto',
      inlineCodeOpacity: 0.72,
      inlineCodeRadius: 6,
      quoteAccent: 'auto',
      quoteBackground: 'auto',
      quoteOpacity: 0.58,
      tableBorder: 'auto',
      tableBackground: 'auto',
      tableOpacity: 0.72,
      tableRadius: 8,
      imageRadius: 12,
    },
  },
  backgroundKind: 'image',
  previewDataUrl: '/src-tauri/assets/preset-bamboo-skylight.jpg',
  builtIn: true,
}

const previewWilderness: ThemeRecord = {
  ...previewTheme,
  id: 'preview-wilderness',
  name: '旷野',
  appearance: 'light',
  accent: '#7f9e65',
  backgroundKind: 'video',
  previewDataUrl: '/docs/screenshots/wilderness-codex-app.gif',
  art: {
    ...previewTheme.art,
    focusX: 0.68,
    safeArea: 'right',
  },
}

export const isBrowserPreview = typeof window !== 'undefined'
  && import.meta.env.DEV
  && new URLSearchParams(window.location.search).has('preview')

export const browserPreviewDashboard: Dashboard = {
  platform: 'desktop',
  codexFound: true,
  codexVersion: '0.3.8',
  mode: 'active',
  activeThemeId: previewTheme.id,
  port: 5164,
  message: '已连接到 Codex 本地引擎',
  autostartEnabled: true,
  launchCodexOnOpen: true,
  modelPickerLayout: 'native',
  themes: [previewTheme, previewWilderness],
}
