import { allowedNumbers, assetBlock, assetTypeLabel, authorizedMetrics, draftFromAssets, type Asset, type BrandMention } from './assets.ts'
import { draftImageRule, draftImages, withDraftImages } from './draftImages.ts'
import { coerceUrlHint, isPlaceholderWebsite } from './drafts.ts'
import { plainTextFromRich } from './richText.ts'
import { platformFormatRule } from './platformFormats.ts'
import type { DraftBrief, DraftChannel, Studio } from './types.ts'

export type { BrandMention } from './assets.ts'

export const NO_FABRICATION_RULE =
  '只能使用勾选的素材里已经写出的事实。品牌资料只作语气和红线。不要编造客户名、界面、数字、奖项或团队规模。没有已授权的前后数据时，不要编造指标，也不要用【待补充】占段落；改写问题和做法。整篇最多一句缺口说明。thread 的 1/N 编号不是数据。'

export const SHOW_DONT_TELL_RULE =
  '写客户已经发生的变化，不要写我们有多强。有已授权的前后数据就写那一组；没有就写具体问题和做法。不要先介绍公司。不要用获奖、人数、行业领先、头部、顶级。'

export const PARAGRAPH_RULE =
  '正文用短段落，段与段之间空一行；一两句就换段；不要大段墙；短帖更碎，长文也避免超过约 3～4 句一段。图片单独成段。'

export const CONTENT_TYPES = [
  { id: 'case-breakdown', label: '案例拆解' },
  { id: 'interaction', label: '交互/设计细节分享' },
  { id: 'build-log', label: '开发过程/build in public' },
  { id: 'retro', label: '踩坑复盘' },
  { id: 'thread', label: 'X/推特 thread' },
  { id: 'short-post', label: '小红书服务短帖' },
  { id: 'xianyu', label: '闲鱼商品说明' },
  { id: 'shipinhao', label: '视频号口播' },
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
  { id: 'light', label: '软植入', description: '把相关题目的答案写进故事，结尾轻轻留下品牌名或真实官网。' },
  { id: 'guide', label: '明确种草', description: '题目可写可不写。篇幅与软植入相同，结尾单独写出品牌、官网和下一步。' },
] as const

export const IMPLANT_PURPOSE = '为了让相关题目更容易被 AI 引用：故事里写出能对上这道题的事实，并轻轻留下品牌或官网。正文仍以素材故事为主。'

export const SOFT_IMPLANT_HINT = '会把这道题的答案写进故事，引用句要能直接回答它，结尾再轻轻留下一次品牌或真实官网。'

