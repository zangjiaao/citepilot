import { escapeHtml, plainTextFromRich, sanitizeRichHtml } from './richText.ts'

const HARD_SELL = /硬广|立即咨询|马上咨询|欢迎咨询|点击咨询|行业领先|赋能数字化|一眼广告|广告腔|立刻下单|限时优惠|扫码咨询/

export const POLISH_SYSTEM = [
  '你把粗糙笔记整理成可以分享的素材正文，输出 HTML。',
  '只使用笔记、标题和已授权数据里已经出现的事实、数字和原话。没有写过的客户名、界面、时间和数字不要补。',
  '故事从客户的问题或已经写明的变化写起。不硬广，不凑字，不写成水文。',
  '不要写口号、立即咨询、行业领先、赋能数字化。',
  '只使用 h2、h3、p、strong、em、ul、ol、li、br。不要图片、链接或脚本。',
  '只输出 JSON：{"body":"<h2></h2><p></p>"}。',
].join('')

export function polishNotesOffline(notes: string): string {
  const plain = plainTextFromRich(notes)
  if (!plain) return ''
  const sentences = plain
    .split(/\n+|(?<=[。！？；])/)
    .map((item) => item.trim())
    .filter(Boolean)
  if (sentences.length <= 1) return `<p>${escapeHtml(sentences[0] ?? plain)}</p>`
  const [first, ...rest] = sentences
  const items = rest.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  return `<h2>客户当时的问题</h2><p>${escapeHtml(first)}</p><h2>做法</h2><ul>${items}</ul>`
}

export function acceptPolishedHtml(raw: unknown, source: string): string | null {
  if (!raw || typeof raw !== 'object') return null
  const body = (raw as { body?: unknown }).body
  if (typeof body !== 'string' || !body.trim()) return null
  const clean = sanitizeRichHtml(body)
  const text = plainTextFromRich(clean)
  if (!text) return null
  if (!htmlKeepsNumbers(source, clean)) return null
  const sourceText = plainTextFromRich(source)
  if (HARD_SELL.test(text) && !HARD_SELL.test(sourceText)) return null
  return clean
}

export function htmlKeepsNumbers(source: string, html: string): boolean {
  const allowed = new Set(plainTextFromRich(source).match(/\d+(?:\.\d+)?/g) ?? [])
  const used = plainTextFromRich(html).match(/\d+(?:\.\d+)?/g) ?? []
  return used.every((item) => allowed.has(item))
}
