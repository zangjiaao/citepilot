import type { BrandMention } from './assets.ts'
import type { DraftLength, PublishPlatformId } from './draftPrompt.ts'

/**
 * 各发布平台的写法习惯。生成时按 contentType 取一条，避免所有渠道都写成同一篇散文。
 * - 小红书 / short-post：卖服务的短帖。钩子 → 边界 → 一个具体做法 → 私信或真实链接。标题约 12–20 字；正文约 300–800，不超过约 1000；不用 Markdown。
 * - 闲鱼：商品说明。短标题，正文用列表。价格只照抄素材里已经写明的说明。没有真实官网时落点写闲鱼主页。
 * - 视频号：约 15–60 秒口播。短句。画面提示单独成段，以「画面：」开头。没有真实官网时引导视频号私信。
 * - 公众号：标题约 15–30 字；正文约 900–2000，篇幅选长则更长；手机上 2–4 句一段；小标题少；先写问题或场景。
 * - 知乎：第一段先回答；再给案例；不要「感谢邀请 / 我将从三方面」；短到中等段落；可用编号。
 * - thread：5–8 条，标成 1/N；每条一个点；先钩子；软植入或明确种草时，品牌或真实官网只放最后一条。
 * - 官网 / 案例拆解：分节；正文里留可引用的句子；软植入或明确种草时真实官网只出现一次。
 * - FAQ：先直接回答，再补短细节；每条答案能单独被引用。
 */

const HINTS: Record<PublishPlatformId, string> = {
  xiaohongshu: '小红书：钩子、边界、一个做法，再私信或链接',
  xianyu: '闲鱼：短标题加列表，价格只照抄素材',
  shipinhao: '视频号：15 到 60 秒口播，短句，可加画面行',
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
    case 'xianyu':
      return 'xianyu'
    case 'shipinhao':
      return 'shipinhao'
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
      return '平台格式（小红书服务短帖）：这是在卖一项服务，不是生活方式笔记。标题约 12 到 20 字，先写客户卡住的一件事。正文约 300 到 800 字，不超过约 1000 字。不要用 Markdown，不要写 ** 或 #。需要强调时用「」。段落一两句，段与段之间空一行。可以少量表情。顺序是：第一句钩子，接着一句边界（做什么、不做什么，只用素材里的说法），再只讲一个具体做法，结尾一句私信或一条真实链接。没有真实官网时不要写网址，不要写 example.com。不要先介绍公司，不要编造报价或客户数字。'
    case 'xianyu':
      return '平台格式（闲鱼商品说明）：写成一条服务挂牌，不是长文。标题 10 到 24 字，说清卖的是哪一项服务。正文约 120 到 400 字，用「- 」开头的短列表，一项一行。只写素材里已经有的交付物、边界和做法。价格只有素材里已经写明时才可以照抄，没有就整篇不提价格，不要编造区间。不要用 Markdown 标题。没有真实官网时，urlHint 和结尾写闲鱼主页，不要写 example.com，不要编造网址。'
    case 'shipinhao':
      return '平台格式（视频号口播）：写成大约 15 到 60 秒能念完的口播，约 80 到 320 字。句子要短，一句一件事，适合出声念。不要用 Markdown。顺序是：开头一句钩子，接着一句边界，再讲一个具体做法，结尾引导视频号私信；有真实官网时可以补一次链接。需要出字幕时，把画面提示单独成段，用「画面：」开头，不要写成拍摄清单。没有真实官网时不要念网址，不要写 example.com。不要编造报价或客户数字。'
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
