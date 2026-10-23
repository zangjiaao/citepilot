import { describe, expect, it } from 'vitest'
import { clearDismissedTips, dismissTip, readDismissedTips, tipStorageKey } from '../web/src/tips.ts'

function memory() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
  }
}

describe('tip dismissals', () => {
  it('keys a tip by brand and page, then keeps it dismissed', () => {
    const storage = memory()
    const key = tipStorageKey('studio-chengchuan', 'drafts', 'llm-template')
    expect(key).toBe('studio-chengchuan:drafts:llm-template')
    expect(tipStorageKey('', 'overview', 'llm-off')).toBe('none:overview:llm-off')
    dismissTip(storage, key)
    expect(readDismissedTips(storage)).toEqual([key])
    dismissTip(storage, key)
    expect(readDismissedTips(storage)).toEqual([key])
    clearDismissedTips(storage)
    expect(readDismissedTips(storage)).toEqual([])
  })

  it('ignores a broken stored list', () => {
    const storage = memory()
    storage.setItem('citepilot.dismissedTips', '{')
    expect(readDismissedTips(storage)).toEqual([])
  })
})