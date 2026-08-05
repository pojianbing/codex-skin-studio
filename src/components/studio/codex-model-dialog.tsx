import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AlertTriangle, Bot, CheckCircle2, KeyRound, LoaderCircle, Network, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  type CodexModelMode,
  type CodexModelsStatus,
  type ConfigureCodexModelsRequest,
  type ConfigureCodexModelsResult,
} from '@/lib/theme-types'

type CodexModelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: (result: ConfigureCodexModelsResult) => void
}

const fieldClassName = 'mt-1.5 h-8 w-full rounded-md border border-zinc-800 bg-zinc-950/70 px-2.5 text-xs text-zinc-100 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20'

export function CodexModelDialog({ open, onOpenChange, onApplied }: CodexModelDialogProps) {
  const [status, setStatus] = useState<CodexModelsStatus>()
  const [mode, setMode] = useState<CodexModelMode>('mixed')
  const [includePro, setIncludePro] = useState(false)
  const [selectedModel, setSelectedModel] = useState('deepseek-v4-flash')
  const [apiKeyEnv, setApiKeyEnv] = useState('DEEPSEEK_API_KEY')
  const [useCurrentProvider, setUseCurrentProvider] = useState(true)
  const [routerProviderId, setRouterProviderId] = useState('codex-skin-router')
  const [routerBaseUrl, setRouterBaseUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const next = await invoke<CodexModelsStatus>('get_codex_models_status')
      setStatus(next)
      if (!next.currentProvider) setUseCurrentProvider(false)
    } catch (error) {
      toast.error(String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void loadStatus()
  }, [open])

  const apply = async () => {
    if (mode === 'mixed' && !useCurrentProvider && !routerBaseUrl.trim()) {
      toast.error('请填写 Responses 路由地址')
      return
    }
    setApplying(true)
    const request: ConfigureCodexModelsRequest = {
      mode,
      includePro,
      apiKeyEnv: apiKeyEnv.trim() || 'DEEPSEEK_API_KEY',
      useCurrentProvider,
      routerProviderId: routerProviderId.trim() || 'codex-skin-router',
      routerBaseUrl: routerBaseUrl.trim(),
      selectedModel,
    }
    try {
      const result = await invoke<ConfigureCodexModelsResult>('configure_codex_models', { request })
      onApplied(result)
      onOpenChange(false)
    } catch (error) {
      toast.error(String(error))
    } finally {
      setApplying(false)
    }
  }

  const modelOptions = includePro
    ? [['deepseek-v4-flash', 'DeepSeek-V4-Flash'], ['deepseek-v4-pro', 'DeepSeek-V4-Pro']]
    : [['deepseek-v4-flash', 'DeepSeek-V4-Flash']]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="studio-dialog max-w-lg border-zinc-800 bg-zinc-950 p-0 text-zinc-100">
        <DialogHeader className="gap-2 border-b border-zinc-800 px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-zinc-50">
            <Bot className="size-5 text-emerald-400" />
            Codex 模型接入
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-zinc-400">
            合并模型目录并写入 Codex 用户配置。API Key 只从本机环境变量读取，不会写入 Skin Studio。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(68vh,560px)] space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex items-start justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-100">当前 Codex 配置</p>
                <p className="mt-1 truncate text-[11px] text-zinc-500" title={status?.configPath}>
                  {loading ? '正在读取…' : status?.configPath ?? '未找到 config.toml'}
                </p>
                {status && (
                  <p className="mt-1 text-[11px] text-zinc-400">
                    GPT {status.gptModelCount} 个 · DeepSeek {status.deepseekModelCount} 个
                    {status.currentProvider ? ` · provider: ${status.currentProvider}` : ''}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              title="刷新配置状态"
              aria-label="刷新配置状态"
              onClick={() => void loadStatus()}
              disabled={loading || applying}
            >
              <RefreshCw className={loading ? 'animate-spin' : undefined} />
            </Button>
          </div>

          <label className="block text-xs font-medium text-zinc-200">
            接入方式
            <Select value={mode} onValueChange={(value) => setMode(value as CodexModelMode)}>
              <SelectTrigger className="mt-1.5 h-8 w-full border-zinc-800 bg-zinc-900 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mixed">混合模型：保留 GPT，追加 DeepSeek</SelectItem>
                <SelectItem value="deepseek">DeepSeek 独立 provider</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            <label className="block text-xs font-medium text-zinc-200">
              默认模型
              <Select
                value={selectedModel}
                onValueChange={(value) => {
                  if (value) setSelectedModel(value)
                }}
              >
                <SelectTrigger className="mt-1.5 h-8 w-full border-zinc-800 bg-zinc-900 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex h-8 items-center justify-between gap-3 self-end rounded-md border border-zinc-800 bg-zinc-900/70 px-2.5 text-xs text-zinc-200">
              <span>加入 V4-Pro</span>
              <Switch
                checked={includePro}
                onCheckedChange={(checked) => {
                  setIncludePro(checked)
                  if (!checked && selectedModel === 'deepseek-v4-pro') setSelectedModel('deepseek-v4-flash')
                }}
                disabled={applying}
                aria-label="加入 DeepSeek V4 Pro"
              />
            </label>
          </div>

          {mode === 'mixed' ? (
            <div className="space-y-3 rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
              <div className="flex items-start gap-2">
                <Network className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <p className="text-[11px] leading-relaxed text-amber-100/80">
                  混合列表只负责声明模型。当前 Responses provider 必须能按 model 字段把 GPT 和 DeepSeek 路由到不同上游。
                </p>
              </div>
              <label className="flex items-center justify-between gap-3 text-xs text-zinc-200">
                <span>复用当前 provider{status?.currentProvider ? `（${status.currentProvider}）` : ''}</span>
                <Switch
                  checked={useCurrentProvider}
                  onCheckedChange={setUseCurrentProvider}
                  disabled={applying || !status?.currentProvider}
                  aria-label="复用当前 provider"
                />
              </label>
              {!useCurrentProvider && (
                <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
                  <label className="block text-xs text-zinc-300">
                    provider ID
                    <input
                      className={fieldClassName}
                      value={routerProviderId}
                      onChange={(event) => setRouterProviderId(event.target.value)}
                      spellCheck={false}
                      autoCapitalize="none"
                    />
                  </label>
                  <label className="block text-xs text-zinc-300">
                    Responses 路由地址
                    <input
                      className={fieldClassName}
                      value={routerBaseUrl}
                      onChange={(event) => setRouterBaseUrl(event.target.value)}
                      placeholder="http://127.0.0.1:8787/v1"
                      spellCheck={false}
                      autoCapitalize="none"
                    />
                  </label>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-3">
              <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <p className="text-[11px] leading-relaxed text-emerald-100/80">
                  需要先在系统环境变量中设置 DeepSeek API Key；本工具只把变量名写入 Codex 配置。
                </p>
              </div>
              <label className="block text-xs text-zinc-300">
                API Key 环境变量名
                <input
                  className={fieldClassName}
                  value={apiKeyEnv}
                  onChange={(event) => setApiKeyEnv(event.target.value)}
                  spellCheck={false}
                  autoCapitalize="none"
                />
              </label>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-zinc-800 bg-zinc-900/30 p-3 text-[11px] leading-relaxed text-zinc-500">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <span>应用后需要完全退出并重新打开 Codex。现有 config.toml 和模型目录会先生成备份。</span>
          </div>
        </div>

        <DialogFooter className="border-zinc-800 bg-zinc-900/50 px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            取消
          </Button>
          <Button onClick={() => void apply()} disabled={applying || loading}>
            {applying ? <LoaderCircle className="animate-spin" /> : <Bot />}
            写入 Codex 配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
