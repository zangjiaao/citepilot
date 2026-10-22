import { describe, expect, it } from 'vitest'
import { normalizeDomain, parseCompetitorList, readStoredCompetitors } from '../shared/competitors.ts'

describe('parseCompetitorList', () => {
  it('turns legacy names into profiles and keeps aliases plus domains', () => {
    const legacy = parseCompetitorList(['澜舟智能体实验室', '  '])
    expect(legacy.ok).toBe(true)
    if (!legacy.ok) return
    expect(legacy.competitors).toHaveLength(1)
    expect(legacy.competitors[0]?.name).toBe('澜舟智能体实验室')
    expect(legacy.competitors[0]?.aliases).toEqual([])
    expect(legacy.competitors[0]?.id.startsWith('legacy-')).toBe(true)

    const rich = parseCompetitorList([
      { id: 'comp-lanzhou', name: '澜舟智能体实验室', aliases: ['澜舟', '澜舟', '澜舟智能体实验室'], domain: 'https://www.lanzhou.example/about' },
    ])
    expect(rich.ok).toBe(true)
    if (!rich.ok) return
    expect(rich.competitors[0]).toMatchObject({
      id: 'comp-lanzhou',
      aliases: ['澜舟'],
      domain: 'lanzhou.example',
    })
  })

  it('rejects a domain that is not a hostname', () => {
    const parsed = parseCompetitorList([{ name: '北坡应用工场', aliases: [], domain: '不是域名' }])
    expect(parsed.ok).toBe(false)
  })

  it('reads either shape out of the stored JSON column', () => {
    expect(readStoredCompetitors('["拾光 FDE 工作室"]')[0]?.name).toBe('拾光 FDE 工作室')
    expect(readStoredCompetitors('{"name":"坏了"}')).toEqual([])
    expect(normalizeDomain('Beipo.Example')).toBe('beipo.example')
  })
})
