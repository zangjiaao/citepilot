const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173'

async function main() {
  const health = await json('/api/health')
  if (!health.ok) throw new Error('health failed')
  const studios = await json('/api/studios')
  const studio = studios.studios?.[0]
  if (!studio?.id) throw new Error('missing seed studio')
  const prompts = await json(`/api/studios/${studio.id}/prompts`)
  if ((prompts.prompts?.length ?? 0) < 16) throw new Error(`expected seeded prompts, got ${prompts.prompts?.length}`)
  const cycles = await json(`/api/studios/${studio.id}/cycles`)
  const baseline = cycles.cycles?.find((item) => item.kind === 'baseline')
  const prompt = prompts.prompts.find((item) => item.cluster === 'scenario')
  const created = await json(`/api/studios/${studio.id}/observations`, {
    method: 'POST',
    body: JSON.stringify({
      promptId: prompt.id,
      cycleId: baseline.id,
      platform: 'qwen',
      answerText: '澄川智能体工场可以先帮团队整理故障手册。公开说明见 https://example.com ，做法比较专业。',
    }),
  })
  if (!created.observation?.brandMentioned || !created.observation?.ownUrlCited) {
    throw new Error(`parser missed the pasted answer: ${created.observation?.summary}`)
  }
  await json(`/api/studios/${studio.id}/observations/${created.observation.id}`, { method: 'DELETE' })
  const generated = await json(`/api/studios/${studio.id}/prompts/generate`, { method: 'POST', body: '{}' })
  if (!Array.isArray(generated.prompts)) throw new Error('generate did not return prompts')
  const compare = await json(`/api/studios/${studio.id}/compare?from=cycle-baseline&to=cycle-retest`)
  if (!compare.from || !compare.to) throw new Error('compare missing cycles')
  if (compare.from.name !== '示例·优化前' || compare.to.name !== '示例·优化后') {
    throw new Error(`seed pair should be historical samples, got ${compare.from.name} / ${compare.to.name}`)
  }
  if ((compare.to.metrics?.mentionRate ?? 0) < (compare.from.metrics?.mentionRate ?? 1)) {
    throw new Error('seeded retest should not mention the brand less often than baseline')
  }
  const custom = await json(`/api/studios/${studio.id}/cycles`, {
    method: 'POST',
    body: JSON.stringify({ name: '冒烟第2轮', kind: 'custom' }),
  })
  if (custom.cycle?.kind !== 'custom') throw new Error('custom cycle was not created')
  const customObservation = await json(`/api/studios/${studio.id}/observations`, {
    method: 'POST',
    body: JSON.stringify({
      promptId: prompt.id,
      cycleId: custom.cycle.id,
      platform: 'deepseek',
      answerText: '澄川智能体工场可以先帮团队整理故障手册。公开说明见 https://example.com ，做法比较专业。',
    }),
  })
  const customCompare = await json(`/api/studios/${studio.id}/compare?from=cycle-baseline&to=${custom.cycle.id}`)
  if (customCompare.to?.id !== custom.cycle.id) throw new Error('compare did not use the custom cycle')
  if ((customCompare.to.metrics?.mentionRate ?? 0) <= 0) throw new Error('custom cycle mention rate missing')
  await json(`/api/studios/${studio.id}/observations/${customObservation.observation.id}`, { method: 'DELETE' })
  await json(`/api/studios/${studio.id}/cycles/${custom.cycle.id}`, { method: 'DELETE' })
  const generatedDraft = await json(`/api/studios/${studio.id}/drafts/generate`, {
    method: 'POST',
    body: JSON.stringify({ channel: 'product-promo', promptId: prompt.id }),
  })
  const preview = generatedDraft.draft
  if (preview?.channel !== 'product-promo') throw new Error('draft channel missing')
  if (!preview.title || !preview.body?.includes(studio.name) || (preview.citeSentences?.length ?? 0) < 2) {
    throw new Error('draft generate returned an empty product promo')
  }
  if (!String(preview.urlHint).includes('example.com')) throw new Error('draft url hint missing site')
  if (!health.llm.enabled && preview.source !== 'template') throw new Error(`expected template draft, got ${preview.source}`)
  const stored = await json(`/api/studios/${studio.id}/drafts`, {
    method: 'POST',
    body: JSON.stringify(preview),
  })
  if (!stored.draft?.id) throw new Error('draft save failed')
  if (!stored.draft.updatedAt) throw new Error('draft save missing updatedAt')
  const revisedTitle = '澄川智能体工场产品说明·已改'
  const revisedBody = `${preview.body}\n\n补充：改稿后仍由你自己发布。`
  const updated = await json(`/api/studios/${studio.id}/drafts/${stored.draft.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      channel: 'faq',
      title: revisedTitle,
      body: revisedBody,
      citeSentences: preview.citeSentences,
      urlHint: preview.urlHint,
    }),
  })
  if (updated.draft?.title !== revisedTitle) throw new Error('draft update did not keep the new title')
  if (updated.draft?.channel !== 'faq') throw new Error('draft update did not keep the new channel')
  if (!updated.draft?.updatedAt || updated.draft.updatedAt < stored.draft.updatedAt) {
    throw new Error('draft update did not move updatedAt')
  }
  const replaced = await json(`/api/studios/${studio.id}/drafts/${stored.draft.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      channel: 'faq',
      title: revisedTitle,
      body: revisedBody,
      citeSentences: preview.citeSentences,
      urlHint: preview.urlHint,
    }),
  })
  if (replaced.draft?.id !== stored.draft.id) throw new Error('PUT replaced the draft id')
  const listed = await json(`/api/studios/${studio.id}/drafts`)
  const found = listed.drafts?.find((item) => item.id === stored.draft.id)
  if (!found || found.title !== revisedTitle) throw new Error('updated draft missing from list')
  const copied = await json(`/api/studios/${studio.id}/drafts/${stored.draft.id}/copy`, { method: 'POST' })
  if (!copied.draft?.id || copied.draft.id === stored.draft.id) throw new Error('draft copy did not create a new row')
  if (!String(copied.draft.title).includes('副本')) throw new Error('draft copy title missing 副本')
  await json(`/api/studios/${studio.id}/drafts/${copied.draft.id}`, { method: 'DELETE' })
  await json(`/api/studios/${studio.id}/drafts/${stored.draft.id}`, { method: 'DELETE' })
  console.log(JSON.stringify({
    ok: true,
    studio: studio.name,
    prompts: prompts.prompts.length,
    generated: generated.prompts.length,
    source: generated.source,
    llm: health.llm,
    baselineMention: compare.from.metrics.mentionRate,
    retestMention: compare.to.metrics.mentionRate,
    draftChannel: preview.channel,
    draftSource: preview.source,
  }))
}

async function json(path, init) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${path} ${response.status} ${data.error ?? ''}`)
  return data
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
