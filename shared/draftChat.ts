import type { Asset, BrandMention } from './assets.ts'
import { assetBlock } from './assets.ts'
import { implantRule, NO_FABRICATION_RULE, SHOW_DONT_TELL_RULE, type ContentType, type DraftLength } from './draftPrompt.ts'
import { platformFormatRule } from './platformFormats.ts'

export const NO_MODEL_REVISION = '没有配置生成模型，没法按对话改稿。到设置里配上密钥后再试。'

export const REVISION_UNCHANGED = '这次改稿没有通过检查，正文还是原来的。'

export interface DraftChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface DraftRevisionFields {
  title: string
  body: string
  citeSentences: string[]
  urlHint: string
}

export interface DraftRevision extends DraftRevisionFields {
  note: string
}

const DEFAULT_NOTE = '已按这句话改了稿。'

export function parseDraftChatHistory(value: unknown, limit = 40): DraftChatTurn[] {
  if (!Array.isArray(value)) return []
  const turns: DraftChatTurn[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as { role?: unknown; content?: unknown }
    if (record.role !== 'user' && record.role !== 'assistant') continue
    if (typeof record.content !== 'string') continue
    const content = record.content.trim().slice(0, 2000)
    if (!content) continue
    turns.push({ role: record.role, content })
    if (turns.length >= limit) break
  }
  return turns
}

export function recentDraftTurns(turns: DraftChatTurn[], limit = 8): DraftChatTurn[] {
  return turns.slice(-limit)
}

export function assetFactsForRevision(assets: Asset[]): string {
  return assets
    .slice(0, 8)
    .map((asset) => assetBlock(asset))
    .join('\n\n')
    .slice(0, 6000)
}

export function reviseDraftPrompt(input: {
  brand: string
  website: string
  promptText?: string
  channelLabel: string
  contentType: ContentType
  length: DraftLength
  brandMention: BrandMention
  audience: string
  tone: string
  requirements?: string
  instruction: string
  draft: DraftRevisionFields
  history: DraftChatTurn[]
  assetFacts: string
}): { system: string; user: string } {
  const history = recentDraftTurns(input.history)
    .map((turn) => `${turn.role === 'user' ? '用户' : '改动'}：${turn.content}`)
    .join('\n')
  const system = [
    '你在按对话修改一篇已经生成的草稿。用户的话是修改要求，不是新的素材。',
    NO_FABRICATION_RULE,
    SHOW_DONT_TELL_RULE,
    implantRule(input.brandMention, input.promptText, input.brand, input.website, input.contentType),
    platformFormatRule(input.contentType, input.length, input.brandMention),
    '只改用户这次要求改的地方。标题、正文、可引用句和落点都要交回完整结果，不要只回差异。',
    '没有真实官网时，闲鱼落点用闲鱼主页，视频号落点用视频号私信，不要写 example.com。',
    '不要编造价格、客户名、数字或网址。价格只有素材里已经写明才能照抄。',
    '只输出 JSON：{"title":"...","body":"...","citeSentences":["...","..."],"urlHint":"...","note":"一两句说明改了什么"}',
    'note 不超过 80 字，不要把正文再抄进 note。',
  ].join('\n')
  const user = [
    `渠道：${input.channelLabel}`,
    `主题：${input.promptText?.trim() || '无'}`,
    `需求：${input.requirements?.trim() || '沿用当前稿'}`,
    `读者：${input.audience.trim() || (input.requirements?.trim() ? '见需求' : '沿用当前稿')}`,
    `语气：${input.tone.trim() || (input.requirements?.trim() ? '见需求' : '沿用当前稿')}`,
    `当前标题：${input.draft.title}`,
    `当前正文：\n${input.draft.body}`,
    `当前可引用句：\n${input.draft.citeSentences.map((item) => `- ${item}`).join('\n')}`,
    `当前落点：${input.draft.urlHint}`,
    `素材事实（只能用这些；没有就只改写现有稿，不要补新事实）：\n${input.assetFacts.trim() || '没有勾选素材。不要新增事实、数字或价格。'}`,
    history ? `最近对话：\n${history}` : '最近对话：无',
    `这次要求：${input.instruction.trim()}`,
  ].join('\n\n')
  return { system, user }
}

export function acceptDraftRevision(raw: unknown): DraftRevision | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  const body = typeof record.body === 'string' ? record.body.trim() : ''
  const urlHint = typeof record.urlHint === 'string' ? record.urlHint.trim() : ''
  if (title.length < 4 || title.length > 80) return null
  if (body.length < 40 || body.length > 8000) return null
  if (urlHint.length < 8 || urlHint.length > 300) return null
  if (!Array.isArray(record.citeSentences)) return null
  const citeSentences = record.citeSentences
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length >= 12 && item.length <= 180)
    .slice(0, 6)
  if (citeSentences.length < 2) return null
  const noteRaw = typeof record.note === 'string' ? record.note.replace(/\s+/g, ' ').trim() : ''
  const note = (noteRaw || DEFAULT_NOTE).slice(0, 200)
  return { title, body, citeSentences, urlHint, note }
}
