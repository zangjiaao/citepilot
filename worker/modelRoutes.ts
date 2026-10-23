import type { Hono } from 'hono'
import { LLM_PRESETS, callConfig, keepsStoredKey, parseLlmDraft } from '../shared/llmProviders.ts'
import type { AppBindings } from './env.ts'
import { HttpError } from './errors.ts'
import { testLlmConnection } from './llm.ts'
import { configForTest, llmStatus, publicConfig } from './models.ts'
import {
  deleteLlmConfig,
  getLlmConfig,
  getLlmSettings,
  insertLlmConfig,
  listLlmConfigs,
  saveLlmSettings,
  updateLlmConfig,
  type StoredLlmConfig,
} from './db.ts'

export function registerModelRoutes(app: Hono<{ Bindings: AppBindings }>) {
  app.get('/api/llm/configs', async (c) => {
    const [configs, settings, status] = await Promise.all([
      listLlmConfigs(c.env.DB),
      getLlmSettings(c.env.DB),
      llmStatus(c.env.DB, c.env),
    ])
    return c.json({
      configs: configs.map(publicConfig),
      settings,
      presets: LLM_PRESETS,
      active: status,
    })
  })

  app.post('/api/llm/configs', async (c) => {
    const parsed = parseLlmDraft(await c.req.json().catch(() => null), { requireKey: true })
    if (!parsed.ok) throw new HttpError(400, parsed.error, parsed.field)
    if (!parsed.value.apiKey || keepsStoredKey(parsed.value.apiKey)) throw new HttpError(400, '请填写 API 密钥', 'apiKey')
    const now = new Date().toISOString()
    const config: StoredLlmConfig = {
      id: crypto.randomUUID(),
      label: parsed.value.label,
      provider: parsed.value.provider,
      baseUrl: parsed.value.baseUrl,
      model: parsed.value.model,
      apiStyle: parsed.value.apiStyle,
      apiKey: parsed.value.apiKey,
      temperature: parsed.value.temperature,
      maxTokens: parsed.value.maxTokens,
      isDefault: parsed.value.isDefault,
      createdAt: now,
      updatedAt: now,
    }
    await insertLlmConfig(c.env.DB, config)
    return c.json({ config: publicConfig(config) }, 201)
  })

  app.put('/api/llm/configs/:id', async (c) => {
    const existing = await getLlmConfig(c.env.DB, c.req.param('id'))
    if (!existing) throw new HttpError(404, '没有找到这个模型配置')
    const parsed = parseLlmDraft(await c.req.json().catch(() => null), { requireKey: false })
    if (!parsed.ok) throw new HttpError(400, parsed.error, parsed.field)
    const apiKey = parsed.value.apiKey && !keepsStoredKey(parsed.value.apiKey) ? parsed.value.apiKey : existing.apiKey
    const config: StoredLlmConfig = {
      ...existing,
      label: parsed.value.label,
      provider: parsed.value.provider,
      baseUrl: parsed.value.baseUrl,
      model: parsed.value.model,
      apiStyle: parsed.value.apiStyle,
      apiKey,
      temperature: parsed.value.temperature,
      maxTokens: parsed.value.maxTokens,
      isDefault: parsed.value.isDefault,
      updatedAt: new Date().toISOString(),
    }
    await updateLlmConfig(c.env.DB, config)
    return c.json({ config: publicConfig(config) })
  })

  app.delete('/api/llm/configs/:id', async (c) => {
    await deleteLlmConfig(c.env.DB, c.req.param('id'))
    return c.json({ ok: true })
  })

  app.put('/api/llm/settings', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { generateConfigId?: unknown; analyzeConfigId?: unknown } | null
    const generateConfigId = typeof body?.generateConfigId === 'string' ? body.generateConfigId.trim() : ''
    const analyzeConfigId = typeof body?.analyzeConfigId === 'string' ? body.analyzeConfigId.trim() : ''
    const configs = await listLlmConfigs(c.env.DB)
    if (generateConfigId && !configs.some((item) => item.id === generateConfigId)) throw new HttpError(400, '内容生成没有这套配置')
    if (analyzeConfigId && !configs.some((item) => item.id === analyzeConfigId)) throw new HttpError(400, '分析没有这套配置')
    await saveLlmSettings(c.env.DB, { generateConfigId, analyzeConfigId })
    return c.json({ settings: { generateConfigId, analyzeConfigId } })
  })

  app.post('/api/llm/test', async (c) => {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    let config = null
    if (id) {
      const inlineKey = typeof body?.apiKey === 'string' ? body.apiKey : undefined
      const stored = await configForTest(c.env.DB, id, inlineKey)
      if (!stored) throw new HttpError(404, '没有找到这个模型配置')
      if (body && typeof body.baseUrl === 'string' && typeof body.model === 'string') {
        const parsed = parseLlmDraft({ ...body, apiKey: stored.apiKey }, { requireKey: true })
        if (!parsed.ok) throw new HttpError(400, parsed.error, parsed.field)
        config = callConfig(
          parsed.value.baseUrl,
          parsed.value.model,
          stored.apiKey,
          parsed.value.temperature,
          parsed.value.maxTokens,
          parsed.value.apiStyle,
        )
      } else {
        config = stored
      }
    } else {
      const parsed = parseLlmDraft(body, { requireKey: true })
      if (!parsed.ok) throw new HttpError(400, parsed.error, parsed.field)
      if (!parsed.value.apiKey) throw new HttpError(400, '请填写 API 密钥', 'apiKey')
      config = callConfig(
        parsed.value.baseUrl,
        parsed.value.model,
        parsed.value.apiKey,
        parsed.value.temperature,
        parsed.value.maxTokens,
        parsed.value.apiStyle,
      )
    }
    const result = await testLlmConnection(config)
    if (!result.ok) throw new HttpError(422, result.error)
    return c.json({ ok: true, reply: result.reply })
  })
}
