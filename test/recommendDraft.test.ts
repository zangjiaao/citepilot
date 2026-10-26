import { describe, expect, it } from 'vitest'
import { emptyDetails, type Asset } from '../shared/assets.ts'
import { recommendDraftSelection, relatedDraftPrompts } from '../shared/recommendDraft.ts'
import type { Studio } from '../shared/types.ts'

const studio: Pick<Studio, 'keywords' | 'services' | 'positioning'> = {
  positioning: '把知识库做成能点开出处的问答',
  services: ['把故障手册接成可引用的问答'],
  keywords: ['故障手册', '验收题', '错引'],
}

function asset(partial: Pick<Asset, 'id' | 'type' | 'title'> & Partial<Asset>): Asset {
  return {
    studioId: 's',
    body: partial.body ?? partial.title,
    details: partial.details ?? emptyDetails(),
    tags: partial.tags ?? [],
    links: [],
    publicity: partial.publicity ?? 'public',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('recommendDraftSelection', () => {
  const library = [
    asset({
      id: 'case',
      type: 'case',
      title: '尽调出处',
      body: `分析师写尽调时要对上三本故障手册。${'这段把前后变化、出处和条款写完整。'.repeat(20)}`,
      details: {
        ...emptyDetails(),
        problem: '出处散在三本故障手册里',
        metrics: [{ id: 'm', name: '单次查询', before: '45', after: '8', unit: '分钟', source: '工单', customerAuthorized: true }],
      },
    }),
    asset({
      id: 'outcome',
      type: 'outcome',
      title: '错引下降',
      body: '每周抽查里的错引从 6 条变成 1 条，客户授权公开这个前后数字。',
      details: {
        ...emptyDetails(),
        problem: '引用落到相邻条款',
        metrics: [{ id: 'm2', name: '错引', before: '6', after: '1', unit: '条', source: '抽查', customerAuthorized: true }],
      },
    }),
    asset({ id: 'interaction', type: 'interaction', title: '点一下展开', body: '点出处就展开原段。' }),
    asset({
      id: 'idea',
      type: 'idea',
      title: '按条款切',
      body: '按条款号切开。',
      details: { ...emptyDetails(), howItWorks: '条款号当主键，页码只标在旁边。' },
    }),
    asset({ id: 'product', type: 'product', title: '出处卡片', body: '回答下面嵌着手册原段。', details: { ...emptyDetails(), howItWorks: '先召回段落再嵌进回答。' } }),
    asset({ id: 'lesson', type: 'lesson', title: '按页切 PDF 对不上', body: '第一周按页切，条款被截断。' }),
    asset({
      id: 'private',
      type: 'case',
      title: '内部试点',
      body: '不能公开的验收题。',
      publicity: 'private',
      details: {
        ...emptyDetails(),
        metrics: [{ id: 'm3', name: '耗时', before: '3', after: '1', unit: '小时', source: '内部', customerAuthorized: true }],
      },
    }),
  ]

  it('picks case and outcome for a case breakdown and skips private rows', () => {
    const result = recommendDraftSelection({ contentType: 'case-breakdown', assets: library, studio })
    expect(result.assetIds).toContain('case')
    expect(result.assetIds).toContain('outcome')
    expect(result.assetIds).not.toContain('private')
    expect(result.assetIds.length).toBeLessThanOrEqual(5)
    expect(result.rankedIds).not.toContain('private')
    expect(result.assetIds.every((id) => library.some((item) => item.id === id))).toBe(true)
  })

  it('prefers interaction, idea, and product for an interaction note', () => {
    const result = recommendDraftSelection({ contentType: 'interaction', assets: library, studio })
    expect(result.assetIds).toEqual(expect.arrayContaining(['interaction', 'idea', 'product']))
    expect(result.assetIds).not.toContain('lesson')
  })

  it('prefers the lesson for a retro', () => {
    const result = recommendDraftSelection({ contentType: 'retro', assets: library, studio })
    expect(result.assetIds[0]).toBe('lesson')
    expect(result.assetIds).not.toContain('private')
  })

  it('prefers short high-signal rows for a short post', () => {
    const result = recommendDraftSelection({ contentType: 'short-post', assets: library, studio })
    expect(result.assetIds.length).toBeLessThanOrEqual(2)
    expect(result.assetIds).not.toContain('case')
    expect(result.assetIds.every((id) => ['idea', 'interaction', 'product', 'outcome', 'lesson'].includes(id))).toBe(true)
  })

  it('prefers a service asset for 小红书、闲鱼 and 视频号', () => {
    const service = asset({
      id: 'service',
      type: 'service',
      title: '智能体开发',
      body: '按验收题交付一版流程。',
      details: {
        ...emptyDetails(),
        problem: '演示能聊，一问验收就停住',
        approach: '先写验收题',
        howItWorks: '一条流程先上线',
        boundaries: '不含未授权的数据标注量',
        deliverables: '验收题和交接说明',
      },
    })
    const hidden = asset({ ...service, id: 'hidden-service', publicity: 'private' })
    const pool = [...library, service, hidden]
    for (const contentType of ['short-post', 'xianyu', 'shipinhao'] as const) {
      const result = recommendDraftSelection({ contentType, assets: pool, studio })
      expect(result.assetIds[0]).toBe('service')
      expect(result.assetIds).not.toContain('hidden-service')
      expect(result.rankedIds).not.toContain('hidden-service')
    }
  })

  it('suggests a weak overlapping question and skips one that does not fit', () => {
    const fitted = recommendDraftSelection({
      contentType: 'case-breakdown',
      assets: library,
      studio,
      prompts: [
        { id: 'weak', cluster: 'scenario', text: '故障手册对不上时，验收题应该怎么写？' },
        { id: 'loud', cluster: 'brand', text: '这家公司是做什么的？' },
      ],
      mentions: [
        { promptId: 'weak', mentioned: false },
        { promptId: 'weak', mentioned: false },
        { promptId: 'loud', mentioned: true },
        { promptId: 'loud', mentioned: true },
      ],
    })
    expect(fitted.promptId).toBe('weak')

    const none = recommendDraftSelection({
      contentType: 'retro',
      assets: [library[5]],
      studio: { positioning: '', services: [], keywords: [] },
      prompts: [{ id: 'other', cluster: 'brand', text: '股价今天怎么样？' }],
    })
    expect(none.promptId).toBeNull()
  })

  it('prefers a question the checked asset can answer over a monitor-only prompt', () => {
    const prompts = [
      { id: 'pick', cluster: 'category' as const, text: '企业想做智能体应用，应该怎么选服务商？' },
      { id: 'clause', cluster: 'scenario' as const, text: '整本 PDF 按页切开后，应该怎么按条款切？' },
      { id: 'misquote', cluster: 'scenario' as const, text: '每周抽查里的错引，怎么看是不是落到了相邻条款？' },
    ]
    const outcome = library.find((item) => item.id === 'outcome')
    const ranked = relatedDraftPrompts('wechat', studio, outcome ? [outcome] : [], prompts, [], library)
    expect(ranked[0]).toBe('misquote')
    expect(ranked).not.toContain('pick')
    expect(ranked).not.toContain('clause')
    const selected = recommendDraftSelection({
      contentType: 'wechat',
      assets: library,
      studio,
      selectedIds: ['outcome'],
      prompts,
    })
    expect(selected.promptId).toBe('misquote')
    const lonely = asset({ id: 'lonely', type: 'idea', title: '完全无关的标题甲乙丙', body: '甲乙丙丁戊己庚辛', tags: ['甲乙丙'] })
    const fallback = relatedDraftPrompts('thread', studio, [lonely], prompts, [], library)
    expect(fallback[0]).toBe('clause')
    expect(fallback).not.toContain('pick')
  })
})
