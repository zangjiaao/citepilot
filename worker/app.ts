import { Hono, type Context } from 'hono'
import { compareCycles, metricsFor, type MetricScope } from '../shared/compare.ts'
import { parseCompetitorList } from '../shared/competitors.ts'
import { defaultCycleName } from '../shared/cycles.ts'
import { buildDiagnosis } from '../shared/diagnose.ts'
import { acceptDraft, channelLabel, coerceUrlHint, copyDraftTitle, DRAFT_CHANNELS, isDraftChannel, parseDraftEdit, templateDraft } from '../shared/drafts.ts'
import { parseAnswer, summarize } from '../shared/parseAnswer.ts'
import { isCycleKind, normalizePlatform, PLATFORMS } from '../shared/platforms.ts'
import { buildOpsCockpit } from '../shared/overviewOps.ts'
import { addedPromptSummary, assemblePromptGeneration, assessPromptCoverage, isCluster, normalizeQuestion, selectGapPrompts } from '../shared/prompts.ts'
import { applyBrandPageSave, readBrandProfile } from '../shared/brandProfile.ts'
import { readStudioList, type StudioListField } from '../shared/studioLists.ts'
import { applyBrandMention, assembleDraftPrompt, channelForContentType, finishDraftBody, isContentType, isPublishableDraft, materialDraft, parseAssetIds, parseDraftOptions, placeholderShare, profileGaps, rewriteGenericSentences } from '../shared/draftPrompt.ts'
import { backfillDraftImages, draftImages } from '../shared/draftImages.ts'
import { relatedDraftPrompts } from '../shared/recommendDraft.ts'
import { readAssetDraft } from '../shared/assets.ts'
import { acceptPolishedHtml, POLISH_SYSTEM, polishNotesOffline } from '../shared/polishAsset.ts'
import { assertPublicHttpUrl } from '../shared/ssrf.ts'
import type { Cluster, ContentDraft, Cycle, CycleTrendPoint, Diagnosis, DraftPreview, Observation, Overview, Prompt, Studio } from '../shared/types.ts'
import {
  deleteCycle,
  deleteDraft,
  deleteObservation,
  deletePrompt,
  deleteStudio,
  getDraft,
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
  updateDraft,
  updateStudio,
} from './db.ts'
import type { AppBindings } from './env.ts'
import { HttpError } from './errors.ts'
import { fetchPublic } from './fetchPage.ts'
import { acceptGeneratedPrompts, acceptOwnSentiment, acceptSuggestions, acceptSummary, completeJson } from './llm.ts'
import { registerModelRoutes } from './modelRoutes.ts'
import { llmStatus, resolveLlm } from './models.ts'
import { assetFromDraft, countAssets, deleteAsset, getAsset, insertAsset, listAssets, updateAsset } from './assets.ts'
import { readStoredMedia, storeStudioImage } from './media.ts'

export const app = new Hono<{ Bindings: AppBindings }>()

registerModelRoutes(app)

app.onError((error, c) => {
  if (error instanceof HttpError) {
    const status = error.status === 404 || error.status === 409 || error.status === 422 || error.status === 503 ? error.status : 400
    return c.json(error.field ? { error: error.message, field: error.field } : { error: error.message }, status)
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/no such table|no such column/i.test(message)) {
    return c.json({ error: '本地数据库还没有迁移。请运行 npm run db:migrate 后刷新。' }, 503)
  }
  console.error(JSON.stringify({ message: 'request failed', path: c.req.path, error: message }))
  return c.json({ error: '服务器处理请求时出错' }, 500)
})

app.get('/api/health', async (c) => {
  const llm = await llmStatus(c.env.DB, c.env)
  return c.json({ ok: true, llm })
})

app.get('/api/meta', async (c) => {
  const llm = await llmStatus(c.env.DB, c.env)
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
  const studio: Studio = { ...applyBrandPageSave(existing, draft), updatedAt: new Date().toISOString() }
  await updateStudio(c.env.DB, studio)
  return c.json({ studio })
})

app.delete('/api/studios/:id', async (c) => {
  const existing = await mustStudio(c.env.DB, c.req.param('id'))
  const body = await readJson(c)
  const confirmName = typeof (body as { confirmName?: unknown })?.confirmName === 'string' ? (body as { confirmName: string }).confirmName.trim() : ''
  if (confirmName !== existing.name) throw new HttpError(400, '请输入完整的品牌名称以确认删除', 'confirmName')
  await deleteStudio(c.env.DB, existing.id)
  return c.json({ ok: true })
})

