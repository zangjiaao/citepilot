import { describe, expect, it } from 'vitest'
import { NEXT_BASELINE_NOTE, PRODUCT_LOOP } from '../shared/loop.ts'

describe('PRODUCT_LOOP', () => {
  it('names the four monitoring steps without week numbers', () => {
    expect(PRODUCT_LOOP.map((step) => step.title)).toEqual(['基线监测', '整站+内容分发', '一段时间后再监测', '与基线对比'])
    expect(PRODUCT_LOOP.every((step) => !step.detail.includes('第') && !step.detail.includes('周'))).toBe(true)
    expect(NEXT_BASELINE_NOTE).toContain('新的基线')
  })
})