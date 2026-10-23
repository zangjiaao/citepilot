import { describe, expect, it } from 'vitest'
import { emptyDetails, type Asset } from '../shared/assets.ts'
import { addedPromptSummary, assemblePromptGeneration, assessPromptCoverage, assetGroundedCount, selectGapPrompts, templatePrompts } from '../shared/prompts.ts'
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

const chengchuan: Studio = {
  ...studio,
  positioning: '给已经有手册、工单和制度，但回答对不上原文的团队，把知识库做成能点开出处的问答。',
  services: ['把故障手册和工单接成可引用的问答', '销售资料问答，回答旁边展开原文', '驻场两周，和业务一起写验收题再交接', '上线后按错引和耗时复盘'],
  competitors: [
    { id: 'comp-lanzhou', name: '澜舟智能体实验室', aliases: ['澜舟'], domain: 'lanzhou.example' },
    { id: 'comp-beipo', name: '北坡应用工场', aliases: [], domain: '' },
    { id: 'comp-shiguang', name: '拾光 FDE 工作室', aliases: [], domain: '' },
  ],
  keywords: ['企业知识库', '引用溯源', '故障手册', '尽调报告', '驻场交付', '验收题', '销售资料', '错引', '工单', '条款切分'],
}

const coveredPrompts = [
  '澄川智能体工场是做什么的？适合哪类企业？',
  '企业知识库 RAG 项目一般包含哪些交付物？',
  '澄川智能体工场和澜舟智能体实验室做企业智能体，差别在哪里？',
  '澄川智能体工场和北坡应用工场，谁更适合做 RAG 知识库？',
  '拾光 FDE 工作室和澄川智能体工场的前场驻场模式有何不同？',
  '制造企业想用智能体做设备故障知识问答，应该怎么开工？',
  '销售团队想要一个能查产品资料和写方案的 Copilot，落地步骤是什么？',
  '内部制度太多，员工找不到答案，知识库智能体要怎么验收？',
  '金融行业做对客问答智能体，合规和引用溯源应该怎么要求服务商？',
  '写尽调时出处散在多本手册里，怎么让回答点开同一段原文？',
  '知识库回答只给文件名时，出处能不能在旁边展开原段？',
  '整本 PDF 按页切开后条款对不上，应该怎么按条款切？',
  '上线后每周抽查，怎么发现错引是不是落到了相邻条款？',
  '按页切 PDF 为什么会让引用对不上条款号？',
]

const chengchuanAssets: Asset[] = [
  libraryAsset({
    id: 'diligence',
    type: 'case',
    title: '尽调报告从翻手册变成点开出处',
    tags: ['尽调', '出处'],
    details: {
      ...emptyDetails(),
      industry: '装备制造',
      problem: '写尽调时，出处散在三本手册里，两个人对不上同一段原文。',
      approach: '先把手册按条款切开，回答只允许引用已经入库的段落。',
      metrics: [{ id: 'm-query', name: '单次查询', before: '45', after: '8', unit: '分钟', source: '工单系统导出', customerAuthorized: true }],
    },
  }),
  libraryAsset({
    id: 'secret-cc',
    type: 'case',
    title: '内部试点的验收题还没获准公开',
    publicity: 'private',
    details: { ...emptyDetails(), problem: '验收题里有未公开的内部流程编号。' },
  }),
  libraryAsset({
    id: 'card',
    type: 'product',
    title: '出处卡片',
    tags: ['产品', '出处'],
    details: { ...emptyDetails(), problem: '只给文件名时，读者还是会回到网盘里翻。', howItWorks: '检索先召回段落，再把段落嵌进回答。' },
  }),
  libraryAsset({
    id: 'clause-cc',
    title: '按条款切，不按整本 PDF 切',
    tags: ['切分', '条款'],
    details: { ...emptyDetails(), problem: '按页切开时，一条条款会被截在两块中间。', howItWorks: '条款号当主键，段落是条款正文。' },
  }),
  libraryAsset({
    id: 'expand',
    type: 'interaction',
    title: '点一下就展开原段',
    tags: ['交互', '展开'],
    details: { ...emptyDetails(), problem: '只给链接时，大家还是会回到文件夹里翻。', approach: '点击出处就地展开，不跳走。' },
  }),
  libraryAsset({
    id: 'misquote-cc',
    type: 'outcome',
    title: '每周抽查里的错引被数出来',
    tags: ['错引', '抽查'],
    details: { ...emptyDetails(), problem: '上线第一周，引用经常落到相邻条款。', approach: '改成按条款切分后再抽查。' },
  }),
  libraryAsset({
    id: 'lesson',
    type: 'lesson',
    title: '先按页切 PDF，引用对不上条款',
    tags: ['踩坑', '切分'],
    details: { ...emptyDetails(), problem: '按页切会把一条制度截成两段。', approach: '停掉按页切，改成条款号为主键。' },
  }),
  libraryAsset({
    id: 'quote',
    type: 'testimonial',
    title: '分析师说点开就是那一段',
    tags: ['原话'],
    details: { ...emptyDetails(), quote: '以前对一条出处要翻三本，现在点开就是那一段。', quoteAuthorized: true },
  }),
]

