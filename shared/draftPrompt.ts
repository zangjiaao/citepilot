import { allowedNumbers, assetBlock, assetTypeLabel, draftFromAssets, type Asset, type BrandMention } from './assets.ts'
import { coerceUrlHint, isPlaceholderWebsite } from './drafts.ts'
import type { DraftBrief, DraftChannel, Studio } from './types.ts'

export type { BrandMention } from './assets.ts'

export const NO_FABRICATION_RULE =
  '只能使用勾选的素材里已经写出的事实。品牌资料只作语气和红线。不要编造客户名、界面、数字、奖项或团队规模。没有的数字写成【待补充：客户授权的前后数据】。'

export const SHOW_DONT_TELL_RULE =
  '写客户的效率变化和已经发生的结果，不要写我们有多强。先给具体问题、前后数据或一处交互，不要先介绍公司。不要用获奖、人数、行业领先、头部、顶级。'

export const CONTENT_TYPES = [
  { id: 'case-breakdown', label: '案例拆解' },
  { id: 'interaction', label: '交互/设计细节分享' },
  { id: 'build-log', label: '开发过程/build in public' },
  { id: 'retro', label: '踩坑复盘' },
  { id: 'thread', label: 'X/推特 thread' },
  { id: 'short-post', label: '即刻/小红书短帖' },
  { id: 'zhihu', label: '知乎回答' },
  { id: 'wechat', label: '公众号长文' },
  { id: 'faq', label: 'FAQ' },
] as const

export type ContentType = (typeof CONTENT_TYPES)[number]['id']
export type DraftLength = 'short' | 'medium' | 'long'

export interface DraftRequestOptions {
  audience: string
  contentType: ContentType
  tone: string
  length: DraftLength
  allowBragging: boolean
  brandMention: BrandMention
}

const CONTENT_IDS = new Set<string>(CONTENT_TYPES.map((item) => item.id))
const LENGTHS = new Set<string>(['short', 'medium', 'long'])

const GENERIC =
  /赋能|抓手|闭环|颗粒度|一站式|全方位|极致|我们致力于|专业的团队|专业团队|丰富的经验|丰富经验|优质的服务|优质服务|数字化转型|无缝|降本增效|水文/

const BRAG =
  /行业领先|业内领先|获奖|荣获|荣誉|头部|顶级|最强|第一品牌|百人团队|数百人|团队规模|国家级|独角兽|行业标杆|遥遥领先|秀肌肉|领军|权威/

const HARD_SELL =
  /硬广|立即咨询|马上咨询|欢迎咨询|点击咨询|行业领先|赋能数字化|一眼广告|广告腔|立刻下单|限时优惠|扫码咨询/

export const IMPLANT_LEVELS = [
  { id: 'none', label: '不植入', description: '不把题目写进正文，也不强行带品牌。' },
  { id: 'light', label: '软植入', description: '把一道相关题目的答案写进故事，方便发布后被 AI 引用。' },
  { id: 'guide', label: '明确种草', description: '题目可写可不写。结尾会更明确地写出品牌、官网和下一步。' },
] as const

export const IMPLANT_PURPOSE = '为了让相关题目更容易被 AI 引用；正文仍以素材故事为主'

export const SOFT_IMPLANT_HINT = '会把这道题的答案写进故事，引用句要能直接回答它。'

export const PUBLISH_PLATFORMS = [
  { id: 'xiaohongshu', label: '小红书 / 即刻短帖', contentType: 'short-post', channel: 'xiaohongshu', format: '短帖' },
  { id: 'wechat', label: '公众号', contentType: 'wechat', channel: 'wechat', format: '长文' },
  { id: 'zhihu', label: '知乎', contentType: 'zhihu', channel: 'linkedin', format: '回答' },
  { id: 'thread', label: 'X / thread', contentType: 'thread', channel: 'social-short', format: '一串短句' },
  { id: 'site', label: '官网长文', contentType: 'case-breakdown', channel: 'site-article', format: '案例拆解' },
  { id: 'faq', label: 'FAQ', contentType: 'faq', channel: 'faq', format: '问答' },
] as const

export type PublishPlatformId = (typeof PUBLISH_PLATFORMS)[number]['id']

export function publishPlatform(id: string) {
  return PUBLISH_PLATFORMS.find((item) => item.id === id) ?? PUBLISH_PLATFORMS[0]
}

