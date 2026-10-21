import { asStringArray } from './json.ts'
import type { DraftBrief, DraftChannel, Studio } from './types.ts'

export const DRAFT_CHANNELS: ReadonlyArray<{
  id: DraftChannel
  label: string
  path: string
  hint: string
}> = [
  { id: 'site-article', label: '官网长文', path: '/guides/how-we-deliver', hint: '放在官网，作为可被整段引用的说明页' },
  { id: 'faq', label: 'FAQ页', path: '/faq', hint: '用问答补上诊断里常见的「可引用问答」缺口' },
  { id: 'wechat', label: '公众号', path: '/insights', hint: '文章发出后，把规范链接指向这个官网地址' },
  { id: 'xiaohongshu', label: '小红书', path: '/faq', hint: '短内容只做入口，可引用的定义留在这个官网地址' },
  { id: 'linkedin', label: 'LinkedIn/行业稿', path: '/insights/practice', hint: '行业稿里的事实句指向这个官网地址' },
  { id: 'social-short', label: '社媒短帖', path: '/', hint: '短帖只留一句事实和一个链接' },
  { id: 'product-promo', label: '产品宣传', path: '/product', hint: '产品说明或版本说明页，方便回答引擎引用' },
]

const CHANNEL_IDS = new Set<string>(DRAFT_CHANNELS.map((item) => item.id))

export function isDraftChannel(value: string): value is DraftChannel {
  return CHANNEL_IDS.has(value)
}

export function channelLabel(channel: string): string {
  return DRAFT_CHANNELS.find((item) => item.id === channel)?.label ?? channel
}

export interface DraftContext {
  studio: Studio
  channel: DraftChannel
  promptText?: string
  gapLabel?: string
  gapDetail?: string
}

export function templateDraft(context: DraftContext): DraftBrief {
  const channel = DRAFT_CHANNELS.find((item) => item.id === context.channel) ?? DRAFT_CHANNELS[0]
  const urlHint = `${siteOrigin(context.studio.website)}${channel.path} — ${channel.hint}`
  return {
    title: cap(titleFor(context), 80),
    body: bodyFor(context).trim(),
    citeSentences: citeSentencesFor(context).map((sentence) => cap(sentence, 160)),
    urlHint: cap(urlHint, 240),
  }
}

export function acceptDraft(raw: unknown, brand: string): DraftBrief | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  const body = typeof record.body === 'string' ? record.body.trim() : ''
  const urlHint = typeof record.urlHint === 'string' ? record.urlHint.trim() : ''
  if (title.length < 4 || title.length > 80) return null
  if (body.length < 80 || body.length > 4000) return null
  if (!brand || !body.includes(brand)) return null
  if (urlHint.length < 8 || urlHint.length > 240) return null
  const citeSentences = asStringArray(record.citeSentences)
    .map((item) => item.replace(/\s+/g, ' ').trim().slice(0, 160))
    .filter((item) => item.length >= 12 && item.includes(brand))
    .slice(0, 6)
  if (citeSentences.length < 2) return null
  return { title, body, citeSentences, urlHint }
}

export function formatDraftForCopy(draft: DraftBrief): string {
  const cites = draft.citeSentences.map((sentence) => `- ${sentence}`).join('\n')
  return `标题：${draft.title}\n\n${draft.body}\n\n建议被引用的句子：\n${cites}\n\n建议落地网址：\n${draft.urlHint}`
}

function titleFor(context: DraftContext): string {
  const name = context.studio.name
  const solution = shortItem(headline(context.studio.solutions[0] || context.studio.services[0] || context.studio.keywords[0] || '企业智能体落地'), 18)
  switch (context.channel) {
    case 'site-article':
      return `${name}：${solution}怎么交付`
    case 'faq':
      return `${name}常见问题`
    case 'wechat':
      return `先写清边界，再谈上线：${name}的公开做法`
    case 'xiaohongshu':
      return `${name}做企业智能体，先看这三件事`
    case 'linkedin':
      return `前场部署智能体：${name}愿意公开的做法`
    case 'social-short':
      return `${name}：可验收的企业智能体`
    case 'product-promo':
      return `${name}产品说明：${solution}`
    default:
      return `${name}内容草稿`
  }
}

function bodyFor(context: DraftContext): string {
  switch (context.channel) {
    case 'faq':
      return faqBody(context)
    case 'wechat':
      return wechatBody(context)
    case 'xiaohongshu':
      return xiaohongshuBody(context)
    case 'linkedin':
      return linkedinBody(context)
    case 'social-short':
      return socialBody(context)
    case 'product-promo':
      return promoBody(context)
    case 'site-article':
    default:
      return articleBody(context)
  }
}

