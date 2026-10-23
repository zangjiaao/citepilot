import { describe, expect, it } from 'vitest'
import { emptyDetails, type Asset } from '../shared/assets.ts'
import { buildOpsCockpit } from '../shared/overviewOps.ts'
import { blankBrandProfile } from '../shared/brandProfile.ts'
import type { Studio } from '../shared/types.ts'

const studio: Studio = {
  id: 's',
  name: '澄川智能体工场',
  website: 'https://example.com',
  positioning: '面向企业的前场部署工作室，做可上线的业务智能体。',
  services: ['企业知识库与 RAG 落地'],
  competitors: [{ id: 'comp-lanzhou', name: '澜舟智能体实验室', aliases: ['澜舟'], domain: '' }],
  keywords: ['企业智能体'],
  capabilities: [],
  cases: [],
  targetCustomers: [],
  solutions: [],
  ...blankBrandProfile(),
  createdAt: '',
  updatedAt: '',
}

function asset(partial: Pick<Asset, 'id' | 'title'> & Partial<Asset>): Asset {
  return {
    studioId: 's',
    type: partial.type ?? 'case',
    body: '',
    details: partial.details ?? emptyDetails(),
    tags: partial.tags ?? [],
    links: [],
    publicity: partial.publicity ?? 'public',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

const coveredPrompt = '写尽调时出处散在多本手册里，怎么让回答点开同一段原文？'
const brandPrompt = '澄川智能体工场是做什么的？适合哪类企业？'
const comparisonPrompt = '澄川智能体工场和澜舟智能体实验室比，差别在哪里？'

describe('buildOpsCockpit', () => {
  it('points an empty studio at the asset library first', () => {
    const ops = buildOpsCockpit({ studio, assets: [], prompts: [], drafts: [], observations: [], cycles: [] })
    expect(ops.empty).toBe(true)
    expect(ops.actions).toHaveLength(1)
    expect(ops.actions[0]?.href).toBe('/library')
    expect(ops.actions[0]?.detail).toContain('评估并补盲区')
    expect(ops.actions.map((item) => item.detail).join('')).not.toContain('两道')
  })

  it('sends uncovered assets to the prompt bank instead of a fixed batch', () => {
    const ops = buildOpsCockpit({
      studio,
      assets: [
        asset({ id: 'source', title: '尽调出处', tags: ['出处'], details: { ...emptyDetails(), problem: '写尽调时出处散在手册里。' } }),
        asset({
          id: 'hr',
          title: '企业员工入职引导',
          tags: ['入职'],
          details: { ...emptyDetails(), problem: '新员工培训要靠翻整本公司制度。', approach: '用 RAG 把制度按条款收下。' },
        }),
        asset({ id: 'secret', title: '内部试点', publicity: 'private', details: { ...emptyDetails(), problem: '验收题里有未公开的内部流程编号。' } }),
      ],
      prompts: [
        { id: 'p1', cluster: 'scenario', text: coveredPrompt },
        { id: 'p2', cluster: 'brand', text: brandPrompt },
        { id: 'p3', cluster: 'comparison', text: comparisonPrompt },
      ],
      drafts: [],
      observations: [],
      cycles: [],
    })
    const coverage = ops.actions.find((item) => item.id === 'coverage')
    expect(coverage?.href).toBe('/prompts')
    expect(coverage?.title).toBe('1 条素材还没有对应的题')
    expect(coverage?.detail).toContain('入职')
    expect(coverage?.detail).toContain('评估并补盲区')
    expect(ops.actions.map((item) => `${item.title}${item.detail}`).join('\n')).not.toContain('内部流程编号')
    expect(ops.actions.some((item) => item.id === 'draft' && item.href === '/drafts/new')).toBe(true)
    expect(ops.counts.publicAssets).toBe(2)
    expect(ops.counts.cases).toBe(2)
  })

  it('sends a prompt bank with no public assets back to the library', () => {
    const ops = buildOpsCockpit({
      studio,
      assets: [asset({ id: 'secret', title: '内部', publicity: 'private', details: { ...emptyDetails(), problem: '内部流程编号不能写进题。' } })],
      prompts: [{ id: 'p2', cluster: 'brand', text: brandPrompt }],
      drafts: [],
      observations: [],
      cycles: [],
    })
    expect(ops.actions[0]?.id).toBe('assets')
    expect(ops.actions[0]?.href).toBe('/library')
    expect(ops.actions.some((item) => item.id === 'coverage')).toBe(false)
  })

  it('asks for monitoring after a draft exists and no observations have been pasted', () => {
    const source = asset({ id: 'source', type: 'product', title: '出处卡片', tags: ['出处'], details: { ...emptyDetails(), problem: '只给文件名时读者还要回网盘翻。' } })
    const ops = buildOpsCockpit({
      studio,
      assets: [source],
      prompts: [
        { id: 'p1', cluster: 'scenario', text: '只给文件名时，出处能不能在旁边展开？' },
        { id: 'p2', cluster: 'brand', text: brandPrompt },
        { id: 'p3', cluster: 'comparison', text: comparisonPrompt },
        { id: 'p4', cluster: 'category', text: '做企业智能体时，通常先要弄清什么问题？' },
      ],
      drafts: [{ id: 'd1', title: '出处怎么展开', channel: 'faq', updatedAt: '2026-10-02T00:00:00.000Z' }],
      observations: [],
      cycles: [],
    })
    expect(ops.actions.some((item) => item.id === 'coverage')).toBe(false)
    expect(ops.actions.find((item) => item.id === 'monitor')).toMatchObject({ href: '/monitor' })
    expect(ops.recent[0]?.title).toContain('出处怎么展开')
    expect(ops.recent[0]?.href).toBe('/drafts/d1')
  })

  it('keeps a covered studio with drafts and observations to a short next step', () => {
    const ops = buildOpsCockpit({
      studio: { ...studio, services: [] },
      assets: [
        asset({ id: 'product', type: 'product', title: '出处卡片', tags: ['出处'] }),
        asset({ id: 'case', type: 'case', title: '尽调报告', tags: ['尽调'], details: { ...emptyDetails(), problem: '写尽调时出处散在手册里。' } }),
      ],
      prompts: [
        { id: 'p1', cluster: 'scenario', text: coveredPrompt },
        { id: 'p2', cluster: 'brand', text: brandPrompt },
        { id: 'p3', cluster: 'comparison', text: comparisonPrompt },
        { id: 'p4', cluster: 'category', text: '做企业智能体时，通常先要弄清什么问题？' },
      ],
      drafts: [{ id: 'd1', title: '尽调出处稿', channel: 'wechat', updatedAt: '2026-10-03T00:00:00.000Z' }],
      observations: [
        {
          id: 'o1',
          promptId: 'p1',
          promptText: coveredPrompt,
          brandMentioned: true,
          createdAt: '2026-10-04T00:00:00.000Z',
          cycleId: 'c1',
          cycleName: '改站后',
          platform: 'deepseek',
        },
        {
          id: 'o2',
          promptId: 'p3',
          promptText: comparisonPrompt,
          brandMentioned: false,
          createdAt: '2026-09-01T00:00:00.000Z',
          cycleId: 'c0',
          cycleName: '基线',
          platform: 'kimi',
        },
      ],
      cycles: [
        { id: 'c0', name: '基线', createdAt: '2026-09-01T00:00:00.000Z' },
        { id: 'c1', name: '改站后', createdAt: '2026-10-04T00:00:00.000Z' },
      ],
    })
    expect(ops.actions.map((item) => item.id)).toEqual(['steady'])
    expect(ops.counts.mentionedPrompts).toBe(1)
    expect(ops.counts.mentionRate).toBe(1)
    expect(ops.counts.cycleName).toBe('改站后')
    expect(ops.counts.products).toBe(1)
    expect(ops.counts.cases).toBe(1)
    expect(ops.recent[0]?.kind).toBe('observation')
    expect(ops.recent[0]?.detail).toContain('提到了品牌')
    expect(ops.actions.length).toBeLessThanOrEqual(4)
  })
})
