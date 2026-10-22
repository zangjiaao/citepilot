import { assertPublicHttpUrl } from './ssrf.ts'
import type { DraftBrief, Studio } from './types.ts'

export type BrandMention = 'none' | 'light' | 'guide'

export const ASSET_TYPES = [
  { id: 'case', label: '案例' },
  { id: 'product', label: '产品' },
  { id: 'idea', label: '巧思' },
  { id: 'interaction', label: '交互细节' },
  { id: 'outcome', label: '数据成效' },
  { id: 'testimonial', label: '客户评价' },
  { id: 'lesson', label: '踩坑经验' },
  { id: 'reference', label: '参考资料' },
  { id: 'other', label: '其他' },
] as const

export type AssetType = (typeof ASSET_TYPES)[number]['id']
export type Publicity = 'public' | 'anonymous' | 'private'

export interface AssetLink {
  id: string
  label: string
  url: string
}

export interface CaseMetric {
  id: string
  name: string
  before: string
  after: string
  unit: string
  source: string
  customerAuthorized: boolean
}

export interface AssetDetails {
  industry: string
  problem: string
  approach: string
  howItWorks: string
  metrics: CaseMetric[]
  quote: string
  quoteAuthorized: boolean
}

export interface Asset {
  id: string
  studioId: string
  type: AssetType
  title: string
  body: string
  details: AssetDetails
  tags: string[]
  links: AssetLink[]
  publicity: Publicity
  createdAt: string
  updatedAt: string
}

export type AssetDraft = Omit<Asset, 'id' | 'studioId' | 'createdAt' | 'updatedAt'>

const TYPES = new Set<string>(ASSET_TYPES.map((item) => item.id))
const LONG = 20000

export function assetTypeLabel(type: string): string {
  return ASSET_TYPES.find((item) => item.id === type)?.label ?? type
}

export function isAssetType(value: string): value is AssetType {
  return TYPES.has(value)
}

export function publicityLabel(value: Publicity): string {
  if (value === 'public') return '公开'
  if (value === 'anonymous') return '匿名'
  return '不可公开'
}

export function emptyDetails(): AssetDetails {
  return { industry: '', problem: '', approach: '', howItWorks: '', metrics: [], quote: '', quoteAuthorized: false }
}

export function authorizedMetrics(details: AssetDetails): CaseMetric[] {
  return details.metrics.filter((item) => item.customerAuthorized && (item.before.trim() || item.after.trim()))
}

export function formatMetric(metric: CaseMetric): string {
  const unit = metric.unit.trim()
  const source = metric.source.trim() ? `（口径：${metric.source.trim()}）` : ''
  return `${metric.name}：优化前 ${metric.before || '未写'}${unit}，优化后 ${metric.after || '未写'}${unit}${source}`
}

export function assetAngles(asset: Asset): string[] {
  const angles: string[] = []
  const metric = authorizedMetrics(asset.details)[0]
  if (metric) angles.push(`用客户授权的变化作钩子：${formatMetric(metric)}`)
  if (asset.details.problem.trim()) angles.push(`从客户的问题开头：${clip(asset.details.problem)}`)
  if (asset.type === 'interaction' || asset.type === 'idea') angles.push(`只拆这一处：${clip(asset.body || asset.details.howItWorks || asset.title)}`)
  if (asset.type === 'lesson' || asset.body.includes('踩')) angles.push(`写成一次踩坑，不要写成成绩单：${clip(asset.body || asset.title)}`)
  if (asset.details.howItWorks.trim()) angles.push(`讲它怎么运作：${clip(asset.details.howItWorks)}`)
  if (asset.details.quoteAuthorized && asset.details.quote.trim()) angles.push(`用客户原话收束：${clip(asset.details.quote)}`)
  if (asset.type === 'product') angles.push(`写成这个产品解决的一件具体事：${clip(asset.title)}`)
  if (angles.length < 3) angles.push(`按「问题 → 做法 → 客户侧变化」来组织：${clip(asset.title)}`)
  return angles.slice(0, 5)
}

export function readAssetDraft(input: unknown): { ok: true; value: AssetDraft } | { ok: false; field: string; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, field: 'title', error: '素材格式不正确' }
  const record = input as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type.trim() : ''
  if (!isAssetType(type)) return { ok: false, field: 'type', error: '请选择素材类型' }
  const title = text(record.title, 80)
  if (title === null || !title) return { ok: false, field: 'title', error: '标题需要 1 到 80 个字' }
  const body = text(record.body, LONG)
  if (body === null) return { ok: false, field: 'body', error: `正文有 ${typeof record.body === 'string' ? record.body.trim().length : 0} 字，上限是 ${LONG} 字` }
  const publicity = record.publicity
  if (publicity !== 'public' && publicity !== 'anonymous' && publicity !== 'private') {
    return { ok: false, field: 'publicity', error: '公开程度请选公开、匿名或不可公开' }
  }
  const tags = readTags(record.tags)
  if (!tags.ok) return tags
  const links = readLinks(record.links)
  if (!links.ok) return links
  const details = readDetails(record.details)
  if (!details.ok) return details
  return { ok: true, value: { type, title, body: body ?? '', details: details.value, tags: tags.items, links: links.items, publicity } }
}

