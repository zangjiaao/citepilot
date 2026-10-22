export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value * 100)}%`
}

export function formatRank(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)
}

export function sampleFraction(hits: number, total: number): string {
  if (total <= 0) return '未记录'
  return `${hits}/${total}`
}

export function splitList(value: string): string[] {
  return value
    .split(/\n|，|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function joinLines(items: string[]): string {
  return items.join('\n')
}

export function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
