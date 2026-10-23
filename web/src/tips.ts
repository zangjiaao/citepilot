export const TIP_STORAGE_KEY = 'citepilot.dismissedTips'
export const TIP_EVENT = 'citepilot-tips'

export function tipStorageKey(studioId: string, page: string, id: string): string {
  return `${studioId || 'none'}:${page}:${id}`
}

export function readDismissedTips(storage: Pick<Storage, 'getItem'>): string[] {
  try {
    const raw = storage.getItem(TIP_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

export function dismissTip(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string): void {
  const next = new Set(readDismissedTips(storage))
  next.add(key)
  storage.setItem(TIP_STORAGE_KEY, JSON.stringify([...next]))
}

export function clearDismissedTips(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(TIP_STORAGE_KEY)
}
