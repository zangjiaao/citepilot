import type { Asset, AssetType } from './assets.ts'
import type { ContentType } from './draftPrompt.ts'
import type { Cluster, Prompt, Studio } from './types.ts'

/** Preferred asset types per content type. Higher means a closer fit. Private assets are never recommended. */
const TYPE_WEIGHTS: Record<ContentType, Partial<Record<AssetType, number>>> = {
  'case-breakdown': { case: 8, outcome: 8, testimonial: 4, lesson: 3, product: 2, interaction: 2, idea: 2 },
  interaction: { interaction: 8, idea: 8, product: 7, case: 3, reference: 2 },
  'build-log': { lesson: 7, case: 6, idea: 4, interaction: 4, product: 3 },
  retro: { lesson: 9, case: 3, idea: 2, outcome: 2 },
  thread: { idea: 6, interaction: 5, outcome: 5, lesson: 4, case: 3, product: 3 },
  'short-post': { idea: 6, interaction: 5, outcome: 5, testimonial: 4, lesson: 3, product: 3, case: 2 },
  zhihu: { case: 7, outcome: 7, lesson: 4, idea: 3, product: 3, testimonial: 3 },
  wechat: { case: 8, outcome: 8, lesson: 4, testimonial: 4, product: 2, idea: 2 },
  faq: { product: 7, reference: 6, idea: 5, case: 5, lesson: 4, outcome: 4 },
}

const CLUSTER_FIT: Record<ContentType, Partial<Record<Cluster, number>>> = {
  'case-breakdown': { scenario: 3, brand: 2, category: 1 },
  interaction: { scenario: 3, category: 2 },
  'build-log': { scenario: 3, category: 2 },
  retro: { scenario: 3, category: 2 },
  thread: { scenario: 2, category: 2 },
  'short-post': { scenario: 3, category: 2 },
  zhihu: { category: 3, comparison: 2, scenario: 2 },
  wechat: { scenario: 3, brand: 2, category: 2 },
  faq: { category: 4, brand: 3, scenario: 1 },
}

const SHORT_TYPES = new Set<ContentType>(['short-post', 'thread'])
const RICH_TYPES = new Set<ContentType>(['case-breakdown', 'wechat', 'zhihu'])
const STRONG_SCORE = 6

export interface PromptMention {
  promptId: string
  mentioned: boolean
}

export interface DraftRecommendation {
  assetIds: string[]
  rankedIds: string[]
  promptId: string | null
}

type PromptLike = Pick<Prompt, 'id' | 'text' | 'cluster'>
type StudioLike = Pick<Studio, 'keywords' | 'services' | 'positioning'>

export function recommendDraftSelection(input: {
  contentType: ContentType
  assets: Asset[]
  studio: StudioLike
  prompts?: PromptLike[]
  mentions?: PromptMention[]
}): DraftRecommendation {
  const usable = input.assets.filter((item) => item.publicity !== 'private')
  const ranked = usable
    .map((item) => ({ id: item.id, score: scoreAsset(item, input.contentType, input.studio) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const cap = SHORT_TYPES.has(input.contentType) ? 2 : 3
  const strong = ranked.filter((item) => item.score >= STRONG_SCORE).length
  const count = ranked.length === 0 ? 0 : Math.min(cap, Math.max(1, Math.min(strong, cap)))
  return {
    assetIds: ranked.slice(0, count).map((item) => item.id),
    rankedIds: ranked.map((item) => item.id),
    promptId: suggestPrompt(input.contentType, input.studio, usable, input.prompts ?? [], input.mentions ?? []),
  }
}

function scoreAsset(asset: Asset, contentType: ContentType, studio: StudioLike): number {
  let score = TYPE_WEIGHTS[contentType][asset.type] ?? 0
  const metrics = asset.details.metrics.filter((item) => item.customerAuthorized && (item.before || item.after))
  if (metrics.length > 0) score += RICH_TYPES.has(contentType) || asset.type === 'outcome' ? 4 : 2
  if (asset.details.howItWorks.trim()) {
    score += contentType === 'build-log' || contentType === 'interaction' ? 5 : 1
  }
  if (asset.details.problem.trim()) score += 1
  if (asset.details.quoteAuthorized && asset.details.quote.trim()) score += contentType === 'case-breakdown' || contentType === 'wechat' ? 2 : 1
  if (asset.type === 'testimonial' && asset.details.quote.trim() && !asset.details.quoteAuthorized) score -= 2
  score += Math.min(3, overlapCount(assetText(asset), studioTerms(studio)))
  const length = asset.body.trim().length
  if (SHORT_TYPES.has(contentType)) score += length > 0 && length <= 160 ? 3 : length > 500 ? -3 : 0
  if (RICH_TYPES.has(contentType) && assetText(asset).length > 180) score += 2
  return score
}

function suggestPrompt(
  contentType: ContentType,
  studio: StudioLike,
  assets: Asset[],
  prompts: PromptLike[],
  mentions: PromptMention[],
): string | null {
  const terms = [...studioTerms(studio), ...assets.flatMap((item) => [item.title, ...item.tags, item.details.problem, item.details.industry])]
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
  let best: { id: string; score: number; rate: number } | null = null
  for (const prompt of prompts) {
    const overlap = terms.filter((term) => prompt.text.includes(term)).length
    const stats = mentionStats(prompt.id, mentions)
    const cluster = CLUSTER_FIT[contentType][prompt.cluster] ?? 0
    let score = cluster + Math.min(overlap, 3) * 3
    if (stats.rate === null) score += 0.5
    else score += (1 - stats.rate) * 4
    if (stats.rate !== null && stats.rate >= 0.8) score -= 2
    const eligible = score >= 3 && (overlap > 0 || (stats.rate !== null && stats.rate < 0.5))
    if (!eligible) continue
    const rate = stats.rate ?? 1
    if (!best || score > best.score || (score === best.score && rate < best.rate)) best = { id: prompt.id, score, rate }
  }
  return best?.id ?? null
}

function mentionStats(promptId: string, mentions: PromptMention[]): { samples: number; rate: number | null } {
  const rows = mentions.filter((item) => item.promptId === promptId)
  if (rows.length === 0) return { samples: 0, rate: null }
  return { samples: rows.length, rate: rows.filter((item) => item.mentioned).length / rows.length }
}

function studioTerms(studio: StudioLike): string[] {
  return [...studio.keywords, ...studio.services, studio.positioning].map((item) => item.trim()).filter((item) => item.length >= 2)
}

function assetText(asset: Asset): string {
  return [asset.title, asset.body, asset.details.problem, asset.details.approach, asset.details.howItWorks].join('')
}

function overlapCount(text: string, terms: string[]): number {
  return terms.filter((term) => text.includes(term)).length
}
