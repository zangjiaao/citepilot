import { Hono } from 'hono'
import { compareCycles, metricsFor } from '../shared/compare.ts'
import { defaultCycleName } from '../shared/cycles.ts'
import { buildDiagnosis } from '../shared/diagnose.ts'
import { acceptDraft, channelLabel, isDraftChannel, templateDraft } from '../shared/drafts.ts'
import { parseAnswer } from '../shared/parseAnswer.ts'
import { isCycleKind, isPlatformId, PLATFORMS } from '../shared/platforms.ts'
import { isCluster, templatePrompts } from '../shared/prompts.ts'
import { assertPublicHttpUrl } from '../shared/ssrf.ts'
import type { Cluster, ContentDraft, Cycle, Diagnosis, DraftPreview, Observation, Overview, Prompt, Studio } from '../shared/types.ts'
import {
  deleteCycle,
  deleteDraft,
  deleteObservation,
  deletePrompt,
  insertCycle,
  insertDiagnosis,
  insertDraft,
  insertObservation,
  insertPrompts,
  insertStudio,
  listCycles,
  listDiagnoses,
  listDrafts,
  listObservations,
  listPrompts,
  listStudios,
  mustCycle,
  mustStudio,
  updateStudio,
} from './db.ts'
import { llmConfig, type AppBindings } from './env.ts'
import { HttpError } from './errors.ts'
import { fetchPublic } from './fetchPage.ts'
import { acceptGeneratedPrompts, acceptSuggestions, acceptSummary, deepseekJson } from './llm.ts'

export const app = new Hono<{ Bindings: AppBindings }>()

app.onError((error, c) => {
  if (error instanceof HttpError) {
    const status = error.status === 404 || error.status === 409 || error.status === 422 || error.status === 503 ? error.status : 400
    return c.json({ error: error.message }, status)
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/no such table|no such column/i.test(message)) {
    return c.json({ error: '本地数据库还没有迁移。请运行 npm run db:migrate 后刷新。' }, 503)
  }
  console.error(JSON.stringify({ message: 'request failed', path: c.req.path, error: message }))
  return c.json({ error: '服务器处理请求时出错' }, 500)
})

app.get('/api/health', (c) => {
  const llm = llmConfig(c.env)
  return c.json({
    ok: true,
    llm: { enabled: llm.enabled, model: llm.model, baseUrl: llm.baseUrl },
  })
})

app.get('/api/meta', (c) => {
  const llm = llmConfig(c.env)
  return c.json({
    platforms: PLATFORMS,
    clusters: [
      { id: 'brand', label: '品牌' },
      { id: 'category', label: '品类' },
      { id: 'comparison', label: '对比' },
      { id: 'scenario', label: '场景' },
    ],
    llm: { enabled: llm.enabled, model: llm.model },
  })
})

app.get('/api/studios', async (c) => {
  return c.json({ studios: await listStudios(c.env.DB) })
})

