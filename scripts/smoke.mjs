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
  const compare = await json(`/api/studios/${studio.id}/compare`)
  if (!compare.baseline || !compare.retest) throw new Error('compare missing cycles')
  if ((compare.retest.metrics?.mentionRate ?? 0) < (compare.baseline.metrics?.mentionRate ?? 1)) {
    throw new Error('seeded retest should not mention the brand less often than baseline')
  }
  console.log(JSON.stringify({
    ok: true,
    studio: studio.name,
    prompts: prompts.prompts.length,
    generated: generated.prompts.length,
    source: generated.source,
    llm: health.llm,
    baselineMention: compare.baseline.metrics.mentionRate,
    retestMention: compare.retest.metrics.mentionRate,
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
