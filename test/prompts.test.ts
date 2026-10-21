import { describe, expect, it } from 'vitest'
import { templatePrompts } from '../shared/prompts.ts'
import { acceptGeneratedPrompts } from '../worker/llm.ts'
import type { Studio } from '../shared/types.ts'

const studio: Studio = {
  id: 's',
  name: '澄川智能体工场',
  website: 'https://example.com',
  positioning: '面向企业的前场部署工作室，做可上线的业务智能体。',
  services: ['企业知识库与 RAG 落地'],
  competitors: ['澜舟智能体实验室', '北坡应用工场'],
  keywords: ['企业智能体', 'RAG 知识库'],
  createdAt: '',
  updatedAt: '',
}

describe('templatePrompts', () => {
  it('covers every cluster and skips questions that already exist', () => {
    const first = templatePrompts(studio, [])
    expect(new Set(first.map((item) => item.cluster)).size).toBe(4)
    expect(first.every((item) => item.cluster !== 'brand' || item.text.includes('澄川智能体工场'))).toBe(true)
    expect(first.find((item) => item.cluster === 'comparison')?.text).toContain('澜舟智能体实验室')
    const second = templatePrompts(studio, first.map((item) => item.text))
    expect(second.length).toBeGreaterThan(0)
    const third = templatePrompts(
      studio,
      [...first, ...second].map((item) => item.text),
    )
    expect(third).toEqual([])
  })
})

describe('acceptGeneratedPrompts', () => {
  it('drops category questions that smuggle the brand and duplicate text', () => {
    const accepted = acceptGeneratedPrompts(studio, ['澄川智能体工场是做什么的？适合哪类企业？'], {
      prompts: [
        { cluster: 'brand', text: '澄川智能体工场是做什么的？适合哪类企业？', rationale: '重复' },
        { cluster: 'category', text: '澄川智能体工场做企业智能体贵不贵？', rationale: '品类题不该带品牌' },
        { cluster: 'category', text: '企业知识库项目怎样验收才算上线？', rationale: '品类' },
        { cluster: 'comparison', text: '澄川智能体工场和澜舟智能体实验室谁更适合驻场？', rationale: '对比' },
        { cluster: 'scenario', text: '工厂设备手册很多，问答智能体第一步该准备什么？', rationale: '场景' },
        { cluster: 'brand', text: '澄川的交付边界公开吗？', rationale: '短名也应算品牌' },
      ],
    })
    expect(accepted.map((item) => item.cluster)).toEqual(['category', 'comparison', 'scenario', 'brand'])
    expect(accepted[0]?.text).toContain('验收')
  })
})