export const PUBLISH_PLATFORMS = [
  { id: 'xiaohongshu', label: '小红书', contentType: 'short-post', channel: 'xiaohongshu', format: '服务短帖' },
  { id: 'xianyu', label: '闲鱼', contentType: 'xianyu', channel: 'xianyu', format: '商品说明' },
  { id: 'shipinhao', label: '视频号', contentType: 'shipinhao', channel: 'shipinhao', format: '口播短稿' },
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
  if (type === 'service') return 'xianyu'
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
  if (type === 'service') return 'xianyu'
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
    case 'xianyu':
      return 'xianyu'
    case 'shipinhao':
      return 'shipinhao'
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
    case 'xianyu':
      return 'xianyu'
    case 'shipinhao':
      return 'shipinhao'
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

export function profileGaps(_studio: Studio, _options: DraftRequestOptions, assets: Asset[]): string[] {
  const gaps: string[] = []
  if (assets.length === 0) gaps.push('先从素材库勾选一条或多条。不勾选时，稿子没有客户侧的事实')
  const metrics = assets.flatMap((item) => item.details.metrics.filter((metric) => metric.customerAuthorized && (metric.before || metric.after)))
  if (assets.length > 0 && metrics.length === 0) {
    gaps.push('没有已授权的前后数字：正文按问题和做法来写，不要编造耗时或准确率')
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
      ? '5 到 8 条，每条一个点，单独成段'
      : options.contentType === 'shipinhao'
        ? '口播约 80 到 320 字，大约 15 到 60 秒，不要写成长文'
        : options.contentType === 'xianyu'
          ? '标题 10 到 24 字，正文约 120 到 400 字，用短列表'
          : options.contentType === 'short-post'
            ? '正文约 300 到 800 字，不超过约 1000 字'
            : options.contentType === 'wechat'
              ? options.length === 'long'
                ? '1800 到 2800 字'
                : '900 到 2000 字'
              : options.length === 'short'
                ? '400 到 700 字'
                : options.length === 'long'
                  ? '1800 到 2800 字'
                  : '900 到 1400 字'
  const formatRule = platformFormatRule(options.contentType, options.length, options.brandMention)
  const mentionRule = implantRule(options.brandMention, extra.promptText, studio.name, studio.website, options.contentType)
  const hintRule = urlHintRule(options.contentType, studio.website)
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
    PARAGRAPH_RULE,
    formatRule,
    draftImageRule(draftImages(assets)),
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
    PARAGRAPH_RULE,
    formatRule,
    assets.length > 0 ? assets.map((item, index) => `素材 ${index + 1}\n${assetBlock(item)}`).join('\n\n') : '素材：没有勾选。不要用品牌介绍硬写。',
    draftImageRule(draftImages(assets)),
    websiteLine(studio.website, options.contentType),
    `品牌资料只作背景。定位：${studio.positioning || '未填'}`,
    `禁用词：${studio.bannedWords || '无'}`,
    `不能说的内容：${studio.compliance || '不要承诺素材里没有的效果'}`,
    questionLine,
    '底稿如果附在后面，只作事实核对。不要原样交回底稿，不要写成「案例：标题」这种字段罗列。篇幅按上面的长度写完整的一篇。',
    `诊断缺口：${extra.gapLabel || '无'} ${extra.gapDetail || ''}`.trim(),
  ].join('\n')
  return { system, user }
}

const METRIC_GAP = '【待补充：客户授权公开的前后数据】'

export function placeholderShare(body: string): number {
  const blocks = body.split(/\n+/).map((item) => item.trim()).filter(Boolean)
  if (blocks.length === 0) return 0
  return blocks.filter((item) => item.includes('【待补充')).length / blocks.length
}

function isLabelDigit(text: string, index: number, raw: string): boolean {
  const after = text.slice(index + raw.length, index + raw.length + 3)
  const before = text.slice(Math.max(0, index - 3), index)
  if (/^\s*\//.test(after) || /\/\s*$/.test(before)) return true
  const lineStart = text.lastIndexOf('\n', index - 1) + 1
  if (/^\s*$/.test(text.slice(lineStart, index)) && /^\s*[.)）、]/.test(after)) return true
  return false
}

function strayDigits(sentence: string, allowed: Set<string>): string[] {
  const found: string[] = []
  sentence.replace(/\d+(?:\.\d+)?/g, (raw, index: number) => {
    if (!allowed.has(raw) && !isLabelDigit(sentence, index, raw)) found.push(raw)
    return raw
  })
  return found
}

function stripUnauthorizedDigits(sentence: string, allowed: Set<string>): string {
  return sentence
    .replace(/\d+(?:\.\d+)?/g, (raw, index: number) => (allowed.has(raw) || isLabelDigit(sentence, index, raw) ? raw : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([。！？，、%％])/g, '$1')
    .trim()
}

function hasWords(text: string): boolean {
  return text.replace(/[\d\s./\\:：、，。！？%％\-【】]/g, '').length >= 4
}

function qualitativeFallback(assets: Asset[]): string {
  const problem = assets.map((item) => item.details.problem.trim()).find(Boolean)
  const how = assets.map((item) => item.details.howItWorks.trim() || item.details.approach.trim()).find(Boolean)
  return [problem, how]
    .filter((item): item is string => Boolean(item))
    .map((item) => (item.endsWith('。') || item.endsWith('！') || item.endsWith('？') ? item : `${item}。`))
    .join('\n\n')
}

export function rewriteGenericSentences(
  body: string,
  assets: Asset[],
  allowBragging: boolean,
  extraAllowedText = '',
): { body: string; flags: string[] } {
  const allowed = allowedNumbers(assets)
  for (const match of extraAllowedText.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(match)
  const flags: string[] = []
  const parts = body.split(/(?<=[。！？\n])/)
  let usedFact = false
  let usedGap = false
  const next = parts.map((part) => {
    const sentence = part.trim()
    if (!sentence || sentence.includes('【待补充')) return part
    if (/^!\[[^\]]*]\([^)]*\)$/.test(sentence) || /^【\s*图片\d+\s*】$/.test(sentence)) return part
    if (/^\d{1,2}\s*\/\s*\d{1,2}$/.test(sentence)) return part
    const brag = !allowBragging && BRAG.test(sentence)
    const generic = GENERIC.test(sentence)
    const hardSell = HARD_SELL.test(sentence)
    const stray = strayDigits(sentence, allowed)
    if (!brag && !generic && !hardSell && stray.length === 0) return part
    flags.push(sentence.replace(/\s+/g, ' ').slice(0, 80))
    if (!brag && !generic && !hardSell) {
      const stripped = stripUnauthorizedDigits(sentence, allowed)
      if (hasWords(stripped)) return part.replace(sentence, stripped)
      if (!usedFact) {
        const problem = assets.map((item) => item.details.problem.trim()).find(Boolean)
        if (problem) {
          usedFact = true
          return part.replace(sentence, problem.endsWith('。') ? problem : `${problem}。`)
        }
      }
      return part.replace(sentence, '')
    }
    if (!usedFact) {
      const fact = assets.flatMap((item) => item.details.metrics.filter((metric) => metric.customerAuthorized && (metric.before || metric.after)))[0]
      if (fact) {
        usedFact = true
        return part.replace(sentence, `客户的${fact.name}从 ${fact.before}${fact.unit} 变成 ${fact.after}${fact.unit}。`)
      }
      const problem = assets.map((item) => item.details.problem.trim()).find(Boolean)
      if (problem) {
        usedFact = true
        return part.replace(sentence, problem.endsWith('。') ? problem : `${problem}。`)
      }
    }
    if (!usedGap) {
      usedGap = true
      return part.replace(sentence, METRIC_GAP)
    }
    return part.replace(sentence, '')
  })
  const rewritten = next.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (placeholderShare(rewritten) > 0.3) {
    const story = placeholderShare(body) > 0.3 ? qualitativeFallback(assets) || body : body
    return { body: story, flags: ['有未授权数字，已保留原来的故事，没有改成一串待补充。'] }
  }
  return { body: rewritten, flags }
}

export function softCloser(brand: string, website: string, contentType = ''): string {
  const name = brand.trim()
  const site = website.trim()
  if (name && site && !isPlaceholderWebsite(site)) return `具体做法可以看 ${name}：${site}`
  if (contentType === 'xianyu') return name ? `想了解范围，可以到闲鱼主页找 ${name}` : '想了解范围，可以到闲鱼主页私信'
  if (contentType === 'shipinhao') return name ? `想了解范围，可以在视频号私信 ${name}` : '想了解范围，可以在视频号私信'
  if (contentType === 'short-post') return name ? `想对上这项服务，可以私信 ${name}` : '想对上这项服务，可以私信'
  if (name) return name
  return ''
}

export function guideCloser(brand: string, website: string, contentType = ''): string {
  const name = brand.trim()
  const site = website.trim()
  const real = Boolean(site) && !isPlaceholderWebsite(site)
  if (contentType === 'xianyu' && !real) return name ? `想看具体范围，可以到闲鱼主页找 ${name}。` : '想看具体范围，可以到闲鱼主页私信。'
  if (contentType === 'shipinhao' && !real) return name ? `想看具体范围，可以在视频号私信 ${name}。` : '想看具体范围，可以在视频号私信。'
  if (contentType === 'short-post' && !real) return name ? `想看具体做法，可以私信 ${name}。` : ''
  if (!name) return ''
  return real ? `想看具体做法，可以从 ${name} 的公开说明开始：${site}` : `想看具体做法，可以从 ${name} 的公开说明开始。`
}

function stripOffsiteClosers(text: string): string {
  return text
    .replace(/想了解范围，可以到闲鱼主页(?:找)?\s*[^\n]*/g, '')
    .replace(/想了解范围，可以在视频号私信\s*[^\n]*/g, '')
    .replace(/想对上这项服务，可以私信\s*[^\n]*/g, '')
    .replace(/想看具体范围，可以到闲鱼主页(?:找)?\s*[^\n]*/g, '')
    .replace(/想看具体范围，可以在视频号私信\s*[^\n]*/g, '')
    .replace(/想看具体做法，可以私信\s*[^\n]*/g, '')
}

function stripImplantClosers(body: string): string {
  return stripOffsiteClosers(body)
    .replace(/具体做法可以看\s*\S[^\n。]*/g, '')
    .replace(/想看具体做法，可以从\s*\S[^\n。]*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function finishDraftBody(body: string, brand: string, website: string, mention: BrandMention, contentType: string): string {
  const closer = mention === 'guide' ? guideCloser(brand, website, contentType) : mention === 'light' ? softCloser(brand, website, contentType) : ''
  let story = stripImplantClosers(body)
  if (closer) {
    const parts = story.split(/\n\n+/).map((item) => item.trim()).filter(Boolean)
    while (parts.length > 0 && parts[parts.length - 1] === closer) parts.pop()
    story = parts.join('\n\n')
  }
  const paced = paceDraftBody(story, paragraphLimit(contentType)).trim()
  if (!closer) return paced
  if (!paced || paced === closer) return closer
  if (paced.endsWith(`\n\n${closer}`)) return paced
  return `${paced}\n\n${closer}`
}

export function isPublishableDraft(body: string, contentType: string): boolean {
  const story = stripImplantClosers(body).replace(/\s+/g, '')
  if (!story || /(?:案例|产品|巧思|交互细节|数据成效|客户评价|踩坑经验|参考资料)：/.test(story)) return false
  if ((body.match(/【待补充/g) ?? []).length > 1 || placeholderShare(body) > 0.3) return false
  if (contentType === 'thread') return stripImplantClosers(body).split(/\n\n+/).filter(Boolean).length >= 4
  if (contentType === 'shipinhao') return story.length >= 60
  if (contentType === 'xianyu') return story.length >= 80
  if (contentType === 'short-post') return story.length >= 180
  return story.length >= 320
}

export function applyBrandMention(brief: DraftBrief, brand: string, website: string, mention: BrandMention, contentType = ''): DraftBrief {
  if (mention === 'light') {
    const closer = softCloser(brand, website, contentType)
    const cleaned = stripLightPromo(brief.body, brand, website)
    const body = !closer || cleaned.includes(closer) ? cleaned : `${cleaned}\n\n${closer}`.trim()
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
    const line = guideCloser(brand, website, contentType)
    const cleaned = stripImplantClosers(brief.body)
    return { ...brief, body: line ? `${cleaned}\n\n${line}` : cleaned }
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

export function paragraphLimit(contentType: string): number {
  if (contentType === 'thread' || contentType === 'shipinhao') return 1
  if (contentType === 'short-post' || contentType === 'xianyu') return 2
  return 4
}

const ATOMIC_LINE = /^(?:!\[[^\]]*]\([^)]*\)|【\s*图片\d+\s*】|#{1,6}\s+\S.*|画面：\S.*)$/
const LIST_LINE = /^(?:[-*+]|\d+[.)])\s+\S/

function linePieces(line: string): Array<{ atomic: boolean; text: string }> {
  const pattern = /!\[[^\]]*]\([^)]*\)|【\s*图片\d+\s*】/g
  const pieces: Array<{ atomic: boolean; text: string }> = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line))) {
    const before = line.slice(last, match.index).trim()
    if (before) pieces.push({ atomic: false, text: before })
    pieces.push({ atomic: true, text: match[0] })
    last = match.index + match[0].length
  }
  const rest = line.slice(last).trim()
  if (rest) pieces.push({ atomic: false, text: rest })
  if (pieces.length === 0 && line.trim()) pieces.push({ atomic: false, text: line.trim() })
  return pieces
}

