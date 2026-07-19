export type ElementTab = 'shell' | 'components' | 'styles'

export const previewElementMeta = {
  canvas: { tab: 'shell', label: '画布与焦点' },
  composer: { tab: 'shell', label: '输入框' },
  environment: { tab: 'shell', label: '环境面板' },
  changeSummary: { tab: 'shell', label: '变更摘要' },
  sidebar: { tab: 'shell', label: '左侧边栏' },
  header: { tab: 'shell', label: '顶部标题栏' },
  content: { tab: 'shell', label: '正文布局' },
  userBubble: { tab: 'components', label: '用户消息气泡' },
  codeBlock: { tab: 'components', label: '代码块' },
  activityCard: { tab: 'components', label: '工具活动卡片' },
  overlays: { tab: 'components', label: '弹层与菜单' },
  levelSlider: { tab: 'components', label: '级别滑块' },
  threadRows: { tab: 'components', label: '任务列表行' },
  homeSuggestions: { tab: 'components', label: '主页建议卡片' },
  summaryRows: { tab: 'components', label: '环境面板项目' },
  navigation: { tab: 'styles', label: '导航轨与滚动条' },
  diff: { tab: 'styles', label: 'Diff 文件行' },
  richText: { tab: 'styles', label: '富文本内容' },
  tokens: { tab: 'styles', label: '语义文字与状态' },
} as const satisfies Record<string, { tab: ElementTab; label: string }>

export type PreviewElementId = keyof typeof previewElementMeta
