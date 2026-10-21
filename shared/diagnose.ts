import type { CheckItem, CheckStatus } from './types.ts'

export interface FetchedDoc {
  url: string
  status: number
  body: string
}

export interface DiagnosisInput {
  page: FetchedDoc
  robots: FetchedDoc | null
  llms: FetchedDoc | null
}

export interface DiagnosisReport {
  title: string
  excerpt: string
  checklist: CheckItem[]
  suggestions: string[]
}

const AI_BOTS = ['gptbot', 'claudebot', 'perplexitybot', 'google-extended', 'bytespider']

export function buildDiagnosis(input: DiagnosisInput): DiagnosisReport {
  const html = input.page.body
  const title = textContent(matchTag(html, 'title'))
  const metas = readMetas(html)
  const description = metas.get('description') ?? ''
  const robotsMeta = metas.get('robots') ?? ''
  const ogTitle = metas.get('og:title') ?? ''
  const ogDescription = metas.get('og:description') ?? ''
  const h1s = allTagText(html, 'h1')
  const lang = attr(firstTag(html, 'html'), 'lang')
  const canonical = linkHref(html, 'canonical')
  const jsonLdTypes = readJsonLdTypes(html)
  const visible = visibleText(html)
  const images = tags(html, 'img')
  const imagesMissingAlt = images.filter((tag) => attr(tag, 'alt') === null).length
  const links = tags(html, 'a').map((tag) => attr(tag, 'href')).filter((href): href is string => Boolean(href))
  const hasViewport = metas.has('viewport')
  const faqSignal = jsonLdTypes.some((type) => /faqpage/i.test(type)) || /常见问题|FAQ/i.test(html)
  const orgSignal = jsonLdTypes.some((type) => /organization|website|professionalService/i.test(type))
  const robotsBody = input.robots && input.robots.status >= 200 && input.robots.status < 300 ? input.robots.body : ''
  const robotsInfo = robotsBody ? parseRobots(robotsBody) : null
  const sitemapHint = /sitemap:/i.test(robotsBody) || links.some((href) => /sitemap/i.test(href))
  const https = input.page.url.startsWith('https://')
  const llmsOk = Boolean(input.llms && input.llms.status >= 200 && input.llms.status < 300 && input.llms.body.trim().length > 20)

  const checklist: CheckItem[] = [
    item('https', '使用 HTTPS', https ? 'pass' : 'fail', https ? '最终地址是 HTTPS。' : '最终地址不是 HTTPS，回答引擎更难稳定引用。'),
    item(
      'status',
      '页面可访问',
      input.page.status >= 200 && input.page.status < 300 ? 'pass' : 'fail',
      `HTTP ${input.page.status}。`,
    ),
    item('title', '标题', titleStatus(title), title ? `标题「${truncate(title, 80)}」，${title.length} 个字。` : '没有读到 title。'),
    item(
      'description',
      '描述',
      descriptionStatus(description),
      description ? `描述 ${description.length} 个字。` : '没有 meta description。',
    ),
    item('h1', '主标题 H1', h1Status(h1s.length), h1s.length ? `读到 ${h1s.length} 个 H1：${truncate(h1s[0] ?? '', 40)}` : '没有 H1。'),
    item('lang', '页面语言', lang ? 'pass' : 'warn', lang ? `html lang="${lang}"。` : '没有声明 lang，中文页建议 zh-CN。'),
    item('viewport', '移动端视口', hasViewport ? 'pass' : 'fail', hasViewport ? '已声明 viewport。' : '缺少 viewport，移动端摘录体验不稳定。'),
    item('canonical', '规范链接', canonical ? 'pass' : 'warn', canonical ? `canonical 指向 ${truncate(canonical, 80)}。` : '没有 canonical，重复地址可能分散引用。'),
    item(
      'open-graph',
      '分享摘要',
      ogTitle && ogDescription ? 'pass' : 'warn',
      ogTitle && ogDescription
        ? 'Open Graph 标题和描述都在。'
        : ogTitle || ogDescription
          ? 'Open Graph 不完整。'
          : '没有 og:title 或 og:description。',
    ),
    item(
      'jsonld',
      '结构化数据',
      jsonLdTypes.length === 0 ? 'warn' : orgSignal ? 'pass' : 'warn',
      jsonLdTypes.length ? `JSON-LD 类型：${jsonLdTypes.join('、')}。` : '没有 JSON-LD。建议补 Organization 或 FAQPage。',
    ),
    item('faq', '可引用的问答', faqSignal ? 'pass' : 'warn', faqSignal ? '发现 FAQ 信号。' : '没有常见问题或 FAQPage，回答引擎缺少可直接引用的问答。'),
    item('content', '正文厚度', contentStatus(visible.length), `可见文本约 ${visible.length} 字。`),
    item(
      'images',
      '图片替代文本',
      images.length === 0 ? 'pass' : imagesMissingAlt === 0 ? 'pass' : 'warn',
      images.length === 0 ? '页面没有图片。' : `${images.length} 张图片中有 ${imagesMissingAlt} 张缺少 alt。`,
    ),
    item(
      'noindex',
      '允许收录',
      /noindex/i.test(robotsMeta) ? 'fail' : 'pass',
      robotsMeta ? `robots meta：${robotsMeta}。` : '没有 noindex。',
    ),
    item('links', '页内链接', links.length >= 2 ? 'pass' : 'warn', `读到 ${links.length} 个链接。`),
    robotsItem(input.robots, robotsInfo),
    item(
      'ai-bots',
      '回答引擎抓取',
      !robotsInfo ? 'warn' : robotsInfo.blockedBots.length ? 'warn' : 'pass',
      !robotsInfo
        ? '没有可用的 robots.txt，无法确认 AI 爬虫策略。'
        : robotsInfo.blockedBots.length
          ? `这些爬虫被 Disallow: / ：${robotsInfo.blockedBots.join('、')}。若目标是被引用，应允许它们抓取公开页。`
          : '没有看到常见 AI 爬虫被整站禁止。',
    ),
    item('llms', 'llms.txt', llmsOk ? 'pass' : 'warn', llmsOk ? '站点提供了 llms.txt。' : '没有读到可用的 /llms.txt。可在站点根放一份给模型看的简介。'),
    item('sitemap', '站点地图线索', sitemapHint ? 'pass' : 'warn', sitemapHint ? '发现 sitemap 线索。' : 'robots.txt 和页面链接里都没有 sitemap。'),
  ]

  return {
    title,
    excerpt: truncate(visible, 280),
    checklist,
    suggestions: suggestionsFrom(checklist),
  }
}