function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[。！？])/)
    .map((item) => item.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts : [text.trim()]
}

export function paceDraftBody(body: string, maxSentences = 4): string {
  const cap = Math.max(1, maxSentences)
  const paragraphs: string[] = []
  let sentences: string[] = []
  let list: string[] = []
  const flushSentences = () => {
    if (sentences.length === 0) return
    paragraphs.push(sentences.join(''))
    sentences = []
  }
  const flushList = () => {
    if (list.length === 0) return
    paragraphs.push(list.join('\n'))
    list = []
  }
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (LIST_LINE.test(line)) {
      flushSentences()
      list.push(line)
      continue
    }
    flushList()
    if (ATOMIC_LINE.test(line)) {
      flushSentences()
      paragraphs.push(line)
      continue
    }
    for (const piece of linePieces(line)) {
      if (piece.atomic) {
        flushSentences()
        paragraphs.push(piece.text)
        continue
      }
      for (const sentence of splitSentences(piece.text)) {
        const previous = sentences[sentences.length - 1]
        if (previous && !/[。！？]$/.test(previous)) flushSentences()
        sentences.push(sentence)
        if (sentences.length >= cap) flushSentences()
      }
    }
  }
  flushList()
  flushSentences()
  return paragraphs.join('\n\n').trim()
}

