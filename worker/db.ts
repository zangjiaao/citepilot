import { BRAND_DELETE_ORDER } from '../shared/brandDelete.ts'
import { blankBrandProfile, readBrandProfile, type BrandProfile } from '../shared/brandProfile.ts'
import { readStoredCompetitors } from '../shared/competitors.ts'
import type { DraftEditable } from '../shared/drafts.ts'
import type { BrandHit, CheckItem, ContentDraft, Cycle, CycleKind, Diagnosis, Observation, Prompt, Sentiment, Studio } from '../shared/types.ts'
import { HttpError } from './errors.ts'

interface StudioRow {
  id: string
  name: string
  website: string
  positioning: string
  services: string
  competitors: string
  keywords: string
  capabilities: string
  cases: string
  target_customers: string
  solutions: string
  introduction: string
  team_background: string
  differentiation: string
  case_studies: string
  methodology: string
  pricing: string
  customer_profile: string
  customer_pains: string
  objections: string
  evidence: string
  voice: string
  banned_words: string
  compliance: string
  reference_snippets: string
  created_at: string
  updated_at: string
}

interface DraftRow {
  id: string
  studio_id: string
  channel: ContentDraft['channel']
  title: string
  body: string
  cite_sentences: string
  url_hint: string
  prompt_id: string | null
  prompt_text: string
  diagnosis_id: string | null
  gap_label: string
  source: ContentDraft['source']
  created_at: string
  updated_at: string
}

interface PromptRow {
  id: string
  studio_id: string
  cluster: Prompt['cluster']
  text: string
  rationale: string
  source: Prompt['source']
  created_at: string
}

interface CycleRow {
  id: string
  studio_id: string
  name: string
  kind: CycleKind
  created_at: string
}

interface ObservationRow {
  id: string
  studio_id: string
  prompt_id: string
  cycle_id: string
  platform: string
  answer_text: string
  brand_mentioned: number
  brand_mentions: string
  cited_urls: string
  own_url_cited: number
  competitors_mentioned: string
  brand_hits: string
  sentiment: Sentiment
  summary: string
  parser: Observation['parser']
  created_at: string
  prompt_text: string
  cluster: Prompt['cluster']
  cycle_name: string
}

interface DiagnosisRow {
  id: string
  studio_id: string
  url: string
  final_url: string
  http_status: number
  title: string
  checklist: string
  suggestions: string
  suggestion_source: Diagnosis['suggestionSource']
  excerpt: string
  created_at: string
}

export async function listStudios(db: D1Database): Promise<Studio[]> {
  const { results } = await db.prepare('SELECT * FROM studios ORDER BY created_at ASC').all<StudioRow>()
  return results.map(mapStudio)
}

export async function getStudio(db: D1Database, id: string): Promise<Studio | null> {
  const row = await db.prepare('SELECT * FROM studios WHERE id = ?').bind(id).first<StudioRow>()
  return row ? mapStudio(row) : null
}

export async function mustStudio(db: D1Database, id: string): Promise<Studio> {
  const studio = await getStudio(db, id)
  if (!studio) throw new HttpError(404, '没有找到这个品牌')
  return studio
}