export function platformForAssetType(type: string): PublishPlatformId {
  if (type === 'reference') return 'faq'
  if (type === 'lesson' || type === 'testimonial') return 'wechat'
  if (type === 'case' || type === 'outcome') return 'site'
  return 'xiaohongshu'
}

export function isContentType(value: string): value is ContentType {
  return CONTENT_IDS.has(value)
}

export function contentTypeLabel(id: string): string {
  return CONTENT_TYPES.find((item) => item.id === id)?.label ?? id
}

export function contentTypeForAsset(type: string): ContentType {
  if (type === 'interaction' || type === 'idea' || type === 'product') return 'interaction'
  if (type === 'lesson') return 'retro'
  if (type === 'testimonial') return 'wechat'
  if (type === 'reference') return 'faq'
  return 'case-breakdown'
}

export function channelForContentType(type: ContentType): DraftChannel {
  switch (type) {
    case 'faq':
      return 'faq'
    case 'wechat':
    case 'build-log':
    case 'retro':
      return 'wechat'
    case 'zhihu':
      return 'linkedin'
    case 'thread':
      return 'social-short'
    case 'short-post':
      return 'xiaohongshu'
    case 'case-breakdown':
    case 'interaction':
      return 'site-article'
  }
}

export function contentTypeForChannel(channel: DraftChannel): ContentType {
  switch (channel) {
    case 'faq':
      return 'faq'
    case 'wechat':
      return 'wechat'
    case 'xiaohongshu':
    case 'social-short':
      return 'short-post'
    case 'linkedin':
      return 'zhihu'
    case 'product-promo':
    case 'site-article':
      return 'case-breakdown'
  }
}

export function parseDraftOptions(input: unknown, channel: DraftChannel): DraftRequestOptions {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const requested = typeof record.contentType === 'string' ? record.contentType.trim() : ''
  const contentType = isContentType(requested) ? requested : contentTypeForChannel(channel)
  const lengthRaw = typeof record.length === 'string' ? record.length.trim() : ''
  const length: DraftLength = LENGTHS.has(lengthRaw) ? (lengthRaw as DraftLength) : 'medium'
  const audience = typeof record.audience === 'string' ? record.audience.trim().slice(0, 200) : ''
  const tone = typeof record.tone === 'string' ? record.tone.trim().slice(0, 200) : ''
  const mention = record.brandMention
  const brandMention: BrandMention = mention === 'light' || mention === 'guide' || mention === 'none' ? mention : 'none'
  return { audience, contentType, tone, length, allowBragging: record.allowBragging === true, brandMention }
}

export function parseAssetIds(value: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, ids: [] }
  if (!Array.isArray(value)) return { ok: false, error: '素材选择格式不正确' }
  const ids = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  if (ids.length > 12) return { ok: false, error: '一次最多勾选 12 条素材' }
  if (ids.some((item) => !/^[\w-]{1,80}$/.test(item))) return { ok: false, error: '有一条素材编号不正确' }
  return { ok: true, ids: [...new Set(ids)] }
}

export function profileGaps(_studio: Studio, options: DraftRequestOptions, assets: Asset[]): string[] {
  const gaps: string[] = []
  if (assets.length === 0) gaps.push('先从素材库勾选一条或多条。不勾选时，稿子没有客户侧的事实')
  const metrics = assets.flatMap((item) => item.details.metrics.filter((metric) => metric.customerAuthorized && (metric.before || metric.after)))
  if (assets.length > 0 && metrics.length === 0 && (options.contentType === 'case-breakdown' || options.contentType === 'wechat')) {
    gaps.push('数据成效：补一组客户授权公开的前后数字，例如耗时、成本、准确率或吞吐')
  }
  if (assets.some((item) => item.type === 'testimonial' && item.details.quote.trim() && !item.details.quoteAuthorized)) {
    gaps.push('客户评价还没有授权公开，稿子里不会引用原话')
  }
  if (assets.some((item) => item.publicity === 'anonymous')) gaps.push('有匿名素材：不要写出能认出客户的信息')
  if (assets.some((item) => item.details.metrics.some((metric) => !metric.customerAuthorized && (metric.before || metric.after)))) {
    gaps.push('有未授权的指标，那些数字不会写进稿子')
  }
  return gaps.slice(0, 6)
}