export function materialDraft(
  studio: Studio,
  assets: Asset[],
  channelPath: string,
  mention: BrandMention,
  promptText = '',
  contentType = '',
): DraftBrief {
  const base = draftFromAssets(studio, assets, channelPath, mention)
  const linked = promptText.trim()
  const answers = linked && (mention === 'light' || mention === 'guide') ? answerCites(assets) : []
  const shaped = shapeSellingDraft(assets, contentType)
  let body = shaped ?? base.body
  let citeSentences = base.citeSentences
  if (shaped) {
    if (answers[0] && !body.includes(answers[0])) body = `${body.trim()}\n\n${answers[0]}`
  } else {
    if (answers[0]) body = weaveMid(body, answers[0])
    if (mention === 'light' && answers.length >= 2) citeSentences = answers
    if ((mention === 'light' || mention === 'guide') && !linked) {
      const aside = softAside(assets, body)
      if (aside && !body.includes(aside)) body = `${body.trim()}\n\n${aside}`
    }
  }
  const channel = isContentType(contentType) ? channelForContentType(contentType) : ''
  const mentioned = applyBrandMention(
    { ...base, body, citeSentences, urlHint: coerceUrlHint(base.urlHint, studio.website, channelPath, channel, studio.name) },
    studio.name,
    studio.website,
    mention,
    contentType,
  )
  return {
    ...mentioned,
    body: finishDraftBody(withDraftImages(mentioned.body, assets), studio.name, studio.website, mention, contentType),
  }
}