app.get('/api/studios/:id/overview', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const [prompts, storedObservations, cycles, diagnoses, assets, drafts] = await Promise.all([
    listPrompts(c.env.DB, studio.id),
    listObservations(c.env.DB, studio.id),
    listCycles(c.env.DB, studio.id),
    listDiagnoses(c.env.DB, studio.id),
    listAssets(c.env.DB, studio.id),
    listDrafts(c.env.DB, studio.id),
  ])
  const observations = hydrateObservations(storedObservations, studio)
  const scope = metricScope(studio)
  const llm = await llmStatus(c.env.DB, c.env)
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
      ? { id: earliest.id, name: earliest.name, metrics: metricsFor(observations.filter((item) => item.cycleId === earliest.id), scope) }
      : null,
    latest: latestCycle
      ? { id: latestCycle.id, name: latestCycle.name, metrics: metricsFor(observations.filter((item) => item.cycleId === latestCycle.id), scope) }
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
    ops: buildOpsCockpit({ studio, assets, prompts, drafts, observations, cycles }),
    trend: ordered.flatMap((cycle) => {
      const rows = observations.filter((item) => item.cycleId === cycle.id)
      if (rows.length === 0) return []
      const metrics = metricsFor(rows, scope)
      const point: CycleTrendPoint = {
        id: cycle.id,
        name: cycle.name,
        kind: cycle.kind,
        createdAt: cycle.createdAt,
        samples: metrics.observations,
        mentionRate: metrics.mentionRate,
        citationRate: metrics.citationRate,
        shareOfVoice: metrics.shareOfVoice,
        averageRank: metrics.averageRank,
        stable: metrics.stable,
      }
      return [point]
    }),
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
  const assets = await listAssets(c.env.DB, studio.id)
  const existingTexts = existing.map((item) => item.text)
  const coverage = assessPromptCoverage(studio, existingTexts, assets)
  if (coverage.gaps.length === 0) {
    return c.json({ source: 'covered', warning: '', summary: coverage.summary, prompts: [] })
  }
  const llm = await resolveLlm(c.env.DB, c.env, 'generate')
  let matched: ReturnType<typeof selectGapPrompts> = []
  let source: 'template' | 'llm' = 'template'
  let warning = ''
  if (llm.enabled) {
    try {
      const brief = assemblePromptGeneration(studio, existingTexts, assets)
      const raw = await completeJson(llm, brief.system, brief.user, 0.7)
      const accepted = acceptGeneratedPrompts(studio, existingTexts, raw).filter((item) =>
        coverage.gaps.some((gap) => gap.anchors.some((anchor) => item.text.includes(anchor))),
      )
      if (accepted.length > 0) {
        matched = accepted
        source = 'llm'
      } else {
        warning = '模型题对不上盲区，已改用模板。'
      }
    } catch (error) {
      warning = error instanceof Error ? error.message : '模型生成失败，已改用模板。'
      console.error(JSON.stringify({ message: 'prompt generation fell back', error: warning }))
    }
  }
  const picked = selectGapPrompts(coverage.gaps, matched)
  if (matched.length > 0 && picked.some((item) => !matched.some((hit) => normalizeQuestion(hit.text) === normalizeQuestion(item.text)))) {
    warning = warning || '模型没写到的盲区，已用模板补上。'
  }
  const created = picked.map((item) =>
    toPrompt(studio.id, item, matched.some((hit) => normalizeQuestion(hit.text) === normalizeQuestion(item.text)) ? 'llm' : 'template'),
  )
  if (created.length > 0) await insertPrompts(c.env.DB, created)
  return c.json({ source, warning, summary: addedPromptSummary(picked, coverage), prompts: created })
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
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  return c.json({ observations: hydrateObservations(await listObservations(c.env.DB, studio.id), studio) })
})