app.post('/api/studios', async (c) => {
  const body = await readJson(c)
  const draft = studioFromBody(body)
  const now = new Date().toISOString()
  const studio: Studio = { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
  await insertStudio(c.env.DB, studio)
  const firstSample: Cycle = {
    id: crypto.randomUUID(),
    studioId: studio.id,
    name: defaultCycleName(new Date(now)),
    kind: 'custom',
    createdAt: now,
  }
  await insertCycle(c.env.DB, firstSample)
  return c.json({ studio }, 201)
})

app.get('/api/studios/:id', async (c) => {
  return c.json({ studio: await mustStudio(c.env.DB, c.req.param('id')) })
})

app.put('/api/studios/:id', async (c) => {
  const existing = await mustStudio(c.env.DB, c.req.param('id'))
  const draft = studioFromBody(await readJson(c))
  const studio: Studio = { ...existing, ...draft, updatedAt: new Date().toISOString() }
  await updateStudio(c.env.DB, studio)
  return c.json({ studio })
})

app.get('/api/studios/:id/overview', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const [prompts, observations, cycles, diagnoses] = await Promise.all([
    listPrompts(c.env.DB, studio.id),
    listObservations(c.env.DB, studio.id),
    listCycles(c.env.DB, studio.id),
    listDiagnoses(c.env.DB, studio.id),
  ])
  const llm = llmConfig(c.env)
  const ordered = [...cycles].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const earliest = ordered[0] ?? null
  const latestCycle = ordered.at(-1) ?? null
  const latest = diagnoses[0]
  const overview: Overview = {
    studio,
    llm: { enabled: llm.enabled, model: llm.model, baseUrl: llm.baseUrl },
    counts: {
      prompts: prompts.length,
      observations: observations.length,
      diagnoses: diagnoses.length,
      byCluster: {
        brand: prompts.filter((item) => item.cluster === 'brand').length,
        category: prompts.filter((item) => item.cluster === 'category').length,
        comparison: prompts.filter((item) => item.cluster === 'comparison').length,
        scenario: prompts.filter((item) => item.cluster === 'scenario').length,
      },
    },
    earliest: earliest
      ? { id: earliest.id, name: earliest.name, metrics: metricsFor(observations.filter((item) => item.cycleId === earliest.id)) }
      : null,
    latest: latestCycle
      ? { id: latestCycle.id, name: latestCycle.name, metrics: metricsFor(observations.filter((item) => item.cycleId === latestCycle.id)) }
      : null,
    latestDiagnosis: latest
      ? {
          id: latest.id,
          url: latest.finalUrl || latest.url,
          createdAt: latest.createdAt,
          pass: latest.checklist.filter((item) => item.status === 'pass').length,
          warn: latest.checklist.filter((item) => item.status === 'warn').length,
          fail: latest.checklist.filter((item) => item.status === 'fail').length,
        }
      : null,
  }
  return c.json(overview)
})

app.get('/api/studios/:id/prompts', async (c) => {
  await mustStudio(c.env.DB, c.req.param('id'))
  return c.json({ prompts: await listPrompts(c.env.DB, c.req.param('id')) })
})

app.post('/api/studios/:id/prompts', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const body = asRecord(await readJson(c))
  const cluster = stringField(body, 'cluster')
  const text = stringField(body, 'text').trim()
  const rationale = optionalString(body, 'rationale').trim()
  if (!isCluster(cluster)) throw new HttpError(400, '题目簇不正确')
  if (text.length < 4 || text.length > 500) throw new HttpError(400, '题目长度需要在 4 到 500 字之间')
  const prompt: Prompt = {
    id: crypto.randomUUID(),
    studioId: studio.id,
    cluster,
    text,
    rationale: rationale.slice(0, 200),
    source: 'manual',
    createdAt: new Date().toISOString(),
  }
  await insertPrompts(c.env.DB, [prompt])
  return c.json({ prompt }, 201)
})

app.post('/api/studios/:id/prompts/generate', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const existing = await listPrompts(c.env.DB, studio.id)
  const llm = llmConfig(c.env)
  let created: Prompt[] = []
  let source: 'template' | 'llm' = 'template'
  let warning = ''
  if (llm.enabled) {
    try {
      const raw = await deepseekJson(
        c.env,
        '你是 GEO/AEO 题库编辑，帮智能体应用工作室准备要拿去问 ChatGPT、DeepSeek、豆包、Kimi 等回答引擎的中文问题。问题要像真实采购或研究者会问的话，不要写成广告。只输出 JSON：{"prompts":[{"cluster":"brand|category|comparison|scenario","text":"...","rationale":"..."}]}',
        [
          `工作室：${studio.name}`,
          `官网：${studio.website}`,
          `定位：${studio.positioning}`,
          `服务：${studio.services.join('、') || '未填'}`,
          `竞品：${studio.competitors.join('、') || '未填'}`,
          `关键词：${studio.keywords.join('、') || '未填'}`,
          `已有题目，不要重复：${existing.map((item) => item.text).join('；') || '无'}`,
          '请新写 8 题，四个簇都要有。品牌题必须出现工作室名称。对比题必须同时出现工作室名称和至少一个竞品。品类题不要塞进品牌名。',
        ].join('\n'),
        0.7,
      )
      const accepted = acceptGeneratedPrompts(studio, existing.map((item) => item.text), raw)
      if (accepted.length >= 4) {
        created = accepted.map((item) => toPrompt(studio.id, item, 'llm'))
        source = 'llm'
      } else {
        warning = '模型返回的题目不够用，已改用模板。'
      }
    } catch (error) {
      warning = error instanceof Error ? error.message : '模型生成失败，已改用模板。'
      console.error(JSON.stringify({ message: 'prompt generation fell back', error: warning }))
    }
  }
  if (created.length === 0) {
    const drafts = templatePrompts(studio, existing.map((item) => item.text))
    created = drafts.map((item) => toPrompt(studio.id, item, 'template'))
    source = 'template'
    if (created.length === 0 && !warning) warning = '模板题都已经在题库里了。'
  }
  await insertPrompts(c.env.DB, created)
  return c.json({ source, warning, prompts: created })
})

