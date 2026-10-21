export const PLATFORMS = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'doubao', label: '豆包' },
  { id: 'kimi', label: 'Kimi' },
  { id: 'wenxin', label: '文心一言' },
  { id: 'qwen', label: '通义千问' },
  { id: 'yuanbao', label: '腾讯元宝' },
  { id: 'perplexity', label: 'Perplexity' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude', label: 'Claude' },
] as const

export type PlatformId = (typeof PLATFORMS)[number]['id']

export const CLUSTER_LABEL: Record<string, string> = {
  brand: '品牌',
  category: '品类',
  comparison: '对比',
  scenario: '场景',
}

export const SENTIMENT_LABEL: Record<string, string> = {
  positive: '偏正面',
  neutral: '中性',
  negative: '偏负面',
  mixed: '褒贬都有',
}

export const SOURCE_LABEL: Record<string, string> = {
  seed: '种子',
  template: '模板',
  llm: 'DeepSeek',
  manual: '手写',
  rules: '规则',
  deepseek: 'DeepSeek',
}

export function platformLabel(id: string): string {
  return PLATFORMS.find((item) => item.id === id)?.label ?? id
}

export function isPlatformId(id: string): id is PlatformId {
  return PLATFORMS.some((item) => item.id === id)
}
