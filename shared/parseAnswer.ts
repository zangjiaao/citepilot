import { normalizeDomain } from './competitors.ts'
import { SELF_BRAND_KEY, type BrandHit, type Competitor, type Sentiment } from './types.ts'

const POSITIVE = ['推荐', '专业', '可靠', '领先', '口碑好', '值得', '成熟', '优势', '经验丰富']
const NEGATIVE = ['不推荐', '不建议', '踩坑', '投诉', '风险高', '不靠谱', '较差', '负面', '失败', '谨慎']

const SUFFIXES = ['智能体工场', '智能体工作室', '智能体实验室', '应用工场', '工作室', '工场', '实验室', '公司']

export interface ParseInput {
  answer: string
  brandName: string
  website: string
  competitors: Competitor[]
}

export interface AnswerParse {
  brandMentioned: boolean
  brandSnippets: string[]
  citedUrls: string[]
  ownUrlCited: boolean
  competitorsMentioned: string[]
  brandHits: BrandHit[]
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
  for (const alias of aliases) brandSnippets.push(...snippets(answer, alias))
  const uniqueSnippets = [...new Set(brandSnippets)].slice(0, 3)
  const citedUrls = extractUrls(answer)
  const brandHits = rankBrands(answer, citedUrls, {
    key: SELF_BRAND_KEY,
    name: input.brandName.trim() || '本品牌',
    terms: aliases,
    domain: websiteHost(input.website),
  }, input.competitors)
  const self = brandHits.find((hit) => hit.key === SELF_BRAND_KEY)
  const competitorsMentioned = brandHits.filter((hit) => hit.key !== SELF_BRAND_KEY && hit.mentioned).map((hit) => hit.name)
  const brandMentioned = uniqueSnippets.length > 0 || Boolean(self?.mentioned)
  const parsed: AnswerParse = {
    brandMentioned,
    brandSnippets: uniqueSnippets,
    citedUrls,
    ownUrlCited: Boolean(self?.cited),
    competitorsMentioned,
    brandHits,
    sentiment: brandMentioned ? sentimentOf(answer) : 'neutral',
    summary: '',
  }
  parsed.summary = summarize(parsed)
  return parsed
}

export function summarize(parsed: Omit<AnswerParse, 'summary'>): string {
  const self = parsed.brandHits.find((hit) => hit.key === SELF_BRAND_KEY)
  const brand = parsed.brandMentioned ? (self?.rank ? `品牌已出现，排名第 ${self.rank}` : '品牌已出现') : '品牌未出现'
  const comps = parsed.brandHits.filter((hit) => hit.key !== SELF_BRAND_KEY && hit.mentioned)
  const compText = comps.length === 0 ? '无' : comps.map((hit) => (hit.rank ? `${hit.name}（第 ${hit.rank}）` : hit.name)).join('、')
  const tone = { positive: '偏正面', neutral: '中性', negative: '偏负面', mixed: '褒贬都有' }[parsed.sentiment]
  return `规则解析：${brand}；自有网址${parsed.ownUrlCited ? '被引用' : '未被引用'}；竞品提及：${compText}；态度倾向：${tone}。`
}

interface TrackedTerm {
  key: string
  name: string
  terms: string[]
  domain: string | null
}

function rankBrands(answer: string, urls: string[], self: TrackedTerm, competitors: Competitor[]): BrandHit[] {
  const tracked: TrackedTerm[] = [
    self,
    ...competitors.map((item) => ({
      key: item.id,
      name: item.name,
      terms: [item.name, ...item.aliases],
      domain: normalizeDomain(item.domain),
    })),
  ]
  const found: Array<TrackedTerm & { index: number; length: number; cited: boolean }> = []
  const silent: BrandHit[] = []
  for (const brand of tracked) {
    const located = locate(answer, brand.terms)
    const cited = domainCited(answer, urls, brand.domain)
    if (located) found.push({ ...brand, index: located.index, length: located.length, cited })
    else if (cited) silent.push({ key: brand.key, name: brand.name, mentioned: false, rank: null, cited: true })
  }
  found.sort((a, b) => a.index - b.index || b.length - a.length || a.key.localeCompare(b.key))
  return [
    ...found.map((brand, index) => ({
      key: brand.key,
      name: brand.name,
      mentioned: true,
      rank: index + 1,
      cited: brand.cited,
    })),
    ...silent,
  ]
}

function locate(text: string, terms: string[]): { index: number; length: number } | null {
  const lower = text.toLowerCase()
  let best: { index: number; length: number } | null = null
  for (const term of terms) {
    const needle = term.trim()
    if (needle.length < 2) continue
    const at = lower.indexOf(needle.toLowerCase())
    if (at < 0) continue
    if (!best || at < best.index || (at === best.index && needle.length > best.length)) {
      best = { index: at, length: needle.length }
    }
  }
  return best
}

function domainCited(answer: string, urls: string[], domain: string | null): boolean {
  if (!domain) return false
  if (urls.some((url) => hostMatches(url, domain))) return true
  return answer.toLowerCase().includes(domain)
}

function sentimentOf(answer: string): Sentiment {
  const positive = POSITIVE.some((word) => answer.includes(word))
  const negative = NEGATIVE.some((word) => answer.includes(word))
  if (positive && negative) return 'mixed'
  if (positive) return 'positive'
  if (negative) return 'negative'
  return 'neutral'
}

function snippets(text: string, needle: string): string[] {
  if (needle.length < 2) return []
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
