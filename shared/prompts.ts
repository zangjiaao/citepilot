import type { Asset } from './assets.ts'
import { competitorNames } from './competitors.ts'
import type { Cluster, GeneratedPrompt, Studio } from './types.ts'

export function normalizeQuestion(text: string): string {
  return text.replace(/\s+/g, '').trim().toLowerCase()
}

type PromptStudio = Pick<Studio, 'name' | 'website' | 'positioning' | 'services' | 'competitors' | 'keywords'>
export type PromptTermStudio = Pick<Studio, 'keywords' | 'services' | 'positioning'>

const GENERIC_TAGS = new Set(['产品', '其他', '内部', '案例'])

function trimEndPunct(text: string): string {
  return text.replace(/[。！？\s]+$/g, '').trim()
}

function clipTheme(text: string, max = 80): string {
  const trimmed = trimEndPunct(text)
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max)
}

function phrasePieces(value: string): string[] {
  return value
    .split(/[，。！？、；：\s「」"'“”‘’（）()[\]【】/]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 18 && !/^\d+(?:\.\d+)?$/.test(item) && !GENERIC_TAGS.has(item))
}

export function assetMatchTerms(assets: Asset[], studio: PromptTermStudio): string[] {
  const terms = new Set<string>()
  const studioWords = [...studio.keywords, ...studio.services, studio.positioning].map((item) => item.trim()).filter((item) => item.length >= 2)
  for (const asset of assets) {
    if (asset.publicity === 'private') continue
    const fields = [
      asset.title,
      asset.details.problem,
      asset.details.approach,
      asset.details.howItWorks,
      asset.details.industry,
      ...asset.tags,
      ...asset.details.metrics.filter((item) => item.customerAuthorized && item.name.trim()).map((item) => item.name),
    ]
    for (const piece of fields.flatMap(phrasePieces)) terms.add(piece)
    const blob = [...fields, asset.body].join('\n')
    for (const word of studioWords) {
      if (blob.includes(word)) terms.add(word)
    }
  }
  return [...terms]
}

export function assetGroundedCount(prompts: Array<Pick<GeneratedPrompt, 'cluster' | 'text'>>, assets: Asset[], studio: PromptTermStudio): number {
  const terms = assetMatchTerms(assets, studio)
  if (terms.length === 0) return 0
  return prompts.filter((item) => (item.cluster === 'scenario' || item.cluster === 'category') && terms.some((term) => item.text.includes(term))).length
}

export function promptAssetLines(assets: Asset[]): string[] {
  return assets
    .filter((item) => item.publicity !== 'private')
    .slice(0, 12)
    .map((asset) =>
      [asset.title, asset.details.industry, asset.details.problem, asset.details.approach, asset.details.howItWorks, asset.tags.join('、')]
        .map((item) => item.trim())
        .filter(Boolean)
        .join(' / '),
    )
    .filter(Boolean)
}

export function assemblePromptGeneration(studio: PromptStudio, existing: string[], assets: Asset[]): { system: string; user: string } {
  const lines = promptAssetLines(assets)
  const system = [
    '你是 GEO/AEO 题库编辑，帮一个品牌准备要拿去问 ChatGPT、DeepSeek、豆包、Kimi 等回答引擎的中文问题。',
    '问题要像真实采购或研究者会问的话，不要写成广告。',
    '场景题和品类题必须能用素材库里已经写下的问题、做法或标题来回答，用素材里已经出现的说法。不要只写选型、口碑或团队介绍。',
    '品牌题和对比题留给监测，可以不贴某一条素材。',
    '只输出 JSON：{"prompts":[{"cluster":"brand|category|comparison|scenario","text":"...","rationale":"..."}]}',
  ].join('')
  const user = [
    `品牌：${studio.name}`,
    `官网：${studio.website}`,
    `定位：${studio.positioning}`,
    `服务：${studio.services.join('、') || '未填'}`,
    `竞品：${competitorNames(studio.competitors).join('、') || '未填'}`,
    `关键词：${studio.keywords.join('、') || '未填'}`,
    lines.length > 0
      ? `素材库（场景题和品类题要能被这些素材回答）：\n${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}`
      : '素材库：还没有可公开的素材。场景题先按品牌服务来写。',
    `已有题目，不要重复：${existing.join('；') || '无'}`,
    '请新写 8 题，四个簇都要有。品牌题必须出现品牌名称。对比题必须同时出现品牌名称和至少一个竞品。品类题不要塞进品牌名。有素材时，至少 4 题是素材能回答的场景或品类。',
  ].join('\n')
  return { system, user }
}

function questionsFromAsset(asset: Asset): GeneratedPrompt[] {
  if (asset.publicity === 'private') return []
  const title = asset.title.trim()
  const problem = clipTheme(asset.details.problem)
  const approach = clipTheme(asset.details.approach || asset.details.howItWorks)
  const focus = asset.tags.map((item) => item.trim()).find((item) => item.length >= 2 && item.length <= 8 && !GENERIC_TAGS.has(item))
  const label = title || focus || '已有素材'
  const drafts: GeneratedPrompt[] = []
  if (problem) {
    const glue = focus && !problem.includes(focus) ? `，和「${focus}」有关时` : '，'
    drafts.push({ cluster: 'scenario', text: `${problem}${glue}一般怎么处理？`, rationale: `素材场景：${label}` })
  } else if (title) {
    drafts.push({ cluster: 'scenario', text: `「${title}」适合用在什么情况下？`, rationale: `素材场景：${title}` })
  }
  if (approach) {
    drafts.push({ cluster: 'category', text: `${approach}，这样做通常在解决什么问题？`, rationale: `素材品类：${label}` })
  }
  return drafts.filter((item) => item.text.length >= 8 && item.text.length <= 200)
}

function brandDrafts(studio: Pick<Studio, 'name' | 'services' | 'competitors' | 'keywords'>): GeneratedPrompt[] {
  const name = studio.name.trim() || '这个品牌'
  const names = competitorNames(studio.competitors)
  const competitor = names[0] || '同类服务商'
  const competitor2 = names[1] || competitor
  const keyword = studio.keywords[0]?.trim() || '企业智能体'
  const keyword2 = studio.keywords[1]?.trim() || keyword
  const service = studio.services[0]?.trim() || '智能体应用落地'
  return [
    { cluster: 'brand', text: `${name}是做什么的？适合哪类企业？`, rationale: '监测：品牌认知。回答引擎能不能说清定位' },
    { cluster: 'brand', text: `${name}靠谱吗？有哪些可以核实的案例或客户评价？`, rationale: '监测：品牌信任。是否给出可核对的证据' },
    { cluster: 'brand', text: `${name}的官网、服务范围和联系方式是什么？`, rationale: '监测：品牌导航。是否引用官网' },
    { cluster: 'category', text: `企业要做${keyword}，应该怎么选服务商？`, rationale: '监测：品类选型。素材对不上时不要当软植入的默认题' },
    { cluster: 'category', text: `${keyword2}项目一般怎么验收？`, rationale: '品类标准：公开页是否被当成答案来源' },
    { cluster: 'category', text: `${service}通常包含哪些交付物？`, rationale: '服务定义：回答是否复述你的交付边界' },
    { cluster: 'comparison', text: `${name}和${competitor}做${keyword}，差别在哪里？`, rationale: '监测：对比题。品牌和竞品是否被同时点名' },
    { cluster: 'comparison', text: `选${name}还是${competitor2}，更适合第一次落地${keyword2}？`, rationale: '监测：对比决策。是否给出偏向和理由' },
    { cluster: 'scenario', text: `团队想做「${service}」，第一步应该问服务商什么？`, rationale: '场景题：品牌会不会出现在实施建议里' },
    { cluster: 'scenario', text: `已经有内部知识库，还要不要找${name}这类团队做${keyword}？`, rationale: '场景取舍：自建和外购时品牌是否被提到' },
  ]
}

export function templatePrompts(
  studio: Pick<Studio, 'name' | 'services' | 'competitors' | 'keywords'>,
  existing: string[],
  assets: Asset[] = [],
): GeneratedPrompt[] {
  const drafts = [...assets.flatMap(questionsFromAsset), ...brandDrafts(studio)]
  const seen = new Set(existing.map(normalizeQuestion))
  const fresh = drafts.filter((draft) => {
    const key = normalizeQuestion(draft.text)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const picked: GeneratedPrompt[] = []
  for (const cluster of ['scenario', 'category', 'brand', 'comparison'] as const) {
    const found = fresh.find((draft) => draft.cluster === cluster)
    if (found) picked.push(found)
  }
  for (const draft of fresh) {
    if (picked.length >= 8) break
    if (!picked.includes(draft)) picked.push(draft)
  }
  return picked
}

export function isCluster(value: string): value is Cluster {
  return value === 'brand' || value === 'category' || value === 'comparison' || value === 'scenario'
}