export function assembleDraftPrompt(
  studio: Studio,
  options: DraftRequestOptions,
  extra: { promptText?: string; gapLabel?: string; gapDetail?: string; channelLabel: string },
  assets: Asset[],
): { system: string; user: string } {
  const lengthHint =
    options.contentType === 'thread'
      ? '5 到 8 条短句，每条一行'
      : options.contentType === 'short-post'
        ? '300 字以内'
        : options.length === 'short'
          ? '400 到 700 字'
          : options.length === 'long'
            ? '1800 到 2800 字'
            : '900 到 1400 字'
  const mentionRule = implantRule(options.brandMention, extra.promptText, studio.name, studio.website)
  const hintRule = 'urlHint 必须使用给定官网的主机名。官网若是 example.com 这种示例地址，不要写进 urlHint。'
  const citeRule =
    options.brandMention === 'none'
      ? `citeSentences 是 2 到 4 句从故事里抽出的事实，不要出现品牌名，也不要写成问答。${hintRule}`
      : options.brandMention === 'light' && extra.promptText?.trim()
        ? `citeSentences 是 2 到 4 句可以直接回答「${extra.promptText.trim()}」的话，只使用素材里的事实，不要写成广告或水文。${hintRule}`
        : options.brandMention === 'light'
          ? `citeSentences 是 2 到 4 句故事里的事实，可以不带品牌名。${hintRule}`
          : `citeSentences 是 2 到 4 句可引用的话。品牌名可以出现，但不要每句都是广告。${hintRule}`
  const system = [
    '你在把几条素材合成一篇可以分享的内容。先选一个钩子，再按渠道安排结构，不要逐条复述素材库。故事优先，不硬广，不凑字，不写成水文。',
    SHOW_DONT_TELL_RULE,
    NO_FABRICATION_RULE,
    mentionRule,
    options.allowBragging ? '用户允许提到素材里已经写明的奖项或规模，仍然不能编造。' : '不要写奖项、人数、融资或行业领先。',
    '数字只能来自已授权的指标，或素材正文里已经出现的数字。',
    '只输出 JSON：{"title":"","body":"","citeSentences":["",""],"urlHint":""}。',
    citeRule,
  ].join('')
  const questionLine =
    options.brandMention === 'none'
      ? '题目：这篇不植入，不要把关联题目写进标题或正文，也不要另起问答。'
      : options.brandMention === 'light'
        ? `题目：${extra.promptText || '无'}。若有题目，在故事中段回答它，引用句必须能直接当作回答。不要以题目开头，不要标注 GEO。`
        : `题目：${extra.promptText || '无'}`
  const user = [
    `内容类型：${contentTypeLabel(options.contentType)}`,
    `发布渠道：${extra.channelLabel}`,
    `目标读者：${options.audience || studio.customerProfile || studio.targetCustomers[0] || '做类似事情的同行'}`,
    `语气：${options.tone || studio.voice || '像在讲客户那边发生的变化'}`,
    `长度：${lengthHint}`,
    assets.length > 0 ? assets.map((item, index) => `素材 ${index + 1}\n${assetBlock(item)}`).join('\n\n') : '素材：没有勾选。不要用品牌介绍硬写。',
    `官网：${studio.website || '未填'}。urlHint 只能用这个官网的主机名，不要写成 example.com。`,
    `品牌资料只作背景。定位：${studio.positioning || '未填'}`,
    `禁用词：${studio.bannedWords || '无'}`,
    `不能说的内容：${studio.compliance || '不要承诺素材里没有的效果'}`,
    questionLine,
    `诊断缺口：${extra.gapLabel || '无'} ${extra.gapDetail || ''}`.trim(),
  ].join('\n')
  return { system, user }
}