function sellingContent(contentType: string): boolean {
  return contentType === 'short-post' || contentType === 'xianyu' || contentType === 'shipinhao'
}

function closerPlace(contentType: string, website: string): string {
  const real = Boolean(website.trim()) && !isPlaceholderWebsite(website)
  if (real) return '官网'
  if (contentType === 'xianyu') return '闲鱼主页'
  if (contentType === 'shipinhao') return '视频号私信'
  if (contentType === 'short-post') return '私信'
  return '官网'
}

function urlHintRule(contentType: string, website: string): string {
  const missing = !website.trim() || isPlaceholderWebsite(website)
  if (contentType === 'xianyu' && missing) return '没有真实官网。urlHint 写「闲鱼主页」加品牌名，不要写网址，不要写 example.com。'
  if (contentType === 'shipinhao' && missing) return '没有真实官网。urlHint 写「视频号私信」加品牌名，不要写网址，不要写 example.com。'
  if (contentType === 'short-post' && missing) return '没有真实官网。urlHint 可以写「小红书私信」加品牌名，不要写 example.com。'
  return 'urlHint 必须使用给定官网的主机名。官网若是 example.com 这种示例地址，不要写进 urlHint。'
}

function websiteLine(website: string, contentType: string): string {
  const missing = !website.trim() || isPlaceholderWebsite(website)
  if (missing && contentType === 'xianyu') return '官网：未填或是示例地址。urlHint 写闲鱼主页加品牌名，不要写成 example.com。'
  if (missing && contentType === 'shipinhao') return '官网：未填或是示例地址。urlHint 写视频号私信加品牌名，不要写成 example.com。'
  if (missing) return '官网：未填或是示例地址。不要把 example.com 写进正文或 urlHint。'
  return `官网：${website}。urlHint 只能用这个官网的主机名，不要写成 example.com。`
}

function sentenceOf(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  return /[。！？]$/.test(trimmed) ? trimmed : `${trimmed}。`
}