export async function insertStudio(db: D1Database, studio: Studio): Promise<void> {
  await db
    .prepare(
      `INSERT INTO studios (
         id, name, website, positioning, services, competitors, keywords,
         capabilities, cases, target_customers, solutions,
         introduction, team_background, differentiation, case_studies, methodology, pricing,
         customer_profile, customer_pains, objections, evidence, voice, banned_words, compliance, reference_snippets,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      studio.id,
      studio.name,
      studio.website,
      studio.positioning,
      JSON.stringify(studio.services),
      JSON.stringify(studio.competitors),
      JSON.stringify(studio.keywords),
      JSON.stringify(studio.capabilities),
      JSON.stringify(studio.cases),
      JSON.stringify(studio.targetCustomers),
      JSON.stringify(studio.solutions),
      studio.introduction,
      studio.teamBackground,
      studio.differentiation,
      JSON.stringify(studio.caseStudies),
      studio.methodology,
      studio.pricing,
      studio.customerProfile,
      studio.customerPains,
      JSON.stringify(studio.objections),
      studio.evidence,
      studio.voice,
      studio.bannedWords,
      studio.compliance,
      JSON.stringify(studio.references),
      studio.createdAt,
      studio.updatedAt,
    )
    .run()
}

export async function updateStudio(db: D1Database, studio: Studio): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE studios
       SET name = ?, website = ?, positioning = ?, services = ?, competitors = ?, keywords = ?,
           capabilities = ?, cases = ?, target_customers = ?, solutions = ?,
           introduction = ?, team_background = ?, differentiation = ?, case_studies = ?, methodology = ?, pricing = ?,
           customer_profile = ?, customer_pains = ?, objections = ?, evidence = ?, voice = ?, banned_words = ?, compliance = ?, reference_snippets = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      studio.name,
      studio.website,
      studio.positioning,
      JSON.stringify(studio.services),
      JSON.stringify(studio.competitors),
      JSON.stringify(studio.keywords),
      JSON.stringify(studio.capabilities),
      JSON.stringify(studio.cases),
      JSON.stringify(studio.targetCustomers),
      JSON.stringify(studio.solutions),
      studio.introduction,
      studio.teamBackground,
      studio.differentiation,
      JSON.stringify(studio.caseStudies),
      studio.methodology,
      studio.pricing,
      studio.customerProfile,
      studio.customerPains,
      JSON.stringify(studio.objections),
      studio.evidence,
      studio.voice,
      studio.bannedWords,
      studio.compliance,
      JSON.stringify(studio.references),
      studio.updatedAt,
      studio.id,
    )
    .run()
  if ((result.meta.changes ?? 0) === 0) throw new HttpError(404, '没有找到这个品牌')
}

export async function listPrompts(db: D1Database, studioId: string): Promise<Prompt[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM prompts
       WHERE studio_id = ?
       ORDER BY CASE cluster
         WHEN 'brand' THEN 1
         WHEN 'category' THEN 2
         WHEN 'comparison' THEN 3
         ELSE 4
       END, created_at ASC`,
    )
    .bind(studioId)
    .all<PromptRow>()
  return results.map(mapPrompt)
}

