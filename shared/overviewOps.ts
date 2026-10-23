import type { Asset } from './assets.ts'
import { channelLabel } from './drafts.ts'
import { platformLabel } from './platforms.ts'
import { assessPromptCoverage, assetGapLabel, uncoveredAssets } from './prompts.ts'
import type { ContentDraft, Cycle, Observation, OpsAction, OpsActivity, OpsCockpit, Prompt, Studio } from './types.ts'

const MAX_ACTIONS = 4
const MAX_RECENT = 4

type OpsStudio = Pick<Studio, 'name' | 'services' | 'competitors' | 'keywords'>
type OpsPrompt = Pick<Prompt, 'id' | 'text' | 'cluster'>
type OpsDraft = Pick<ContentDraft, 'id' | 'title' | 'channel' | 'updatedAt'>
type OpsObservation = Pick<Observation, 'id' | 'promptId' | 'promptText' | 'brandMentioned' | 'createdAt' | 'cycleId' | 'cycleName' | 'platform'>
type OpsCycle = Pick<Cycle, 'id' | 'name' | 'createdAt'>

export interface OpsInput {
  studio: OpsStudio
  assets: Asset[]
  prompts: OpsPrompt[]
  drafts: OpsDraft[]
  observations: OpsObservation[]
  cycles: OpsCycle[]
}

function clip(text: string, max = 42): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

function labelsOf(assets: Asset[]): string {
  const labels = assets.map(assetGapLabel).filter(Boolean).slice(0, 3)
  const extra = assets.length > labels.length ? '等' : ''
  return labels.length > 0 ? `${labels.join('、')}${extra}` : '这些素材'
}

function hasAnchors(asset: Asset): boolean {
  return uncoveredAssets([], [asset]).length > 0
}

export function buildOpsCockpit(input: OpsInput): OpsCockpit {
  const writable = input.assets.filter((asset) => asset.publicity !== 'private')
  const products = writable.filter((asset) => asset.type === 'product').length
  const cases = writable.filter((asset) => asset.type === 'case').length
  const promptTexts = input.prompts.map((item) => item.text)
  const uncovered = uncoveredAssets(promptTexts, input.assets)
  const uncoveredIds = new Set(uncovered.map((asset) => asset.id))
  const hasWritableMatch = writable.some((asset) => hasAnchors(asset) && !uncoveredIds.has(asset.id))
  const fieldGaps = assessPromptCoverage(input.studio, promptTexts, input.assets).gaps.filter((gap) => gap.kind !== 'asset')
  const orderedCycles = [...input.cycles].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const latestCycle = orderedCycles.at(-1) ?? null
  const pool = latestCycle ? input.observations.filter((item) => item.cycleId === latestCycle.id) : input.observations
  const mentionedPrompts = new Set(pool.filter((item) => item.brandMentioned).map((item) => item.promptId)).size
  const mentionRate = pool.length > 0 ? pool.filter((item) => item.brandMentioned).length / pool.length : null
  const empty = writable.length === 0 && input.prompts.length === 0 && input.drafts.length === 0 && input.observations.length === 0

  const actions: OpsAction[] = []
  const push = (action: OpsAction) => {
    if (actions.length >= MAX_ACTIONS || actions.some((item) => item.id === action.id)) return
    actions.push(action)
  }

  if (empty) {
    push({
      id: 'start',
      title: '先加产品或案例素材',
      detail: '先把产品和客户场景放进素材库，再到题库评估并补盲区，然后起草。',
      href: '/library',
      cta: '去素材库',
    })
  } else {
    if (writable.length === 0) {
      push({
        id: 'assets',
        title: '还没有可公开素材',
        detail: '起草要用产品和案例。标成不可公开的素材不会拿来出题。',
        href: '/library',
        cta: '去素材库',
      })
    }
    if (uncovered.length > 0) {
      push({
        id: 'coverage',
        title: `${uncovered.length} 条素材还没有对应的题`,
        detail: `「${labelsOf(uncovered)}」还没进题库。到题库点评估并补盲区，只补这些缺口。`,
        href: '/prompts',
        cta: '去题库',
      })
    } else if (input.prompts.length === 0 && writable.length > 0) {
      push({
        id: 'prompts',
        title: '题库还是空的',
        detail: '素材已经在库里。到题库评估并补盲区，按缺口出题。',
        href: '/prompts',
        cta: '去题库',
      })
    } else if (fieldGaps.length > 0) {
      push({
        id: 'brand-gaps',
        title: '品牌资料里还有题库没写到的说法',
        detail: `${fieldGaps.map((gap) => gap.label).slice(0, 3).join('、')}。到题库评估并补盲区。`,
        href: '/prompts',
        cta: '去题库',
      })
    } else if (input.prompts.length > 0 && writable.length > 0 && !hasWritableMatch) {
      push({
        id: 'unmatched',
        title: '有题，但没有能写进稿子的素材',
        detail: '现有题目对不上可公开素材的标题、标签或问题。先补产品或案例。',
        href: '/library',
        cta: '去素材库',
      })
    }
    if (writable.length > 0 && products === 0 && cases === 0) {
      push({
        id: 'product-case',
        title: '还没有产品或案例',
        detail: '起草时要配产品说明和客户场景。可以先把这两类写进素材库。',
        href: '/library',
        cta: '去素材库',
      })
    }
    if (writable.length > 0 && input.prompts.length > 0 && input.drafts.length === 0) {
      push({
        id: 'draft',
        title: '有素材也有题，还没有草稿',
        detail: '选产品和案例，按发布平台起草。生成后看关键词落在哪一段。发布在站外完成。',
        href: '/drafts/new',
        cta: '去起草',
      })
    }
    if (input.drafts.length > 0 && input.observations.length === 0) {
      push({
        id: 'monitor',
        title: '已有草稿，监测里还没有观察',
        detail: '稿子发布后，把回答引擎的回复贴回监测，才能看到这些题有没有被提到。',
        href: '/monitor',
        cta: '去监测',
      })
    }
    if (actions.length === 0) {
      push({
        id: 'steady',
        title: '这一圈目前没有明显缺口',
        detail: '素材、题库和草稿都在。可以再写一篇，或把新的回答贴进监测。',
        href: '/drafts/new',
        cta: '再写一篇',
      })
    }
  }

  const recent: OpsActivity[] = [
    ...input.drafts.map((draft) => ({
      id: draft.id,
      kind: 'draft' as const,
      title: clip(draft.title || '未命名草稿'),
      detail: `草稿 · ${channelLabel(draft.channel)}`,
      href: `/drafts/${draft.id}`,
      at: draft.updatedAt,
    })),
    ...input.observations.map((item) => ({
      id: item.id,
      kind: 'observation' as const,
      title: clip(item.promptText || '一条监测'),
      detail: `${platformLabel(item.platform)} · ${item.brandMentioned ? '提到了品牌' : '没提到品牌'}`,
      href: '/monitor',
      at: item.createdAt,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_RECENT)

  return {
    empty,
    counts: {
      publicAssets: writable.length,
      products,
      cases,
      prompts: input.prompts.length,
      drafts: input.drafts.length,
      mentionedPrompts,
      mentionRate,
      cycleName: latestCycle?.name ?? '',
    },
    actions,
    recent,
  }
}
