import { assertPublicHttpUrl } from './ssrf.ts'

export interface CaseStudy {
  id: string
  industry: string
  pain: string
  approach: string
  duration: string
  outcome: string
  isPublic: boolean
}

export interface Objection {
  id: string
  question: string
  answer: string
}

export interface ReferenceSnippet {
  id: string
  title: string
  url: string
  excerpt: string
}

export interface BrandProfile {
  introduction: string
  teamBackground: string
  differentiation: string
  caseStudies: CaseStudy[]
  methodology: string
  pricing: string
  customerProfile: string
  customerPains: string
  objections: Objection[]
  evidence: string
  voice: string
  bannedWords: string
  compliance: string
  references: ReferenceSnippet[]
}

const LONG_TEXT = 20000
const LIST_CAP = 40

export interface BrandPageFields {
  name: string
  website: string
  positioning: string
  services: string[]
  competitors: { id: string; name: string; aliases: string[]; domain: string }[]
  keywords: string[]
  voice: string
  bannedWords: string
  compliance: string
}

export function applyBrandPageSave<T extends BrandProfile & BrandPageFields & {
  capabilities: string[]
  cases: string[]
  targetCustomers: string[]
  solutions: string[]
}>(existing: T, form: BrandPageFields): T {
  return {
    ...existing,
    name: form.name,
    website: form.website,
    positioning: form.positioning,
    services: form.services,
    competitors: form.competitors,
    keywords: form.keywords,
    voice: form.voice,
    bannedWords: form.bannedWords,
    compliance: form.compliance,
  }
}

export function blankBrandProfile(): BrandProfile {
  return {
    introduction: '',
    teamBackground: '',
    differentiation: '',
    caseStudies: [],
    methodology: '',
    pricing: '',
    customerProfile: '',
    customerPains: '',
    objections: [],
    evidence: '',
    voice: '',
    bannedWords: '',
    compliance: '',
    references: [],
  }
}

export type BrandProfileResult = { ok: true; profile: BrandProfile } | { ok: false; field: string; error: string }

export function readBrandProfile(input: unknown): BrandProfileResult {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const introduction = longText(record.introduction, 'introduction', '品牌介绍')
  if (!introduction.ok) return introduction
  const teamBackground = longText(record.teamBackground, 'teamBackground', '创始人与团队背景')
  if (!teamBackground.ok) return teamBackground
  const differentiation = longText(record.differentiation, 'differentiation', '差异化优势')
  if (!differentiation.ok) return differentiation
  const methodology = longText(record.methodology, 'methodology', '方法论')
  if (!methodology.ok) return methodology
  const pricing = longText(record.pricing, 'pricing', '服务与报价')
  if (!pricing.ok) return pricing
  const customerProfile = longText(record.customerProfile, 'customerProfile', '目标客户画像')
  if (!customerProfile.ok) return customerProfile
  const customerPains = longText(record.customerPains, 'customerPains', '典型痛点')
  if (!customerPains.ok) return customerPains
  const evidence = longText(record.evidence, 'evidence', '证据素材')
  if (!evidence.ok) return evidence
  const voice = longText(record.voice, 'voice', '品牌语气')
  if (!voice.ok) return voice
  const bannedWords = longText(record.bannedWords, 'bannedWords', '禁用词')
  if (!bannedWords.ok) return bannedWords
  const compliance = longText(record.compliance, 'compliance', '合规红线')
  if (!compliance.ok) return compliance
  const caseStudies = readCases(record.caseStudies)
  if (!caseStudies.ok) return caseStudies
  const objections = readObjections(record.objections)
  if (!objections.ok) return objections
  const references = readReferences(record.references)
  if (!references.ok) return references
  return {
    ok: true,
    profile: {
      introduction: introduction.value,
      teamBackground: teamBackground.value,
      differentiation: differentiation.value,
      caseStudies: caseStudies.items,
      methodology: methodology.value,
      pricing: pricing.value,
      customerProfile: customerProfile.value,
      customerPains: customerPains.value,
      objections: objections.items,
      evidence: evidence.value,
      voice: voice.value,
      bannedWords: bannedWords.value,
      compliance: compliance.value,
      references: references.items,
    },
  }
}

export function publicCases(profile: Pick<BrandProfile, 'caseStudies'>): CaseStudy[] {
  return profile.caseStudies.filter((item) => item.isPublic && (item.pain || item.approach || item.outcome))
}

