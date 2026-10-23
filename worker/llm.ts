import { asStringArray, completionsUrl, extractJson, responsesUrl } from '../shared/json.ts'
import type { LlmCallConfig } from '../shared/llmProviders.ts'
import { brandAliases } from '../shared/parseAnswer.ts'
import { isCluster, normalizeQuestion } from '../shared/prompts.ts'
import type { GeneratedPrompt, Studio } from '../shared/types.ts'

/** 起草和其它 JSON 补全。连接测试用更短的 LLM_TEST_TIMEOUT_MS。 */
export const LLM_GENERATE_TIMEOUT_MS = 90_000
export const LLM_TEST_TIMEOUT_MS = 25_000

/**
 * 连接探测的补全上限。
 * 推理模型会先把 token 花在 reasoning 上，上限太小会让可见 content 为空。
 * 起草仍使用配置里的 maxTokens，不受这个探测上限影响。
 * MiniMax 在 Cloudflare 统一计费上即使用 512 或 2048，非流式仍会 500；
 * 对话补全改为流式后再拼回全文，见 requestBody。
 */
export const LLM_TEST_MAX_TOKENS = 512

export const DRAFT_TEMPLATE_WARNING = '模型这次没有写成完整稿，下面是按素材整理的底稿，不是终稿。可以再点一次生成。'

export function draftModelWarning(error: unknown): string {
  const detail = failureText(error).replace(/[。！？]+$/u, '')
  if (!detail) return DRAFT_TEMPLATE_WARNING
  return `${detail}。${DRAFT_TEMPLATE_WARNING}`
}

export async function completeJson(config: LlmCallConfig, system: string, user: string, fallbackTemperature: number): Promise<unknown> {
  if (!config.apiKey) throw new Error('还没有配置模型密钥')
  const temperature = config.temperature ?? fallbackTemperature
  const response = await postCompletion(config, LLM_GENERATE_TIMEOUT_MS, (mode, dropTemperature) =>
    requestBody(config, system, user, temperature, mode, dropTemperature, config.maxTokens),
  )
  if (!response.ok) {
    const detail = await providerErrorDetail(response)
    console.error(JSON.stringify({ message: 'llm status', status: response.status, model: config.model, detail }))
    throw new Error(httpFailure(response.status, detail))
  }
  const payload = await readPayload(response)
  const content = readModelText(payload)
  if (!content) throw new Error(terminalError(payload) || providerMessage(payload) || '模型没有返回内容')
  return extractJson(content)
}

export async function testLlmConnection(config: LlmCallConfig): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  try {
    const response = await postJson(
      requestUrl(config),
      config.apiKey,
      probeBody(config),
      LLM_TEST_TIMEOUT_MS,
    )
    if (!response.ok) {
      const detail = await providerErrorDetail(response)
      return { ok: false, error: httpFailure(response.status, detail) }
    }
    const payload = await readPayload(response)
    const reply = readModelText(payload).trim()
    if (!reply) return { ok: false, error: terminalError(payload) || providerMessage(payload) || '模型没有返回内容' }
    return { ok: true, reply: reply.slice(0, 80) }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ message: 'llm test failed', error: detail }))
    return { ok: false, error: isTimeoutError(error) ? '模型请求超时' : '模型请求没有完成' }
  }
}

async function postCompletion(
  config: LlmCallConfig,
  timeoutMs: number,
  build: (mode: 'json' | 'plain', dropTemperature: boolean) => Record<string, unknown>,
): Promise<Response> {
  const url = requestUrl(config)
  try {
    const response = await postJson(url, config.apiKey, build('json', false), timeoutMs)
    if (response.ok) return response
    const detail = await providerErrorDetail(response)
    console.error(JSON.stringify({ message: 'llm json mode rejected', status: response.status, model: config.model, detail }))
    const dropTemperature = config.apiStyle === 'responses' && /temperature/i.test(detail)
    return postJson(url, config.apiKey, build('plain', dropTemperature), timeoutMs)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ message: 'llm request failed', error: detail }))
    throw new Error(isTimeoutError(error) ? '模型请求超时' : '模型请求没有完成')
  }
}