app.delete('/api/studios/:id/prompts/:promptId', async (c) => {
  await mustStudio(c.env.DB, c.req.param('id'))
  await deletePrompt(c.env.DB, c.req.param('id'), c.req.param('promptId'))
  return c.json({ ok: true })
})

app.get('/api/studios/:id/cycles', async (c) => {
  await mustStudio(c.env.DB, c.req.param('id'))
  return c.json({ cycles: await listCycles(c.env.DB, c.req.param('id')) })
})

app.post('/api/studios/:id/cycles', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const body = asRecord(await readJson(c))
  const name = stringField(body, 'name').trim()
  const kind = stringField(body, 'kind')
  if (name.length < 2 || name.length > 40) throw new HttpError(400, '轮次名称需要 2 到 40 个字')
  if (!isCycleKind(kind)) throw new HttpError(400, '轮次类型只能是抽查、基线或复测')
  const cycle: Cycle = {
    id: crypto.randomUUID(),
    studioId: studio.id,
    name,
    kind,
    createdAt: new Date().toISOString(),
  }
  await insertCycle(c.env.DB, cycle)
  return c.json({ cycle }, 201)
})

app.delete('/api/studios/:id/cycles/:cycleId', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  await deleteCycle(c.env.DB, studio.id, c.req.param('cycleId'))
  return c.json({ ok: true })
})

app.get('/api/studios/:id/observations', async (c) => {
  await mustStudio(c.env.DB, c.req.param('id'))
  return c.json({ observations: await listObservations(c.env.DB, c.req.param('id')) })
})

app.post('/api/studios/:id/observations', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const body = asRecord(await readJson(c))
  const promptId = stringField(body, 'promptId')
  const cycleId = stringField(body, 'cycleId')
  const platform = stringField(body, 'platform')
  const answerText = stringField(body, 'answerText').trim()
  if (!isPlatformId(platform)) throw new HttpError(400, '不认识这个平台')
  if (answerText.length < 10 || answerText.length > 20_000) throw new HttpError(400, '回答需要在 10 到 20000 字之间')
  const prompts = await listPrompts(c.env.DB, studio.id)
  const prompt = prompts.find((item) => item.id === promptId)
  if (!prompt) throw new HttpError(404, '没有找到这道题')
  const cycle = await mustCycle(c.env.DB, studio.id, cycleId)
  const parsed = parseAnswer({
    answer: answerText,
    brandName: studio.name,
    website: studio.website,
    competitors: studio.competitors,
  })
  let parser: Observation['parser'] = 'rules'
  if (llmConfig(c.env).enabled) {
    try {
      const raw = await deepseekJson(
        c.env,
        '你是 GEO 监测助手。规则解析已经给出事实，请只根据这些事实和回答原文，用中文写一段 80 字以内的摘要。不要发明规则结果里没有的网址或竞品。只输出 JSON：{"summary":"..."}',
        `规则结果：${JSON.stringify({ ...parsed, summary: undefined })}\n回答原文：${answerText.slice(0, 4000)}`,
        0.2,
      )
      const summary = acceptSummary(raw)
      if (summary) {
        parsed.summary = summary
        parser = 'deepseek'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(JSON.stringify({ message: 'answer summary fell back', error: message }))
    }
  }
  const observation: Observation = {
    id: crypto.randomUUID(),
    studioId: studio.id,
    promptId: prompt.id,
    promptText: prompt.text,
    cluster: prompt.cluster,
    cycleId: cycle.id,
    cycleName: cycle.name,
    platform,
    answerText,
    brandMentioned: parsed.brandMentioned,
    brandSnippets: parsed.brandSnippets,
    citedUrls: parsed.citedUrls,
    ownUrlCited: parsed.ownUrlCited,
    competitorsMentioned: parsed.competitorsMentioned,
    sentiment: parsed.sentiment,
    summary: parsed.summary,
    parser,
    createdAt: new Date().toISOString(),
  }
  await insertObservation(c.env.DB, observation)
  return c.json({ observation }, 201)
})

