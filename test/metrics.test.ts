import { describe, expect, it } from 'vitest'
import { metricsFor, MIN_STABLE_SAMPLES, sampleStabilityNote } from '../shared/compare.ts'
import type { Competitor, Observation } from '../shared/types.ts'

const tracked: Competitor[] = [
  { id: 'comp-lanzhou', name: '澜舟智能体实验室', aliases: ['澜舟', '澜舟实验室'], domain: 'lanzhou.example' },
  { id: 'comp-beipo', name: '北坡应用工场', aliases: ['北坡'], domain: 'beipo.example' },
]

const scope = { ownName: '澄川智能体工场', website: 'https://example.com', competitors: tracked }

function observation(partial: Partial<Observation> & Pick<Observation, 'id' | 'promptId' | 'platform'>): Observation {
  return {
    studioId: 's',
    promptText: '企业想做智能体应用，应该怎么选服务商？',
    cluster: 'category',
    cycleId: 'c',
    cycleName: '批次',
    answerText: '',
    brandMentioned: false,
    brandSnippets: [],
    citedUrls: [],
    ownUrlCited: false,
    competitorsMentioned: [],
    brandHits: [],
    sentiment: 'neutral',
    summary: '',
    parser: 'rules',
    createdAt: '',
    ...partial,
  }
}

describe('metricsFor', () => {
  it('counts mention and citation rates by sample, including several pastes of one prompt', () => {
    const observations = [
      observation({
        id: '1',
        promptId: 'p06',
        platform: 'deepseek',
        brandMentioned: true,
        ownUrlCited: true,
        brandHits: [{ key: 'self', name: '澄川智能体工场', mentioned: true, rank: 1, cited: true }],
      }),
      observation({
        id: '2',
        promptId: 'p06',
        platform: 'kimi',
        brandMentioned: true,
        competitorsMentioned: ['澜舟智能体实验室'],
        brandHits: [
          { key: 'comp-lanzhou', name: '澜舟智能体实验室', mentioned: true, rank: 1, cited: false },
          { key: 'self', name: '澄川智能体工场', mentioned: true, rank: 2, cited: false },
        ],
      }),
      observation({ id: '3', promptId: 'p06', platform: 'doubao' }),
      observation({
        id: '4',
        promptId: 'p11',
        promptText: '澄川和澜舟的差别？',
        platform: 'chatgpt',
        brandMentioned: false,
        brandHits: [{ key: 'comp-lanzhou', name: '澜舟智能体实验室', mentioned: true, rank: 1, cited: true }],
      }),
    ]
    const metrics = metricsFor(observations, scope)
    expect(metrics.observations).toBe(4)
    expect(metrics.promptsCovered).toBe(2)
    expect(metrics.mentionRate).toBe(0.5)
    expect(metrics.citationRate).toBe(0.25)
    expect(metrics.shareOfVoice).toBe(0.5)
    expect(metrics.averageRank).toBe(1.5)
    expect(metrics.stable).toBe(false)
    expect(sampleStabilityNote(metrics.observations)).toContain('结论不稳定')
    expect(sampleStabilityNote(MIN_STABLE_SAMPLES)).toBeNull()
    expect(metrics.byPrompt.find((item) => item.promptId === 'p06')).toMatchObject({
      observations: 3,
      mentionRate: 2 / 3,
      stable: false,
    })
    expect(metrics.byPlatform.find((item) => item.platform === 'kimi')?.mentionRate).toBe(1)
    const self = metrics.brands.find((item) => item.key === 'self')
    const lanzhou = metrics.brands.find((item) => item.key === 'comp-lanzhou')
    expect(self).toMatchObject({ mentions: 2, share: 0.5, averageRank: 1.5 })
    expect(lanzhou).toMatchObject({ mentions: 2, share: 0.5 })
    expect(metrics.brands.find((item) => item.key === 'comp-beipo')).toMatchObject({ mentions: 0, share: 0 })
  })

  it('treats a legacy one-answer row as a single sample without a rank', () => {
    const metrics = metricsFor([
      observation({
        id: 'legacy',
        promptId: 'p01',
        promptText: '澄川智能体工场是做什么的？',
        platform: 'wenxin',
        answerText: '旧数据只有布尔标记，没有品牌命中。',
        brandMentioned: true,
        ownUrlCited: false,
        competitorsMentioned: ['澜舟智能体实验室'],
      }),
    ])
    expect(metrics.observations).toBe(1)
    expect(metrics.mentionRate).toBe(1)
    expect(metrics.shareOfVoice).toBe(0.5)
    expect(metrics.averageRank).toBeNull()
    expect(metrics.stable).toBe(false)
  })

  it('re-parses an old answer when the stored hits are empty and the profile is known', () => {
    const metrics = metricsFor(
      [
        observation({
          id: 'old',
          promptId: 'p01',
          platform: 'deepseek',
          answerText: '澜舟实验室写在前面。澄川智能体工场写在后面，官网 https://example.com 。',
          brandMentioned: true,
          ownUrlCited: true,
          competitorsMentioned: ['澜舟智能体实验室'],
        }),
      ],
      scope,
    )
    expect(metrics.mentionRate).toBe(1)
    expect(metrics.citationRate).toBe(1)
    expect(metrics.shareOfVoice).toBe(0.5)
    expect(metrics.averageRank).toBe(2)
  })
})