function requestUrl(config: LlmCallConfig): string {
  return config.apiStyle === 'responses' ? responsesUrl(config.baseUrl) : completionsUrl(config.baseUrl)
}

function probeBody(config: LlmCallConfig): Record<string, unknown> {
  const body = requestBody(config, '', '只回复一个字：好', 0, 'plain', config.apiStyle === 'responses', LLM_TEST_MAX_TOKENS)
  // Cloudflare MiniMax 的 /chat/completions 示例用 max_tokens，Workers AI 示例用 max_completion_tokens。
  // 探测两个都带上，避免只认其中一个字段时预算失效。其它服务商不带 max_completion_tokens：
  // OpenAI 同时收到两个字段会 400，DeepSeek 只执行 max_tokens。
  if (config.apiStyle !== 'responses' && /minimax/i.test(config.model)) {
    body.max_completion_tokens = LLM_TEST_MAX_TOKENS
  }
  return body
}

function requestBody(
  config: LlmCallConfig,
  system: string,
  user: string,
  temperature: number,
  mode: 'json' | 'plain',
  dropTemperature: boolean,
  maxTokens: number | null,
): Record<string, unknown> {
  if (config.apiStyle === 'responses') {
    const input = system ? [{ role: 'system', content: system }, { role: 'user', content: user }] : [{ role: 'user', content: user }]
    const body: Record<string, unknown> = { model: config.model, input }
    if (!dropTemperature && config.temperature !== null) body.temperature = config.temperature
    if (maxTokens) body.max_output_tokens = maxTokens
    if (mode === 'json') body.text = { format: { type: 'json_object' } }
    return body
  }
  const body: Record<string, unknown> = {
    model: config.model,
    temperature,
    // Cloudflare 对 MiniMax（minimax/m2.7、minimax/m3）的非流式转换会 500：
    // Response conversion failed: Input is undefined or empty。流式不走这个转换。
    // 其它 OpenAI 兼容接口同样带上 stream；若仍返回 JSON，按非流式解析。
    stream: true,
    messages: system
      ? [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ]
      : [{ role: 'user', content: user }],
  }
  if (maxTokens) body.max_tokens = maxTokens
  if (mode === 'json') body.response_format = { type: 'json_object' }
  return body
}

function httpFailure(status: number, detail: string): string {
  return detail ? `模型返回 HTTP ${status}：${detail}` : `模型返回 HTTP ${status}`
}

async function postJson(url: string, apiKey: string, body: unknown, timeoutMs: number): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
}

function failureText(error: unknown): string {
  if (isTimeoutError(error)) return '模型请求超时'
  if (error instanceof Error) return error.message.trim()
  if (typeof error === 'string') return error.trim()
  return ''
}

function isTimeoutError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 3) return false
  const record = error as { name?: unknown; message?: unknown; cause?: unknown }
  const name = typeof record.name === 'string' ? record.name : ''
  const message = typeof record.message === 'string' ? record.message : ''
  if (name === 'TimeoutError') return true
  if (/operation was aborted due to timeout/i.test(message)) return true
  if ((name === 'AbortError' || name === 'DOMException') && /timeout/i.test(message)) return true
  return isTimeoutError(record.cause, depth + 1)
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (isEventStream(response, text)) return aggregateChatStream(text)
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('模型没有返回可解析的 JSON')
  }
}

function isEventStream(response: Response, text: string): boolean {
  const trimmed = text.trimStart().replace(/^\uFEFF/, '')
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return false
  const type = response.headers.get('content-type') ?? ''
  if (type.includes('text/event-stream')) return true
  return trimmed.startsWith('data:') || trimmed.startsWith('event:') || trimmed.startsWith(':')
}

/**
 * 把对话补全 SSE 拼成一条 assistant 文本。
 * 有完整 message.content 时用它；否则按顺序拼接 delta.content。
 * reasoning_content 是推理过程，不计入回复。
 */
