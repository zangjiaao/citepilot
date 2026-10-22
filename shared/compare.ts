import { parseAnswer } from './parseAnswer.ts'
import { SELF_BRAND_KEY, type BrandHit, type BrandShare, type CompareReport, type Competitor, type Cycle, type CycleMetrics, type Observation, type Prompt, type SampleGroup } from './types.ts'

export const MIN_STABLE_SAMPLES = 5

export interface MetricScope {
  ownName: string
  website: string
  competitors: Competitor[]
}

export function sampleStabilityNote(count: number): string | null {
  if (count <= 0 || count >= MIN_STABLE_SAMPLES) return null
  return `样本量 ${count}，少于 ${MIN_STABLE_SAMPLES}，结论不稳定`
}

export function metricsFor(observations: Observation[], scope?: MetricScope): CycleMetrics {
  const prompts = new Set(observations.map((item) => item.promptId))
  const voice = voiceOf(observations, scope)
  return {
    ...groupStats(observations, scope),
    promptsCovered: prompts.size,
    competitorRate: rate(observations, (item) => competitorMentioned(item, scope)),
    brands: voice.brands,
    byPlatform: [...groupBy(observations, (item) => item.platform).entries()]
      .map(([platform, list]) => ({ platform, ...groupStats(list, scope) }))
      .sort((a, b) => a.platform.localeCompare(b.platform, 'zh')),
    byPrompt: [...groupBy(observations, (item) => item.promptId).entries()]
      .map(([promptId, list]) => ({
        promptId,
        promptText: list[0]?.promptText ?? '',
        ...groupStats(list, scope),
      }))
      .sort((a, b) => a.promptText.localeCompare(b.promptText, 'zh')),
  }
}

export function compareCycles(
  prompts: Prompt[],
  observations: Observation[],
  from: Cycle | null,
  to: Cycle | null,
  scope?: MetricScope,
): CompareReport {
  const fromObs = from ? observations.filter((item) => item.cycleId === from.id) : []
  const toObs = to ? observations.filter((item) => item.cycleId === to.id) : []
  return {
    from: from ? { id: from.id, name: from.name, kind: from.kind, metrics: metricsFor(fromObs, scope) } : null,
    to: to ? { id: to.id, name: to.name, kind: to.kind, metrics: metricsFor(toObs, scope) } : null,
    rows: prompts.map((prompt) => {
      const left = sideStats(fromObs, prompt.id, scope)
      const right = sideStats(toObs, prompt.id, scope)
      return {
        promptId: prompt.id,
        text: prompt.text,
        cluster: prompt.cluster,
        fromMentioned: left.mentioned,
        toMentioned: right.mentioned,
        fromCited: left.cited,
        toCited: right.cited,
        fromSamples: left.samples,
        toSamples: right.samples,
        fromMentionedSamples: left.mentionedSamples,
        toMentionedSamples: right.mentionedSamples,
        fromCitedSamples: left.citedSamples,
        toCitedSamples: right.citedSamples,
        fromShare: left.share,
        toShare: right.share,
        fromAverageRank: left.averageRank,
        toAverageRank: right.averageRank,
        fromCompetitors: left.competitors,
        toCompetitors: right.competitors,
      }
    }),
  }
}

function groupStats(observations: Observation[], scope: MetricScope | undefined): SampleGroup {
  const voice = voiceOf(observations, scope)
  return {
    observations: observations.length,
    mentionRate: rate(observations, (item) => mentionedSelf(item, scope)),
    citationRate: rate(observations, (item) => citedSelf(item, scope)),
    shareOfVoice: voice.selfShare,
    averageRank: voice.selfRank,
    stable: observations.length >= MIN_STABLE_SAMPLES,
  }
}

function sideStats(list: Observation[], promptId: string, scope: MetricScope | undefined) {
  const rows = list.filter((item) => item.promptId === promptId)
  const voice = voiceOf(rows, scope)
  const names = new Set<string>()
  for (const row of rows) {
    for (const hit of hitsOf(row, scope)) {
      if (hit.key !== SELF_BRAND_KEY && hit.mentioned) names.add(hit.name)
    }
  }
  return {
    samples: rows.length,
    mentioned: rows.length === 0 ? null : rows.some((item) => mentionedSelf(item, scope)),
    cited: rows.length === 0 ? null : rows.some((item) => citedSelf(item, scope)),
    mentionedSamples: rows.filter((item) => mentionedSelf(item, scope)).length,
    citedSamples: rows.filter((item) => citedSelf(item, scope)).length,
    share: voice.selfShare,
    averageRank: voice.selfRank,
    competitors: [...names],
  }
}