export function suggestionsFrom(checklist: CheckItem[]): string[] {
  const byId = new Map(checklist.map((entry) => [entry.id, entry]))
  const suggestions: string[] = []
  const push = (id: string, text: string) => {
    const found = byId.get(id)
    if (found && found.status !== 'pass') suggestions.push(text)
  }
  push('https', '把官网切到 HTTPS，并让诊断地址最终落到 https。')
  push('status', '先保证这个 URL 返回 200，再谈被引用。')
  push('noindex', '去掉 noindex，否则回答引擎不该引用这一页。')
  push('title', '把 title 写成 15 到 40 个字，包含工作室名称和核心服务，而不是只有品牌词。')
  push('description', '补一段 50 到 140 字的 meta description，写清为谁解决什么问题。')
  push('h1', '页面只保留一个 H1，用一句人话说明你是做什么的。')
  push('content', '公开页补上服务边界、交付物和一两个可核对的案例，避免只有口号。')
  push('faq', '增加「常见问题」小节，或提供 FAQPage 结构化数据，方便回答引擎整段引用。')
  push('jsonld', '用 JSON-LD 标出 Organization 或 ProfessionalService，写上名称、网址和服务。')
  push('llms', '在网站根目录发布 /llms.txt，用纯文本说明定位、服务和首选引用页。')
  push('ai-bots', '检查 robots.txt，不要把 GPTBot、PerplexityBot、ClaudeBot 整站禁掉，除非你故意不做 GEO。')
  push('robots', '提供 robots.txt，并写上 Sitemap 地址。')
  push('canonical', '给主页加上 canonical，避免带参数的地址被当成另一页。')
  push('sitemap', '提交 sitemap，并在 robots.txt 里声明。')
  push('open-graph', '补齐 og:title 和 og:description，让摘录和分享卡片一致。')
  push('images', '给信息性图片补上 alt，装饰图可以用空 alt。')
  push('links', '从主页链到服务、案例和关于页，给引用提供下一跳。')
  push('lang', '在 html 上声明 lang="zh-CN"。')
  push('viewport', '加上 viewport meta，保证移动端摘录可读。')
  if (suggestions.length === 0) {
    suggestions.push('基础信号已经齐了。下一步把可引用的定义、案例和交付边界写进正文，再去做复测。')
  }
  return suggestions.slice(0, 8)
}

