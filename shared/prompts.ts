import type { Asset } from './assets.ts'
import { competitorNames } from './competitors.ts'
import type { Cluster, GeneratedPrompt, Studio } from './types.ts'

export function normalizeQuestion(text: string): string {
  return text.replace(/\s+/g, '').trim().toLowerCase()
}

type PromptStudio = Pick<Studio, 'name' | 'website' | 'positioning' | 'services' | 'competitors' | 'keywords'>
export type PromptTermStudio = Pick<Studio, 'keywords' | 'services' | 'positioning'>

const GENERIC_TAGS = new Set(['产品', '其他', '内部', '案例'])

function trimEndPunct(text: string): string {
  return text.replace(/[。！？\s]+$/g, '').trim()
}

function clipTheme(text: string, max = 80): string {
  const trimmed = trimEndPunct(text)
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max)
}

function phrasePieces(value: string): string[] {
  return value
    .split(/[，。！？、；：\s「」"'“”‘’（）()[\]【】/]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 18 && !/^\d+(?:\.\d+)?$/.test(item) && !GENERIC_TAGS.has(item))
}

export function assetMatchTerms(assets: Asset[], studio: PromptTermStudio): string[] {
  const terms = new Set<string>()
  const studioWords = [...studio.keywords, ...studio.services, studio.positioning].map((item) => item.trim()).filter((item) => item.length >= 2)
  for (const asset of assets) {
    if (asset.publicity === 'private') continue
    const fields = [
      asset.title,
      asset.details.problem,
      asset.details.approach,
      asset.details.howItWorks,
      asset.details.industry,
      ...asset.tags,
      ...asset.details.metrics.filter((item) => item.customerAuthorized && item.name.trim()).map((item) => item.name),
    ]
    for (const piece of fields.flatMap(phrasePieces)) terms.add(piece)
    const blob = [...fields, asset.body].join('\n')
    for (const word of studioWords) {
      if (blob.includes(word)) terms.add(word)
    }
  }
  return [...terms]
}

export function assetGroundedCount(prompts: Array<Pick<GeneratedPrompt, 'cluster' | 'text'>>, assets: Asset[], studio: PromptTermStudio): number {
  const terms = assetMatchTerms(assets, studio)
  if (terms.length === 0) return 0
  return prompts.filter((item) => (item.cluster === 'scenario' || item.cluster === 'category') && terms.some((term) => item.text.includes(term))).length
}

export function promptAssetLines(assets: Asset[]): string[] {
  return assets
    .filter((item) => item.publicity !== 'private')
    .slice(0, 12)
    .map((asset) =>
      [asset.title, asset.details.industry, asset.details.problem, asset.details.approach, asset.details.howItWorks, asset.tags.join('、')]
        .map((item) => item.trim())
        .filter(Boolean)
        .join(' / '),
    )
    .filter(Boolean)
}

const MAX_NEW_PROMPTS = 8

export type PromptGapKind = 'asset' | 'brand' | 'competitor' | 'keyword' | 'service'

export interface PromptGap {
  kind: PromptGapKind
  cluster: Cluster
  label: string
  anchors: string[]
  draft: GeneratedPrompt
}

export interface PromptCoverage {
  covered: boolean
  summary: string
  gaps: PromptGap[]
}

type CoverageStudio = Pick<Studio, 'name' | 'services' | 'competitors' | 'keywords'>

function focusTag(asset: Asset): string {
  return asset.tags.map((item) => item.trim()).find((item) => item.length >= 2 && item.length <= 8 && !GENERIC_TAGS.has(item)) ?? ''
}

function assetAnchors(asset: Asset): string[] {
  if (asset.publicity === 'private') return []
  const anchors = new Set<string>()
  const tag = focusTag(asset)
  if (tag) anchors.add(tag)
  for (const tagItem of asset.tags) {
    const trimmed = tagItem.trim()
    if (trimmed.length >= 2 && trimmed.length <= 8 && !GENERIC_TAGS.has(trimmed)) anchors.add(trimmed)
  }
  const fields = [asset.title, asset.details.problem]
  if (asset.details.quoteAuthorized) fields.push(asset.details.quote)
  for (const field of fields) {
    for (const piece of phrasePieces(field)) {
      if (piece.length >= 4) anchors.add(piece)
    }
  }
  return [...anchors]
}

function assetBlob(asset: Asset): string {
  const metrics = asset.details.metrics.filter((item) => item.customerAuthorized)
  return [
    asset.title,
    asset.details.problem,
    asset.details.approach,
    asset.details.howItWorks,
    asset.details.industry,
    ...asset.tags,
    ...metrics.flatMap((item) => [item.name, item.source]),
    asset.details.quoteAuthorized ? asset.details.quote : '',
  ].join('\n')
}

function hits(corpus: string, anchors: string[]): boolean {
  return anchors.some((anchor) => anchor.length >= 2 && corpus.includes(anchor))
}

function keywordCovered(keyword: string, corpus: string, blob: string): boolean {
  const term = keyword.trim()
  if (term.length < 2) return true
  if (corpus.includes(term) || blob.includes(term)) return true
  // 长关键词用开头 2–4 个字对照已有题目，避免「尽调报告」「条款切分」再各出一题。
  const max = Math.min(4, term.length - 1)
  for (let len = max; len >= 2; len -= 1) {
    const prefix = term.slice(0, len)
    if (corpus.includes(prefix) || blob.includes(prefix)) return true
  }
  return false
}

function serviceCovered(service: string, corpus: string, blob: string, keywords: string[]): boolean {
  const trimmed = service.trim()
  if (trimmed.length < 2) return true
  if (keywords.some((keyword) => keyword.length >= 2 && trimmed.includes(keyword) && keywordCovered(keyword, corpus, blob))) return true
  const pieces = phrasePieces(trimmed).filter((piece) => piece.length >= 4)
  if (pieces.some((piece) => corpus.includes(piece) || blob.includes(piece))) return true
  return trimmed.length <= 18 && (corpus.includes(trimmed) || blob.includes(trimmed))
}

function usableDraft(draft: GeneratedPrompt): boolean {
  return draft.text.length >= 8 && draft.text.length <= 200
}

function assetGap(asset: Asset, anchors: string[]): PromptGap | null {
  const title = asset.title.trim()
  const problem = clipTheme(asset.details.problem)
  const approach = clipTheme(asset.details.approach || asset.details.howItWorks)
  const quote = asset.details.quoteAuthorized ? clipTheme(asset.details.quote, 40) : ''
  const focus = focusTag(asset)
  const label = focus || clipTheme(problem || title || quote, 12) || '素材'
  let draft: GeneratedPrompt | null = null
  if (problem) {
    const glue = focus && !problem.includes(focus) ? `，和「${focus}」有关时` : '，'
    draft = { cluster: 'scenario', text: `${problem}${glue}一般怎么处理？`, rationale: `盲区：素材「${title || label}」还没有对应的题` }
  } else if (quote) {
    draft = { cluster: 'scenario', text: `客户原话提到「${quote}」，这种情况一般怎么核对？`, rationale: `盲区：素材「${title || label}」还没有对应的题` }
  } else if (title) {
    draft = { cluster: 'scenario', text: `「${title}」适合用在什么情况下？`, rationale: `盲区：素材「${title}」还没有对应的题` }
  } else if (approach) {
    draft = { cluster: 'category', text: `${approach}，这样做通常在解决什么问题？`, rationale: `盲区：素材「${label}」还没有对应的题` }
  }
  if (!draft || !usableDraft(draft)) return null
  if (!hits(draft.text, anchors)) return null
  return { kind: 'asset', cluster: draft.cluster, label, anchors, draft }
}

function limitGaps(gaps: PromptGap[]): PromptGap[] {
  if (gaps.length <= MAX_NEW_PROMPTS) return gaps
  const score = (gap: PromptGap) => (gap.kind === 'asset' ? 0 : gap.kind === 'brand' || gap.kind === 'competitor' ? 1 : 2)
  return gaps
    .map((gap, index) => ({ gap, index }))
    .sort((a, b) => score(a.gap) - score(b.gap) || a.index - b.index)
    .slice(0, MAX_NEW_PROMPTS)
    .map((item) => item.gap)
}

export function assessPromptCoverage(studio: CoverageStudio, existing: string[], assets: Asset[] = []): PromptCoverage {
  const corpus = existing.join('\n')
  const gaps: PromptGap[] = []
  const seen = new Set(existing.map(normalizeQuestion))
  const push = (gap: PromptGap | null) => {
    if (!gap) return
    const key = normalizeQuestion(gap.draft.text)
    if (seen.has(key)) return
    seen.add(key)
    gaps.push(gap)
  }

  const coveredAssets: Asset[] = []
  const uncoveredAssets: Asset[] = []
  for (const asset of assets) {
    if (asset.publicity === 'private') continue
    const anchors = assetAnchors(asset)
    if (anchors.length === 0) continue
    if (hits(corpus, anchors)) coveredAssets.push(asset)
    else uncoveredAssets.push(asset)
  }
  for (const asset of uncoveredAssets) push(assetGap(asset, assetAnchors(asset)))

  const blob = coveredAssets.map(assetBlob).join('\n')
  const pendingBlob = uncoveredAssets.map(assetBlob).join('\n')
  const name = studio.name.trim()
  const brandCovered = name.length < 2 || corpus.includes(name)

  const competitors = studio.competitors.filter((item) => item.name.trim().length >= 2 || item.aliases.some((alias) => alias.trim().length >= 2))
  let competitorHits = 0
  for (const competitor of competitors) {
    const labels = [competitor.name, ...competitor.aliases].map((item) => item.trim()).filter((item) => item.length >= 2)
    if (labels.some((label) => corpus.includes(label))) {
      competitorHits += 1
      continue
    }
    const competitorName = competitor.name.trim() || labels[0] || ''
    if (!competitorName || !name) continue
    const draft: GeneratedPrompt = {
      cluster: 'comparison',
      text: `${name}和${competitorName}比，差别在哪里？`,
      rationale: `盲区：竞品${competitorName}还没有对比题`,
    }
    if (!usableDraft(draft)) continue
    push({ kind: 'competitor', cluster: 'comparison', label: competitorName, anchors: labels, draft })
  }

  const keywords = [...new Set(studio.keywords.map((item) => item.trim()).filter((item) => item.length >= 2))]
  for (const keyword of keywords) {
    if (keywordCovered(keyword, corpus, blob) || pendingBlob.includes(keyword)) continue
    const draft: GeneratedPrompt = {
      cluster: 'category',
      text: `做${keyword}时，通常先要弄清什么问题？`,
      rationale: `盲区：关键词${keyword}还没进题库`,
    }
    if (!usableDraft(draft)) continue
    push({ kind: 'keyword', cluster: 'category', label: keyword, anchors: [keyword], draft })
  }

  for (const service of studio.services) {
    const trimmed = service.trim()
    if (serviceCovered(trimmed, corpus, `${blob}\n${pendingBlob}`, keywords)) continue
    const clip = clipTheme(trimmed, 40)
    const draft: GeneratedPrompt = {
      cluster: 'scenario',
      text: `团队在做「${clip}」时，一般先确认什么？`,
      rationale: `盲区：服务「${clipTheme(trimmed, 18)}」还没进题库`,
    }
    if (!usableDraft(draft)) continue
    const anchors = [clip, ...phrasePieces(trimmed).filter((piece) => piece.length >= 4 && clip.includes(piece))]
    push({ kind: 'service', cluster: 'scenario', label: clipTheme(trimmed, 12), anchors: anchors.length > 0 ? anchors : [clip], draft })
  }

  if (!brandCovered) {
    const draft: GeneratedPrompt = {
      cluster: 'brand',
      text: `${name}是做什么的？适合哪类企业？`,
      rationale: '盲区：品牌名还没出现在题库',
    }
    push({ kind: 'brand', cluster: 'brand', label: name, anchors: [name], draft })
  }

  const kept = limitGaps(gaps)
  const themes: string[] = []
  for (const asset of coveredAssets) {
    for (const tag of asset.tags) {
      const trimmed = tag.trim()
      if (trimmed.length < 2 || trimmed.length > 8 || GENERIC_TAGS.has(trimmed) || !corpus.includes(trimmed) || themes.includes(trimmed)) continue
      themes.push(trimmed)
      if (themes.length >= 6) break
    }
    if (themes.length >= 6) break
  }
  const competitorsCovered = competitors.length > 0 && competitorHits === competitors.length
  const summary = kept.length === 0 ? coveredSummary(brandCovered, competitorsCovered, themes) : gapSummary(kept)
  return { covered: kept.length === 0, summary, gaps: kept }
}

function coveredSummary(brand: boolean, competitors: boolean, themes: string[]): string {
  const head: string[] = []
  if (brand) head.push('品牌')
  if (competitors) head.push('竞品')
  const themeText = themes.join('、')
  let detail = '已有题库里的问法'
  if (head.length > 0 && themeText) detail = `已有${head.join('、')}、以及${themeText}`
  else if (head.length > 0) detail = `已有${head.join('、')}`
  else if (themeText) detail = `已有${themeText}`
  return `题库已覆盖当前品牌和素材。${detail}。`
}

function gapSummary(gaps: PromptGap[]): string {
  const labels = gaps.map((gap) => gap.label).slice(0, 6).join('、')
  return labels ? `还有 ${gaps.length} 处没被题库盖住：${labels}。` : `还有 ${gaps.length} 处没被题库盖住。`
}

export function addedPromptSummary(prompts: GeneratedPrompt[], coverage: PromptCoverage): string {
  if (prompts.length === 0) return coverage.summary
  const labels: string[] = []
  for (const prompt of prompts) {
    const gap = coverage.gaps.find((item) => hits(prompt.text, item.anchors))
    if (gap && !labels.includes(gap.label)) labels.push(gap.label)
  }
  const detail = labels.slice(0, 6).join('、')
  return detail ? `补了 ${prompts.length} 道盲区题：${detail}。` : `补了 ${prompts.length} 道盲区题。`
}

export function selectGapPrompts(gaps: PromptGap[], accepted: GeneratedPrompt[]): GeneratedPrompt[] {
  const used = new Set<number>()
  const seen = new Set<string>()
  const picked: GeneratedPrompt[] = []
  for (const item of accepted) {
    if (picked.length >= MAX_NEW_PROMPTS) break
    const key = normalizeQuestion(item.text)
    if (seen.has(key) || !usableDraft(item)) continue
    const index = gaps.findIndex((gap, gapIndex) => !used.has(gapIndex) && hits(item.text, gap.anchors))
    if (index < 0) continue
    used.add(index)
    seen.add(key)
    picked.push({ cluster: item.cluster, text: item.text.trim(), rationale: item.rationale.trim() || gaps[index]?.draft.rationale || '' })
  }
  for (let index = 0; index < gaps.length && picked.length < MAX_NEW_PROMPTS; index += 1) {
    if (used.has(index)) continue
    const draft = gaps[index]?.draft
    if (!draft) continue
    const key = normalizeQuestion(draft.text)
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(draft)
  }
  return picked
}

export function assemblePromptGeneration(studio: PromptStudio, existing: string[], assets: Asset[]): { system: string; user: string } {
  const coverage = assessPromptCoverage(studio, existing, assets)
  const lines = promptAssetLines(assets)
  const system = [
    '你是 GEO/AEO 题库编辑，帮一个品牌准备要拿去问 ChatGPT、DeepSeek、豆包、Kimi 等回答引擎的中文问题。',
    '问题要像真实采购或研究者会问的话，不要写成广告。',
    '先看题库是否已经盖住品牌和素材。只为列出的盲区各写一题，不要为了凑数再写已经覆盖的题。',
    '场景题和品类题必须能用素材库里已经写下的问题、做法或标题来回答，用素材里已经出现的说法。',
    '品牌题和对比题留给监测，可以不贴某一条素材。',
    '只输出 JSON：{"prompts":[{"cluster":"brand|category|comparison|scenario","text":"...","rationale":"..."}]}',
  ].join('')
  const gapBlock = coverage.gaps.length
    ? `只补这些盲区，每处一题，写不到就少写，不要凑数量：\n${coverage.gaps
        .map((gap, index) => `${index + 1}. ${gap.label}（${gap.cluster}）。尽量用到这些说法：${gap.anchors.slice(0, 4).join('、')}`)
        .join('\n')}`
    : '当前题库已经盖住品牌和素材，不要新写题目。'
  const user = [
    `品牌：${studio.name}`,
    `官网：${studio.website}`,
    `定位：${studio.positioning}`,
    `服务：${studio.services.join('、') || '未填'}`,
    `竞品：${competitorNames(studio.competitors).join('、') || '未填'}`,
    `关键词：${studio.keywords.join('、') || '未填'}`,
    lines.length > 0
      ? `素材库（场景题和品类题要能被这些素材回答）：\n${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}`
      : '素材库：还没有可公开的素材。没有素材盲区时，不要另写场景题。',
    `已有题目，不要重复：${existing.join('；') || '无'}`,
    gapBlock,
    '品牌题必须出现品牌名称。对比题必须同时出现品牌名称和至少一个竞品。品类题不要塞进品牌名。',
  ].join('\n')
  return { system, user }
}

export function templatePrompts(studio: CoverageStudio, existing: string[], assets: Asset[] = []): GeneratedPrompt[] {
  return assessPromptCoverage(studio, existing, assets).gaps.map((gap) => gap.draft)
}

export function isCluster(value: string): value is Cluster {
  return value === 'brand' || value === 'category' || value === 'comparison' || value === 'scenario'
}
