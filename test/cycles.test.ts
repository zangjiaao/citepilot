import { describe, expect, it } from 'vitest'
import { defaultCycleName } from '../shared/cycles.ts'

describe('defaultCycleName', () => {
  it('uses the calendar date plus 抽查, not a week number', () => {
    const name = defaultCycleName(new Date(2026, 9, 21, 12, 0, 0))
    expect(name).toBe('2026-10-21 抽查')
    expect(name).not.toMatch(/周/)
  })
})
