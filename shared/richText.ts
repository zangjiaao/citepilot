import { isMediaKey, keyFromMediaUrl } from './media.ts'

const ALLOWED = new Set(['p', 'h2', 'h3', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a', 'img', 'br', 'div'])
const VOID = new Set(['br', 'img'])

export interface RichImageRef {
  key: string
  alt: string
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function sanitizeRichHtml(input: string): string {
  const source = input
    .replace(/\0/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|svg|math|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|svg|math|noscript)\b[^>]*\/?>/gi, '')
  let out = ''
  let index = 0
  while (index < source.length) {
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4)
      index = end === -1 ? source.length : end + 3
      continue
    }
    if (source[index] !== '<') {
      const next = source.indexOf('<', index)
      out += source.slice(index, next === -1 ? source.length : next)
      index = next === -1 ? source.length : next
      continue
    }
    const end = source.indexOf('>', index + 1)
    if (end === -1) break
    const raw = source.slice(index + 1, end).trim()
    index = end + 1
    if (!raw || raw.startsWith('!') || raw.startsWith('?')) continue
    const closing = raw.startsWith('/')
    const body = (closing ? raw.slice(1) : raw).trim()
    const selfClose = !closing && /\/$/.test(body)
    const inner = (selfClose ? body.slice(0, -1) : body).trim()
    const space = inner.search(/\s/)
    const name = (space === -1 ? inner : inner.slice(0, space)).toLowerCase()
    const attrText = space === -1 ? '' : inner.slice(space)
    if (!ALLOWED.has(name)) continue
    if (closing) {
      if (!VOID.has(name)) out += `</${name}>`
      continue
    }
    const attrs = attributesFor(name, attrText)
    if (attrs === null) continue
    out += `<${name}${attrs}>`
  }
  return out
}

export function plainTextFromRich(value: string): string {
  const withBreaks = value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h2|h3|li|ul|ol)>/gi, '\n')
  const stripped = withBreaks.replace(/<[^>]+>/g, ' ')
  return decodeEntities(stripped)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function richHtmlForEditor(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return sanitizeRichHtml(trimmed)
  return trimmed
    .split(/\n{2,}/)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function imageRefsFromHtml(html: string): RichImageRef[] {
  const refs: RichImageRef[] = []
  const seen = new Set<string>()
  const pattern = /<img\b([^>]*)>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) {
    const attrs = parseAttrs(match[1] ?? '')
    const key = keyFromMediaUrl(attrs.src ?? '')
    if (!key || !isMediaKey(key) || seen.has(key)) continue
    seen.add(key)
    refs.push({ key, alt: (attrs.alt ?? '').slice(0, 120) })
  }
  return refs
}

function attributesFor(tag: string, raw: string): string | null {
  const attrs = parseAttrs(raw)
  if (tag === 'a') {
    const href = safeHref(attrs.href ?? '')
    return href ? ` href="${escapeHtml(href)}"` : ''
  }
  if (tag === 'img') {
    const key = keyFromMediaUrl(attrs.src ?? '')
    const src = key ? `/api/media/${key}` : safeRemoteImage(attrs.src ?? '')
    if (!src) return null
    const alt = (attrs.alt ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
    return ` src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"`
  }
  return ''
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

function safeHref(value: string): string {
  const href = value.trim().replace(/[\u0000-\u001f\s]/g, '')
  if (!href) return ''
  if (keyFromMediaUrl(href)) return href
  if (/^https?:\/\//i.test(href)) return href
  return ''
}

function safeRemoteImage(value: string): string {
  const src = value.trim().replace(/[\u0000-\u001f\s]/g, '')
  return /^https:\/\//i.test(src) ? src : ''
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
