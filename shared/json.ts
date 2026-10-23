export function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    // 继续尝试代码块或首尾花括号
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim()) as unknown
    } catch {
      // 继续
    }
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown
  }
  throw new Error('模型没有返回可解析的 JSON')
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

export function completionsUrl(base: string): string {
  const root = endpointRoot(base, 'https://api.deepseek.com')
  if (root.endsWith('/chat/completions')) return root
  return `${root}/chat/completions`
}

export function responsesUrl(base: string): string {
  const root = endpointRoot(base, 'https://api.openai.com/v1')
  if (root.endsWith('/responses')) return root
  return `${root}/responses`
}

function endpointRoot(base: string, fallback: string): string {
  const trimmed = base.trim().replace(/\/+$/, '') || fallback
  if (trimmed.endsWith('/chat/completions')) return trimmed.slice(0, -'/chat/completions'.length)
  if (trimmed.endsWith('/responses')) return trimmed.slice(0, -'/responses'.length)
  return trimmed
}