app.delete('/api/studios/:id/observations/:observationId', async (c) => {
  await mustStudio(c.env.DB, c.req.param('id'))
  await deleteObservation(c.env.DB, c.req.param('id'), c.req.param('observationId'))
  return c.json({ ok: true })
})

app.get('/api/studios/:id/diagnoses', async (c) => {
  await mustStudio(c.env.DB, c.req.param('id'))
  return c.json({ diagnoses: await listDiagnoses(c.env.DB, c.req.param('id')) })
})

app.post('/api/studios/:id/diagnoses', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const body = await readJson(c)
  const requested = body && typeof body === 'object' && typeof (body as { url?: unknown }).url === 'string'
    ? (body as { url: string }).url.trim()
    : studio.website
  const pageUrl = assertPublicHttpUrl(requested || studio.website)
  let page: Awaited<ReturnType<typeof fetchPublic>>
  try {
    page = await fetchPublic(pageUrl.toString(), 500_000)
  } catch (error) {
    const message = error instanceof Error ? error.message : '抓取失败'
    throw new HttpError(422, message)
  }
  const origin = new URL(page.url).origin
  const robots = await fetchOptional(new URL('/robots.txt', origin).toString(), 100_000)
  const llms = await fetchOptional(new URL('/llms.txt', origin).toString(), 100_000)
  const report = buildDiagnosis({
    page: { url: page.url, status: page.status, body: page.text },
    robots: robots ? { url: robots.url, status: robots.status, body: robots.text } : null,
    llms: llms ? { url: llms.url, status: llms.status, body: llms.text } : null,
  })
  let suggestions = report.suggestions
  let suggestionSource: Diagnosis['suggestionSource'] = 'rules'
  if (llmConfig(c.env).enabled) {
    try {
      const raw = await deepseekJson(
        c.env,
        '你是 GEO/AEO 顾问。下面是对公开网页的检查清单。只根据清单里已经出现的未通过项，用中文给出 5 条可执行建议，按优先级排序。不要声称清单里没有的项目已经通过或失败。只输出 JSON：{"suggestions":["..."]}',
        `页面：${page.url}\n清单：${JSON.stringify(report.checklist)}`,
        0.3,
      )
      const accepted = acceptSuggestions(raw)
      if (accepted) {
        suggestions = accepted
        suggestionSource = 'deepseek'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(JSON.stringify({ message: 'diagnosis text fell back', error: message }))
    }
  }
  const diagnosis: Diagnosis = {
    id: crypto.randomUUID(),
    studioId: studio.id,
    url: pageUrl.toString(),
    finalUrl: page.url,
    httpStatus: page.status,
    title: report.title,
    checklist: report.checklist,
    suggestions,
    suggestionSource,
    excerpt: report.excerpt,
    createdAt: new Date().toISOString(),
  }
  await insertDiagnosis(c.env.DB, diagnosis)
  console.log(JSON.stringify({ message: 'diagnosis stored', url: page.url, status: page.status, source: suggestionSource }))
  return c.json({ diagnosis }, 201)
})

app.get('/api/studios/:id/drafts', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  return c.json({ drafts: await listDrafts(c.env.DB, studio.id) })
})

