import type { CompareReport, Cycle, CycleMetrics, Observation, Prompt } from './types.ts'

export function metricsFor(observations: Observation[]): CycleMetrics {
  const prompts = new Set(observations.map((item) => item.promptId))
  const ratio = (count: number) => (observations.length === 0 ? null : count / observations.length)
  const byPlatform = new Map<string, Observation[]>()
  for (const observation of observations) {
    const list = byPlatform.get(observation.platform) ?? []
    list.push(observation)
    byPlatform.set(observation.platform, list)
  }
  return {
    observations: observations.length,
    promptsCovered: prompts.size,
    mentionRate: ratio(observations.filter((item) => item.brandMentioned).length),
    citationRate: ratio(observations.filter((item) => item.ownUrlCited).length),
    competitorRate: ratio(observations.filter((item) => item.competitorsMentioned.length > 0).length),
    byPlatform: [...byPlatform.entries()].map(([platform, list]) => ({
      platform,
      observations: list.length,
      mentionRate: list.length === 0 ? null : list.filter((item) => item.brandMentioned).length / list.length,
    })),
  }
}

export function compareCycles(
  prompts: Prompt[],
  observations: Observation[],
  from: Cycle | null,
  to: Cycle | null,
): CompareReport {
  const fromObs = from ? observations.filter((item) => item.cycleId === from.id) : []
  const toObs = to ? observations.filter((item) => item.cycleId === to.id) : []
  const any = (list: Observation[], promptId: string, pick: (item: Observation) => boolean): boolean | null => {
    const rows = list.filter((item) => item.promptId === promptId)
    if (rows.length === 0) return null
    return rows.some(pick)
  }
  const names = (list: Observation[], promptId: string) => {
    const found = new Set<string>()
    for (const row of list) {
      if (row.promptId !== promptId) continue
      for (const name of row.competitorsMentioned) found.add(name)
    }
    return [...found]
  }
  return {
    from: from ? { id: from.id, name: from.name, kind: from.kind, metrics: metricsFor(fromObs) } : null,
    to: to ? { id: to.id, name: to.name, kind: to.kind, metrics: metricsFor(toObs) } : null,
    rows: prompts.map((prompt) => ({
      promptId: prompt.id,
      text: prompt.text,
      cluster: prompt.cluster,
      fromMentioned: any(fromObs, prompt.id, (item) => item.brandMentioned),
      toMentioned: any(toObs, prompt.id, (item) => item.brandMentioned),
      fromCited: any(fromObs, prompt.id, (item) => item.ownUrlCited),
      toCited: any(toObs, prompt.id, (item) => item.ownUrlCited),
      fromCompetitors: names(fromObs, prompt.id),
      toCompetitors: names(toObs, prompt.id),
    })),
  }
}