function aggregateChatStream(text: string): unknown {
  const deltas: string[] = []
  let finalContent = ''
  let error = ''
  for (const data of sseDataPayloads(text)) {
    if (!data || data === '[DONE]') continue
    let payload: unknown
    try {
      payload = JSON.parse(data) as unknown
    } catch {
      continue
    }
    const message = providerMessage(payload)
    if (message) error = message
    const piece = chatStreamPiece(payload)
    if (piece.final) finalContent = piece.final
    if (piece.delta) deltas.push(piece.delta)
  }
  const content = finalContent || deltas.join('')
  if (content) return { choices: [{ message: { content } }] }
  if (error) return { error: { message: error } }
  return { choices: [{ message: { content: '' } }] }
}

function chatStreamPiece(payload: unknown): { final: string; delta: string } {
  if (!payload || typeof payload !== 'object') return { final: '', delta: '' }
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') {
    return { final: readModelText(payload), delta: '' }
  }
  const choice = choices[0] as { message?: { content?: unknown }; delta?: { content?: unknown } }
  return {
    final: textContent(choice.message?.content),
    delta: textContent(choice.delta?.content),
  }
}

function textContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const part of content) {
    if (typeof part === 'string') {
      parts.push(part)
      continue
    }
    if (!part || typeof part !== 'object') continue
    const text = (part as { text?: unknown }).text
    if (typeof text === 'string') parts.push(text)
  }
  return parts.join('')
}

function sseDataPayloads(text: string): string[] {
  const payloads: string[] = []
  let dataLines: string[] = []
  const flush = () => {
    if (dataLines.length === 0) return
    payloads.push(dataLines.join('\n').trim())
    dataLines = []
  }
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (const line of normalized.split('\n')) {
    if (line === '') {
      flush()
      continue
    }
    if (line.startsWith(':')) continue
    if (!line.startsWith('data:')) continue
    const value = line.slice(5).replace(/^ /, '')
    if (dataLines.length === 1 && isStandaloneSseData(dataLines[0])) flush()
    dataLines.push(value)
  }
  flush()
  return payloads
}

function isStandaloneSseData(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '[DONE]') return true
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

export function readModelText(payload: unknown): string {
  const chat = chatContent(payload)
  if (chat) return chat
  return responsesContent(payload)
}

function chatContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return ''
  const first = choices[0]
  if (!first || typeof first !== 'object') return ''
  const content = (first as { message?: { content?: unknown } }).message?.content
  return typeof content === 'string' ? content : ''
}

function responsesContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const record = payload as { output_text?: unknown; output?: unknown }
  if (!Array.isArray(record.output)) {
    return typeof record.output_text === 'string' ? record.output_text : ''
  }
  const parts: string[] = []
  for (const item of record.output) {
    if (!item || typeof item !== 'object') continue
    const output = item as { type?: unknown; content?: unknown }
    if (output.type === 'reasoning') continue
    if (typeof output.content === 'string') {
      parts.push(output.content)
      continue
    }
    if (!Array.isArray(output.content)) continue
    for (const part of output.content) {
      if (!part || typeof part !== 'object') continue
      const block = part as { type?: unknown; text?: unknown }
      if ((block.type === 'output_text' || block.type === 'text') && typeof block.text === 'string') parts.push(block.text)
    }
  }
  if (parts.length > 0) return parts.join('')
  return typeof record.output_text === 'string' ? record.output_text : ''
}

function terminalError(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const status = (payload as { status?: unknown }).status
  if (status !== 'failed' && status !== 'incomplete' && status !== 'cancelled') return ''
  return providerMessage(payload) || '模型没有完成这次请求'
}

async function providerErrorDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  const trimmed = text.trim()
  if (!trimmed || trimmed.startsWith('<')) return ''
  try {
    const message = providerMessage(JSON.parse(trimmed) as unknown)
    if (message) return clip(message)
  } catch {
    // 纯文本错误
  }
  return clip(trimmed)
}

function providerMessage(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  if (typeof record.error === 'string') return record.error
  if (record.error && typeof record.error === 'object') {
    const message = (record.error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  if (Array.isArray(record.errors)) {
    for (const item of record.errors) {
      if (item && typeof item === 'object' && typeof (item as { message?: unknown }).message === 'string') {
        return (item as { message: string }).message
      }
    }
  }
  if (typeof record.message === 'string') return record.message
  return ''
}

function clip(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return clean.length > 160 ? `${clean.slice(0, 160)}…` : clean
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