app.post('/api/studios/:id/observations', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const body = asRecord(await readJson(c))
  const promptId = stringField(body, 'promptId')
  const cycleId = stringField(body, 'cycleId')
  const platform = normalizePlatform(stringField(body, 'platform'))
  const answerText = stringField(body, 'answerText').trim()
  if (!platform) throw new HttpError(400, '平台名称需要 1 到 32 个字，可以选列表，也可以自己填')
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
  const analyze = await resolveLlm(c.env.DB, c.env, 'analyze')
  if (analyze.enabled) {
    try {
      const raw = await completeJson(
        analyze,
        '你是 GEO 监测助手。规则解析已经给出品牌是否出现、排名、网址和竞品。请只根据这些事实和回答原文，用中文写一段 80 字以内的摘要。不要发明规则结果里没有的网址、品牌或排名。如果品牌被提到，再判断回答对本品牌的态度，只能是 positive、neutral 或 negative：明显推荐或夸奖用 positive，明显劝退或批评用 negative，其余用 neutral。品牌没被提到时 sentiment 用 neutral。只输出 JSON：{"summary":"...","sentiment":"positive|neutral|negative"}',
        `规则结果：${JSON.stringify({ ...parsed, summary: undefined })}\n回答原文：${answerText.slice(0, 4000)}`,
        0.2,
      )
      const summary = acceptSummary(raw)
      const sentiment = acceptOwnSentiment(raw)
      if (parsed.brandMentioned && sentiment) {
        parsed.sentiment = sentiment
        parser = 'deepseek'
      }
      if (summary) {
        parsed.summary = summary
        parser = 'deepseek'
      } else if (parser === 'deepseek') {
        parsed.summary = summarize(parsed)
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
    brandHits: parsed.brandHits,
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
  const analyze = await resolveLlm(c.env.DB, c.env, 'analyze')
  if (analyze.enabled) {
    try {
      const raw = await completeJson(
        analyze,
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

app.get('/api/studios/:id/assets', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  return c.json({ assets: await listAssets(c.env.DB, studio.id) })
})

app.post('/api/studios/:id/assets', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const parsed = readAssetDraft(await readJson(c))
  if (!parsed.ok) throw new HttpError(400, parsed.error, parsed.field)
  if ((await countAssets(c.env.DB, studio.id)) >= 500) throw new HttpError(400, '素材库已有 500 条，上限是 500 条', 'title')
  const now = new Date().toISOString()
  const asset = assetFromDraft(crypto.randomUUID(), studio.id, parsed.value, now)
  await insertAsset(c.env.DB, asset)
  return c.json({ asset }, 201)
})

app.put('/api/studios/:id/assets/:assetId', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const existing = await getAsset(c.env.DB, studio.id, c.req.param('assetId'))
  if (!existing) throw new HttpError(404, '没有找到这条素材')
  const parsed = readAssetDraft(await readJson(c))
  if (!parsed.ok) throw new HttpError(400, parsed.error, parsed.field)
  const asset = assetFromDraft(existing.id, studio.id, parsed.value, new Date().toISOString(), existing.createdAt)
  await updateAsset(c.env.DB, asset)
  return c.json({ asset })
})

app.delete('/api/studios/:id/assets/:assetId', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  await deleteAsset(c.env.DB, studio.id, c.req.param('assetId'))
  return c.json({ ok: true })
})

app.post('/api/studios/:id/assets/polish', async (c) => {
  await mustStudio(c.env.DB, c.req.param('id'))
  const record = asRecord(await readJson(c))
  const notes = stringField(record, 'notes').trim()
  if (!notes) throw new HttpError(400, '先在右侧写下笔记，再一起整理', 'body')
  if (notes.length > 20000) throw new HttpError(400, '笔记太长', 'body')
  const title = stringField(record, 'title').trim().slice(0, 80)
  const metrics = Array.isArray(record.metrics)
    ? record.metrics.filter((item): item is string => typeof item === 'string').slice(0, 12).join('\n')
    : ''
  const source = [title, notes, metrics].filter(Boolean).join('\n')
  const fallback = polishNotesOffline(notes)
  const writer = await resolveLlm(c.env.DB, c.env, 'generate')
  if (!writer.enabled) return c.json({ body: fallback, source: 'notes' })
  try {
    const raw = await completeJson(
      writer,
      POLISH_SYSTEM,
      `标题：${title || '未写'}\n已授权的数据：\n${metrics || '没有'}\n笔记：\n${notes}`,
      0.2,
    )
    const accepted = acceptPolishedHtml(raw, source)
    if (!accepted) return c.json({ body: fallback, source: 'notes' })
    return c.json({ body: accepted, source: 'model' })
  } catch (error) {
    console.error(JSON.stringify({ message: 'asset polish failed', error: error instanceof Error ? error.message : String(error) }))
    return c.json({ body: fallback, source: 'notes' })
  }
})

app.post('/api/studios/:id/media', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new HttpError(400, '请选择一张图片', 'file')
  try {
    const image = await storeStudioImage(c.env, studio.id, file)
    return c.json(image, 201)
  } catch (error) {
    if (error instanceof HttpError) throw error
    console.error(JSON.stringify({ message: 'media store failed', error: error instanceof Error ? error.message : String(error) }))
    throw new HttpError(502, '图片没有保存。本地会用 Wrangler 的 R2；没有绑定 MEDIA 时写到 .data/media。线上需要先创建桶 citepilot-media。')
  }
})

app.get('/api/media/*', async (c) => {
  const key = decodeMediaKey(c.req.path)
  if (!key) throw new HttpError(404, '没有这张图片')
  const media = await readStoredMedia(c.env, key)
  if (!media) throw new HttpError(404, '没有这张图片')
  const body = media.bytes.buffer.slice(media.bytes.byteOffset, media.bytes.byteOffset + media.bytes.byteLength) as ArrayBuffer
  return new Response(body, {
    headers: {
      'content-type': media.contentType,
      'cache-control': 'public, max-age=86400',
      'x-content-type-options': 'nosniff',
    },
  })
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

  const options = parseDraftOptions(record, channelRaw)
  const picked = parseAssetIds(record.assetIds)
  if (!picked.ok) throw new HttpError(400, picked.error, 'assetIds')
  const library = picked.ids.length > 0 ? await listAssets(c.env.DB, studio.id) : []
  const assets = picked.ids.map((id) => library.find((item) => item.id === id))
  if (assets.some((item) => !item)) throw new HttpError(404, '有一条勾选的素材已经不在库里')
  const selected = assets.filter((item): item is NonNullable<typeof item> => Boolean(item))
  const hidden = selected.find((item) => item.publicity === 'private')
  if (hidden) throw new HttpError(400, `「${hidden.title}」标成不可公开，不会用来起草`)
  let linkedPromptId = promptId
  if (options.brandMention === 'none') {
    promptText = ''
    linkedPromptId = ''
  } else if (options.brandMention === 'light' && !promptText && record.linkPrompt !== false) {
    const bank = await listPrompts(c.env.DB, studio.id)
    const observations = await listObservations(c.env.DB, studio.id)
    const ranked = relatedDraftPrompts(
      options.contentType,
      studio,
      selected,
      bank,
      observations.map((item) => ({ promptId: item.promptId, mentioned: item.brandMentioned })),
      library,
    )
    const chosen = bank.find((item) => item.id === ranked[0])
    if (chosen) {
      linkedPromptId = chosen.id
      promptText = chosen.text
    }
  }
  const channel = typeof record.contentType === 'string' && isContentType(record.contentType) ? channelForContentType(options.contentType) : channelRaw
  const channelMeta = DRAFT_CHANNELS.find((item) => item.id === channel) ?? DRAFT_CHANNELS[0]
  const context = { studio, channel, promptText, gapLabel, gapDetail }
  let brief =
    selected.length > 0
      ? materialDraft(studio, selected, channelMeta?.path ?? '/', options.brandMention, options.brandMention === 'none' ? '' : promptText, options.contentType)
      : templateDraft(context)
  let source: DraftPreview['source'] = 'template'
  let warning = ''
  const writer = await resolveLlm(c.env.DB, c.env, 'generate')
  const fallbackWarning = '模型这次没有写成完整稿，下面是按素材整理的底稿，不是终稿。可以再点一次生成。'
  if (writer.enabled) {
    try {
      const prompt = assembleDraftPrompt(
        studio,
        options,
        { promptText, gapLabel, gapDetail, channelLabel: channelLabel(channel) },
        selected,
      )
      const raw = await completeJson(
        writer,
        prompt.system,
        `${prompt.user}\n素材摘录（不要原样交回）：${JSON.stringify(brief)}\n把勾选的素材写成完整的一篇，先写客户侧的变化。明确种草也按同样篇幅写，不要缩短成广告短帖。`,
        0.4,
      )
      const accepted = acceptDraft(raw, studio.name, options.brandMention)
      if (accepted && isPublishableDraft(accepted.body, options.contentType)) {
        brief = { ...accepted, urlHint: coerceUrlHint(accepted.urlHint, studio.website, channelMeta?.path ?? '/') }
        source = 'deepseek'
      } else {
        warning = fallbackWarning
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(JSON.stringify({ message: 'draft text fell back', error: message }))
      warning = fallbackWarning
    }
  }
  let polished = rewriteGenericSentences(brief.body, selected, options.allowBragging)
  if (writer.enabled && polished.flags.length > 0) {
    try {
      const raw = await completeJson(
        writer,
        '你在做硬广和水文自检。硬广、立即咨询、行业领先、赋能数字化、一眼广告腔，以及自夸，都改成素材里客户的问题或做法。没有已授权的前后数据时不要编造数字，也不要把句子换成【待补充】。thread 的 1/N 编号保留。不要补奖项或团队规模。软植入结尾仍留一句品牌或官网，用来标明出处；不要在中段反复写品牌，不要写成硬广或水文。只输出 JSON：{"body":"..."}',
        `要改的句子：${polished.flags.join('\n')}\n原文：${brief.body}`,
        0.2,
      )
      const next = raw && typeof raw === 'object' && typeof (raw as { body?: unknown }).body === 'string' ? (raw as { body: string }).body.trim() : ''
      const mentions = studio.name ? next.split(studio.name).length - 1 : 0
      const brandOk = options.brandMention === 'none' ? mentions === 0 : options.brandMention === 'light' ? mentions <= 1 : mentions >= 1
      if (next.length >= 80 && brandOk && placeholderShare(next) <= 0.3) brief = { ...brief, body: next }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(JSON.stringify({ message: 'draft self-check fell back', error: message }))
    }
    polished = rewriteGenericSentences(brief.body, selected, options.allowBragging)
  }
  brief = applyBrandMention(
    { ...brief, body: backfillDraftImages(polished.body, draftImages(selected)) },
    studio.name,
    studio.website,
    options.brandMention,
  )
  brief = {
    ...brief,
    body: finishDraftBody(brief.body, studio.name, studio.website, options.brandMention, options.contentType),
    urlHint: coerceUrlHint(brief.urlHint, studio.website, channelMeta?.path ?? '/'),
  }
  const gaps = profileGaps(studio, options, selected)

  const draft: DraftPreview = {
    ...brief,
    channel,
    source,
    promptId: linkedPromptId || null,
    promptText,
    diagnosisId: diagnosisId || null,
    gapId: gapId || null,
    gapLabel,
  }
  console.log(JSON.stringify({ message: 'draft generated', channel, source, gaps: gaps.length, flags: polished.flags.length }))
  return c.json({ draft, gaps, flags: polished.flags, warning })
})

app.post('/api/studios/:id/drafts', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const record = asRecord(await readJson(c))
  const parsed = parseDraftEdit(record)
  if (!parsed.ok) throw new HttpError(400, parsed.error)
  const { channel: channelRaw, title, body, citeSentences, urlHint } = parsed.value
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

  const now = new Date().toISOString()
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
    createdAt: now,
    updatedAt: now,
  }
  await insertDraft(c.env.DB, draft)
  return c.json({ draft }, 201)
})

async function saveDraftEdits(c: Context<{ Bindings: AppBindings }>) {
  const studioId = c.req.param('id')
  const draftId = c.req.param('draftId')
  if (!studioId || !draftId) throw new HttpError(400, '缺少草稿')
  const studio = await mustStudio(c.env.DB, studioId)
  const existing = await getDraft(c.env.DB, studio.id, draftId)
  const parsed = parseDraftEdit(asRecord(await readJson(c)))
  if (!parsed.ok) throw new HttpError(400, parsed.error)
  const draft = await updateDraft(c.env.DB, studio.id, existing.id, parsed.value, new Date().toISOString())
  console.log(JSON.stringify({ message: 'draft updated', id: draft.id, channel: draft.channel }))
  return c.json({ draft })
}

app.patch('/api/studios/:id/drafts/:draftId', saveDraftEdits)
app.put('/api/studios/:id/drafts/:draftId', saveDraftEdits)

app.post('/api/studios/:id/drafts/:draftId/copy', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const existing = await getDraft(c.env.DB, studio.id, c.req.param('draftId'))
  const now = new Date().toISOString()
  const draft: ContentDraft = {
    ...existing,
    id: crypto.randomUUID(),
    title: copyDraftTitle(existing.title),
    createdAt: now,
    updatedAt: now,
  }
  await insertDraft(c.env.DB, draft)
  console.log(JSON.stringify({ message: 'draft copied', from: existing.id, id: draft.id }))
  return c.json({ draft }, 201)
})

