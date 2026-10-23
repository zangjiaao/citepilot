import { completionsUrl, responsesUrl } from './json.ts'
import { assertPublicHttpUrl } from './ssrf.ts'

export const LLM_PRESETS = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'qwen', label: '通义千问 / DashScope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'moonshot', label: 'Moonshot / Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { id: 'zhipu', label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { id: 'doubao', label: '豆包 / 火山方舟', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { id: 'custom', label: '自定义 OpenAI 兼容', baseUrl: '', model: '' },
] as const

export type LlmProviderId = (typeof LLM_PRESETS)[number]['id']
export type LlmTask = 'generate' | 'analyze'
export type LlmApiStyle = 'chat' | 'responses'

export const LLM_API_STYLES = [
  { id: 'chat', label: '对话补全（Chat Completions）' },
  { id: 'responses', label: 'Responses API' },
] as const

export interface LlmConfigChoice {
  id: string
  isDefault: boolean
}

export interface LlmTaskSettings {
  generateConfigId: string
  analyzeConfigId: string
}

export interface LlmCallConfig {
  apiKey: string
  baseUrl: string
  model: string
  apiStyle: LlmApiStyle
  completionsUrl: string
  temperature: number | null
  maxTokens: number | null
}

const PROVIDER_IDS = new Set<string>(LLM_PRESETS.map((item) => item.id))

export function isLlmProvider(value: string): value is LlmProviderId {
  return PROVIDER_IDS.has(value)
}

export function providerLabel(id: string): string {
  return LLM_PRESETS.find((item) => item.id === id)?.label ?? id
}

export function isLlmApiStyle(value: string): value is LlmApiStyle {
  return value === 'chat' || value === 'responses'
}

export function apiStyleLabel(style: string): string {
  return LLM_API_STYLES.find((item) => item.id === style)?.label ?? '对话补全（Chat Completions）'
}

export function apiStyleHint(style: LlmApiStyle): string {
  if (style === 'responses') {
    return '填到 /v1 或 /ai/v1 为止，请求会发到 /responses。Cloudflare 统一计费用 https://api.cloudflare.com/client/v4/accounts/账户ID/ai/v1 ，模型 ID 例如 openai/gpt-5.6-sol。'
  }
  return '填到服务商根地址或 /v1、/ai/v1 为止，请求会发到 /chat/completions。DeepSeek 用 https://api.deepseek.com 。Cloudflare 对话补全同样用 …/ai/v1 。'
}

export function maskApiKey(key: string): string {
  const trimmed = key.trim()
  if (!trimmed) return ''
  const tail = trimmed.slice(-4)
  return `已保存 ····${tail}`
}

export function keepsStoredKey(input: string | undefined): boolean {
  if (input === undefined) return true
  const trimmed = input.trim()
  if (!trimmed) return true
  return trimmed.startsWith('已保存')
}

export function pickConfigId(configs: LlmConfigChoice[], settings: LlmTaskSettings, task: LlmTask): string | null {
  const specific = task === 'generate' ? settings.generateConfigId : settings.analyzeConfigId
  if (specific && configs.some((item) => item.id === specific)) return specific
  return configs.find((item) => item.isDefault)?.id ?? null
}

export interface LlmDraftInput {
  label: string
  provider: string
  baseUrl: string
  model: string
  apiStyle: LlmApiStyle
  apiKey?: string
  temperature: number | null
  maxTokens: number | null
  isDefault: boolean
}

export type LlmDraftResult = { ok: true; value: LlmDraftInput } | { ok: false; field: string; error: string }

export function parseLlmDraft(input: unknown, options: { requireKey: boolean }): LlmDraftResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, field: 'label', error: '模型配置格式不正确' }
  }
  const record = input as Record<string, unknown>
  const label = typeof record.label === 'string' ? record.label.trim() : ''
  const provider = typeof record.provider === 'string' ? record.provider.trim() : ''
  const baseUrl = typeof record.baseUrl === 'string' ? record.baseUrl.trim() : ''
  const model = typeof record.model === 'string' ? record.model.trim() : ''
  const apiKey = typeof record.apiKey === 'string' ? record.apiKey.trim() : undefined
  if (label.length < 1 || label.length > 40) return { ok: false, field: 'label', error: '配置名称需要 1 到 40 个字' }
  if (!isLlmProvider(provider)) return { ok: false, field: 'provider', error: '不认识这个模型服务商' }
  if (model.length < 1 || model.length > 120) return { ok: false, field: 'model', error: '模型 ID 需要 1 到 120 个字符' }
  let parsedUrl: URL
  try {
    parsedUrl = assertPublicHttpUrl(baseUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : '接口地址不正确'
    return { ok: false, field: 'baseUrl', error: message }
  }
  if (parsedUrl.protocol !== 'https:') return { ok: false, field: 'baseUrl', error: '模型接口只允许 https' }
  if (options.requireKey && (!apiKey || keepsStoredKey(apiKey))) {
    return { ok: false, field: 'apiKey', error: '请填写 API 密钥' }
  }
  if (apiKey && !keepsStoredKey(apiKey) && (apiKey.length < 8 || apiKey.length > 500)) {
    return { ok: false, field: 'apiKey', error: 'API 密钥长度看起来不对' }
  }
  const apiStyle = readApiStyle(record.apiStyle)
  if (!apiStyle.ok) return apiStyle
  const temperature = optionalNumber(record.temperature, 'temperature', 0, 2)
  if (!temperature.ok) return temperature
  const maxTokens = optionalInt(record.maxTokens, 'maxTokens', 1, 128000)
  if (!maxTokens.ok) return maxTokens
  return {
    ok: true,
    value: {
      label,
      provider,
      baseUrl: parsedUrl.toString().replace(/\/$/, ''),
      model,
      apiStyle: apiStyle.value,
      apiKey,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      isDefault: record.isDefault === true,
    },
  }
}

function readApiStyle(value: unknown): { ok: true; value: LlmApiStyle } | { ok: false; field: string; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: 'chat' }
  if (typeof value === 'string' && isLlmApiStyle(value)) return { ok: true, value }
  return { ok: false, field: 'apiStyle', error: '接口类型只能是对话补全或 Responses API' }
}

export function callConfig(
  baseUrl: string,
  model: string,
  apiKey: string,
  temperature: number | null,
  maxTokens: number | null,
  apiStyle: LlmApiStyle = 'chat',
): LlmCallConfig {
  return {
    apiKey,
    baseUrl,
    model,
    apiStyle,
    completionsUrl: apiStyle === 'responses' ? responsesUrl(baseUrl) : completionsUrl(baseUrl),
    temperature,
    maxTokens,
  }
}

function optionalNumber(
  value: unknown,
  field: string,
  min: number,
  max: number,
): { ok: true; value: number | null } | { ok: false; field: string; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number < min || number > max) {
    return { ok: false, field, error: `温度需要在 ${min} 到 ${max} 之间` }
  }
  return { ok: true, value: number }
}

function optionalInt(
  value: unknown,
  field: string,
  min: number,
  max: number,
): { ok: true; value: number | null } | { ok: false; field: string; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    return { ok: false, field, error: `最大输出需要是 ${min} 到 ${max} 的整数` }
  }
  return { ok: true, value: number }
}
