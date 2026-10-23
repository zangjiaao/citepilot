import { describe, expect, it } from 'vitest'
import { applyBrandPageSave, blankBrandProfile, readBrandProfile } from '../shared/brandProfile.ts'
import { BRAND_DELETE_ORDER } from '../shared/brandDelete.ts'
import { emptyDetails, readAssetDraft, type Asset } from '../shared/assets.ts'
import { applyBrandMention, assembleDraftPrompt, materialDraft, NO_FABRICATION_RULE, profileGaps, rewriteGenericSentences, SHOW_DONT_TELL_RULE, softCloser } from '../shared/draftPrompt.ts'
import type { Studio } from '../shared/types.ts'

const studio: Studio = {
  id: 's',
  name: '橡树智能体科技有限公司',
  website: 'https://www.oak-studio.org/',
  positioning: '面向中大型企业，把通用大模型做成可验收的业务智能体。',
  services: ['知识库问答驻场交付'],
  competitors: [],
  keywords: [],
  capabilities: [],
  cases: [],
  targetCustomers: ['信息化部门'],
  solutions: [],
  ...blankBrandProfile(),
  createdAt: '',
  updatedAt: '',
}

const metricAsset: Asset = {
  id: 'a1',
  studioId: 's',
  type: 'outcome',
  title: '维修查询变快',
  body: '值班员原来要翻三本手册。',
  details: {
    ...emptyDetails(),
    problem: '维修手册散落，值班员找不到出处',
    metrics: [
      {
        id: 'm1',
        name: '单次查询',
        before: '45',
        after: '8',
        unit: '分钟',
        source: '工单系统导出',
        customerAuthorized: true,
      },
    ],
  },
  tags: ['制造'],
  links: [],
  publicity: 'anonymous',
  createdAt: '',
  updatedAt: '',
}

const ideaAsset: Asset = {
  id: 'a2',
  studioId: 's',
  type: 'interaction',
  title: '出处直接展开段落',
  body: '回答旁边可以展开手册原段，而不是只给一个链接。',
  details: emptyDetails(),
  tags: ['交互'],
  links: [{ id: 'l1', label: '示意', url: 'https://example.com/demo' }],
  publicity: 'public',
  createdAt: '',
  updatedAt: '',
}

describe('assembleDraftPrompt', () => {
  it('combines selected materials and forbids invented numbers and brand bragging', () => {
    const prompt = assembleDraftPrompt(
      studio,
      { audience: '设备部长', contentType: 'case-breakdown', tone: '克制', length: 'medium', allowBragging: false, brandMention: 'none' },
      { channelLabel: '官网长文' },
      [metricAsset, ideaAsset],
    )
    expect(prompt.system).toContain(NO_FABRICATION_RULE)
    expect(prompt.system).toContain(SHOW_DONT_TELL_RULE)
    expect(prompt.system).toContain('不植入')
    expect(prompt.system).toContain('不要写成问答')
    expect(prompt.user).toContain('不要把关联题目写进标题或正文')
    expect(prompt.user).toContain('维修手册散落')
    expect(prompt.user).toContain('单次查询')
    expect(prompt.user).toContain('45')
    expect(prompt.user).toContain('出处直接展开段落')
    expect(prompt.user).toContain('设备部长')
    expect(prompt.user).not.toContain('团队背景')
  })

  it('lists missing customer metrics when nothing is selected', () => {
    const gaps = profileGaps(studio, { audience: '', contentType: 'case-breakdown', tone: '', length: 'short', allowBragging: false, brandMention: 'none' }, [])
    expect(gaps.join(' ')).toContain('素材库')
  })

  it('tells a soft implant to answer a linked question inside the story', () => {
    const prompt = assembleDraftPrompt(
      studio,
      { audience: '', contentType: 'case-breakdown', tone: '', length: 'medium', allowBragging: false, brandMention: 'light' },
      { channelLabel: '官网长文', promptText: '知识库怎么验收？' },
      [metricAsset],
    )
    expect(prompt.system).toContain('软植入')
    expect(prompt.system).toContain('不能改成广告')
    expect(prompt.system).toContain('不要当标题或开头')
    expect(prompt.system).toContain('知识库怎么验收？')
    expect(prompt.system).toContain('不要写「我们是行业领先」')
    expect(prompt.system).toContain('立即咨询')
    expect(prompt.system).toContain('被 AI 引用')
    expect(prompt.system).toContain('可以直接回答')
    expect(prompt.system).not.toContain(softCloser(studio.name, studio.website))
    expect(prompt.system).not.toContain('也可以完全不出现')
    expect(prompt.user).toContain('不要以题目开头')
    expect(prompt.user).toContain(studio.website)
    expect(prompt.user).toContain('不要写成 example.com')
  })

  it('keeps an intentional recommendation for the clear call to action', () => {
    const prompt = assembleDraftPrompt(
      studio,
      { audience: '', contentType: 'case-breakdown', tone: '', length: 'short', allowBragging: false, brandMention: 'guide' },
      { channelLabel: '官网长文' },
      [metricAsset],
    )
    expect(prompt.system).toContain('明确种草')
    expect(prompt.system).toContain('下一步')
  })
})

