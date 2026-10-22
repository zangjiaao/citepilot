import { isMediaKey, keyFromMediaUrl } from './media.ts'

export interface RichImageRef {
  key: string
  alt: string
}

export function plainTextFromRich(value: string): string {
  const withoutMarkdownImages = value.replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
  const withoutLinks = withoutMarkdownImages.replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
  const withBreaks = withoutLinks.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|ul|ol)>/gi, '\n')
  const stripped = withBreaks.replace(/<[^>]+>/g, ' ')
  return decodeEntities(stripped)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function imageRefsFromHtml(value: string): RichImageRef[] {
  const refs: RichImageRef[] = []
  const seen = new Set<string>()
  const push = (alt: string, src: string) => {
    const key = keyFromMediaUrl(src)
    if (!key || !isMediaKey(key) || seen.has(key)) return
    seen.add(key)
    refs.push({ key, alt: alt.replace(/\s+/g, ' ').trim().slice(0, 120) })
  }
  const markdown = /!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let match: RegExpExecArray | null
  while ((match = markdown.exec(value))) push(match[1] ?? '', match[2] ?? '')
  const images = /<img\b([^>]*)>/gi
  while ((match = images.exec(value))) {
    const attrs = parseAttrs(match[1] ?? '')
    push(attrs.alt ?? '', attrs.src ?? '')
  }
  return refs
}

export function normalizeMarkdownBody(input: string): string {
  const stripped = input
    .replace(/\0/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
  if (!/<(p|h2|h3|ul|ol|li|img|strong|b|em|i|a|div|br)\b/i.test(stripped)) return stripped
  return htmlFragmentToMarkdown(stripped)
}

function htmlFragmentToMarkdown(html: string): string {
  let text = html
  text = text.replace(/<img\b([^>]*)>/gi, (_all, attrs: string) => {
    const parsed = parseAttrs(attrs)
    return parsed.src ? `![${parsed.alt ?? ''}](${parsed.src})` : ''
  })
  text = text.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_all, attrs: string, inner: string) => {
    const href = parseAttrs(attrs).href
    const label = inner.replace(/<[^>]+>/g, '').trim()
    return href ? `[${label}](${href})` : label
  })
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_all, inner: string) => `\n## ${inner.replace(/<[^>]+>/g, '').trim()}\n`)
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_all, inner: string) => `\n### ${inner.replace(/<[^>]+>/g, '').trim()}\n`)
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_all, _tag: string, inner: string) => `**${inner.replace(/<[^>]+>/g, '')}**`)
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_all, _tag: string, inner: string) => `*${inner.replace(/<[^>]+>/g, '')}*`)
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_all, inner: string) => `\n- ${inner.replace(/<[^>]+>/g, '').trim()}`)
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/(ul|ol|p|div)>/gi, '\n')
  text = text.replace(/<[^>]+>/g, '')
  return decodeEntities(text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  const pattern = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(raw))) {
    const key = match[1].toLowerCase()
    if (key.startsWith('on')) continue
    out[key] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return out
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