export async function insertPrompts(db: D1Database, prompts: Prompt[]): Promise<void> {
  if (prompts.length === 0) return
  await db.batch(
    prompts.map((prompt) =>
      db
        .prepare(
          `INSERT INTO prompts (id, studio_id, cluster, text, rationale, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(prompt.id, prompt.studioId, prompt.cluster, prompt.text, prompt.rationale, prompt.source, prompt.createdAt),
    ),
  )
}

export async function deleteStudio(db: D1Database, id: string): Promise<void> {
  const existing = await getStudio(db, id)
  if (!existing) throw new HttpError(404, '没有找到这个品牌')
  await db.batch(
    BRAND_DELETE_ORDER.map((table) => {
      const sql = table === 'studios' ? 'DELETE FROM studios WHERE id = ?' : `DELETE FROM ${table} WHERE studio_id = ?`
      return db.prepare(sql).bind(id)
    }),
  )
}

export async function deletePrompt(db: D1Database, studioId: string, promptId: string): Promise<void> {
  const row = await db
    .prepare('SELECT COUNT(*) AS total FROM observations WHERE studio_id = ? AND prompt_id = ?')
    .bind(studioId, promptId)
    .first<{ total: number }>()
  if ((row?.total ?? 0) > 0) throw new HttpError(409, '这道题已经有监测记录，先保留记录。')
  const result = await db.prepare('DELETE FROM prompts WHERE id = ? AND studio_id = ?').bind(promptId, studioId).run()
  if ((result.meta.changes ?? 0) === 0) throw new HttpError(404, '没有找到这道题')
}

export async function listCycles(db: D1Database, studioId: string): Promise<Cycle[]> {
  const { results } = await db
    .prepare('SELECT * FROM cycles WHERE studio_id = ? ORDER BY created_at ASC')
    .bind(studioId)
    .all<CycleRow>()
  return results.map(mapCycle)
}

export async function mustCycle(db: D1Database, studioId: string, cycleId: string): Promise<Cycle> {
  const row = await db
    .prepare('SELECT * FROM cycles WHERE id = ? AND studio_id = ?')
    .bind(cycleId, studioId)
    .first<CycleRow>()
  if (!row) throw new HttpError(404, '没有找到这个轮次')
  return mapCycle(row)
}

export async function insertCycle(db: D1Database, cycle: Cycle): Promise<void> {
  await db
    .prepare('INSERT INTO cycles (id, studio_id, name, kind, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(cycle.id, cycle.studioId, cycle.name, cycle.kind, cycle.createdAt)
    .run()
}

export async function deleteCycle(db: D1Database, studioId: string, cycleId: string): Promise<void> {
  const row = await db
    .prepare('SELECT COUNT(*) AS total FROM observations WHERE studio_id = ? AND cycle_id = ?')
    .bind(studioId, cycleId)
    .first<{ total: number }>()
  if ((row?.total ?? 0) > 0) throw new HttpError(409, '这个轮次已有监测记录。先删掉记录，再删轮次。')
  const result = await db.prepare('DELETE FROM cycles WHERE id = ? AND studio_id = ?').bind(cycleId, studioId).run()
  if ((result.meta.changes ?? 0) === 0) throw new HttpError(404, '没有找到这个轮次')
}

export async function listObservations(db: D1Database, studioId: string): Promise<Observation[]> {
  const { results } = await db
    .prepare(
       `SELECT o.*, p.text AS prompt_text, p.cluster AS cluster, c.name AS cycle_name
       FROM observations o
       JOIN prompts p ON p.id = o.prompt_id
       JOIN cycles c ON c.id = o.cycle_id
       WHERE o.studio_id = ?
       ORDER BY o.created_at DESC`,
    )
    .bind(studioId)
    .all<ObservationRow>()
  return results.map(mapObservation)
}

export async function insertObservation(db: D1Database, observation: Observation): Promise<void> {
  await db
    .prepare(
      `INSERT INTO observations (
         id, studio_id, prompt_id, cycle_id, platform, answer_text,
         brand_mentioned, brand_mentions, cited_urls, own_url_cited, competitors_mentioned,
         brand_hits, sentiment, summary, parser, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      observation.id,
      observation.studioId,
      observation.promptId,
      observation.cycleId,
      observation.platform,
      observation.answerText,
      observation.brandMentioned ? 1 : 0,
      JSON.stringify(observation.brandSnippets),
      JSON.stringify(observation.citedUrls),
      observation.ownUrlCited ? 1 : 0,
      JSON.stringify(observation.competitorsMentioned),
      JSON.stringify(observation.brandHits),
      observation.sentiment,
      observation.summary,
      observation.parser,
      observation.createdAt,
    )
    .run()
}

export async function deleteObservation(db: D1Database, studioId: string, observationId: string): Promise<void> {
  const result = await db
    .prepare('DELETE FROM observations WHERE id = ? AND studio_id = ?')
    .bind(observationId, studioId)
    .run()
  if ((result.meta.changes ?? 0) === 0) throw new HttpError(404, '没有找到这条记录')
}

export async function listDiagnoses(db: D1Database, studioId: string): Promise<Diagnosis[]> {
  const { results } = await db
    .prepare('SELECT * FROM diagnoses WHERE studio_id = ? ORDER BY created_at DESC LIMIT 20')
    .bind(studioId)
    .all<DiagnosisRow>()
  return results.map(mapDiagnosis)
}

export async function insertDiagnosis(db: D1Database, diagnosis: Diagnosis): Promise<void> {
  await db
    .prepare(
      `INSERT INTO diagnoses (
         id, studio_id, url, final_url, http_status, title, checklist, suggestions, suggestion_source, excerpt, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      diagnosis.id,
      diagnosis.studioId,
      diagnosis.url,
      diagnosis.finalUrl,
      diagnosis.httpStatus,
      diagnosis.title,
      JSON.stringify(diagnosis.checklist),
      JSON.stringify(diagnosis.suggestions),
      diagnosis.suggestionSource,
      diagnosis.excerpt,
      diagnosis.createdAt,
    )
    .run()
}

export async function listDrafts(db: D1Database, studioId: string): Promise<ContentDraft[]> {
  const { results } = await db
    .prepare('SELECT * FROM drafts WHERE studio_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 50')
    .bind(studioId)
    .all<DraftRow>()
  return results.map(mapDraft)
}

export async function getDraft(db: D1Database, studioId: string, draftId: string): Promise<ContentDraft> {
  const row = await db.prepare('SELECT * FROM drafts WHERE id = ? AND studio_id = ?').bind(draftId, studioId).first<DraftRow>()
  if (!row) throw new HttpError(404, '没有找到这篇草稿')
  return mapDraft(row)
}

export async function insertDraft(db: D1Database, draft: ContentDraft): Promise<void> {
  await db
    .prepare(
      `INSERT INTO drafts (
         id, studio_id, channel, title, body, cite_sentences, url_hint,
         prompt_id, prompt_text, diagnosis_id, gap_label, source, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      draft.id,
      draft.studioId,
      draft.channel,
      draft.title,
      draft.body,
      JSON.stringify(draft.citeSentences),
      draft.urlHint,
      draft.promptId,
      draft.promptText,
      draft.diagnosisId,
      draft.gapLabel,
      draft.source,
      draft.createdAt,
      draft.updatedAt,
    )
    .run()
}

export async function updateDraft(
  db: D1Database,
  studioId: string,
  draftId: string,
  fields: DraftEditable,
  updatedAt: string,
): Promise<ContentDraft> {
  const result = await db
    .prepare(
      `UPDATE drafts
       SET channel = ?, title = ?, body = ?, cite_sentences = ?, url_hint = ?, updated_at = ?
       WHERE id = ? AND studio_id = ?`,
    )
    .bind(fields.channel, fields.title, fields.body, JSON.stringify(fields.citeSentences), fields.urlHint, updatedAt, draftId, studioId)
    .run()
  if ((result.meta.changes ?? 0) === 0) throw new HttpError(404, '没有找到这篇草稿')
  return getDraft(db, studioId, draftId)
}

export async function deleteDraft(db: D1Database, studioId: string, draftId: string): Promise<void> {
  const result = await db.prepare('DELETE FROM drafts WHERE id = ? AND studio_id = ?').bind(draftId, studioId).run()
  if ((result.meta.changes ?? 0) === 0) throw new HttpError(404, '没有找到这篇草稿')
}

function mapStudio(row: StudioRow): Studio {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    positioning: row.positioning,
    services: parseStringArray(row.services),
    competitors: readStoredCompetitors(row.competitors),
    keywords: parseStringArray(row.keywords),
    capabilities: parseStringArray(row.capabilities),
    cases: parseStringArray(row.cases),
    targetCustomers: parseStringArray(row.target_customers),
    solutions: parseStringArray(row.solutions),
    ...profileFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDraft(row: DraftRow): ContentDraft {
  return {
    id: row.id,
    studioId: row.studio_id,
    channel: row.channel,
    title: row.title,
    body: row.body,
    citeSentences: parseStringArray(row.cite_sentences),
    urlHint: row.url_hint,
    promptId: row.prompt_id,
    promptText: row.prompt_text,
    diagnosisId: row.diagnosis_id,
    gapLabel: row.gap_label,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  }
}

function mapPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    studioId: row.studio_id,
    cluster: row.cluster,
    text: row.text,
    rationale: row.rationale,
    source: row.source,
    createdAt: row.created_at,
  }
}

function mapCycle(row: CycleRow): Cycle {
  return {
    id: row.id,
    studioId: row.studio_id,
    name: row.name,
    kind: row.kind,
    createdAt: row.created_at,
  }
}

function mapObservation(row: ObservationRow): Observation {
  return {
    id: row.id,
    studioId: row.studio_id,
    promptId: row.prompt_id,
    promptText: row.prompt_text,
    cluster: row.cluster,
    cycleId: row.cycle_id,
    cycleName: row.cycle_name,
    platform: row.platform,
    answerText: row.answer_text,
    brandMentioned: row.brand_mentioned === 1,
    brandSnippets: parseStringArray(row.brand_mentions),
    citedUrls: parseStringArray(row.cited_urls),
    ownUrlCited: row.own_url_cited === 1,
    competitorsMentioned: parseStringArray(row.competitors_mentioned),
    brandHits: parseBrandHits(row.brand_hits),
    sentiment: row.sentiment,
    summary: row.summary,
    parser: row.parser,
    createdAt: row.created_at,
  }
}

function mapDiagnosis(row: DiagnosisRow): Diagnosis {
  return {
    id: row.id,
    studioId: row.studio_id,
    url: row.url,
    finalUrl: row.final_url,
    httpStatus: row.http_status,
    title: row.title,
    checklist: parseChecklist(row.checklist),
    suggestions: parseStringArray(row.suggestions),
    suggestionSource: row.suggestion_source,
    excerpt: row.excerpt,
    createdAt: row.created_at,
  }
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

function parseBrandHits(value: string | null | undefined): BrandHit[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isBrandHit)
  } catch {
    return []
  }
}

function isBrandHit(value: unknown): value is BrandHit {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.key === 'string' &&
    typeof record.name === 'string' &&
    typeof record.mentioned === 'boolean' &&
    (record.rank === null || typeof record.rank === 'number') &&
    typeof record.cited === 'boolean'
  )
}

function parseChecklist(value: string): CheckItem[] {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCheckItem)
  } catch {
    return []
  }
}

