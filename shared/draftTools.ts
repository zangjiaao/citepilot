import type { DraftRevisionFields } from './draftChat.ts'

export const DRAFT_TOOL_NAMES = ['replace_paragraph', 'update_section', 'append_paragraph', 'delete_paragraph', 'update_draft'] as const

export type DraftToolName = (typeof DRAFT_TOOL_NAMES)[number]

export interface DraftToolCall {
  name: DraftToolName
  arguments: Record<string, unknown>
}

export interface DraftParagraph {
  id: string
  index: number
  text: string
}

export interface AppliedDraftTools {
  ok: true
  draft: DraftRevisionFields
  note: string
  changed: boolean
  tools: DraftToolName[]
}

export type DraftToolResult = AppliedDraftTools | { ok: false; error: string }

const NAMES = new Set<string>(DRAFT_TOOL_NAMES)

export const DRAFT_EDIT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'replace_paragraph',
      description: '替换一个已有段落，其它段落保持原样。id 用 p1、p2，或用从 0 开始的 index。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          index: { type: 'integer' },
          text: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_section',
      description: '按段落 id 或 index 替换那一节，其它段落保持原样。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          index: { type: 'integer' },
          text: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'append_paragraph',
      description: '在某一段后面加一段。不写 after 就加在末尾。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          after: { type: 'string', description: '段落 id，例如 p1。也可以不写。' },
          note: { type: 'string' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_paragraph',
      description: '删掉一个段落，其余段落保持原样。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          index: { type: 'integer' },
          note: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_draft',
      description: '用户明确要求重写整篇，或要改标题、可引用句、落点时才用。只填需要改的字段。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          citeSentences: { type: 'array', items: { type: 'string' } },
          urlHint: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
  },
] as const

export function splitDraftParagraphs(body: string): DraftParagraph[] {
  return body
    .split(/\n\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: `p${index + 1}`, index, text }))
}

export function joinDraftParagraphs(paragraphs: ReadonlyArray<{ text: string }>): string {
  return paragraphs
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

export function cleanChangedParagraphs(before: string, after: string, clean: (text: string) => string): string {
  const previous = new Set(splitDraftParagraphs(before).map((item) => item.text))
  const next = splitDraftParagraphs(after).map((item) => {
    if (previous.has(item.text)) return item.text
    const cleaned = clean(item.text).trim()
    return cleaned || item.text
  })
  return next.join('\n\n')
}

export function parseDraftToolCalls(raw: unknown): DraftToolCall[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.flatMap((item) => parseDraftToolCalls(item))
  if (typeof raw !== 'object') return []
  const record = raw as Record<string, unknown>
  if (Array.isArray(record.tool_calls)) return parseDraftToolCalls(record.tool_calls)
  if (Array.isArray(record.calls)) return parseDraftToolCalls(record.calls)
  if (Array.isArray(record.choices)) {
    const first = record.choices[0]
    if (first && typeof first === 'object') {
      const message = (first as { message?: unknown }).message
      if (message && typeof message === 'object' && 'tool_calls' in (message as object)) {
        return parseDraftToolCalls((message as { tool_calls?: unknown }).tool_calls)
      }
    }
  }
  if (Array.isArray(record.output)) {
    const calls = parseDraftToolCalls(record.output)
    if (calls.length > 0) return calls
  }
  const call = parseOneCall(record)
  return call ? [call] : []
}

export function applyDraftTools(draft: DraftRevisionFields, calls: DraftToolCall[]): DraftToolResult {
  if (calls.length === 0) return { ok: false, error: '没有调用修改工具' }
  let next: DraftRevisionFields = { ...draft, citeSentences: [...draft.citeSentences] }
  const notes: string[] = []
  const tools: DraftToolName[] = []
  for (const call of calls) {
    const step = applyOne(next, call)
    if (!step.ok) return step
    next = step.draft
    if (step.note) notes.push(step.note)
    tools.push(call.name)
  }
  if (!draftStillValid(next)) return { ok: false, error: '改完之后稿子不完整' }
  const note = (notes.join(' ') || '已按工具改了稿。').replace(/\s+/g, ' ').trim().slice(0, 200)
  return {
    ok: true,
    draft: next,
    note,
    changed: !sameDraft(draft, next),
    tools,
  }
}

function parseOneCall(record: Record<string, unknown>): DraftToolCall | null {
  const fn = record.function
  const nested = fn && typeof fn === 'object' ? (fn as { name?: unknown; arguments?: unknown }) : null
  const nameValue = nested?.name ?? record.name ?? record.tool
  if (typeof nameValue !== 'string' || !NAMES.has(nameValue)) return null
  const argsValue = nested ? nested.arguments : (record.arguments ?? record.args)
  const args = argumentsObject(argsValue, nested ? {} : record)
  return { name: nameValue as DraftToolName, arguments: args }
}

function argumentsObject(value: unknown, fallback: Record<string, unknown>): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      return {}
    }
    return {}
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  const copy = { ...fallback }
  delete copy.name
  delete copy.tool
  delete copy.function
  delete copy.arguments
  delete copy.args
  delete copy.type
  delete copy.id
  return copy
}

