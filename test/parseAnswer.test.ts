import { describe, expect, it } from 'vitest'
import { brandAliases, parseAnswer } from '../shared/parseAnswer.ts'

const studio = {
  brandName: '澄川智能体工场',
  website: 'https://example.com',
  competitors: ['澜舟智能体实验室', '北坡应用工场', '拾光 FDE 工作室'],
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
    expect(parsed.summary).toBe('规则解析：品牌未出现；自有网址未被引用；竞品提及：澜舟智能体实验室；态度倾向：中性。')
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
