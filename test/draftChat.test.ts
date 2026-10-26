import { describe, expect, it } from 'vitest'
import { acceptDraftRevision, reviseDraftPrompt } from '../shared/draftChat.ts'
import { NO_FABRICATION_RULE } from '../shared/draftPrompt.ts'

const draft = {
  title: '闲鱼：驻场把验收题写清',
  body: '客户要先写清验收题，再谈上线。交付时把评测题和知识库一起交接。不另报价格。'.repeat(2),
  citeSentences: ['客户要先写清验收题，再谈上线范围。', '交付时把评测题和知识库一起交接。'],
  urlHint: '闲鱼主页：澄川智能体工场',
}

describe('对话改稿', () => {
  it('puts the revision instruction next to the no-fabrication and platform rules', () => {
    const prompt = reviseDraftPrompt({
      brand: '澄川智能体工场',
      website: 'https://example.com',
      channelLabel: '闲鱼',
      contentType: 'xianyu',
      length: 'short',
      brandMention: 'none',
      audience: '信息化负责人',
      tone: '驻场工程师',
      instruction: '标题再短一点，并删掉交付物里的驻场',
      draft,
      history: [{ role: 'user', content: '先改成列表' }],
      assetFacts: '交付物：评测题和知识库',
    })
    expect(prompt.system).toContain(NO_FABRICATION_RULE)
    expect(prompt.system).toContain('平台格式（闲鱼商品说明）')
    expect(prompt.system).toContain('植入强度：不植入')
    expect(prompt.user).toContain('标题再短一点，并删掉交付物里的驻场')
    expect(prompt.user).toContain(draft.title)
    expect(prompt.user).toContain('先改成列表')
    expect(prompt.system).toContain('不要写 example.com')
  })

  it('accepts a complete revision and clips the note', () => {
    const accepted = acceptDraftRevision({
      title: '闲鱼：先写验收题',
      body: draft.body,
      citeSentences: draft.citeSentences,
      urlHint: draft.urlHint,
      note: '改短了标题。'.repeat(40),
    })
    expect(accepted?.title).toBe('闲鱼：先写验收题')
    expect(accepted?.citeSentences).toHaveLength(2)
    expect(accepted?.note.length).toBeLessThanOrEqual(200)
    expect(accepted?.note.startsWith('改短了标题。')).toBe(true)
  })

  it('rejects a thin revision', () => {
    expect(
      acceptDraftRevision({
        title: '短',
        body: '太短',
        citeSentences: ['只有一句可引用的话在这里。'],
        urlHint: '闲鱼主页',
        note: '不行',
      }),
    ).toBeNull()
    expect(acceptDraftRevision({ title: draft.title, body: draft.body, citeSentences: draft.citeSentences, urlHint: '太短' })).toBeNull()
  })
})