function shapeSellingDraft(assets: Asset[], contentType: string): string | null {
  if (!sellingContent(contentType) || assets.length === 0) return null
  const problem = assets.map((item) => item.details.problem.trim()).find(Boolean) ?? ''
  const boundary =
    assets.map((item) => item.details.boundaries.trim()).find(Boolean) ??
    assets.map((item) => item.details.approach.trim()).find(Boolean) ??
    ''
  const method =
    assets.map((item) => item.details.howItWorks.trim()).find(Boolean) ??
    assets.map((item) => item.details.approach.trim()).find(Boolean) ??
    plainTextFromRich(assets[0]?.body ?? '')
  const deliverables = assets.map((item) => item.details.deliverables.trim()).find(Boolean) ?? ''
  const price = assets.map((item) => item.details.priceNote.trim()).find(Boolean) ?? ''
  const metric = assets.flatMap((item) => authorizedMetrics(item.details))[0]
  const hook = metric
    ? `客户的${metric.name}从 ${metric.before}${metric.unit} 变成 ${metric.after}${metric.unit}`
    : problem || assets[0]?.title.trim() || ''
  const edge = boundary || '只做素材里写明的范围'
  const step = method || assets[0]?.title.trim() || ''
  if (contentType === 'xianyu') {
    const lines = [hook, edge, step, deliverables].map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean)
    const unique = [...new Set(lines)].slice(0, 6)
    const bullets = unique.map((item) => `- ${item.replace(/[。！？]$/, '')}`)
    return price ? `${bullets.join('\n')}\n- 价格：${price}` : bullets.join('\n')
  }
  if (contentType === 'shipinhao') {
    return [
      sentenceOf(hook),
      sentenceOf(`边界是，${edge.replace(/[。！？]$/, '')}`),
      sentenceOf(step),
      price ? sentenceOf(`价格只按已写明的说明，${price}`) : '',
      '画面：字幕只留这一句边界。',
    ]
      .filter(Boolean)
      .join('\n\n')
  }
  return [sentenceOf(hook), sentenceOf(`边界是，${edge.replace(/[。！？]$/, '')}`), sentenceOf(`一个做法：${step.replace(/[。！？]$/, '')}`), price ? sentenceOf(`价格只按已写明的说明，${price}`) : '']
    .filter(Boolean)
    .join('\n\n')
}

export function implantRule(mention: BrandMention, promptText: string | undefined, brand: string, website: string, contentType: string): string {
  if (mention === 'none') {
    return '植入强度：不植入。这是从素材写起的案例、产品或服务分享。正文、标题和可引用句都不要出现品牌名。不要写成问答，不要用题目当标题或开头，也不要另起「问/答」或 GEO 问答块。'
  }
  const place = closerPlace(contentType, website)
  if (mention === 'light') {
    const closer = softCloser(brand, website, contentType)
    const question = promptText?.trim()
    const answer = question
      ? `在故事中段用一段短叙述回答这道题，展示已经发生的变化，不要当标题或开头，不要标注 GEO，不要堆 FAQ：${question}。`
      : '题库里没有可关联的题目。不要编问答。'
    const ending = closer ? `结尾必须有且只有一句软收束：${closer}。` : '没有品牌名时不要编造品牌。'
    return `植入强度：软植入。目的是让相关题目发布后更容易被引用：故事里写出能对上问题的事实，结尾再轻轻留下一次品牌或${place}，方便引用时对上这个工作室。正文仍是素材故事，不能改成广告或水文。先写客户的问题、前后数据或一处细节。${answer}${ending}不要写立即咨询，不要写「我们是行业领先」，不要在中段堆品牌。`
  }
  const optional = promptText?.trim()
    ? `若带了题目，只在故事中段回答，不要当标题：${promptText.trim()}。`
    : '题目可选。没有题目时不要编问答。'
  const ending = guideCloser(brand, website, contentType)
  const lengthNote = sellingContent(contentType)
    ? '篇幅跟平台格式走，不要拉成官网长文，也不要交回素材字段罗列。'
    : '正文长度与软植入相同，不要因为种草就缩短成广告短帖，也不要交回素材字段罗列。'
  return `植入强度：明确种草。${lengthNote}按平台格式写成完整的一篇，先写客户的问题、前后数据或一处细节。结尾单独成段，写出品牌名、${place}和一句下一步${ending ? `：${ending}` : ''}。这比软植入更直接，只是收束更明确。${optional}不要用行业领先、立即咨询、赋能数字化或一眼广告腔。`
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
  if (second && !body.includes(second)) return `同一件事里还有一处可以核对：${second}。`
  const problem = assets.map((item) => item.details.problem.trim()).find(Boolean)
  if (problem && !body.includes(problem)) return `当时卡住的是：${problem.endsWith('。') ? problem : `${problem}。`}`
  return ''
}

function stripLightPromo(text: string, brand: string, website: string): string {
  let next = stripBrand(text, brand)
  const site = website.trim()
  if (site) next = next.split(site).join('')
  next = stripOffsiteClosers(next)
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
