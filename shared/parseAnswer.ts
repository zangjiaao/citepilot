import type { Sentiment } from './types.ts'

const POSITIVE = ['推荐', '专业', '可靠', '领先', '口碑好', '值得', '成熟', '优势', '经验丰富']
const NEGATIVE = ['不推荐', '不建议', '踩坑', '投诉', '风险高', '不靠谱', '较差', '负面', '失败', '谨慎']

const SUFFIXES = ['智能体工场', '智能体工作室', '智能体实验室', '应用工场', '工作室', '工场', '实验室', '公司']

export interface ParseInput {
  answer: string
  brandName: string
  website: string
  competitors: string[]
}

export interface AnswerParse {
  brandMentioned: boolean
  brandSnippets: string[]
  citedUrls: string[]
  ownUrlCited: boolean
  competitorsMentioned: string[]
  sentiment: Sentiment
  summary: string
}

export function brandAliases(name: string): string[] {
  const compact = name.replace(/\s+/g, '').trim()
  const aliases = new Set<string>()
  if (name.trim().length >= 2) aliases.add(name.trim())
  if (compact.length >= 2) aliases.add(compact)
  for (const suffix of SUFFIXES) {
    if (compact.endsWith(suffix) && compact.length - suffix.length >= 2) {
      aliases.add(compact.slice(0, -suffix.length))
      break
    }
  }
  return [...aliases].sort((a, b) => b.length - a.length)
}

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"'，。；、）)】\]]+/gi) ?? []
  const seen = new Set<string>()
  for (const match of matches) {
    const cleaned = match.replace(/[.,;:]+$/, '')
    seen.add(cleaned)
  }
  return [...seen]
}

export function websiteHost(website: string): string | null {
  try {
    return new URL(website).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

export function parseAnswer(input: ParseInput): AnswerParse {
  const answer = input.answer.replace(/\u0000/g, '')
  const aliases = brandAliases(input.brandName)
  const brandSnippets: string[] = []
  for (const alias of aliases) {
    brandSnippets.push(...snippets(answer, alias))
  }
  const uniqueSnippets = [...new Set(brandSnippets)].slice(0, 3)
  const brandMentioned = uniqueSnippets.length > 0
  const citedUrls = extractUrls(answer)
  const host = websiteHost(input.website)
  const ownUrlCited = host
    ? citedUrls.some((url) => hostMatches(url, host)) || answer.toLowerCase().includes(host)
    : false
  const competitorsMentioned = input.competitors.filter((name) => name.trim() && includesTerm(answer, name.trim()))
  const sentiment = brandMentioned ? sentimentOf(answer) : 'neutral'
  const parsed: AnswerParse = {
    brandMentioned,
    brandSnippets: uniqueSnippets,
    citedUrls,
    ownUrlCited,
    competitorsMentioned,
    sentiment,
    summary: '',
  }
  parsed.summary = summarize(parsed)
  return parsed
}

export function summarize(parsed: Omit<AnswerParse, 'summary'>): string {
  const comps = parsed.competitorsMentioned.length > 0 ? parsed.competitorsMentioned.join('、') : '无'
  const tone = { positive: '偏正面', neutral: '中性', negative: '偏负面', mixed: '褒贬都有' }[parsed.sentiment]
  return `规则解析：品牌${parsed.brandMentioned ? '已出现' : '未出现'}；自有网址${parsed.ownUrlCited ? '被引用' : '未被引用'}；竞品提及：${comps}；态度倾向：${tone}。`
}

function sentimentOf(answer: string): Sentiment {
  const positive = POSITIVE.some((word) => answer.includes(word))
  const negative = NEGATIVE.some((word) => answer.includes(word))
  if (positive && negative) return 'mixed'
  if (positive) return 'positive'
  if (negative) return 'negative'
  return 'neutral'
}

function includesTerm(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

function snippets(text: string, needle: string): string[] {
  const lower = text.toLowerCase()
  const target = needle.toLowerCase()
  const found: string[] = []
  let from = 0
  while (found.length < 3) {
    const at = lower.indexOf(target, from)
    if (at < 0) break
    const start = Math.max(0, at - 12)
    const end = Math.min(text.length, at + needle.length + 12)
    found.push(text.slice(start, end).replace(/\s+/g, ' ').trim())
    from = at + needle.length
  }
  return found
}

function hostMatches(url: string, host: string): boolean {
  try {
    const name = new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
    return name === host || name.endsWith(`.${host}`)
  } catch {
    return false
  }
}