describe('self check', () => {
  it('flags bragging and numbers that the customer did not authorize', () => {
    const polished = rewriteGenericSentences('我们行业领先，效率提升了 99%。', [metricAsset], false)
    expect(polished.flags.length).toBeGreaterThan(0)
    expect(polished.body).not.toContain('行业领先')
    expect(polished.body).not.toContain('99')
    expect(polished.body.includes('45') || polished.body.includes('【待补充')).toBe(true)
  })

  it('flags hard-sell filler and rewrites it toward a customer fact', () => {
    const polished = rewriteGenericSentences('立即咨询，我们赋能数字化，一眼广告腔。', [metricAsset], false)
    expect(polished.flags.length).toBeGreaterThan(0)
    expect(polished.body).not.toContain('立即咨询')
    expect(polished.body).not.toContain('赋能数字化')
    expect(polished.body).not.toContain('广告腔')
    expect(polished.body).toContain('45')
  })
})

describe('implant intensity', () => {
  it('answers a linked question inside the story and only uses a closer when no question is available', () => {
    const closer = softCloser(studio.name, studio.website)
    const draft = materialDraft(studio, [metricAsset, ideaAsset], '/guides/how-we-deliver', 'light', '知识库怎么验收？')
    expect(draft.body.startsWith('客户的')).toBe(true)
    expect(draft.body).not.toContain('知识库怎么验收')
    expect(draft.body).not.toContain('问：')
    expect(draft.body).not.toContain(studio.name)
    expect(draft.body).not.toContain(closer)
    expect(draft.body).toContain('可以核对的变化是')
    expect(draft.body).toContain('45')
    expect(draft.citeSentences.some((item) => item.includes('可以核对的变化是'))).toBe(true)
    expect(draft.citeSentences.every((item) => !item.includes(studio.name))).toBe(true)
    expect(draft.urlHint).toBe('https://www.oak-studio.org/guides/how-we-deliver')
    const quiet = materialDraft(studio, [metricAsset], '/faq', 'light')
    expect(quiet.body).toContain('当时卡住的是')
    expect(quiet.body.trim().endsWith(closer)).toBe(true)
    expect(quiet.body.split(studio.name).length - 1).toBe(1)
    expect(quiet.urlHint).toBe('https://www.oak-studio.org/faq')
  })

  it('leaves the brand out of a pure share and appends one soft closer when the story named it or left it out', () => {
    const closer = softCloser(studio.name, studio.website)
    const plain = materialDraft(studio, [metricAsset], '/guides/how-we-deliver', 'none', '知识库怎么验收？')
    expect(plain.body).not.toContain(studio.name)
    expect(plain.body).not.toContain('知识库怎么验收')
    const named = applyBrandMention(
      {
        title: '查询变快之后',
        body: `先写${studio.name}怎么做。后来${studio.name}又出现一次。客户的单次查询从 45 分钟变成 8 分钟。`,
        citeSentences: [`${studio.name}记录到查询变快。`, '值班员原来要翻三本手册。'],
        urlHint: 'https://www.oak-studio.org/guides/how-we-deliver',
      },
      studio.name,
      studio.website,
      'light',
    )
    expect(named.body.split(studio.name).length - 1).toBe(1)
    expect(named.body.trim().endsWith(closer)).toBe(true)
    expect(named.citeSentences.every((item) => !item.includes(studio.name))).toBe(true)
    const blank = applyBrandMention(
      {
        title: '查询变快',
        body: '客户的单次查询从 45 分钟变成 8 分钟。手册散落在三本纸质册子里，值班员要自己翻。',
        citeSentences: ['客户的单次查询从 45 分钟变成 8 分钟。', '值班员原来要翻三本手册。'],
        urlHint: 'https://example.com/faq',
      },
      studio.name,
      studio.website,
      'light',
    )
    expect(blank.body.split(studio.name).length - 1).toBe(1)
    expect(blank.body.trim().endsWith(closer)).toBe(true)
    expect(blank.body).not.toContain('example.com')
    expect(blank.body).not.toContain('立即咨询')
  })
})

