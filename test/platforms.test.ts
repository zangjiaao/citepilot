import { describe, expect, it } from 'vitest'
import { normalizePlatform, platformLabel } from '../shared/platforms.ts'

describe('normalizePlatform', () => {
  it('maps known labels and ids, and keeps a custom name', () => {
    expect(normalizePlatform('DeepSeek')).toBe('deepseek')
    expect(normalizePlatform('kimi')).toBe('kimi')
    expect(normalizePlatform('腾讯元宝')).toBe('yuanbao')
    expect(normalizePlatform('元宝')).toBe('元宝')
    expect(normalizePlatform(' 纳米搜索 ')).toBe('纳米搜索')
    expect(platformLabel('纳米搜索')).toBe('纳米搜索')
    expect(platformLabel('doubao')).toBe('豆包')
  })

  it('rejects empty and punctuation-only names', () => {
    expect(normalizePlatform('   ')).toBeNull()
    expect(normalizePlatform('...')).toBeNull()
    expect(normalizePlatform('a'.repeat(33))).toBeNull()
  })
})