app.post('/api/studios/:id/drafts/generate', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const record = asRecord(await readJson(c))
  const channelRaw = stringField(record, 'channel').trim()
  if (!isDraftChannel(channelRaw)) throw new HttpError(400, '不认识这个渠道')
  const promptId = optionalId(record.promptId)
  const diagnosisId = optionalId(record.diagnosisId)
  const gapId = optionalId(record.gapId)
  if (gapId && !diagnosisId) throw new HttpError(400, '要指定诊断记录，才能关联缺口')

  let promptText = ''
  if (promptId) {
    const prompt = (await listPrompts(c.env.DB, studio.id)).find((item) => item.id === promptId)
    if (!prompt) throw new HttpError(404, '没有找到这道题')
    promptText = prompt.text
  }
  let gapLabel = ''
  let gapDetail = ''
  if (diagnosisId) {
    const diagnosis = (await listDiagnoses(c.env.DB, studio.id)).find((item) => item.id === diagnosisId)
    if (!diagnosis) throw new HttpError(404, '没有找到这次诊断')
    if (gapId) {
      const gap = diagnosis.checklist.find((item) => item.id === gapId && item.status !== 'pass')
      if (!gap) throw new HttpError(400, '这个检查项没有缺口，或不是这次诊断里的')
      gapLabel = gap.label
      gapDetail = gap.detail
    }
  }

  const context = { studio, channel: channelRaw, promptText, gapLabel, gapDetail }
  let brief = templateDraft(context)
  let source: DraftPreview['source'] = 'template'
  if (llmConfig(c.env).enabled) {
    try {
      const raw = await deepseekJson(
        c.env,
        '你是 GEO/AEO 内容编辑。只根据用户给出的工作室档案改写草稿，不要新增客户名、金额、百分比或未提供的案例。正文必须出现工作室名称。只输出 JSON：{"title":"","body":"","citeSentences":["",""],"urlHint":""}。citeSentences 是 3 到 5 句可以单独被回答引擎引用的话，每句都包含工作室名称。urlHint 必须包含给定官网主机名，并说明内容应该落在哪个地址。',
        `渠道：${channelLabel(channelRaw)}\n官网：${studio.website}\n档案：${JSON.stringify({
          name: studio.name,
          positioning: studio.positioning,
          capabilities: studio.capabilities,
          cases: studio.cases,
          targetCustomers: studio.targetCustomers,
          solutions: studio.solutions,
          services: studio.services,
        })}\n题目：${promptText || '无'}\n诊断缺口：${gapLabel || '无'} ${gapDetail}\n模板草稿：${JSON.stringify(brief)}\n请按该渠道的写法重写，保留事实。`,
        0.4,
      )
      const accepted = acceptDraft(raw, studio.name)
      if (accepted) {
        const host = new URL(studio.website).host
        if (!accepted.urlHint.includes(host)) accepted.urlHint = brief.urlHint
        brief = accepted
        source = 'deepseek'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(JSON.stringify({ message: 'draft text fell back', error: message }))
    }
  }

  const draft: DraftPreview = {
    ...brief,
    channel: channelRaw,
    source,
    promptId: promptId || null,
    promptText,
    diagnosisId: diagnosisId || null,
    gapId: gapId || null,
    gapLabel,
  }
  console.log(JSON.stringify({ message: 'draft generated', channel: channelRaw, source }))
  return c.json({ draft })
})

app.post('/api/studios/:id/drafts', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const record = asRecord(await readJson(c))
  const channelRaw = stringField(record, 'channel').trim()
  if (!isDraftChannel(channelRaw)) throw new HttpError(400, '不认识这个渠道')
  const title = stringField(record, 'title').trim()
  const body = stringField(record, 'body').trim()
  const urlHint = stringField(record, 'urlHint').trim()
  const citeSentences = stringList(record.citeSentences, 6, 180)
  if (title.length < 4 || title.length > 80) throw new HttpError(400, '标题需要 4 到 80 个字')
  if (body.length < 40 || body.length > 8000) throw new HttpError(400, '正文太短或太长')
  if (citeSentences.length < 2) throw new HttpError(400, '至少保留两句可引用的话')
  if (urlHint.length < 8 || urlHint.length > 300) throw new HttpError(400, '建议网址需要写清落在哪一页')
  const source = optionalString(record, 'source')
  if (source !== 'template' && source !== 'deepseek') throw new HttpError(400, '草稿来源不正确')

  const promptId = optionalId(record.promptId)
  let promptText = optionalString(record, 'promptText').trim().slice(0, 200)
  if (promptId) {
    const prompt = (await listPrompts(c.env.DB, studio.id)).find((item) => item.id === promptId)
    if (!prompt) throw new HttpError(404, '没有找到这道题')
    if (!promptText) promptText = prompt.text
  }
  const diagnosisId = optionalId(record.diagnosisId)
  if (diagnosisId) {
    const diagnosis = (await listDiagnoses(c.env.DB, studio.id)).find((item) => item.id === diagnosisId)
    if (!diagnosis) throw new HttpError(404, '没有找到这次诊断')
  }
  const gapLabel = optionalString(record, 'gapLabel').trim().slice(0, 80)

  const draft: ContentDraft = {
    id: crypto.randomUUID(),
    studioId: studio.id,
    channel: channelRaw,
    title,
    body,
    citeSentences,
    urlHint,
    promptId: promptId || null,
    promptText,
    diagnosisId: diagnosisId || null,
    gapLabel,
    source,
    createdAt: new Date().toISOString(),
  }
  await insertDraft(c.env.DB, draft)
  return c.json({ draft }, 201)
})