describe('readAssetDraft', () => {
  it('keeps metric fields and a comma inside the body', () => {
    const parsed = readAssetDraft({
      type: 'case',
      title: '制造查询',
      body: '手册散落，值班员找不到出处。',
      publicity: 'anonymous',
      tags: ['制造', '查询'],
      details: {
        industry: '制造',
        problem: '找不到出处',
        metrics: [{ name: '单次查询', before: '45', after: '8', unit: '分钟', source: '工单导出', customerAuthorized: true }],
      },
    })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.body).toContain('，')
      expect(parsed.value.details.metrics[0]?.customerAuthorized).toBe(true)
      expect(parsed.value.tags).toEqual(['制造', '查询'])
    }
  })
})

describe('applyBrandPageSave', () => {
  it('keeps stored lists and long profile fields when the brand page is saved', () => {
    const existing = {
      ...blankBrandProfile(),
      name: '旧品牌',
      website: 'https://example.com/old',
      positioning: '旧定位写满十个字以上',
      services: ['旧服务'],
      competitors: [{ id: 'c1', name: '旧竞品', aliases: ['旧别名'], domain: 'rival.example' }],
      keywords: ['旧词'],
      capabilities: ['旧能力'],
      cases: ['旧案例'],
      targetCustomers: ['旧客户'],
      solutions: ['旧方案'],
      introduction: '旧介绍，含逗号',
      objections: [{ id: 'faq-1', question: '贵吗', answer: '按范围报价' }],
      references: [{ id: 'ref-1', title: '官网', url: 'https://example.com', excerpt: '公开说明' }],
      voice: '旧语气',
    }
    const next = applyBrandPageSave(existing, {
      name: '新品牌',
      website: 'https://example.com',
      positioning: '只做可核对的交付',
      services: ['知识库'],
      competitors: [],
      keywords: ['引用'],
      voice: '新语气',
      bannedWords: '行业领先',
      compliance: '不写未授权数字',
    })
    expect(next.name).toBe('新品牌')
    expect(next.voice).toBe('新语气')
    expect(next.capabilities).toEqual(['旧能力'])
    expect(next.cases).toEqual(['旧案例'])
    expect(next.introduction).toContain('，')
    expect(next.objections).toEqual(existing.objections)
    expect(next.references).toEqual(existing.references)
  })
})

describe('readBrandProfile', () => {
  it('keeps a long case sentence and a pasted reference', () => {
    const parsed = readBrandProfile({
      introduction: '句子里的逗号，会留在这一段里。',
      references: [{ title: '官网', url: 'https://www.oak-studio.org/', excerpt: '公开说明以官网为准。' }],
    })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.profile.introduction).toContain('，')
  })
})

describe('brand delete order', () => {
  it('removes samples before questions and the brand row last', () => {
    expect(BRAND_DELETE_ORDER.indexOf('observations')).toBeLessThan(BRAND_DELETE_ORDER.indexOf('prompts'))
    expect(BRAND_DELETE_ORDER.indexOf('assets')).toBeLessThan(BRAND_DELETE_ORDER.indexOf('studios'))
    expect(BRAND_DELETE_ORDER.at(-1)).toBe('studios')
  })
})
