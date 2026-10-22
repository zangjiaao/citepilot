import { completionsUrl } from '../shared/json.ts'

export type AppBindings = Env & {
  DEEPSEEK_API_KEY?: string
  OPENAI_API_KEY?: string
}

export interface LlmConfig {
  enabled: boolean
  apiKey: string
  baseUrl: string
  model: string
  completionsUrl: string
}

export function llmConfig(env: AppBindings): LlmConfig {
  const apiKey = env.DEEPSEEK_API_KEY?.trim() || env.OPENAI_API_KEY?.trim() || ''
  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').trim()
  const model = (env.DEEPSEEK_MODEL || 'deepseek-chat').trim()
  return {
    enabled: apiKey.length > 0,
    apiKey,
    baseUrl,
    model,
    completionsUrl: completionsUrl(baseUrl),
  }
}