app.delete('/api/studios/:id/drafts/:draftId', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  await deleteDraft(c.env.DB, studio.id, c.req.param('draftId'))
  return c.json({ ok: true })
})

app.get('/api/studios/:id/compare', async (c) => {
  const studio = await mustStudio(c.env.DB, c.req.param('id'))
  const [prompts, storedObservations, cycles] = await Promise.all([
    listPrompts(c.env.DB, studio.id),
    listObservations(c.env.DB, studio.id),
    listCycles(c.env.DB, studio.id),
  ])
  const observations = hydrateObservations(storedObservations, studio)
  const ordered = [...cycles].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const from = await pickCycle(c.env.DB, studio.id, c.req.query('from') || c.req.query('baseline'), ordered[0] ?? null)
  const to = await pickCycle(c.env.DB, studio.id, c.req.query('to') || c.req.query('retest'), ordered.at(-1) ?? null)
  return c.json(compareCycles(prompts, observations, from, to, metricScope(studio)))
})

app.all('/api/*', (c) => c.json({ error: '没有这个接口' }, 404))

app.all('*', async (c) => {
  if (c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw)
  return c.text('CitePilot API')
})

function decodeMediaKey(path: string): string | null {
  const prefix = '/api/media/'
  if (!path.startsWith(prefix)) return null
  try {
    const key = path
      .slice(prefix.length)
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/')
    return key || null
  } catch {
    return null
  }
}

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
  if (name.length < 2 || name.length > 80) throw new HttpError(400, '品牌名称需要 2 到 80 个字', 'name')
  if (positioning.length < 10 || positioning.length > 2000) throw new HttpError(400, `定位有 ${positioning.length} 字，需要 10 到 2000 个字`, 'positioning')
  let parsed: URL
  try {
    parsed = assertPublicHttpUrl(website)
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : '官网地址不正确', 'website')
  }
  const profile = readBrandProfile(record)
  if (!profile.ok) throw new HttpError(400, profile.error, profile.field)
  return {
    name,
    website: parsed.toString(),
    positioning,
    services: studioList(record.services, 'services'),
    competitors: competitorField(record.competitors),
    keywords: studioList(record.keywords, 'keywords'),
    capabilities: studioList(record.capabilities ?? [], 'capabilities'),
    cases: studioList(record.cases ?? [], 'cases'),
    targetCustomers: studioList(record.targetCustomers ?? [], 'targetCustomers'),
    solutions: studioList(record.solutions ?? [], 'solutions'),
    ...profile.profile,
  }
}

function competitorField(value: unknown): Studio['competitors'] {
  const parsed = parseCompetitorList(value)
  if (!parsed.ok) throw new HttpError(400, parsed.error, 'competitors')
  return parsed.competitors
}

function studioList(value: unknown, field: StudioListField): string[] {
  const parsed = readStudioList(value, field)
  if (!parsed.ok) throw new HttpError(400, parsed.error, parsed.field)
  return parsed.items
}

function metricScope(studio: Studio): MetricScope {
  return { ownName: studio.name, website: studio.website, competitors: studio.competitors }
}

function hydrateObservations(observations: Observation[], studio: Studio): Observation[] {
  return observations.map((item) => {
    if (item.brandHits.length > 0 || item.answerText.trim().length === 0) return item
    return {
      ...item,
      brandHits: parseAnswer({
        answer: item.answerText,
        brandName: studio.name,
        website: studio.website,
        competitors: studio.competitors,
      }).brandHits,
    }
  })
}

function optionalId(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') throw new HttpError(400, '关联字段不正确')
  return value.trim()
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
