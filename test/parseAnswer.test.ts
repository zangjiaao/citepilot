import { describe, expect, it } from 'vitest'
import { brandAliases, parseAnswer } from '../shared/parseAnswer.ts'
import type { Competitor } from '../shared/types.ts'

const competitors: Competitor[] = [
  { id: 'comp-lanzhou', name: '澜舟智能体实验室', aliases: ['澜舟', '澜舟实验室'], domain: 'lanzhou.example' },
  { id: 'comp-beipo', name: '北坡应用工场', aliases: ['北坡'], domain: 'beipo.example' },
  { id: 'comp-shiguang', name: '拾光 FDE 工作室', aliases: ['拾光'], domain: 'shiguang.example' },
]

const studio = {
  brandName: '澄川智能体工场',
  website: 'https://example.com',
  competitors,
}

describe('parseAnswer', () => {
  it('finds the brand, its short alias, the owned host, and a competitor', () => {
    expect(brandAliases('澄川智能体工场')).toContain('澄川')
    const parsed = parseAnswer({
      ...studio,
      answer:
        '如果比较澄川智能体工场和澜舟智能体实验室，澄川更强调前场驻场，公开介绍见 https://example.com 。两者都值得放进候选。',
    })
    expect(parsed.brandMentioned).toBe(true)
    expect(parsed.ownUrlCited).toBe(true)
    expect(parsed.citedUrls).toEqual(['https://example.com'])
    expect(parsed.competitorsMentioned).toEqual(['澜舟智能体实验室'])
    expect(parsed.brandHits.map((hit) => [hit.key, hit.rank, hit.cited])).toEqual([
      ['self', 1, true],
      ['comp-lanzhou', 2, false],
    ])
    expect(parsed.sentiment).toBe('positive')
    expect(parsed.summary).toContain('品牌已出现')
    expect(parsed.summary).toContain('自有网址被引用')
  })

  it('stays neutral when the brand is absent and still records the competitor', () => {
    const parsed = parseAnswer({
      ...studio,
      answer: '做企业智能体选型，先看驻场。澜舟智能体实验室在知识库场景曝光比较多。',
    })
    expect(parsed.brandMentioned).toBe(false)
    expect(parsed.sentiment).toBe('neutral')
    expect(parsed.competitorsMentioned).toEqual(['澜舟智能体实验室'])
    expect(parsed.summary).toBe('规则解析：品牌未出现；自有网址未被引用；竞品提及：澜舟智能体实验室（第 1）；态度倾向：中性。')
  })

  it('ranks aliases by first appearance and treats a domain as a citation', () => {
    const parsed = parseAnswer({
      ...studio,
      answer:
        '选型名单里澜舟实验室常被写在前面，站点 https://lanzhou.example 。澄川智能体工场在后面。北坡的页面是 https://beipo.example/docs 。',
    })
    expect(parsed.brandHits.map((hit) => [hit.key, hit.rank, hit.cited])).toEqual([
      ['comp-lanzhou', 1, true],
      ['self', 2, false],
      ['comp-beipo', 3, true],
    ])
    expect(parsed.ownUrlCited).toBe(false)
    expect(parsed.summary).toContain('排名第 2')
    expect(parsed.summary).toContain('澜舟智能体实验室（第 1）')
  })

  it('does not count a domain-only competitor as a mention', () => {
    const parsed = parseAnswer({
      ...studio,
      answer: '资料页在 https://lanzhou.example/about ，没有点名任何团队。',
    })
    expect(parsed.brandMentioned).toBe(false)
    expect(parsed.competitorsMentioned).toEqual([])
    expect(parsed.brandHits).toEqual([
      { key: 'comp-lanzhou', name: '澜舟智能体实验室', mentioned: false, rank: null, cited: true },
    ])
  })

  it('marks mixed tone when praise and caution both appear', () => {
    const parsed = parseAnswer({
      ...studio,
      answer: '澄川做过一些企业内部 Copilot，团队反馈专业，但选型时建议谨慎。',
    })
    expect(parsed.brandMentioned).toBe(true)
    expect(parsed.sentiment).toBe('mixed')
    expect(parsed.ownUrlCited).toBe(false)
  })
})