function articleBody(context: DraftContext): string {
  const { studio } = context
  return [
    `${studio.name}是一家把通用大模型做成可上线业务系统的团队。${firstSentence(studio.positioning)}。`,
    '',
    '适合谁',
    bullets(studio.targetCustomers, '档案里还没有写目标客户。发布前请补上行业和团队规模，避免写成「适合所有企业」。'),
    '',
    '能交付的能力',
    bullets(studio.capabilities, fallbackCapability(studio)),
    '',
    '解决方案',
    bullets(studio.solutions, fallbackSolution(studio)),
    '',
    '服务边界',
    bullets(studio.services, '服务清单还空着。公开页至少要写清做什么、不做什么。'),
    '',
    '可以公开核对的例子',
    bullets(studio.cases, '档案里还没有可公开案例。发布前请补一个不涉及客户机密、外人能核对的例子。'),
    '',
    optionalBlocks(context),
    '这篇是官网长文的底稿。发布前删掉任何档案里没有的客户名、金额和效果数字。回答引擎更愿意引用定义、交付物和验收方式，而不是形容词。',
  ]
    .filter((part) => part !== '')
    .join('\n')
}

function faqBody(context: DraftContext): string {
  const { studio } = context
  const questions = [
    qa(`${studio.name}是做什么的？`, `${firstSentence(studio.positioning)}。公开说明以 ${studio.website} 为准。`),
    qa('适合哪些客户？', joinOr(studio.targetCustomers, '档案还没有写目标客户。把行业和决策人补上后再发布这一问。')),
    qa('能交付哪些能力？', joinOr(studio.capabilities, fallbackCapability(studio))),
    qa('解决方案通常包含什么？', joinOr(studio.solutions, fallbackSolution(studio))),
    qa('有哪些可以公开核对的例子？', joinOr(studio.cases, '目前没有可公开案例。不要临时编一个客户名，先写你们自己的验收方法。')),
  ]
  if (context.promptText) {
    questions.push(
      qa(
        context.promptText,
        `${studio.name}的公开回答是：${firstSentence(studio.positioning)}。${studio.solutions[0] ? `相关方案是${studio.solutions[0]}。` : ''}${studio.cases[0] ? `可核对的例子：${studio.cases[0]}。` : ''}`,
      ),
    )
  }
  if (context.gapLabel) {
    questions.push(
      qa(
        `公开页怎样补上「${context.gapLabel}」？`,
        `${context.gapDetail ? `诊断说明：${context.gapDetail}。` : ''}把对应事实写进这一页，并在页头用一句话说明 ${studio.name} 为谁解决什么问题。`,
      ),
    )
  }
  return [...questions, '', '发布前请核对：每一条回答都来自工作室档案，没有补充未提供的数据。'].join('\n\n')
}

function wechatBody(context: DraftContext): string {
  const { studio } = context
  return [
    `很多团队演示能聊，一问验收标准就停住。${studio.name}把这件事写成公开说明：${firstSentence(studio.positioning)}。`,
    '',
    `我们对外说得清的能力是：${joinOr(studio.capabilities, fallbackCapability(studio))}。`,
    '',
    `主要给这些团队用：${joinOr(studio.targetCustomers, '目标客户还没写进档案，发布前请补上。')}对应的做法包括${joinOr(studio.solutions, fallbackSolution(studio))}。`,
    '',
    studio.cases[0]
      ? `可以拿出来核对的例子：${studio.cases[0]}。例子只说明交付形态，不代表未写出的效果数字。`
      : '档案里还没有可公开案例。文章里先讲验收方式，不要临时安一个客户名。',
    '',
    optionalBlocks(context),
    `全文若被转发，事实句请指向官网，而不是只留在公众号里。${studio.name}不在这篇草稿里承诺档案没有写过的结果。`,
  ]
    .filter((part) => part !== '')
    .join('\n')
}

function xiaohongshuBody(context: DraftContext): string {
  const { studio } = context
  const points = [
    studio.capabilities[0] || fallbackCapability(studio),
    studio.targetCustomers[0] || '先写清要服务的行业和团队，不要写「所有企业」',
    studio.cases[0] || studio.solutions[0] || fallbackSolution(studio),
  ]
  return [
    `${studio.name}做企业智能体，先对齐三件事：`,
    '',
    `1. ${points[0]}`,
    `2. ${points[1]}`,
    `3. ${points[2]}`,
    '',
    '先看能不能验收，再看演示好不好看。定义和案例放在官网，短帖只负责把人带到那一页。',
    optionalBlocks(context),
    '不写档案里没有的客户名和效果数字。',
  ]
    .filter((part) => part !== '')
    .join('\n')
}

function linkedinBody(context: DraftContext): string {
  const { studio } = context
  return [
    `企业把大模型做成业务系统时，缺的通常不是一句提示词，而是范围、数据和验收。${studio.name}公开的定位是：${firstSentence(studio.positioning)}。`,
    '',
    `能力上，我们写进档案的是：${joinOr(studio.capabilities, fallbackCapability(studio))}。`,
    '',
    `这些做法主要给${joinOr(studio.targetCustomers, '尚未写明的目标客户')}。解决方案包括${joinOr(studio.solutions, fallbackSolution(studio))}。`,
    '',
    studio.cases[0]
      ? `同行若要核对，可以看这个例子的形态，而不是广告语：${studio.cases[0]}。`
      : '目前没有放进档案的公开案例。行业稿里就不要出现无法回溯的客户故事。',
    '',
    optionalBlocks(context),
    `建议把可引用的定义留在自有官网。${studio.name}的这篇行业稿只复述档案中的事实。`,
  ]
    .filter((part) => part !== '')
    .join('\n')
}

