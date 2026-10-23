import { describe, expect, it } from 'vitest'
import { acceptDraft, coerceUrlHint, copyDraftTitle, DRAFT_CHANNELS, formatDraftForCopy, parseDraftEdit, templateDraft } from '../shared/drafts.ts'
import { blankBrandProfile } from '../shared/brandProfile.ts'
import type { Studio } from '../shared/types.ts'

const studio: Studio = {
  id: 'studio-chengchuan',
  name: '澄川智能体工场',
  website: 'https://example.com',
  positioning: '面向中大型企业的前场部署工程师工作室，把通用大模型做成可上线的业务智能体。',
  services: ['智能体应用从 0 到 1 共创', '企业知识库与 RAG 落地'],
  competitors: [{ id: 'comp-lanzhou', name: '澜舟智能体实验室', aliases: [], domain: '' }],
  keywords: ['企业智能体', 'RAG 知识库'],
  capabilities: ['企业知识库与 RAG：权限、引用溯源和评测集一起交付', '前场部署工程师驻场，和业务方一起写验收题'],
  cases: ['制造企业设备故障问答：把维修手册整理成可引用的知识库'],
  targetCustomers: ['第一次把大模型做成业务系统的中大型企业'],
  solutions: ['企业知识库 RAG：文档、权限、引用和回归题'],
  ...blankBrandProfile(),
  createdAt: '',
  updatedAt: '',
}

describe('templateDraft', () => {
  it('writes a product promo from the studio profile without an API key', () => {
    const draft = templateDraft({ studio, channel: 'product-promo' })
    expect(draft.title).toContain('澄川智能体工场')
    expect(draft.title).toContain('产品说明')
    expect(draft.body).toContain('企业知识库与 RAG')
    expect(draft.body).toContain('第一次把大模型做成业务系统的中大型企业')
    expect(draft.body).toContain('制造企业设备故障问答')
    expect(draft.citeSentences.length).toBeGreaterThanOrEqual(3)
    expect(draft.citeSentences.every((sentence) => sentence.includes('澄川智能体工场'))).toBe(true)
    expect(draft.urlHint).toContain('https://example.com/product')
    expect(formatDraftForCopy(draft)).toContain('建议被引用的句子')
  })

  it('answers a linked prompt and names a diagnosis gap', () => {
    const draft = templateDraft({
      studio,
      channel: 'faq',
      promptText: '企业知识库 RAG 项目一般包含哪些交付物？',
      gapLabel: '可引用的问答',
      gapDetail: '页面没有 FAQ',
    })
    expect(draft.title).toContain('常见问题')
    expect(draft.body).toContain('企业知识库 RAG 项目一般包含哪些交付物？')
    expect(draft.body).toContain('可引用的问答')
    expect(draft.body).toContain('页面没有 FAQ')
    expect(draft.urlHint).toContain('/faq')
    expect(draft.urlHint.startsWith('https://example.com/faq')).toBe(true)
  })

  it('replaces a sneaked example.com hint when the studio site is somewhere else', () => {
    expect(coerceUrlHint('https://example.com/faq', 'https://www.oak-studio.org/', '/faq')).toBe('https://www.oak-studio.org/faq')
    expect(coerceUrlHint('https://www.oak-studio.org/custom — 说明', 'https://www.oak-studio.org/', '/faq')).toBe(
      'https://www.oak-studio.org/custom — 说明',
    )
    expect(coerceUrlHint('https://example.com/faq', 'https://example.com', '/faq')).toBe('https://example.com/faq')
  })

  it('gives every channel its own title and a body that names the studio', () => {
    const titles = DRAFT_CHANNELS.map((item) => templateDraft({ studio, channel: item.id }).title)
    expect(new Set(titles).size).toBe(DRAFT_CHANNELS.length)
    expect(DRAFT_CHANNELS.map((item) => item.label)).toContain('产品宣传')
    for (const item of DRAFT_CHANNELS) {
      const draft = templateDraft({ studio, channel: item.id })
      expect(draft.body.length).toBeGreaterThan(40)
      expect(draft.body).toContain('澄川智能体工场')
      expect(draft.citeSentences.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('still drafts from positioning when the profile lists are empty', () => {
    const thin: Studio = { ...studio, capabilities: [], cases: [], targetCustomers: [], solutions: [] }
    const draft = templateDraft({ studio: thin, channel: 'product-promo' })
    expect(draft.body).toContain('面向中大型企业的前场部署工程师工作室')
    expect(draft.body).toContain('还没有可公开案例')
  })
})

describe('parseDraftEdit', () => {
  const valid = {
    channel: 'faq',
    title: '澄川智能体工场常见问题',
    body: '澄川智能体工场把企业知识库、权限和回归题一起交付。公开说明只写档案里已经有的事实，不追加客户名或效果数字。',
    citeSentences: ['澄川智能体工场交付企业知识库。', '澄川智能体工场写明权限和回归题。'],
    urlHint: 'https://example.com/faq — 常见问题页',
  }

  it('accepts an edit of the saved fields', () => {
    const parsed = parseDraftEdit(valid)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.channel).toBe('faq')
  })

  it('rejects a short title and an unknown channel', () => {
    expect(parseDraftEdit({ ...valid, title: '短' }).ok).toBe(false)
    expect(parseDraftEdit({ ...valid, channel: 'email' }).ok).toBe(false)
    expect(parseDraftEdit({ ...valid, citeSentences: ['只有一句'] }).ok).toBe(false)
  })

  it('keeps a copied title inside the length limit', () => {
    expect(copyDraftTitle('澄川智能体工场产品说明')).toBe('澄川智能体工场产品说明（副本）')
    expect(copyDraftTitle(`${'很长的标题'.repeat(20)}`)).toHaveLength(80)
    expect(copyDraftTitle(`${'很长的标题'.repeat(20)}`).endsWith('（副本）')).toBe(true)
    expect(copyDraftTitle('已经是副本（副本）')).toBe('已经是副本（副本）')
  })
})

describe('acceptDraft', () => {
  it('drops model output that is too thin or omits the brand', () => {
    expect(acceptDraft({ title: '短', body: '太短', citeSentences: [], urlHint: '' }, studio.name)).toBeNull()
    const longBody = `${'没有品牌名的说明。'.repeat(12)}`
    expect(
      acceptDraft(
        {
          title: '一份看起来完整的草稿标题',
          body: longBody,
          citeSentences: ['这句话没有品牌。', '另一句也没有。'],
          urlHint: 'https://example.com/product',
        },
        studio.name,
      ),
    ).toBeNull()
  })

  it('keeps a model draft that stays inside the studio facts', () => {
    const body =
      '澄川智能体工场面向中大型企业，交付可验收的企业知识库，并写明权限、引用和回归题。发布前不追加档案里没有的客户名、金额或效果数字，公开说明以官网为准。范围只覆盖已经写进档案的能力。'
    const accepted = acceptDraft(
      {
        title: '澄川智能体工场产品说明',
        body,
        citeSentences: ['澄川智能体工场交付企业知识库。', '这句话不该留下。', '澄川智能体工场服务中大型企业。'],
        urlHint: 'https://example.com/product — 产品说明页',
      },
      studio.name,
    )
    expect(accepted?.citeSentences).toEqual(['澄川智能体工场交付企业知识库。', '澄川智能体工场服务中大型企业。'])
    expect(accepted?.title).toContain('产品说明')
  })
})
