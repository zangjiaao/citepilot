import type { Competitor } from './types.ts'

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export function legacyCompetitorId(name: string): string {
  let hash = 0
  for (const char of name.trim()) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
  return `legacy-${hash.toString(16)}`
}

export function competitorNames(competitors: Competitor[]): string[] {
  return competitors.map((item) => item.name.trim()).filter((name) => name.length > 0)
}

export function normalizeDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  let host = trimmed
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname
    } catch {
      return null
    }
  }
  host = host.replace(/^www\./, '').split('/')[0]?.split(':')[0] ?? ''
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null
  if (!/^[a-z0-9.-]+$/.test(host)) return null
  return host
}

export function parseCompetitorList(value: unknown): { ok: true; competitors: Competitor[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: '竞品列表格式不正确' }
  if (value.length > 20) return { ok: false, error: '竞品最多 20 个' }
  const competitors: Competitor[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  for (const item of value) {
    const parsed = oneCompetitor(item)
    if (!parsed.ok) return parsed
    if (!parsed.competitor) continue
    const nameKey = parsed.competitor.name.toLowerCase()
    if (seenNames.has(nameKey) || seenIds.has(parsed.competitor.id)) continue
    seenNames.add(nameKey)
    seenIds.add(parsed.competitor.id)
    competitors.push(parsed.competitor)
  }
  return { ok: true, competitors }
}

export function readStoredCompetitors(value: string): Competitor[] {
  try {
    const parsed = parseCompetitorList(JSON.parse(value) as unknown)
    return parsed.ok ? parsed.competitors : []
  } catch {
    return []
  }
}

function oneCompetitor(item: unknown): { ok: true; competitor: Competitor | null } | { ok: false; error: string } {
  if (typeof item === 'string') {
    const name = item.trim()
    if (!name) return { ok: true, competitor: null }
    if (name.length < 2 || name.length > 80) return { ok: false, error: '竞品名称需要 2 到 80 个字' }
    return { ok: true, competitor: { id: legacyCompetitorId(name), name, aliases: [], domain: '' } }
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, error: '竞品列表格式不正确' }
  const record = item as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  if (!name) return { ok: true, competitor: null }
  if (name.length < 2 || name.length > 80) return { ok: false, error: '竞品名称需要 2 到 80 个字' }
  let id = typeof record.id === 'string' ? record.id.trim() : ''
  if (!id || id === 'self' || !ID_PATTERN.test(id)) id = legacyCompetitorId(name)
  const aliases = readAliases(record.aliases, name)
  if (!aliases.ok) return aliases
  const domainRaw = typeof record.domain === 'string' ? record.domain.trim() : ''
  if (!domainRaw) return { ok: true, competitor: { id, name, aliases: aliases.aliases, domain: '' } }
  const domain = normalizeDomain(domainRaw)
  if (!domain) return { ok: false, error: `竞品「${name}」的域名不正确` }
  return { ok: true, competitor: { id, name, aliases: aliases.aliases, domain } }
}

function readAliases(value: unknown, name: string): { ok: true; aliases: string[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, aliases: [] }
  if (!Array.isArray(value)) return { ok: false, error: '竞品别名格式不正确' }
  const aliases: string[] = []
  for (const alias of value) {
    if (typeof alias !== 'string') return { ok: false, error: '竞品别名格式不正确' }
    const trimmed = alias.trim()
    if (!trimmed) continue
    if (trimmed.length < 2 || trimmed.length > 40) return { ok: false, error: '竞品别名需要 2 到 40 个字' }
    if (trimmed.toLowerCase() === name.toLowerCase()) continue
    if (aliases.some((item) => item.toLowerCase() === trimmed.toLowerCase())) continue
    aliases.push(trimmed)
  }
  if (aliases.length > 8) return { ok: false, error: '每个竞品最多 8 个别名' }
  return { ok: true, aliases }
}
