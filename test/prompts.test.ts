import { describe, expect, it } from 'vitest'
import { emptyDetails, type Asset } from '../shared/assets.ts'
import { assemblePromptGeneration, assetGroundedCount, templatePrompts } from '../shared/prompts.ts'
import { acceptGeneratedPrompts, acceptOwnSentiment } from '../worker/llm.ts'
import { blankBrandProfile } from '../shared/brandProfile.ts'
import type { Studio } from '../shared/types.ts'

const studio: Studio = {
  id: 's',
  name: '澄川智能体工场',
  website: 'https://example.com',
  positioning: '面向企业的前场部署工作室，做可上线的业务智能体。',
  services: ['企业知识库与 RAG 落地'],
  competitors: [
    { id: 'comp-lanzhou', name: '澜舟智能体实验室', aliases: ['澜舟'], domain: 'lanzhou.example' },
    { id: 'comp-beipo', name: '北坡应用工场', aliases: [], domain: '' },
  ],
  keywords: ['企业智能体', 'RAG 知识库'],
  capabilities: [],
  cases: [],
  targetCustomers: [],
  solutions: [],
  ...blankBrandProfile(),
  createdAt: '',
  updatedAt: '',
}

function libraryAsset(partial: Pick<Asset, 'id' | 'title'> & Partial<Asset>): Asset {
  return {
    studioId: 's',
    type: partial.type ?? 'idea',
    body: partial.body ?? '',
    details: partial.details ?? emptyDetails(),
    tags: partial.tags ?? [],
    links: [],
    publicity: partial.publicity ?? 'public',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

const citationAssets: Asset[] = [
  libraryAsset({
    id: 'clause',
    title: '按条款切，不按整本 PDF 切',
    tags: ['切分', '条款'],
    details: { ...emptyDetails(), problem: '按页切开时，一条条款会被截在两块中间。', howItWorks: '条款号当主键，段落是条款正文。' },
  }),
  libraryAsset({
    id: 'misquote',
    type: 'outcome',
    title: '每周抽查里的错引被数出来',
    tags: ['错引', '抽查'],
    details: {
      ...emptyDetails(),
      problem: '上线第一周，引用经常落到相邻条款。',
      approach: '改成按条款切分后再抽查。',
      metrics: [{ id: 'm', name: '错引', before: '6', after: '1', unit: '条', source: '抽查', customerAuthorized: true }],
    },
  }),
  libraryAsset({
    id: 'source',
    type: 'case',
    title: '尽调报告从翻手册变成点开出处',
    tags: ['尽调', '出处'],
    details: { ...emptyDetails(), industry: '装备制造', problem: '写尽调时，出处散在三本手册里。', approach: '先把手册按条款切开。' },
  }),
  libraryAsset({
    id: 'secret',
    type: 'case',
    title: '内部试点',
    publicity: 'private',
    details: { ...emptyDetails(), problem: '验收题里有未公开的内部流程编号。' },
  }),
]

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

  it('writes scenario questions the asset library can answer', () => {
    const prompts = templatePrompts(studio, [], citationAssets)
    const text = prompts.map((item) => item.text).join('\n')
    expect(text).toMatch(/出处|条款|错引/)
    expect(text).not.toContain('内部流程编号')
    expect(prompts.some((item) => item.cluster === 'brand' && item.text.includes('澄川智能体工场'))).toBe(true)
    expect(prompts.some((item) => item.cluster === 'comparison')).toBe(true)
    expect(prompts.filter((item) => item.cluster === 'scenario' || item.cluster === 'category').length).toBeGreaterThan(1)
    const brief = assemblePromptGeneration(studio, [], citationAssets)
    expect(brief.user).toContain('按条款切，不按整本 PDF 切')
    expect(brief.user).toContain('错引')
    expect(brief.system).toContain('素材库')
    expect(brief.user).not.toContain('内部流程编号')
    expect(assetGroundedCount(prompts, citationAssets, studio)).toBeGreaterThan(0)
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

describe('acceptOwnSentiment', () => {
  it('keeps positive, neutral, and negative, and drops anything else', () => {
    expect(acceptOwnSentiment({ sentiment: 'positive' })).toBe('positive')
    expect(acceptOwnSentiment({ sentiment: 'neutral' })).toBe('neutral')
    expect(acceptOwnSentiment({ sentiment: 'negative' })).toBe('negative')
    expect(acceptOwnSentiment({ sentiment: 'mixed' })).toBeNull()
    expect(acceptOwnSentiment({ summary: '只有摘要' })).toBeNull()
    expect(acceptOwnSentiment(null)).toBeNull()
  })
})