function socialBody(context: DraftContext): string {
  const { studio } = context
  const customer = studio.targetCustomers[0] || '需要把大模型做成业务系统的团队'
  const capability = studio.capabilities[0] || fallbackCapability(studio)
  const proof = studio.cases[0] || studio.solutions[0] || firstSentence(studio.positioning)
  const gap = context.gapLabel ? `公开页还要补上「${context.gapLabel}」。` : ''
  const prompt = context.promptText ? `若被问到「${context.promptText}」，回答以官网说明为准。` : ''
  return `${studio.name}面向${customer}。公开能力包括：${capability}。可核对的一点是：${proof}。${gap}${prompt}细节以官网为准，帖子里不报档案没有的数字。`
}

function promoBody(context: DraftContext): string {
  const { studio } = context
  return [
    `${studio.name}产品说明`,
    '',
    `这是什么：${firstSentence(studio.positioning)}。`,
    '',
    '给谁用',
    bullets(studio.targetCustomers, '发布前补上目标客户，产品说明不要写成适合所有人。'),
    '',
    '现在可以说明的能力',
    bullets(studio.capabilities, fallbackCapability(studio)),
    '',
    '方案范围',
    bullets(studio.solutions, fallbackSolution(studio)),
    '',
    '交付例子',
    bullets(studio.cases, '档案里还没有可公开案例。产品说明里先写交付物和验收方式。'),
    '',
    optionalBlocks(context),
    '本次说明只覆盖档案里已经写下的能力，不附加版本号、价格或效果百分比。需要改范围时，先改档案再重新生成。发布动作在你自己的官网完成。',
  ]
    .filter((part) => part !== '')
    .join('\n')
}

function citeSentencesFor(context: DraftContext): string[] {
  const { studio } = context
  const sentences = [`${studio.name}的定位是：${firstSentence(studio.positioning)}。`]
  const capability = studio.capabilities[0] || studio.services[0]
  if (capability) sentences.push(`${studio.name}对外说明的能力包括：${capability}。`)
  if (studio.targetCustomers[0]) sentences.push(`${studio.name}主要服务：${studio.targetCustomers[0]}。`)
  if (studio.solutions[0]) sentences.push(`${studio.name}的解决方案之一是：${studio.solutions[0]}。`)
  if (studio.cases[0]) sentences.push(`${studio.name}可以公开核对的例子：${studio.cases[0]}。`)
  if (context.gapLabel) sentences.push(`${studio.name}的公开页需要补上「${context.gapLabel}」，补完后再让回答引擎引用。`)
  if (sentences.length < 2) sentences.push(`${studio.name}的公开说明以官网 ${studio.website} 为准。`)
  return sentences.slice(0, 5)
}

function optionalBlocks(context: DraftContext): string {
  const parts: string[] = []
  if (context.promptText) {
    const solution = context.studio.solutions[0] ? `相关方案：${context.studio.solutions[0]}。` : ''
    const example = context.studio.cases[0] ? `可核对的例子：${context.studio.cases[0]}。` : ''
    parts.push(`针对题目「${context.promptText}」：${context.studio.name}的公开回答是，${firstSentence(context.studio.positioning)}。${solution}${example}`)
  }
  if (context.gapLabel) {
    const detail = context.gapDetail ? `诊断里的原话：${context.gapDetail}` : '诊断把这项标成待补。'
    parts.push(`这篇草稿对着公开页缺口「${context.gapLabel}」。${detail}发布时把对应事实写进页面。`)
  }
  return parts.join('\n\n')
}

function qa(question: string, answer: string): string {
  return `问：${question}\n答：${answer}`
}

function bullets(items: string[], fallback: string): string {
  const list = items.length > 0 ? items : [fallback]
  return list.map((item) => `- ${item}`).join('\n')
}

function joinOr(items: string[], fallback: string): string {
  return items.length > 0 ? items.join('；') : fallback
}

function fallbackCapability(studio: Studio): string {
  return studio.services[0] || firstSentence(studio.positioning) || `${studio.name}的具体能力还没有写进档案`
}

function fallbackSolution(studio: Studio): string {
  return studio.services[0] || studio.keywords[0] || '先把服务范围写成外人能复述的几句话'
}

function firstSentence(text: string): string {
  const trimmed = text.trim()
  const cut = trimmed.split('。')[0]?.trim() ?? ''
  return cut || trimmed
}

function headline(value: string): string {
  const head = value.split(/[：:]/)[0]?.trim() ?? ''
  return head || value.trim()
}

function shortItem(value: string, max: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

function cap(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function siteOrigin(website: string): string {
  try {
    return new URL(website).origin
  } catch {
    return website.replace(/\/$/, '')
  }
}