export function rewriteGenericSentences(body: string, assets: Asset[], allowBragging: boolean): { body: string; flags: string[] } {
  const allowed = allowedNumbers(assets)
  const flags: string[] = []
  const parts = body.split(/(?<=[。！？\n])/)
  let usedFact = false
  const next = parts.map((part) => {
    const sentence = part.trim()
    if (!sentence || sentence.includes('【待补充')) return part
    const brag = !allowBragging && BRAG.test(sentence)
    const generic = GENERIC.test(sentence)
    const hardSell = HARD_SELL.test(sentence)
    const stray = [...(sentence.match(/\d+(?:\.\d+)?/g) ?? [])].some((item) => !allowed.has(item))
    if (!brag && !generic && !hardSell && !stray) return part
    flags.push(sentence.replace(/\s+/g, ' ').slice(0, 80))
    if (!usedFact) {
      const fact = assets.flatMap((item) => item.details.metrics.filter((metric) => metric.customerAuthorized))[0]
      if (fact) {
        usedFact = true
        return part.replace(sentence, `客户的${fact.name}从 ${fact.before}${fact.unit} 变成 ${fact.after}${fact.unit}。`)
      }
      const problem = assets.map((item) => item.details.problem.trim()).find(Boolean)
      if (problem && (brag || generic || hardSell)) {
        usedFact = true
        return part.replace(sentence, `${problem}。`)
      }
    }
    return part.replace(sentence, stray ? '【待补充：客户授权公开的前后数据】' : '【待补充：把这句硬广或空话换成客户侧的问题或变化】')
  })
  return { body: next.join(''), flags }
}

export function softCloser(brand: string, website: string): string {
  const name = brand.trim()
  const site = website.trim()
  if (name && site && !isPlaceholderWebsite(site)) return `具体做法可以看 ${name}：${site}`
  if (name) return name
  return ''
}

export function applyBrandMention(
  brief: DraftBrief,
  brand: string,
  website: string,
  mention: BrandMention,
  linkedQuestion = false,
): DraftBrief {
  if (mention === 'light') {
    const closer = softCloser(brand, website)
    const cleaned = stripLightPromo(brief.body, brand, website)
    const body = linkedQuestion || !closer || cleaned.includes(closer) ? cleaned : `${cleaned}\n\n${closer}`.trim()
    const citeSentences = brief.citeSentences
      .map((item) => stripBrand(item, brand))
      .filter((item) => item.length >= 12 && item !== closer && !item.startsWith('具体做法可以看'))
    const padded =
      citeSentences.length >= 2
        ? citeSentences
        : [
            ...citeSentences,
            ...body
              .split('\n')
              .map((item) => item.trim())
              .filter((item) => item.length >= 12 && item !== brand && item !== closer && !item.startsWith('具体做法可以看')),
          ]
    return { ...brief, body, citeSentences: padded.slice(0, 5) }
  }
  if (mention === 'guide') {
    const line = `想看具体做法，可以从 ${brand} 的公开说明开始：${website}`
    return { ...brief, body: brief.body.includes(brand) ? brief.body : `${brief.body.trim()}\n\n${line}` }
  }
  const body = stripBrand(brief.body, brand)
  const citeSentences = brief.citeSentences.map((item) => stripBrand(item, brand)).filter((item) => item.length >= 12)
  const padded = citeSentences.length >= 2 ? citeSentences : [...citeSentences, ...body.split('\n').map((item) => item.trim()).filter((item) => item.length >= 12)]
  return {
    ...brief,
    title: clipTitle(stripBrand(brief.title, brand) || '客户侧的一处变化'),
    body,
    citeSentences: padded.slice(0, 5),
  }
}

export function materialDraft(
  studio: Studio,
  assets: Asset[],
  channelPath: string,
  mention: BrandMention,
  promptText = '',
): DraftBrief {
  const base = draftFromAssets(studio, assets, channelPath, mention)
  const linked = promptText.trim()
  const answers = linked && (mention === 'light' || mention === 'guide') ? answerCites(assets) : []
  let body = base.body
  let citeSentences = base.citeSentences
  if (answers[0]) body = weaveMid(body, answers[0])
  if (mention === 'light' && answers.length >= 2) citeSentences = answers
  else if (mention === 'light' && !linked) {
    const aside = softAside(assets, body)
    if (aside) body = `${body.trim()}\n\n${aside}`
  }
  return applyBrandMention(
    { ...base, body, citeSentences, urlHint: coerceUrlHint(base.urlHint, studio.website, channelPath) },
    studio.name,
    studio.website,
    mention,
    mention === 'light' && Boolean(linked),
  )
}