app.delete('/api/studios/:id/drafts/:draftId', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  await deleteDraft(c.env.DB, studio.id, c.req.param('draftId'))
  return c.json({ ok: true })
})

app.get('/api/studios/:id/compare', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const [prompts, observations, cycles] = await Promise.all([
    listPrompts(c.env.DB, studio.id),
    listObservations(c.env.DB, studio.id),
    listCycles(c.env.DB, studio.id),
  ])
  const ordered = [...cycles].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const from = await pickCycle(c.env.DB, studio.id, c.req.query('from') || c.req.query('baseline'), ordered[0] ?? null)
  const to = await pickCycle(c.env.DB, studio.id, c.req.query('to') || c.req.query('retest'), ordered.at(-1) ?? null)
  return c.json(compareCycles(prompts, observations, from, to))
})

app.all('/api/*', (c) => c.json({ error: '没有这个接口' }, 404))

app.all('*', async (c) => {
  if (c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw)
  return c.text('CitePilot API')
})

async function pickCycle(db: D1Database, studioId: string, requested: string | undefined, fallback: Cycle | null): Promise<Cycle | null> {
  if (requested) return mustCycle(db, studioId, requested)
  return fallback
}

async function fetchOptional(url: string, maxBytes: number) {
  try {
    return await fetchPublic(url, maxBytes)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ message: 'optional fetch skipped', url, error: message }))
    return null
  }
}

function toPrompt(studioId: string, draft: { cluster: Cluster; text: string; rationale: string }, source: Prompt['source']): Prompt {
  return {
    id: crypto.randomUUID(),
    studioId,
    cluster: draft.cluster,
    text: draft.text,
    rationale: draft.rationale,
    source,
    createdAt: new Date().toISOString(),
  }
}

function studioFromBody(body: unknown): Omit<Studio, 'id' | 'createdAt' | 'updatedAt'> {
  const record = asRecord(body)
  const name = stringField(record, 'name').trim()
  const website = stringField(record, 'website').trim()
  const positioning = stringField(record, 'positioning').trim()
  if (name.length < 2 || name.length > 80) throw new HttpError(400, '工作室名称需要 2 到 80 个字')
  if (positioning.length < 10 || positioning.length > 2000) throw new HttpError(400, '定位需要 10 到 2000 个字')
  let parsed: URL
  try {
    parsed = assertPublicHttpUrl(website)
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : '官网地址不正确')
  }
  return {
    name,
    website: parsed.toString(),
    positioning,
    services: stringList(record.services, 20, 80),
    competitors: stringList(record.competitors, 20, 80),
    keywords: stringList(record.keywords, 20, 40),
    capabilities: optionalStringList(record.capabilities, 12, 120),
    cases: optionalStringList(record.cases, 8, 200),
    targetCustomers: optionalStringList(record.targetCustomers, 12, 80),
    solutions: optionalStringList(record.solutions, 12, 120),
  }
}

function optionalStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (value === undefined || value === null) return []
  return stringList(value, maxItems, maxLength)
}

function optionalId(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') throw new HttpError(400, '关联字段不正确')
  return value.trim()
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) throw new HttpError(400, '列表字段格式不正确')
  const items = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  if (items.length > maxItems) throw new HttpError(400, '列表项目太多')
  if (items.some((item) => item.length > maxLength)) throw new HttpError(400, '列表里有一项太长')
  return items
}

async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    throw new HttpError(400, '请求体不是 JSON')
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, '请求体格式不正确')
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') throw new HttpError(400, `缺少 ${key}`)
  return value
}

function optionalString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}
