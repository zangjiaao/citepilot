import { describe, expect, it } from 'vitest'
import { compareCycles } from '../shared/compare.ts'
import type { Cycle, Observation, Prompt } from '../shared/types.ts'

const prompt = (id: string, text: string): Prompt => ({
  id,
  studioId: 's',
  cluster: 'category',
  text,
  rationale: '',
  source: 'seed',
  createdAt: '',
})

const observation = (partial: Pick<Observation, 'id' | 'promptId' | 'cycleId' | 'brandMentioned' | 'ownUrlCited'>): Observation => ({
  studioId: 's',
  promptText: '',
  cluster: 'category',
  cycleName: '',
  platform: 'kimi',
  answerText: 'x'.repeat(20),
  brandSnippets: [],
  citedUrls: [],
  competitorsMentioned: [],
  sentiment: 'neutral',
  summary: '',
  parser: 'rules',
  createdAt: '',
  ...partial,
})

describe('compareCycles', () => {
  it('shows a prompt moving from unmentioned to mentioned', () => {
    const prompts = [prompt('p06', '企业想做智能体应用，应该怎么选服务商？'), prompt('p16', '制造企业怎么开工？')]
    const cycles: Cycle[] = [
      { id: 'base', studioId: 's', name: '基线', kind: 'baseline', createdAt: '' },
      { id: 're', studioId: 's', name: '复测', kind: 'retest', createdAt: '' },
    ]
    const observations = [
      observation({ id: '1', promptId: 'p06', cycleId: 'base', brandMentioned: false, ownUrlCited: false }),
      observation({ id: '2', promptId: 'p06', cycleId: 're', brandMentioned: true, ownUrlCited: true }),
    ]
    const report = compareCycles(prompts, observations, cycles[0] ?? null, cycles[1] ?? null)
    expect(report.from?.metrics.mentionRate).toBe(0)
    expect(report.to?.metrics.mentionRate).toBe(1)
    expect(report.rows[0]).toMatchObject({ fromMentioned: false, toMentioned: true, toCited: true })
    expect(report.rows[1]).toMatchObject({ fromMentioned: null, toMentioned: null })
  })

  it('compares two custom rounds the same way as the first baseline pair', () => {
    const prompts = [prompt('p06', '企业想做智能体应用，应该怎么选服务商？')]
    const earlier: Cycle = { id: 'round-2', studioId: 's', name: '第 2 轮', kind: 'custom', createdAt: '' }
    const later: Cycle = { id: 'round-3', studioId: 's', name: '第 3 轮', kind: 'custom', createdAt: '' }
    const observations = [
      observation({ id: '1', promptId: 'p06', cycleId: 'round-2', brandMentioned: false, ownUrlCited: false }),
      observation({ id: '2', promptId: 'p06', cycleId: 'round-3', brandMentioned: true, ownUrlCited: true }),
    ]
    const report = compareCycles(prompts, observations, earlier, later)
    expect(report.from?.name).toBe('第 2 轮')
    expect(report.to?.kind).toBe('custom')
    expect(report.rows[0]).toMatchObject({ fromMentioned: false, toMentioned: true, toCited: true })
  })
})