function isCheckItem(value: unknown): value is CheckItem {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.label === 'string' &&
    (record.status === 'pass' || record.status === 'warn' || record.status === 'fail') &&
    typeof record.detail === 'string'
  )
}

function profileFromRow(row: StudioRow): BrandProfile {
  const parsed = readBrandProfile({
    introduction: row.introduction,
    teamBackground: row.team_background,
    differentiation: row.differentiation,
    caseStudies: parseJson(row.case_studies),
    methodology: row.methodology,
    pricing: row.pricing,
    customerProfile: row.customer_profile,
    customerPains: row.customer_pains,
    objections: parseJson(row.objections),
    evidence: row.evidence,
    voice: row.voice,
    bannedWords: row.banned_words,
    compliance: row.compliance,
    references: parseJson(row.reference_snippets),
  })
  return parsed.ok ? parsed.profile : blankBrandProfile()
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) return []
  try {
    return JSON.parse(value) as unknown
  } catch {
    return []
  }
}

export interface StoredLlmConfig {
  id: string
  label: string
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  temperature: number | null
  maxTokens: number | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

interface LlmConfigRow {
  id: string
  label: string
  provider: string
  base_url: string
  model: string
  api_key: string
  temperature: number | null
  max_tokens: number | null
  is_default: number
  created_at: string
  updated_at: string
}

export interface StoredLlmSettings {
  generateConfigId: string
  analyzeConfigId: string
}

export async function listLlmConfigs(db: D1Database): Promise<StoredLlmConfig[]> {
  const { results } = await db.prepare('SELECT * FROM llm_configs ORDER BY created_at ASC').all<LlmConfigRow>()
  return results.map(mapLlmConfig)
}

export async function getLlmConfig(db: D1Database, id: string): Promise<StoredLlmConfig | null> {
  const row = await db.prepare('SELECT * FROM llm_configs WHERE id = ?').bind(id).first<LlmConfigRow>()
  return row ? mapLlmConfig(row) : null
}

export async function insertLlmConfig(db: D1Database, config: StoredLlmConfig): Promise<void> {
  const statements = []
  if (config.isDefault) statements.push(db.prepare('UPDATE llm_configs SET is_default = 0'))
  statements.push(
    db
      .prepare(
        `INSERT INTO llm_configs (
           id, label, provider, base_url, model, api_key, temperature, max_tokens, is_default, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        config.id,
        config.label,
        config.provider,
        config.baseUrl,
        config.model,
        config.apiKey,
        config.temperature,
        config.maxTokens,
        config.isDefault ? 1 : 0,
        config.createdAt,
        config.updatedAt,
      ),
  )
  await db.batch(statements)
}

export async function updateLlmConfig(db: D1Database, config: StoredLlmConfig): Promise<void> {
  const statements = []
  if (config.isDefault) statements.push(db.prepare('UPDATE llm_configs SET is_default = 0 WHERE id != ?').bind(config.id))
  statements.push(
    db
      .prepare(
        `UPDATE llm_configs
         SET label = ?, provider = ?, base_url = ?, model = ?, api_key = ?, temperature = ?, max_tokens = ?, is_default = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        config.label,
        config.provider,
        config.baseUrl,
        config.model,
        config.apiKey,
        config.temperature,
        config.maxTokens,
        config.isDefault ? 1 : 0,
        config.updatedAt,
        config.id,
      ),
  )
  const results = await db.batch(statements)
  const updated = results[results.length - 1]
  if ((updated?.meta.changes ?? 0) === 0) throw new HttpError(404, '没有找到这个模型配置')
}

export async function deleteLlmConfig(db: D1Database, id: string): Promise<void> {
  const result = await db.prepare('DELETE FROM llm_configs WHERE id = ?').bind(id).run()
  if ((result.meta.changes ?? 0) === 0) throw new HttpError(404, '没有找到这个模型配置')
}

export async function getLlmSettings(db: D1Database): Promise<StoredLlmSettings> {
  const row = await db
    .prepare('SELECT generate_config_id, analyze_config_id FROM llm_settings WHERE id = ?')
    .bind('app')
    .first<{ generate_config_id: string | null; analyze_config_id: string | null }>()
  return {
    generateConfigId: row?.generate_config_id ?? '',
    analyzeConfigId: row?.analyze_config_id ?? '',
  }
}

export async function saveLlmSettings(db: D1Database, settings: StoredLlmSettings): Promise<void> {
  await db
    .prepare(
      `INSERT INTO llm_settings (id, generate_config_id, analyze_config_id) VALUES ('app', ?, ?)
       ON CONFLICT(id) DO UPDATE SET generate_config_id = excluded.generate_config_id, analyze_config_id = excluded.analyze_config_id`,
    )
    .bind(settings.generateConfigId || null, settings.analyzeConfigId || null)
    .run()
}

function mapLlmConfig(row: LlmConfigRow): StoredLlmConfig {
  return {
    id: row.id,
    label: row.label,
    provider: row.provider,
    baseUrl: row.base_url,
    model: row.model,
    apiKey: row.api_key,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