function implantRule(mention: BrandMention, promptText: string | undefined, brand: string, website: string): string {
  if (mention === 'none') {
    return '植入强度：不植入。这是从素材写起的案例或产品分享。正文、标题和可引用句都不要出现品牌名。不要写成问答，不要用题目当标题或开头，也不要另起「问/答」或 GEO 问答块。'
  }
  if (mention === 'light') {
    const closer = softCloser(brand, website)
    if (promptText?.trim()) {
      return `植入强度：软植入。目的是让这道题发布后更容易被 AI 引用，不是喊品牌名。正文仍是素材里的故事，不能改成广告或水文。先写客户的问题、前后数据或一处细节。在故事中段用一段短叙述回答这道题，展示已经发生的变化，不要当标题或开头，不要标注 GEO，不要堆 FAQ：${promptText.trim()}。不要写立即咨询，不要写「我们是行业领先」，不要在中段堆品牌，也不要为了植入再追加品牌收束。`
    }
    return `植入强度：软植入。题库里没有可关联的题目。不要编问答，不要写成水文。正文仍是素材故事。结尾必须有且只有一句软收束：${closer}。不要写立即咨询，不要写「我们是行业领先」。`
  }
  const optional = promptText?.trim()
    ? `若带了题目，只在故事中段回答，不要当标题：${promptText.trim()}。`
    : '题目可选。没有题目时不要编问答。'
  return `植入强度：明确种草。读者有意了解品牌时再用。正文仍从客户问题或素材细节写起，结尾写出品牌名、官网和一句下一步。这比软植入更直接。${optional}不要用行业领先、立即咨询、赋能数字化或一眼广告腔。`
}

function answerCites(assets: Asset[]): string[] {
  const lines: string[] = []
  const metric = assets.flatMap((item) => item.details.metrics.filter((entry) => entry.customerAuthorized && (entry.before || entry.after)))[0]
  if (metric) lines.push(`可以核对的变化是：${metric.name}从 ${metric.before}${metric.unit} 到 ${metric.after}${metric.unit}。`)
  const how = assets.map((item) => item.details.howItWorks.trim() || item.details.approach.trim()).find(Boolean)
  if (how) lines.push(`做法上，${how.endsWith('。') ? how : `${how}。`}`)
  const problem = assets.map((item) => item.details.problem.trim()).find(Boolean)
  if (problem) lines.push(`当时要解决的是：${problem.endsWith('。') ? problem : `${problem}。`}`)
  const second = assets[1]?.title.trim()
  if (second) lines.push(`同一件事里还能核对：${second}。`)
  return lines.filter((item) => item.length >= 12).slice(0, 4)
}

function weaveMid(body: string, aside: string): string {
  const parts = body.split(/\n\n+/).map((item) => item.trim()).filter(Boolean)
  if (parts.length === 0) return aside
  const at = Math.max(1, Math.ceil(parts.length / 2))
  parts.splice(at, 0, aside)
  return parts.join('\n\n')
}

function softAside(assets: Asset[], body: string): string {
  const detail = assets
    .map((item) => item.details.howItWorks.trim() || item.details.approach.trim())
    .find((item) => item && !body.includes(item))
  if (detail) return `具体到做法上，${detail.endsWith('。') ? detail : `${detail}。`}`
  const second = assets[1]?.title.trim()
  if (second) return `同一件事里还有一处可以核对：${second}。`
  const problem = assets.map((item) => item.details.problem.trim()).find(Boolean)
  return problem ? `当时卡住的是：${problem.endsWith('。') ? problem : `${problem}。`}` : ''
}

function stripLightPromo(text: string, brand: string, website: string): string {
  let next = stripBrand(text, brand)
  const site = website.trim()
  if (site) next = next.split(site).join('')
  next = next
    .replace(/具体做法可以看\s*[：:]?/g, '')
    .replace(/想看具体做法，可以从\s*的公开说明开始\s*[：:]?/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return next
}

function stripBrand(text: string, brand: string): string {
  if (!brand) return text.trim()
  return text
    .split(`${brand}：`).join('')
    .split(`${brand}的`).join('')
    .split(brand).join('')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[：:\s]+/gm, '')
    .trim()
}

function clipTitle(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 4) return trimmed.slice(0, 80)
  return '客户侧的一处变化'
}

export function assetTypeNames(assets: Asset[]): string {
  return assets.map((item) => assetTypeLabel(item.type)).join('、')
}
