import type { BrandMention } from './assets.ts'
import type { DraftLength, PublishPlatformId } from './draftPrompt.ts'

/**
 * 各发布平台的写法习惯。生成时按 contentType 取一条，避免所有渠道都写成同一篇散文。
 * - 小红书 / short-post：标题约 12–20 字；正文约 300–800，不超过约 1000；不用 Markdown；「」强调；一两句一段；可少量表情；先钩子。
 * - 公众号：标题约 15–30 字；正文约 900–2000，篇幅选长则更长；手机上 2–4 句一段；小标题少；先写问题或场景。
 * - 知乎：第一段先回答；再给案例；不要「感谢邀请 / 我将从三方面」；短到中等段落；可用编号。
 * - thread：5–8 条，标成 1/N；每条一个点；先钩子；软植入或明确种草时，品牌或真实官网只放最后一条。
 * - 官网 / 案例拆解：分节；正文里留可引用的句子；软植入或明确种草时真实官网只出现一次。
 * - FAQ：先直接回答，再补短细节；每条答案能单独被引用。
 */

const HINTS: Record<PublishPlatformId, string> = {
  xiaohongshu: '小红书：短段、无 Markdown、标题约20字内',
  wechat: '公众号：先写场景，手机上两三句一段，小标题少',
  zhihu: '知乎：第一段先回答，再给案例，不要「感谢邀请」',
  thread: 'thread：5 到 8 条，每条一个点，标成 1/N',
  site: '官网：分节写，正文里留可引用的句子',
  faq: 'FAQ：先直接回答，再补一句细节',
}

export function platformFormatHint(platformId: string): string {
  if (platformId in HINTS) return HINTS[platformId as PublishPlatformId]
  return HINTS.xiaohongshu
}

function platformForContent(contentType: string): PublishPlatformId {
  switch (contentType) {
    case 'wechat':
    case 'build-log':
    case 'retro':
      return 'wechat'
    case 'zhihu':
      return 'zhihu'
    case 'thread':
      return 'thread'
    case 'case-breakdown':
    case 'interaction':
      return 'site'
    case 'faq':
      return 'faq'
    case 'short-post':
    default:
      return 'xiaohongshu'
  }
}

function closingNote(mention: BrandMention, whenOn: string): string {
  if (mention === 'none') return '不植入：正文不要出现品牌名或链接。'
  return whenOn
}

export function platformFormatRule(contentType: string, length: DraftLength, mention: BrandMention): string {
  const platform = platformForContent(contentType)
  switch (platform) {
    case 'xiaohongshu':
      return '平台格式（小红书短帖）：标题约 12 到 20 字。正文约 300 到 800 字，不超过约 1000 字。不要用 Markdown，不要写 ** 或 #。需要强调时用「」。段落一两句，段与段之间空一行。可以少量表情。第一句先写钩子，不要先介绍公司。'
    case 'wechat':
      return `平台格式（公众号）：标题约 15 到 30 字。正文约 900 到 2000 字${length === 'long' ? '；这次篇幅选了长，可以写到约 1800 到 2800 字' : ''}。按手机阅读来排：每段 2 到 4 句，段与段之间空一行。小标题少，只在换场景时用。开头写问题或现场，不要先介绍公司。`
    case 'zhihu':
      return '平台格式（知乎回答）：第一段直接回答问题，再写案例和证据。不要写「感谢邀请」，不要写「我将从三方面」。段落短到中等。需要分点时用 1. 2. 3.，不要堆小标题。'
    case 'thread':
      return `平台格式（thread）：写成 5 到 8 条，每条单独成段，开头标 1/N。每条只讲一个点，第一句先写钩子。${closingNote(mention, '品牌名或真实官网只放在最后一条，前面各条不要出现。')}`
    case 'site':
      return `平台格式（官网案例拆解）：用清楚的小节，正文里写出能单独被引用的句子。${closingNote(mention, '真实官网只出现一次，放在结尾。')}`
    case 'faq':
      return `平台格式（FAQ）：先写问题，紧接着直接回答，再补一两句细节。每条答案单独成段，拿出来也能当引用片段。${closingNote(mention, '真实官网最多出现一次，不要写进每一条答案。')}`
  }
}
