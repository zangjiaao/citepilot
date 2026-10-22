import { asStringArray, extractJson } from '../shared/json.ts'
import { brandAliases } from '../shared/parseAnswer.ts'
import { isCluster, normalizeQuestion } from '../shared/prompts.ts'
import type { GeneratedPrompt, Studio } from '../shared/types.ts'
import type { AppBindings } from './env.ts'
import { llmConfig } from './env.ts'

export async function deepseekJson(env: AppBindings, system: string, user: string, temperature: number): Promise<unknown> {
  const config = llmConfig(env)
  if (!config.enabled) throw new Error('未配置 DeepSeek API key')
  let response: Response
  try {
    response = await fetch(config.completionsUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(25_000),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ message: 'deepseek request failed', error: message }))
    throw new Error('DeepSeek 请求没有完成')
  }
  if (!response.ok) {
    console.error(JSON.stringify({ message: 'deepseek status', status: response.status }))
    throw new Error(`DeepSeek 返回 HTTP ${response.status}`)
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek 没有返回内容')
  return extractJson(content)
}

export function acceptGeneratedPrompts(studio: Studio, existing: string[], raw: unknown): GeneratedPrompt[] {
  if (!raw || typeof raw !== 'object') return []
  const prompts = (raw as { prompts?: unknown }).prompts
  if (!Array.isArray(prompts)) return []
  const seen = new Set(existing.map(normalizeQuestion))
  const aliases = brandAliases(studio.name)
  const accepted: GeneratedPrompt[] = []
  for (const entry of prompts) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const cluster = typeof record.cluster === 'string' ? record.cluster : ''
    const text = typeof record.text === 'string' ? record.text.trim() : ''
    const rationale = typeof record.rationale === 'string' ? record.rationale.trim().slice(0, 200) : ''
    if (!isCluster(cluster) || text.length < 8 || text.length > 200) continue
    const key = normalizeQuestion(text)
    if (seen.has(key)) continue
    const mentionsBrand = aliases.some((alias) => text.includes(alias))
    if ((cluster === 'brand' || cluster === 'comparison') && !mentionsBrand) continue
    if (cluster === 'category' && mentionsBrand) continue
    seen.add(key)
    accepted.push({ cluster, text, rationale })
    if (accepted.length >= 8) break
  }
  return accepted
}

export function acceptSummary(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const summary = (raw as { summary?: unknown }).summary
  if (typeof summary !== 'string') return null
  const trimmed = summary.trim()
  if (trimmed.length < 8 || trimmed.length > 400) return null
  return trimmed
}

export function acceptOwnSentiment(raw: unknown): 'positive' | 'neutral' | 'negative' | null {
  if (!raw || typeof raw !== 'object') return null
  const sentiment = (raw as { sentiment?: unknown }).sentiment
  if (sentiment === 'positive' || sentiment === 'neutral' || sentiment === 'negative') return sentiment
  return null
}

export function acceptSuggestions(raw: unknown): string[] | null {
  if (!raw || typeof raw !== 'object') return null
  const list = asStringArray((raw as { suggestions?: unknown }).suggestions).map((item) => item.slice(0, 240))
  if (list.length < 3) return null
  return list.slice(0, 8)
}
