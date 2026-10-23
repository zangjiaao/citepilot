import { callConfig, maskApiKey, pickConfigId, providerLabel, type LlmCallConfig, type LlmTask } from '../shared/llmProviders.ts'
import type { AppBindings } from './env.ts'
import { llmConfig } from './env.ts'
import { getLlmConfig, getLlmSettings, listLlmConfigs, type StoredLlmConfig } from './db.ts'

export interface PublicLlmTask {
  enabled: boolean
  model: string
  label: string
  provider: string
  source: 'saved' | 'env' | 'none'
}

export interface PublicLlmStatus {
  enabled: boolean
  model: string
  baseUrl: string
  provider: string
  label: string
  source: 'saved' | 'env' | 'none'
  generate: PublicLlmTask
  analyze: PublicLlmTask
}

export interface ResolvedLlm extends LlmCallConfig {
  enabled: boolean
  source: 'saved' | 'env' | 'none'
  label: string
  provider: string
}

export function publicConfig(config: StoredLlmConfig) {
  return {
    id: config.id,
    label: config.label,
    provider: config.provider,
    providerLabel: providerLabel(config.provider),
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    isDefault: config.isDefault,
    keyHint: maskApiKey(config.apiKey),
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  }
}

export async function resolveLlm(db: D1Database, env: AppBindings, task: LlmTask): Promise<ResolvedLlm> {
  const [configs, settings] = await Promise.all([listLlmConfigs(db), getLlmSettings(db)])
  const id = pickConfigId(
    configs.map((item) => ({ id: item.id, isDefault: item.isDefault })),
    settings,
    task,
  )
  const saved = id ? configs.find((item) => item.id === id) : undefined
  if (saved?.apiKey) {
    return {
      enabled: true,
      source: 'saved',
      label: saved.label,
      provider: providerLabel(saved.provider),
      ...callConfig(saved.baseUrl, saved.model, saved.apiKey, saved.temperature, saved.maxTokens),
    }
  }
  const fallback = llmConfig(env)
  if (fallback.enabled) {
    return {
      enabled: true,
      source: 'env',
      label: 'DeepSeek（环境变量）',
      provider: 'DeepSeek',
      apiKey: fallback.apiKey,
      baseUrl: fallback.baseUrl,
      model: fallback.model,
      completionsUrl: fallback.completionsUrl,
      temperature: null,
      maxTokens: null,
    }
  }
  return {
    enabled: false,
    source: 'none',
    label: '',
    provider: '',
    apiKey: '',
    baseUrl: '',
    model: '',
    completionsUrl: '',
    temperature: null,
    maxTokens: null,
  }
}

export async function llmStatus(db: D1Database, env: AppBindings): Promise<PublicLlmStatus> {
  const [generate, analyze] = await Promise.all([resolveLlm(db, env, 'generate'), resolveLlm(db, env, 'analyze')])
  const primary = generate.enabled ? generate : analyze
  return {
    enabled: generate.enabled || analyze.enabled,
    model: primary.model,
    baseUrl: primary.baseUrl,
    provider: primary.provider,
    label: primary.label,
    source: primary.source,
    generate: taskView(generate),
    analyze: taskView(analyze),
  }
}

export async function configForTest(db: D1Database, id: string, apiKey: string | undefined): Promise<LlmCallConfig | null> {
  const stored = await getLlmConfig(db, id)
  if (!stored) return null
  const key = apiKey && !apiKey.startsWith('已保存') ? apiKey : stored.apiKey
  return callConfig(stored.baseUrl, stored.model, key, stored.temperature, stored.maxTokens)
}

function taskView(resolved: ResolvedLlm): PublicLlmTask {
  return {
    enabled: resolved.enabled,
    model: resolved.model,
    label: resolved.label,
    provider: resolved.provider,
    source: resolved.source,
  }
}