const hrAsset = libraryAsset({
  id: 'hr',
  type: 'case',
  title: '企业员工入职引导',
  tags: ['入职'],
  details: { ...emptyDetails(), problem: '新员工培训要靠翻整本公司制度。', approach: '用 RAG 把制度按条款收下。' },
})

describe('templatePrompts', () => {
  it('starts from real gaps and stops once those gaps are filled', () => {
    const first = templatePrompts(studio, [])
    expect(first.length).toBeGreaterThan(0)
    expect(first.length).toBeLessThan(8)
    expect(first.filter((item) => item.cluster === 'brand')).toHaveLength(1)
    expect(first.every((item) => item.cluster !== 'brand' || item.text.includes('澄川智能体工场'))).toBe(true)
    expect(first.find((item) => item.cluster === 'comparison')?.text).toContain('澜舟智能体实验室')
    expect(first.filter((item) => item.cluster === 'comparison')).toHaveLength(2)
    const second = templatePrompts(studio, first.map((item) => item.text))
    expect(second).toEqual([])
  })

  it('writes scenario questions the asset library can answer', () => {
    const prompts = templatePrompts(studio, [], citationAssets)
    const text = prompts.map((item) => item.text).join('\n')
    expect(text).toMatch(/出处|条款|错引/)
    expect(text).not.toContain('内部流程编号')
    expect(prompts.some((item) => item.cluster === 'brand' && item.text.includes('澄川智能体工场'))).toBe(true)
    expect(prompts.some((item) => item.cluster === 'comparison' && item.text.includes('澜舟智能体实验室'))).toBe(true)
    expect(prompts.filter((item) => item.cluster === 'scenario' || item.cluster === 'category').length).toBeGreaterThan(1)
    expect(prompts.length).toBeLessThanOrEqual(8)
    const brief = assemblePromptGeneration(studio, [], citationAssets)
    expect(brief.user).toContain('按条款切，不按整本 PDF 切')
    expect(brief.user).toContain('错引')
    expect(brief.user).toContain('盲区')
    expect(brief.user).not.toContain('请新写 8 题')
    expect(brief.user).not.toContain('四个簇都要有')
    expect(brief.system).toContain('素材库')
    expect(brief.user).not.toContain('内部流程编号')
    expect(assetGroundedCount(prompts, citationAssets, studio)).toBeGreaterThan(0)
  })

  it('adds nothing when the bank already covers the brand and the asset library', () => {
    const coverage = assessPromptCoverage(chengchuan, coveredPrompts, chengchuanAssets.filter((item) => item.id !== 'quote'))
    expect(coverage.covered).toBe(true)
    expect(coverage.gaps).toEqual([])
    expect(coverage.summary).toContain('题库已覆盖当前品牌和素材')
    expect(coverage.summary).toMatch(/出处|条款|错引/)
    expect(templatePrompts(chengchuan, coveredPrompts, chengchuanAssets.filter((item) => item.id !== 'quote'))).toEqual([])
    const withQuote = templatePrompts(chengchuan, coveredPrompts, chengchuanAssets)
    expect(withQuote.length).toBeLessThanOrEqual(1)
    expect(withQuote.every((item) => /原话|分析师|点开/.test(item.text))).toBe(true)
    expect(withQuote.map((item) => item.text).join('\n')).not.toContain('内部流程编号')
  })

  it('only writes a scenario for an uncovered onboarding asset', () => {
    const assets = [...chengchuanAssets, hrAsset]
    const prompts = templatePrompts(chengchuan, coveredPrompts, assets)
    expect(prompts.length).toBeGreaterThanOrEqual(1)
    expect(prompts.length).toBeLessThanOrEqual(3)
    expect(prompts.length).not.toBe(8)
    const text = prompts.map((item) => item.text).join('\n')
    expect(text).toMatch(/新员工培训|入职/)
    expect(text).not.toContain('澄川智能体工场是做什么的')
    expect(text).not.toContain('内部流程编号')
    expect(prompts.some((item) => item.cluster === 'scenario' || item.cluster === 'category')).toBe(true)
    const coverage = assessPromptCoverage(chengchuan, coveredPrompts, assets)
    expect(coverage.summary).toMatch(/入职|新员工培训/)
    const selected = selectGapPrompts(coverage.gaps, [
      { cluster: 'brand', text: '澄川智能体工场的新办公室在哪？', rationale: '凑数' },
      { cluster: 'scenario', text: '新员工培训要靠翻整本公司制度，一般怎么处理？', rationale: '盲区' },
      { cluster: 'category', text: '企业知识库项目怎样验收才算上线？', rationale: '凑数' },
      { cluster: 'comparison', text: '澄川智能体工场和澜舟智能体实验室谁更适合驻场？', rationale: '凑数' },
    ])
    expect(selected.map((item) => item.text).join('\n')).toContain('新员工培训')
    expect(selected.some((item) => item.text.includes('新办公室'))).toBe(false)
    expect(selected.length).toBeLessThanOrEqual(3)
    expect(addedPromptSummary(selected, coverage)).toContain(`补了 ${selected.length} 道盲区题`)
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
