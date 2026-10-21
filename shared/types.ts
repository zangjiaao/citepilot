export type Cluster = 'brand' | 'category' | 'comparison' | 'scenario'
export type CycleKind = 'baseline' | 'retest' | 'custom'
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed'
export type ParserSource = 'rules' | 'deepseek'
export type PromptSource = 'seed' | 'template' | 'llm' | 'manual'
export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface Studio {
  id: string
  name: string
  website: string
  positioning: string
  services: string[]
  competitors: string[]
  keywords: string[]
  capabilities: string[]
  cases: string[]
  targetCustomers: string[]
  solutions: string[]
  createdAt: string
  updatedAt: string
}

export type DraftChannel =
  | 'site-article'
  | 'faq'
  | 'wechat'
  | 'xiaohongshu'
  | 'linkedin'
  | 'social-short'
  | 'product-promo'

export type DraftSource = 'template' | 'deepseek'

export interface DraftBrief {
  title: string
  body: string
  citeSentences: string[]
  urlHint: string
}

export interface DraftPreview extends DraftBrief {
  channel: DraftChannel
  promptId: string | null
  promptText: string
  diagnosisId: string | null
  gapId: string | null
  gapLabel: string
  source: DraftSource
}

export interface ContentDraft extends DraftBrief {
  id: string
  studioId: string
  channel: DraftChannel
  promptId: string | null
  promptText: string
  diagnosisId: string | null
  gapLabel: string
  source: DraftSource
  createdAt: string
}

export interface Prompt {
  id: string
  studioId: string
  cluster: Cluster
  text: string
  rationale: string
  source: PromptSource
  createdAt: string
}

export interface Cycle {
  id: string
  studioId: string
  name: string
  kind: CycleKind
  createdAt: string
}

export interface Observation {
  id: string
  studioId: string
  promptId: string
  promptText: string
  cluster: Cluster
  cycleId: string
  cycleName: string
  platform: string
  answerText: string
  brandMentioned: boolean
  brandSnippets: string[]
  citedUrls: string[]
  ownUrlCited: boolean
  competitorsMentioned: string[]
  sentiment: Sentiment
  summary: string
  parser: ParserSource
  createdAt: string
}

export interface CheckItem {
  id: string
  label: string
  status: CheckStatus
  detail: string
}

export interface Diagnosis {
  id: string
  studioId: string
  url: string
  finalUrl: string
  httpStatus: number
  title: string
  checklist: CheckItem[]
  suggestions: string[]
  suggestionSource: ParserSource
  excerpt: string
  createdAt: string
}

export interface CycleMetrics {
  observations: number
  promptsCovered: number
  mentionRate: number | null
  citationRate: number | null
  competitorRate: number | null
  byPlatform: Array<{
    platform: string
    observations: number
    mentionRate: number | null
  }>
}

export interface CompareRow {
  promptId: string
  text: string
  cluster: Cluster
  fromMentioned: boolean | null
  toMentioned: boolean | null
  fromCited: boolean | null
  toCited: boolean | null
  fromCompetitors: string[]
  toCompetitors: string[]
}

export interface CompareReport {
  from: { id: string; name: string; kind: CycleKind; metrics: CycleMetrics } | null
  to: { id: string; name: string; kind: CycleKind; metrics: CycleMetrics } | null
  rows: CompareRow[]
}

export interface Overview {
  studio: Studio
  llm: { enabled: boolean; model: string; baseUrl: string }
  counts: {
    prompts: number
    observations: number
    diagnoses: number
    byCluster: Record<Cluster, number>
  }
  earliest: { id: string; name: string; metrics: CycleMetrics } | null
  latest: { id: string; name: string; metrics: CycleMetrics } | null
  latestDiagnosis: {
    id: string
    url: string
    createdAt: string
    pass: number
    warn: number
    fail: number
  } | null
}

export interface GeneratedPrompt {
  cluster: Cluster
  text: string
  rationale: string
}