export function assetBlock(asset: Asset): string {
  const visibility =
    asset.publicity === 'anonymous' ? '匿名：可以写行业和做法，不要写出能认出客户的信息。' : '公开：只用下面已经写出的事实。'
  const metrics = authorizedMetrics(asset.details)
  const hidden = asset.details.metrics.filter((item) => !item.customerAuthorized && (item.before.trim() || item.after.trim())).length
  return [
    `类型：${assetTypeLabel(asset.type)}`,
    `公开：${publicityLabel(asset.publicity)}。${visibility}`,
    `标题：${asset.title}`,
    `标签：${asset.tags.join('、') || '无'}`,
    `正文：${asset.body || '未写'}`,
    `行业：${asset.details.industry || '未写'}`,
    `客户问题：${asset.details.problem || '未写'}`,
    `做法：${asset.details.approach || '未写'}`,
    `怎么运作：${asset.details.howItWorks || '未写'}`,
    metrics.length > 0 ? `已授权的前后数据：\n${metrics.map((item) => `- ${formatMetric(item)}`).join('\n')}` : '已授权的前后数据：没有。不要编造时间、成本、准确率或吞吐。',
    hidden > 0 ? `另有 ${hidden} 条未授权数据，不要写出那些数字。` : '',
    asset.details.quoteAuthorized && asset.details.quote.trim()
      ? `客户原话（已授权）：${asset.details.quote.trim()}`
      : asset.details.quote.trim()
        ? '客户原话未授权，不要引用。'
        : '',
    `链接：${asset.links.map((item) => `${item.label || '链接'} ${item.url}`).join('；') || '无'}`,
    `可写的角度：\n${assetAngles(asset).map((item) => `- ${item}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function draftFromAssets(studio: Studio, assets: Asset[], channelPath: string, mention: BrandMention): DraftBrief {
  const metric = assets.flatMap((item) => authorizedMetrics(item.details))[0]
  const problem = assets.map((item) => item.details.problem.trim()).find(Boolean)
  const opener = metric
    ? `客户的${metric.name}从 ${metric.before}${metric.unit} 变成 ${metric.after}${metric.unit}。${problem ?? ''}`.trim()
    : problem || assets[0]?.body.trim() || `【待补充：从素材库补上客户当时的具体问题】`
  const sections = [
    opener,
    '',
    ...assets.flatMap((item) => {
      const lines = [`${assetTypeLabel(item.type)}：${item.title}`, item.body.trim()]
      if (item.details.approach.trim()) lines.push(item.details.approach.trim())
      if (item.details.howItWorks.trim()) lines.push(item.details.howItWorks.trim())
      for (const entry of authorizedMetrics(item.details)) lines.push(formatMetric(entry))
      if (item.details.quoteAuthorized && item.details.quote.trim()) lines.push(`客户原话：「${item.details.quote.trim()}」`)
      return lines.filter(Boolean)
    }),
    mention === 'guide' ? `想看具体做法，可以从 ${studio.name} 的公开说明开始：${studio.website}` : '',
  ].filter((part) => part !== '')
  const fact = metric ? `${metric.name}从 ${metric.before}${metric.unit} 到 ${metric.after}${metric.unit}` : clip(opener, 80)
  const storyCites = [
    `客户的${fact}。`,
    assets[1] ? `另一处材料是：${clip(assets[1].title, 60)}` : `做法写在素材里：${clip(assets[0]?.title || '待补充', 60)}`,
  ]
  const cites =
    mention === 'guide'
      ? [`${studio.name}记录到：客户的${fact}。`, `${studio.name}公开的一处材料是：${clip(assets[0]?.title || studio.name, 40)}`]
      : storyCites
  const titleSource = assets[0]?.title || '客户侧的一处变化'
  return {
    title: clip(titleSource.length >= 4 ? titleSource : `${titleSource}的变化`, 80),
    body: sections.join('\n\n'),
    citeSentences: cites.filter((item) => item.length >= 12).slice(0, 5),
    urlHint: `${safeOrigin(studio.website)}${channelPath}`,
  }
}

export function allowedNumbers(assets: Asset[]): Set<string> {
  const set = new Set<string>()
  const collect = (value: string) => {
    for (const match of value.match(/\d+(?:\.\d+)?/g) ?? []) set.add(match)
  }
  for (const asset of assets) {
    collect(asset.title)
    collect(asset.body)
    collect(asset.details.industry)
    collect(asset.details.problem)
    collect(asset.details.approach)
    collect(asset.details.howItWorks)
    if (asset.details.quoteAuthorized) collect(asset.details.quote)
    for (const metric of asset.details.metrics) {
      if (!metric.customerAuthorized) continue
      collect(metric.name)
      collect(metric.before)
      collect(metric.after)
      collect(metric.unit)
      collect(metric.source)
    }
  }
  return set
}

function readDetails(value: unknown): { ok: true; value: AssetDetails } | { ok: false; field: string; error: string } {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const industry = text(record.industry, 200)
  const problem = text(record.problem, LONG)
  const approach = text(record.approach, LONG)
  const howItWorks = text(record.howItWorks, LONG)
  const quote = text(record.quote, 500)
  if (industry === null) return { ok: false, field: 'industry', error: '行业过长' }
  if (problem === null) return { ok: false, field: 'problem', error: '问题过长' }
  if (approach === null) return { ok: false, field: 'approach', error: '做法过长' }
  if (howItWorks === null) return { ok: false, field: 'howItWorks', error: '运作方式过长' }
  if (quote === null) return { ok: false, field: 'quote', error: '客户原话过长' }
  const metrics = readMetrics(record.metrics)
  if (!metrics.ok) return metrics
  return {
    ok: true,
    value: {
      industry: industry ?? '',
      problem: problem ?? '',
      approach: approach ?? '',
      howItWorks: howItWorks ?? '',
      metrics: metrics.items,
      quote: quote ?? '',
      quoteAuthorized: record.quoteAuthorized === true,
    },
  }
}

function readMetrics(value: unknown): { ok: true; items: CaseMetric[] } | { ok: false; field: string; error: string } {
  if (value === undefined || value === null) return { ok: true, items: [] }
  if (!Array.isArray(value)) return { ok: false, field: 'metrics', error: '指标格式不正确' }
  if (value.length > 12) return { ok: false, field: 'metrics', error: '一条素材最多 12 组指标' }
  const items: CaseMetric[] = []
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') return { ok: false, field: 'metrics', error: `第 ${index + 1} 组指标格式不正确` }
    const record = entry as Record<string, unknown>
    const name = text(record.name, 40)
    const before = text(record.before, 40)
    const after = text(record.after, 40)
    const unit = text(record.unit, 20)
    const source = text(record.source, 200)
    if ([name, before, after, unit, source].some((item) => item === null)) {
      return { ok: false, field: 'metrics', error: `第 ${index + 1} 组指标有一项过长` }
    }
    if (!name && !before && !after && !unit && !source) continue
    if (!name) return { ok: false, field: 'metrics', error: `第 ${index + 1} 组指标还没有名称` }
    items.push({
      id: idOf(record.id, `metric-${index + 1}`),
      name: name ?? '',
      before: before ?? '',
      after: after ?? '',
      unit: unit ?? '',
      source: source ?? '',
      customerAuthorized: record.customerAuthorized === true,
    })
  }
  return { ok: true, items }
}

function readTags(value: unknown): { ok: true; items: string[] } | { ok: false; field: string; error: string } {
  if (value === undefined || value === null) return { ok: true, items: [] }
  const source = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : typeof value === 'string'
      ? value.split(/[,，]/)
      : null
  if (!source) return { ok: false, field: 'tags', error: '标签格式不正确' }
  const items = [...new Set(source.map((item) => item.trim()).filter(Boolean))]
  if (items.length > 20) return { ok: false, field: 'tags', error: `标签有 ${items.length} 个，上限是 20 个` }
  if (items.some((item) => item.length > 24)) return { ok: false, field: 'tags', error: '有一个标签超过 24 个字' }
  return { ok: true, items }
}

function readLinks(value: unknown): { ok: true; items: AssetLink[] } | { ok: false; field: string; error: string } {
  if (value === undefined || value === null) return { ok: true, items: [] }
  if (!Array.isArray(value)) return { ok: false, field: 'links', error: '链接格式不正确' }
  if (value.length > 12) return { ok: false, field: 'links', error: '链接最多 12 条' }
  const items: AssetLink[] = []
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') return { ok: false, field: 'links', error: `第 ${index + 1} 条链接格式不正确` }
    const record = entry as Record<string, unknown>
    const label = text(record.label, 80) ?? ''
    const urlRaw = typeof record.url === 'string' ? record.url.trim() : ''
    if (!label && !urlRaw) continue
    if (!urlRaw) return { ok: false, field: 'links', error: `第 ${index + 1} 条链接还没有地址` }
    try {
      items.push({ id: idOf(record.id, `link-${index + 1}`), label, url: assertPublicHttpUrl(urlRaw).toString() })
    } catch (error) {
      const message = error instanceof Error ? error.message : '链接不正确'
      return { ok: false, field: 'links', error: `第 ${index + 1} 条链接：${message}` }
    }
  }
  return { ok: true, items }
}

function text(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > max) return null
  return trimmed
}

function idOf(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return /^[\w-]{1,80}$/.test(trimmed) ? trimmed : fallback
}

function clip(value: string, max = 80): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

function safeOrigin(website: string): string {
  try {
    return new URL(website).origin
  } catch {
    return website.replace(/\/$/, '')
  }
}