export function parseRobots(body: string): { starDisallowAll: boolean; blockedBots: string[] } {
  const groups: Array<{ agents: string[]; disallows: string[] }> = []
  let agents: string[] = []
  let disallows: string[] = []
  let mode: 'none' | 'agent' | 'rule' = 'none'
  const flush = () => {
    if (agents.length > 0) groups.push({ agents, disallows })
    agents = []
    disallows = []
    mode = 'none'
  }
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split('#')[0]?.trim() ?? ''
    if (!line) {
      flush()
      continue
    }
    const index = line.indexOf(':')
    if (index < 0) continue
    const key = line.slice(0, index).trim().toLowerCase()
    const value = line.slice(index + 1).trim()
    if (key === 'user-agent') {
      if (mode === 'rule') flush()
      agents.push(value.toLowerCase())
      mode = 'agent'
    } else if (key === 'disallow') {
      disallows.push(value)
      mode = 'rule'
    }
  }
  flush()
  return {
    starDisallowAll: groups.some((group) => group.agents.includes('*') && group.disallows.includes('/')),
    blockedBots: AI_BOTS.filter((bot) => groups.some((group) => group.agents.includes(bot) && group.disallows.includes('/'))),
  }
}

function robotsItem(doc: FetchedDoc | null, info: { starDisallowAll: boolean; blockedBots: string[] } | null): CheckItem {
  if (!doc || doc.status < 200 || doc.status >= 300) {
    return item('robots', 'robots.txt', 'warn', doc ? `robots.txt 返回 HTTP ${doc.status}。` : '没有抓到 robots.txt。')
  }
  if (info?.starDisallowAll) return item('robots', 'robots.txt', 'fail', 'User-agent: * 被整站 Disallow，公开页很难被引用。')
  return item('robots', 'robots.txt', 'pass', 'robots.txt 可以读取，且没有整站封禁。')
}

function item(id: string, label: string, status: CheckStatus, detail: string): CheckItem {
  return { id, label, status, detail }
}

function titleStatus(title: string): CheckStatus {
  if (!title) return 'fail'
  if (title.length < 10 || title.length > 60) return 'warn'
  return 'pass'
}

function descriptionStatus(description: string): CheckStatus {
  if (!description) return 'fail'
  if (description.length < 40 || description.length > 170) return 'warn'
  return 'pass'
}

function h1Status(count: number): CheckStatus {
  if (count === 1) return 'pass'
  if (count === 0) return 'fail'
  return 'warn'
}

function contentStatus(length: number): CheckStatus {
  if (length < 200) return 'fail'
  if (length < 800) return 'warn'
  return 'pass'
}

function readMetas(html: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const tag of tags(html, 'meta')) {
    const key = (attr(tag, 'name') ?? attr(tag, 'property') ?? '').toLowerCase()
    const content = attr(tag, 'content')
    if (key && content !== null && !map.has(key)) map.set(key, decode(content))
  }
  return map
}

function readJsonLdTypes(html: string): string[] {
  const types = new Set<string>()
  const pattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(pattern)) {
    const raw = match[1]?.trim()
    if (!raw) continue
    try {
      collectTypes(JSON.parse(raw) as unknown, types)
    } catch {
      // 忽略损坏的 JSON-LD
    }
  }
  return [...types]
}

function collectTypes(value: unknown, types: Set<string>) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const entry of value) collectTypes(entry, types)
    return
  }
  const record = value as Record<string, unknown>
  const type = record['@type']
  if (typeof type === 'string') types.add(type)
  if (Array.isArray(type)) {
    for (const entry of type) if (typeof entry === 'string') types.add(entry)
  }
  for (const entry of Object.values(record)) collectTypes(entry, types)
}

function linkHref(html: string, rel: string): string {
  for (const tag of tags(html, 'link')) {
    const value = attr(tag, 'rel') ?? ''
    if (value.toLowerCase().split(/\s+/).includes(rel)) return attr(tag, 'href') ?? ''
  }
  return ''
}

function allTagText(html: string, name: string): string[] {
  const pattern = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi')
  return [...html.matchAll(pattern)].map((match) => textContent(match[1] ?? '')).filter(Boolean)
}

function matchTag(html: string, name: string): string {
  const match = html.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return match?.[1] ?? ''
}

function firstTag(html: string, name: string): string {
  return tags(html, name)[0] ?? ''
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? []
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  if (!match) return null
  return match[2] ?? match[3] ?? match[4] ?? ''
}

function textContent(value: string): string {
  return decode(value.replace(/<[^>]+>/g, ' '))
}

function visibleText(html: string): string {
  return textContent(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '))
}

function decode(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}
