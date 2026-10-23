import { asStringArray, extractJson } from '../shared/json.ts'
import type { LlmCallConfig } from '../shared/llmProviders.ts'
import { brandAliases } from '../shared/parseAnswer.ts'
import { isCluster, normalizeQuestion } from '../shared/prompts.ts'
import type { GeneratedPrompt, Studio } from '../shared/types.ts'

export async function completeJson(config: LlmCallConfig, system: string, user: string, fallbackTemperature: number): Promise<unknown> {
  if (!config.apiKey) throw new Error('还没有配置模型密钥')
  const temperature = config.temperature ?? fallbackTemperature
  const body: Record<string, unknown> = {
    model: config.model,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (config.maxTokens) body.max_tokens = config.maxTokens
  let response: Response
  try {
    response = await postChat(config, { ...body, response_format: { type: 'json_object' } })
    if (response.status === 400) response = await postChat(config, body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ message: 'llm request failed', error: message }))
    throw new Error('模型请求没有完成')
  }
  if (!response.ok) {
    console.error(JSON.stringify({ message: 'llm status', status: response.status, model: config.model }))
    throw new Error(`模型返回 HTTP ${response.status}`)
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('模型没有返回内容')
  return extractJson(content)
}

export async function testLlmConnection(config: LlmCallConfig): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  try {
    const response = await postChat(config, {
      model: config.model,
      temperature: 0,
      max_tokens: 16,
      messages: [{ role: 'user', content: '只回复一个字：好' }],
    })
    if (!response.ok) return { ok: false, error: `模型返回 HTTP ${response.status}` }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const reply = payload.choices?.[0]?.message?.content?.trim() ?? ''
    if (!reply) return { ok: false, error: '模型没有返回内容' }
    return { ok: true, reply: reply.slice(0, 80) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ message: 'llm test failed', error: message }))
    return { ok: false, error: '模型请求没有完成' }
  }
}

async function postChat(config: LlmCallConfig, body: unknown): Promise<Response> {
  return fetch(config.completionsUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  })
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
