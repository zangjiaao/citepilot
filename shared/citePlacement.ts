import type { BrandMention } from './assets.ts'

export interface CitePlacement {
  lines: string[]
  gap: string
}

const NOISE = ['如何', '怎么做', '怎么样', '怎样', '为什么', '是不是', '是否', '哪些', '什么', '哪个', '怎么', '帮助', '解决', '问题', '企业', '一个', '可以', '我们', '这个', '进行', '通过', '以及', '还是', '应该', '一般', '通常', '需要', '能够']

function cleanQuestion(question: string): string {
  return question.replace(/[？?！!。，,、；;：:\s「」""''（）()]/g, '')
}

function trimNoise(text: string): string {
  const noise = [...NOISE].sort((a, b) => b.length - a.length)
  let next = text
  for (let guard = 0; guard < 8; guard += 1) {
    const before = next
    for (const word of noise) {
      if (next.startsWith(word) && next.length - word.length >= 2) next = next.slice(word.length)
      if (next.endsWith(word) && next.length - word.length >= 2) next = next.slice(0, next.length - word.length)
    }
    if (next === before) break
  }
  return next
}

function noiseFragment(text: string): boolean {
  return NOISE.some((word) => word.length > text.length && (word.startsWith(text) || word.endsWith(text)))
}

function cutsBodyWord(cleaned: string, end: number, body: string): boolean {
  const next = cleaned[end]
  if (!next) return false
  return body.includes(cleaned.slice(end - 1, end + 1))
}

function questionTerms(question: string, body: string): string[] {
  const cleaned = cleanQuestion(question)
  const taken: Array<{ start: number; end: number }> = []
  const terms: string[] = []
  for (let length = Math.min(12, cleaned.length); length >= 2; length -= 1) {
    for (let index = 0; index + length <= cleaned.length; index += 1) {
      if (taken.some((item) => index < item.end && index + length > item.start)) continue
      const raw = cleaned.slice(index, index + length)
      if (!body.includes(raw) || noiseFragment(raw) || cutsBodyWord(cleaned, index + length, body)) continue
      const trimmed = trimNoise(raw)
      if (trimmed.length < 2 || NOISE.includes(trimmed) || noiseFragment(trimmed) || !body.includes(trimmed)) continue
      taken.push({ start: index, end: index + length })
      if (!terms.includes(trimmed)) terms.push(trimmed)
      if (terms.length >= 4) return terms
    }
  }
  return terms
}

function paragraphsOf(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function locate(paragraphs: string[], needle: string, prefer: 'first' | 'last'): number {
  let found = -1
  paragraphs.forEach((paragraph, index) => {
    if (!paragraph.includes(needle)) return
    if (prefer === 'first' && found === -1) found = index
    if (prefer === 'last') found = index
  })
  return found
}

function whereLabel(index: number, total: number, ending: boolean): string {
  if (ending && index === total - 1) return '结尾'
  return `第 ${index + 1} 段`
}

function siteHost(website: string): string {
  const trimmed = website.trim()
  if (!trimmed) return ''
  try {
    return new URL(trimmed).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function line(where: string, quote: string, note: string): string {
  return `${where} · 「${quote}」— ${note}`
}

export function citePlacement(input: {
  body: string
  question?: string
  keywords?: string[]
  brand?: string
  website?: string
  mention?: BrandMention
}): CitePlacement {
  const body = input.body ?? ''
  const paragraphs = paragraphsOf(body)
  const brand = (input.brand ?? '').trim()
  const host = siteHost(input.website ?? '')
  const keywordList = [...new Set((input.keywords ?? []).map((item) => item.trim()).filter((item) => item.length >= 2))]
  const questionHits = questionTerms(input.question ?? '', body).filter(
    (term) => term.length >= 3 || keywordList.some((item) => item.includes(term) || term.includes(item)),
  )
  const keywordHits = keywordList
    .filter((item) => item !== brand && item !== host && body.includes(item))
    .filter((item) => !questionHits.some((term) => term.includes(item) || item.includes(term)))

  const story: string[] = []
  for (const term of questionHits) {
    const index = locate(paragraphs, term, 'first')
    if (index < 0) continue
    story.push(line(whereLabel(index, paragraphs.length, false), term, '对应题干关键词'))
  }
  for (const term of keywordHits) {
    const index = locate(paragraphs, term, 'first')
    if (index < 0) continue
    story.push(line(whereLabel(index, paragraphs.length, false), term, '品牌关键词'))
  }

  const brandAt = brand ? locate(paragraphs, brand, 'last') : -1
  const siteAt = host ? locate(paragraphs, host, 'last') : -1
  const attribution: string[] = []
  if (brandAt >= 0 && siteAt === brandAt) {
    attribution.push(line(whereLabel(brandAt, paragraphs.length, true), `${brand}」「${host}`, '出处'))
  } else {
    if (brandAt >= 0) attribution.push(line(whereLabel(brandAt, paragraphs.length, true), brand, '出处'))
    if (siteAt >= 0) attribution.push(line(whereLabel(siteAt, paragraphs.length, true), host, '出处'))
  }

  const lines = [...story.slice(0, Math.max(0, 6 - attribution.length)), ...attribution]
  const gaps: string[] = []
  if ((input.question ?? '').trim() && questionHits.length === 0) gaps.push('题干里的说法还没写进正文。')
  if ((input.mention === 'light' || input.mention === 'guide') && attribution.length === 0 && (brand || host)) {
    gaps.push('结尾还没有工作室名或官网。')
  }
  return { lines, gap: gaps.join('') }
}