interface Voice {
  brands: BrandShare[]
  selfShare: number | null
  selfRank: number | null
}

function voiceOf(observations: Observation[], scope: MetricScope | undefined): Voice {
  const acc = new Map<string, { key: string; name: string; mentions: number; rankSum: number; rankCount: number; citedSamples: number }>()
  const ensure = (key: string, name: string) => {
    const existing = acc.get(key)
    if (existing) {
      if (key !== SELF_BRAND_KEY && name) existing.name = name
      return existing
    }
    const created = { key, name: name || key, mentions: 0, rankSum: 0, rankCount: 0, citedSamples: 0 }
    acc.set(key, created)
    return created
  }
  ensure(SELF_BRAND_KEY, scope?.ownName || '本品牌')
  for (const competitor of scope?.competitors ?? []) ensure(competitor.id, competitor.name)
  for (const observation of observations) {
    for (const hit of hitsOf(observation, scope)) {
      if (!hit.mentioned && !hit.cited) continue
      const row = ensure(hit.key, hit.key === SELF_BRAND_KEY ? scope?.ownName || hit.name || '本品牌' : hit.name)
      if (hit.mentioned) {
        row.mentions += 1
        if (hit.rank != null) {
          row.rankSum += hit.rank
          row.rankCount += 1
        }
      }
      if (hit.cited) row.citedSamples += 1
    }
  }
  const total = [...acc.values()].reduce((sum, row) => sum + row.mentions, 0)
  const brands = [...acc.values()]
    .map((row) => ({
      key: row.key,
      name: row.name,
      mentions: row.mentions,
      share: total === 0 ? null : row.mentions / total,
      averageRank: row.rankCount === 0 ? null : row.rankSum / row.rankCount,
      citedSamples: row.citedSamples,
    }))
    .sort((a, b) => {
      if (a.key === SELF_BRAND_KEY) return -1
      if (b.key === SELF_BRAND_KEY) return 1
      return b.mentions - a.mentions || a.name.localeCompare(b.name, 'zh')
    })
  const self = brands.find((row) => row.key === SELF_BRAND_KEY)
  return { brands, selfShare: self?.share ?? null, selfRank: self?.averageRank ?? null }
}

function hitsOf(observation: Observation, scope: MetricScope | undefined): BrandHit[] {
  if (observation.brandHits.length > 0) return observation.brandHits
  if (scope && observation.answerText.trim()) {
    return parseAnswer({
      answer: observation.answerText,
      brandName: scope.ownName,
      website: scope.website,
      competitors: scope.competitors,
    }).brandHits
  }
  const hits: BrandHit[] = []
  if (observation.brandMentioned || observation.ownUrlCited) {
    hits.push({
      key: SELF_BRAND_KEY,
      name: scope?.ownName || '本品牌',
      mentioned: observation.brandMentioned,
      rank: null,
      cited: observation.ownUrlCited,
    })
  }
  for (const name of observation.competitorsMentioned) {
    const match = scope?.competitors.find((item) => item.name === name || item.aliases.includes(name))
    hits.push({ key: match?.id ?? `name:${name}`, name: match?.name ?? name, mentioned: true, rank: null, cited: false })
  }
  return hits
}

function mentionedSelf(observation: Observation, scope: MetricScope | undefined): boolean {
  return hitsOf(observation, scope).some((hit) => hit.key === SELF_BRAND_KEY && hit.mentioned)
}

function citedSelf(observation: Observation, scope: MetricScope | undefined): boolean {
  return hitsOf(observation, scope).some((hit) => hit.key === SELF_BRAND_KEY && hit.cited)
}

function competitorMentioned(observation: Observation, scope: MetricScope | undefined): boolean {
  return hitsOf(observation, scope).some((hit) => hit.key !== SELF_BRAND_KEY && hit.mentioned)
}

function rate(list: Observation[], pick: (item: Observation) => boolean): number | null {
  if (list.length === 0) return null
  return list.filter(pick).length / list.length
}

function groupBy(observations: Observation[], key: (item: Observation) => string): Map<string, Observation[]> {
  const map = new Map<string, Observation[]>()
  for (const item of observations) {
    const id = key(item)
    const list = map.get(id)
    if (list) list.push(item)
    else map.set(id, [item])
  }
  return map
}