function longText(
  value: unknown,
  field: string,
  label: string,
): { ok: true; value: string } | { ok: false; field: string; error: string } {
  if (value === undefined || value === null) return { ok: true, value: '' }
  if (typeof value !== 'string') return { ok: false, field, error: `${label}的格式不正确` }
  const trimmed = value.trim()
  if (trimmed.length > LONG_TEXT) return { ok: false, field, error: `${label}有 ${trimmed.length} 字，上限是 ${LONG_TEXT} 字` }
  return { ok: true, value: trimmed }
}

function readCases(value: unknown): { ok: true; items: CaseStudy[] } | { ok: false; field: string; error: string } {
  if (value === undefined || value === null) return { ok: true, items: [] }
  if (!Array.isArray(value)) return { ok: false, field: 'caseStudies', error: '案例详情的格式不正确' }
  if (value.length > LIST_CAP) return { ok: false, field: 'caseStudies', error: `案例详情有 ${value.length} 项，上限是 ${LIST_CAP} 项` }
  const items: CaseStudy[] = []
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') return { ok: false, field: 'caseStudies', error: `第 ${index + 1} 条案例格式不正确` }
    const record = entry as Record<string, unknown>
    const industry = fieldText(record.industry, 400)
    const pain = fieldText(record.pain, 2000)
    const approach = fieldText(record.approach, 2000)
    const duration = fieldText(record.duration, 200)
    const outcome = fieldText(record.outcome, 2000)
    if (industry === null || pain === null || approach === null || duration === null || outcome === null) {
      return { ok: false, field: 'caseStudies', error: `第 ${index + 1} 条案例有一项过长，单项上限是 2000 字` }
    }
    if (!industry && !pain && !approach && !duration && !outcome) continue
    items.push({
      id: idOf(record.id, `case-${index + 1}`),
      industry,
      pain,
      approach,
      duration,
      outcome,
      isPublic: record.isPublic === true || record.isPublic === 'true' || record.isPublic === 'yes',
    })
  }
  return { ok: true, items }
}

function readObjections(value: unknown): { ok: true; items: Objection[] } | { ok: false; field: string; error: string } {
  if (value === undefined || value === null) return { ok: true, items: [] }
  if (!Array.isArray(value)) return { ok: false, field: 'objections', error: '常见异议的格式不正确' }
  if (value.length > LIST_CAP) return { ok: false, field: 'objections', error: `常见异议有 ${value.length} 项，上限是 ${LIST_CAP} 项` }
  const items: Objection[] = []
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') return { ok: false, field: 'objections', error: `第 ${index + 1} 条异议格式不正确` }
    const record = entry as Record<string, unknown>
    const question = fieldText(record.question, 500)
    const answer = fieldText(record.answer, 4000)
    if (!question && !answer) continue
    if (question === null || answer === null) return { ok: false, field: 'objections', error: `第 ${index + 1} 条异议过长` }
    items.push({ id: idOf(record.id, `faq-${index + 1}`), question, answer })
  }
  return { ok: true, items }
}

function readReferences(value: unknown): { ok: true; items: ReferenceSnippet[] } | { ok: false; field: string; error: string } {
  if (value === undefined || value === null) return { ok: true, items: [] }
  if (!Array.isArray(value)) return { ok: false, field: 'references', error: '资料库的格式不正确' }
  if (value.length > LIST_CAP) return { ok: false, field: 'references', error: `资料库有 ${value.length} 项，上限是 ${LIST_CAP} 项` }
  const items: ReferenceSnippet[] = []
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') return { ok: false, field: 'references', error: `第 ${index + 1} 条资料格式不正确` }
    const record = entry as Record<string, unknown>
    const title = fieldText(record.title, 200)
    const excerpt = fieldText(record.excerpt, 20000)
    const urlRaw = typeof record.url === 'string' ? record.url.trim() : ''
    if (title === null || excerpt === null) return { ok: false, field: 'references', error: `第 ${index + 1} 条资料过长` }
    if (!title && !excerpt && !urlRaw) continue
    let url = ''
    if (urlRaw) {
      try {
        url = assertPublicHttpUrl(urlRaw).toString()
      } catch (error) {
        const message = error instanceof Error ? error.message : '资料链接不正确'
        return { ok: false, field: 'references', error: `第 ${index + 1} 条资料：${message}` }
      }
    }
    if (!excerpt && !url) return { ok: false, field: 'references', error: `第 ${index + 1} 条资料需要摘录或公开链接` }
    items.push({ id: idOf(record.id, `ref-${index + 1}`), title, url, excerpt })
  }
  return { ok: true, items }
}

function fieldText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > max) return null
  return trimmed
}

function idOf(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!/^[\w-]{1,80}$/.test(trimmed)) return fallback
  return trimmed
}
