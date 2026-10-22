export type StudioListField = 'services' | 'keywords' | 'capabilities' | 'cases' | 'targetCustomers' | 'solutions'

export const STUDIO_LIST_LIMITS: Record<StudioListField, { label: string; maxItems: number; maxLength: number }> = {
  services: { label: '服务', maxItems: 20, maxLength: 300 },
  capabilities: { label: '能力', maxItems: 20, maxLength: 300 },
  solutions: { label: '解决方案', maxItems: 20, maxLength: 300 },
  cases: { label: '案例', maxItems: 20, maxLength: 500 },
  targetCustomers: { label: '目标客户', maxItems: 20, maxLength: 300 },
  keywords: { label: '关键词', maxItems: 40, maxLength: 80 },
}

export function readStudioList(
  value: unknown,
  field: StudioListField,
): { ok: true; items: string[] } | { ok: false; field: StudioListField; error: string } {
  const spec = STUDIO_LIST_LIMITS[field]
  if (!Array.isArray(value)) return { ok: false, field, error: `${spec.label}的格式不正确` }
  const items = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  if (items.length > spec.maxItems) {
    return { ok: false, field, error: `${spec.label}有 ${items.length} 项，上限是 ${spec.maxItems} 项` }
  }
  const tooLong = items.find((item) => item.length > spec.maxLength)
  if (tooLong) {
    return { ok: false, field, error: `${spec.label}有一项长 ${tooLong.length} 字，上限是 ${spec.maxLength} 字` }
  }
  return { ok: true, items }
}