function applyOne(draft: DraftRevisionFields, call: DraftToolCall): { ok: true; draft: DraftRevisionFields; note: string } | { ok: false; error: string } {
  const args = call.arguments
  const note = typeof args.note === 'string' ? args.note.replace(/\s+/g, ' ').trim().slice(0, 200) : ''
  if (call.name === 'update_draft') return applyFullUpdate(draft, args, note)
  const paragraphs = splitDraftParagraphs(draft.body)
  if (paragraphs.length === 0) return { ok: false, error: '正文没有可改的段落' }
  if (call.name === 'append_paragraph') {
    const text = paragraphText(args.text)
    if (!text) return { ok: false, error: '要追加的段落是空的' }
    const after = args.after === undefined ? paragraphs.length - 1 : findParagraph(paragraphs, { id: args.after, index: args.after })
    if (after === null) return { ok: false, error: '没有找到要接在后面的段落' }
    const next = [...paragraphs]
    next.splice(after + 1, 0, { id: '', index: 0, text })
    return { ok: true, draft: { ...draft, body: joinDraftParagraphs(next) }, note }
  }
  const index = findParagraph(paragraphs, args)
  if (index === null) return { ok: false, error: '没有找到这一段' }
  if (call.name === 'delete_paragraph') {
    const next = paragraphs.filter((_, item) => item !== index)
    return { ok: true, draft: { ...draft, body: joinDraftParagraphs(next) }, note }
  }
  const text = paragraphText(args.text)
  if (!text) return { ok: false, error: '替换后的段落是空的' }
  const next = paragraphs.map((item, itemIndex) => (itemIndex === index ? { ...item, text } : item))
  return { ok: true, draft: { ...draft, body: joinDraftParagraphs(next) }, note }
}

function applyFullUpdate(
  draft: DraftRevisionFields,
  args: Record<string, unknown>,
  note: string,
): { ok: true; draft: DraftRevisionFields; note: string } | { ok: false; error: string } {
  const hasField = ['title', 'body', 'citeSentences', 'urlHint'].some((key) => args[key] !== undefined)
  if (!hasField) return { ok: false, error: 'update_draft 没有要改的字段' }
  const next: DraftRevisionFields = { ...draft, citeSentences: [...draft.citeSentences] }
  if (args.title !== undefined) {
    if (typeof args.title !== 'string') return { ok: false, error: '标题不正确' }
    const title = args.title.trim()
    if (title.length < 4 || title.length > 80) return { ok: false, error: '标题需要 4 到 80 个字' }
    next.title = title
  }
  if (args.body !== undefined) {
    if (typeof args.body !== 'string') return { ok: false, error: '正文不正确' }
    const body = args.body.trim()
    if (body.length < 40 || body.length > 8000) return { ok: false, error: '正文太短或太长' }
    next.body = body
  }
  if (args.urlHint !== undefined) {
    if (typeof args.urlHint !== 'string') return { ok: false, error: '落点不正确' }
    const urlHint = args.urlHint.trim()
    if (urlHint.length < 8 || urlHint.length > 300) return { ok: false, error: '落点需要写清' }
    next.urlHint = urlHint
  }
  if (args.citeSentences !== undefined) {
    if (!Array.isArray(args.citeSentences)) return { ok: false, error: '可引用句子格式不正确' }
    const citeSentences = args.citeSentences
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter((item) => item.length >= 12 && item.length <= 180)
      .slice(0, 6)
    if (citeSentences.length < 2) return { ok: false, error: '至少保留两句可引用的话' }
    next.citeSentences = citeSentences
  }
  return { ok: true, draft: next, note }
}

function findParagraph(paragraphs: DraftParagraph[], args: Record<string, unknown>): number | null {
  const idValue = args.id ?? args.after
  if (typeof idValue === 'string' && idValue.trim()) {
    const match = /^p(\d+)$/i.exec(idValue.trim())
    if (!match) return null
    const index = Number(match[1]) - 1
    return index >= 0 && index < paragraphs.length ? index : null
  }
  if (typeof args.index === 'number' && Number.isInteger(args.index) && args.index >= 0 && args.index < paragraphs.length) return args.index
  return null
}

function paragraphText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 4000)
}

function draftStillValid(draft: DraftRevisionFields): boolean {
  return draft.title.trim().length >= 4 && draft.title.trim().length <= 80 && draft.body.trim().length >= 40 && draft.body.trim().length <= 8000 && draft.urlHint.trim().length >= 8 && draft.urlHint.trim().length <= 300 && draft.citeSentences.length >= 2
}

function sameDraft(left: DraftRevisionFields, right: DraftRevisionFields): boolean {
  return left.title === right.title && left.body === right.body && left.urlHint === right.urlHint && left.citeSentences.join('\n') === right.citeSentences.join('\n')
}
