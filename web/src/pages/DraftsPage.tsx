import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, Layout, LayoutContent, LayoutFooter, LayoutPanel, VStack } from '@astryxdesign/core/Layout'
import { Section } from '@astryxdesign/core/Section'
import { Selector } from '@astryxdesign/core/Selector'
import { StackItem } from '@astryxdesign/core/Stack'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import * as stylex from '@stylexjs/stylex'
import { CONTENT_TYPES, IMPLANT_LEVELS, SOFT_IMPLANT_HINT, channelForContentType, contentTypeForAsset, type BrandMention, type ContentType, type DraftLength } from '../../../shared/draftPrompt.ts'
import { recommendDraftSelection, type PromptMention } from '../../../shared/recommendDraft.ts'
import { ASSET_TYPES, assetTypeLabel, publicityLabel, type Asset, type Publicity } from '../../../shared/assets.ts'
import { plainTextFromRich } from '../../../shared/richText.ts'
import { channelLabel, DRAFT_CHANNELS, formatDraftForCopy } from '../../../shared/drafts.ts'
import { SOURCE_LABEL } from '../../../shared/platforms.ts'
import type { ContentDraft, Diagnosis, DraftChannel, DraftPreview, Prompt } from '../../../shared/types.ts'
import { api } from '../api'
import { formatTime } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, InfoBanner, PageFrame, WarningBanner } from '../ui'

const styles = stylex.create({
  page: {
    height: '100%',
    minHeight: 0,
  },
  grow: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  workspace: {
    flexGrow: 1,
    minHeight: 0,
    height: '100%',
  },
  fill: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
})

interface AssetPickRow extends Record<string, unknown> {
  id: string
  title: string
  typeLabel: string
  publicityLabel: string
  publicity: Publicity
  disabled: boolean
}

function useNarrow(query = '(max-width: 900px)') {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setNarrow(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return narrow
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function publicityVariant(value: Publicity): 'success' | 'warning' | 'neutral' {
  if (value === 'public') return 'success'
  if (value === 'anonymous') return 'warning'
  return 'neutral'
}

export function DraftsPage() {
  const navigate = useNavigate()
  const narrow = useNarrow()
  const { studioId, studio, llm } = useStudio()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [mentions, setMentions] = useState<PromptMention[]>([])
  const [autoLinked, setAutoLinked] = useState(false)
  const appliedRecommendation = useRef('')
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [drafts, setDrafts] = useState<ContentDraft[]>([])
  const [channel, setChannel] = useState<DraftChannel>('product-promo')
  const [contentType, setContentType] = useState<ContentType>('case-breakdown')
  const [assetIds, setAssetIds] = useState<string[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerIds, setPickerIds] = useState<string[]>([])
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerType, setPickerType] = useState('')
  const [brandMention, setBrandMention] = useState<BrandMention>('none')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState('')
  const [length, setLength] = useState<DraftLength>('medium')
  const [missing, setMissing] = useState<string[]>([])
  const [flags, setFlags] = useState<string[]>([])
  const [promptId, setPromptId] = useState('')
  const [diagnosisId, setDiagnosisId] = useState('')
  const [gapId, setGapId] = useState('')
  const [preview, setPreview] = useState<DraftPreview | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [cites, setCites] = useState('')
  const [urlHint, setUrlHint] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState<ContentDraft | null>(null)
  const [editChannel, setEditChannel] = useState<DraftChannel>('product-promo')
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editCites, setEditCites] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [libraryPin, setLibraryPin] = useState('')
  const { draftId } = useParams()
  const openedDraft = useRef('')
  const [searchParams] = useSearchParams()
  const presetAsset = searchParams.get('asset')
  const handledPreset = useRef('')

  const load = async (id: string) => {
    const [promptPayload, diagnosisPayload, draftPayload, assetPayload, observationPayload] = await Promise.all([
      api<{ prompts: Prompt[] }>(`/api/studios/${id}/prompts`),
      api<{ diagnoses: Diagnosis[] }>(`/api/studios/${id}/diagnoses`),
      api<{ drafts: ContentDraft[] }>(`/api/studios/${id}/drafts`),
      api<{ assets: Asset[] }>(`/api/studios/${id}/assets`),
      api<{ observations: Array<{ promptId: string; brandMentioned: boolean }> }>(`/api/studios/${id}/observations`).catch(() => ({
        observations: [],
      })),
    ])
    setPrompts(promptPayload.prompts)
    setMentions(observationPayload.observations.map((item) => ({ promptId: item.promptId, mentioned: item.brandMentioned })))
    setDiagnoses(diagnosisPayload.diagnoses)
    setDrafts(draftPayload.drafts)
    setAssets(assetPayload.assets)
  }

  useEffect(() => {
    if (!studioId) return
    appliedRecommendation.current = ''
    setPreview(null)
    setSaved(false)
    setEditing(null)
    setAssets([])
    setAssetIds([])
    setAutoLinked(false)
    setLibraryPin('')
    handledPreset.current = ''
    openedDraft.current = ''
    load(studioId).catch((err: unknown) => setError(err instanceof Error ? err.message : '草稿加载失败'))
  }, [studioId])

  useEffect(() => {
    if (!draftId || drafts.length === 0 || openedDraft.current === draftId) return
    const found = drafts.find((item) => item.id === draftId)
    if (!found) {
      setError('没有找到这篇草稿')
      return
    }
    openedDraft.current = draftId
    setEditing(found)
    setEditChannel(found.channel)
    setEditTitle(found.title)
    setEditBody(found.body)
    setEditCites(found.citeSentences.join('\n'))
    setEditUrl(found.urlHint)
    setPreview(null)
  }, [draftId, drafts])

  useEffect(() => {
    if (!editing || !narrow) return
    document.getElementById('draft-editor')?.scrollIntoView({ block: 'start' })
  }, [editing?.id, narrow])

  const selectedDiagnosis = diagnoses.find((item) => item.id === diagnosisId)
  const gaps = selectedDiagnosis?.checklist.filter((item) => item.status !== 'pass') ?? []
  const recommendation = useMemo(() => {
    if (!studio) return { assetIds: [] as string[], rankedIds: [] as string[], promptId: null as string | null }
    return recommendDraftSelection({ contentType, assets, studio, prompts, mentions })
  }, [studio, contentType, assets, prompts, mentions])
  const recommendedPrompt = prompts.find((item) => item.id === recommendation.promptId) ?? null

  useEffect(() => {
    if (!presetAsset || !studio || assets.length === 0) return
    const token = `${studio.id}:${presetAsset}`
    if (handledPreset.current === token) return
    handledPreset.current = token
    const asset = assets.find((item) => item.id === presetAsset)
    navigate('/drafts/new', { replace: true })
    if (!asset) {
      setNotice('没有找到这条素材。')
      return
    }
    if (asset.publicity === 'private') {
      setNotice('这条素材不可公开，起草时不能勾选。')
      return
    }
    const hinted = contentTypeForAsset(asset.type)
    setContentType(hinted)
    setChannel(channelForContentType(hinted))
    setLibraryPin(asset.id)
    appliedRecommendation.current = ''
  }, [presetAsset, studio, assets, navigate])

  useEffect(() => {
    if (!studio || assets.length === 0) return
    const key = `${studio.id}:${contentType}:${assets.map((item) => item.id).join(',')}:${libraryPin}`
    if (appliedRecommendation.current === key) return
    appliedRecommendation.current = key
    const next = recommendDraftSelection({ contentType, assets, studio, prompts, mentions })
    const cap = contentType === 'short-post' || contentType === 'thread' ? 2 : 5
    const pinned = libraryPin ? assets.find((item) => item.id === libraryPin && item.publicity !== 'private') : undefined
    const ids = pinned ? [pinned.id, ...next.assetIds.filter((id) => id !== pinned.id)].slice(0, cap) : next.assetIds
    setAssetIds(ids)
    if (brandMention === 'none') {
      setPromptId('')
      setAutoLinked(false)
      return
    }
    setPromptId(next.promptId ?? '')
    setAutoLinked(Boolean(next.promptId))
  }, [studio, contentType, assets, prompts, mentions, libraryPin])

  const rerank = () => {
    if (!studio) return
    setLibraryPin('')
    const next = recommendDraftSelection({ contentType, assets, studio, prompts, mentions })
    setAssetIds(next.assetIds)
    if (brandMention === 'none') {
      setPromptId('')
      setAutoLinked(false)
      return
    }
    setPromptId(next.promptId ?? '')
    setAutoLinked(Boolean(next.promptId))
  }

  const recommendedAssets = recommendation.assetIds
    .slice(0, 5)
    .map((id) => assets.find((item) => item.id === id))
    .filter((item): item is Asset => Boolean(item))
  const checklist = [
    ...recommendedAssets,
    ...assetIds
      .filter((id) => !recommendedAssets.some((item) => item.id === id))
      .map((id) => assets.find((item) => item.id === id))
      .filter((item): item is Asset => Boolean(item)),
  ]
  const pickerRank = new Map(recommendation.rankedIds.map((id, index) => [id, index]))
  const pickerQueryText = pickerQuery.trim()
  const pickerRows: AssetPickRow[] = assets
    .filter((item) => (pickerType ? item.type === pickerType : true))
    .filter((item) => {
      if (!pickerQueryText) return true
      const haystack = `${item.title} ${plainTextFromRich(item.body)} ${item.tags.join(' ')} ${assetTypeLabel(item.type)}`
      return haystack.includes(pickerQueryText)
    })
    .sort((a, b) => {
      const aPrivate = a.publicity === 'private' ? 1 : 0
      const bPrivate = b.publicity === 'private' ? 1 : 0
      if (aPrivate !== bPrivate) return aPrivate - bPrivate
      return (pickerRank.get(a.id) ?? 999) - (pickerRank.get(b.id) ?? 999)
    })
    .map((item) => ({
      id: item.id,
      title: item.title,
      typeLabel: assetTypeLabel(item.type),
      publicityLabel: publicityLabel(item.publicity),
      publicity: item.publicity,
      disabled: item.publicity === 'private',
    }))

  const toggleAsset = (id: string, checked: boolean) => {
    setAssetIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id]
      return current.filter((item) => item !== id)
    })
  }

  const openPicker = () => {
    setPickerIds(assetIds)
    setPickerQuery('')
    setPickerType('')
    setPickerOpen(true)
  }

  const applyPicker = () => {
    const allowed = new Set(assets.filter((item) => item.publicity !== 'private').map((item) => item.id))
    setAssetIds(pickerIds.filter((id) => allowed.has(id)))
    setPickerOpen(false)
  }

  const generate = async () => {
    if (!studioId) return
    setGenerating(true)
    setError('')
    setNotice('')
    try {
      const result = await api<{ draft: DraftPreview; gaps?: string[]; flags?: string[] }>(`/api/studios/${studioId}/drafts/generate`, {
        method: 'POST',
        body: JSON.stringify({
          channel,
          contentType,
          audience,
          tone,
          length,
          brandMention,
          assetIds,
          promptId: promptId || null,
          diagnosisId: diagnosisId || null,
          gapId: gapId || null,
        }),
      })
      setEditing(null)
      setPreview(result.draft)
      setTitle(result.draft.title)
      setBody(result.draft.body)
      setCites(result.draft.citeSentences.join('\n'))
      setUrlHint(result.draft.urlHint)
      setMissing(result.gaps ?? [])
      setFlags(result.flags ?? [])
      setSaved(false)
      setNotice(result.draft.source === 'deepseek' ? '模型按品牌资料改写了这篇草稿。' : '已按品牌资料套用模板。请先核对，再复制到你自己的站点。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const currentBrief = () => ({
    title: title.trim(),
    body: body.trim(),
    citeSentences: splitLines(cites),
    urlHint: urlHint.trim(),
  })

  const editingBrief = () => ({
    title: editTitle.trim(),
    body: editBody.trim(),
    citeSentences: splitLines(editCites),
    urlHint: editUrl.trim(),
  })

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setNotice('已复制。请贴到你自己的官网或账号，这里不会发布。')
      setError('')
    } catch {
      setError('浏览器没有允许写入剪贴板。草稿还在页面上，可以手动选择正文。')
    }
  }

  const save = async () => {
    if (!studioId || !preview) return
    setSaving(true)
    setError('')
    try {
      const brief = currentBrief()
      const result = await api<{ draft: ContentDraft }>(`/api/studios/${studioId}/drafts`, {
        method: 'POST',
        body: JSON.stringify({
          ...brief,
          channel: preview.channel,
          source: preview.source,
          promptId: preview.promptId,
          promptText: preview.promptText,
          diagnosisId: preview.diagnosisId,
          gapLabel: preview.gapLabel,
        }),
      })
      setSaved(true)
      setNotice('已保存。发布仍由你自己完成。')
      openedDraft.current = result.draft.id
      navigate(`/drafts/${result.draft.id}`)
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async () => {
    if (!studioId || !editing) return
    setEditSaving(true)
    setError('')
    try {
      const result = await api<{ draft: ContentDraft }>(`/api/studios/${studioId}/drafts/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          channel: editChannel,
          title: editTitle.trim(),
          body: editBody.trim(),
          citeSentences: splitLines(editCites),
          urlHint: editUrl.trim(),
        }),
      })
      setEditing(result.draft)
      setEditChannel(result.draft.channel)
      setEditTitle(result.draft.title)
      setEditBody(result.draft.body)
      setEditCites(result.draft.citeSentences.join('\n'))
      setEditUrl(result.draft.urlHint)
      setNotice('已保存修改。刷新页面后仍是这篇新内容。')
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setEditSaving(false)
    }
  }

  const renderAssetTable = (list: AssetPickRow[]) => (
    <Table
      data={list}
      idKey="id"
      density="compact"
      hasHover
      verticalAlign="middle"
      columns={[
        {
          key: 'id',
          header: '选',
          width: pixel(56),
          renderCell: (row) => (
            <CheckboxInput
              label={`选用${row.title}`}
              isLabelHidden
              value={pickerIds.includes(row.id)}
              isDisabled={row.disabled}
              disabledMessage={row.disabled ? '不可公开，不能用于起草' : undefined}
              onChange={(checked) => {
                setPickerIds((current) => {
                  if (checked) return current.includes(row.id) ? current : [...current, row.id]
                  return current.filter((id) => id !== row.id)
                })
              }}
            />
          ),
        },
        {
          key: 'typeLabel',
          header: '类型',
          width: pixel(88),
          renderCell: (row) => <Badge variant="info" label={row.typeLabel} />,
        },
        { key: 'title', header: '标题', width: proportional(2, { minWidth: 96 }) },
        {
          key: 'publicityLabel',
          header: '公开',
          width: pixel(88),
          renderCell: (row) => <Badge variant={publicityVariant(row.publicity)} label={row.publicityLabel} />,
        },
      ]}
    />
  )

  const generateButton = (
    <Button label="生成草稿" variant="primary" width="100%" onClick={() => void generate()} isLoading={generating} isDisabled={!studioId} />
  )

  const configFields = (
    <VStack gap={3}>
      <Heading level={2}>配置</Heading>
      <Collapsible defaultIsOpen={false} trigger="品牌边界">
        <VStack gap={2}>
          <Text color="secondary">语气、禁用词和合规红线来自品牌页。案例、产品和数据成效在下面勾选。</Text>
          <Text>{studio?.voice?.trim() ? `语气：${studio.voice.trim()}` : '还没有写品牌语气。'}</Text>
          <Text>{studio?.bannedWords?.trim() ? `禁用词：${studio.bannedWords.trim()}` : '没有禁用词。'}</Text>
          <Text>{studio?.compliance?.trim() ? `合规红线：${studio.compliance.trim()}` : '没有额外合规红线。'}</Text>
          <HStack gap={2} wrap="wrap">
            <Button label="打开素材库" size="sm" variant="secondary" onClick={() => navigate('/library')} />
            <Button label="到品牌里修改" size="sm" variant="secondary" onClick={() => navigate('/studio')} />
          </HStack>
        </VStack>
      </Collapsible>
      <Selector
        label="内容类型"
        value={contentType}
        options={CONTENT_TYPES.map((item) => ({ value: item.id, label: item.label }))}
        onChange={(value) => {
          const next = CONTENT_TYPES.find((item) => item.id === value)
          if (!next) return
          setLibraryPin('')
          setContentType(next.id)
          setChannel(channelForContentType(next.id))
        }}
      />
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Heading level={3}>推荐素材</Heading>
          <Button label="重新推荐" size="sm" variant="ghost" onClick={rerank} isDisabled={!studio || assets.length === 0} />
        </HStack>
        <Text color="secondary">已按内容类型推荐，可取消勾选或打开素材库另选</Text>
        {checklist.length === 0 ? (
          <Text color="secondary">这一类型还没有可公开的素材。</Text>
        ) : (
          <VStack gap={2}>
            {checklist.map((item) => (
              <HStack key={item.id} gap={2} vAlign="center">
                <CheckboxInput
                  label={`选用${item.title}`}
                  isLabelHidden
                  value={assetIds.includes(item.id)}
                  onChange={(checked) => toggleAsset(item.id, checked)}
                />
                <Badge variant="info" label={assetTypeLabel(item.type)} />
                <StackItem size="fill">
                  <Text>{item.title}</Text>
                </StackItem>
                {item.publicity === 'anonymous' ? <Badge variant="warning" label="匿名" /> : null}
              </HStack>
            ))}
          </VStack>
        )}
        <Button label="从素材库挑选" size="sm" variant="secondary" onClick={openPicker} />
      </VStack>
      {brandMention !== 'none' && recommendedPrompt && promptId === recommendedPrompt.id ? (
        <Text color="secondary">已按内容类型推荐：{recommendedPrompt.text}</Text>
      ) : null}
      <Selector
        label="渠道"
        description="决定建议落到官网的哪一类页面。内容类型会先带一个默认渠道。"
        value={channel}
        options={DRAFT_CHANNELS.map((item) => ({ value: item.id, label: item.label, description: item.hint }))}
        onChange={(value) => {
          const next = DRAFT_CHANNELS.find((item) => item.id === value)
          if (next) setChannel(next.id)
        }}
      />
      <Selector
        label="植入强度"
        description="默认不植入，只写素材里的事。软植入仍是故事，最多在结尾提一次品牌；明确种草才写下一步。不是每篇都要种草。"
        value={brandMention}
        options={IMPLANT_LEVELS.map((item) => ({ value: item.id, label: item.label, description: item.description }))}
        onChange={(value) => {
          if (value !== 'none' && value !== 'light' && value !== 'guide') return
          setBrandMention(value)
          if (value === 'none') {
            if (autoLinked) {
              setPromptId('')
              setAutoLinked(false)
            }
            return
          }
          if (!promptId && recommendation.promptId) {
            setPromptId(recommendation.promptId)
            setAutoLinked(true)
          }
        }}
      />
      <Text color="secondary">软植入从素材写故事，只在叙述里悄悄放进一两句可引用的事实，不要改成广告。</Text>
      {brandMention === 'light' && promptId ? <Text color="secondary">{SOFT_IMPLANT_HINT}</Text> : null}
      <TextInput label="目标读者" description="可空。不填就用品牌资料里的客户画像。" value={audience} onChange={setAudience} width="100%" />
      <TextInput label="语气" description="可空。不填就用品牌语气。" value={tone} onChange={setTone} width="100%" />
      <Selector
        label="长度"
        value={length}
        options={[
          { value: 'short', label: '短' },
          { value: 'medium', label: '中' },
          { value: 'long', label: '长' },
        ]}
        onChange={(value) => {
          if (value === 'short' || value === 'medium' || value === 'long') setLength(value)
        }}
      />
      <Collapsible defaultIsOpen={false} trigger="高级">
        <VStack gap={3}>
          <Text color="secondary">关联题目、诊断和缺口。不选也能生成。</Text>
          <Selector
            label="关联题目"
            description="可选。不植入时不会写进正文。软植入只把它当作故事里的一个角度。"
            value={promptId}
            hasSearch
            options={[{ value: '', label: '不关联题目' }, ...prompts.map((item) => ({ value: item.id, label: item.text }))]}
            onChange={(value) => {
              const next = value || ''
              setPromptId(next)
              setAutoLinked(Boolean(next) && next === recommendation.promptId)
            }}
          />
          {promptId && promptId === recommendation.promptId ? <Text color="secondary">已按内容类型推荐</Text> : null}
          {brandMention === 'light' && promptId ? <Text color="secondary">{SOFT_IMPLANT_HINT}</Text> : null}
          {brandMention === 'none' && promptId ? <Text color="secondary">不植入时，这道题不会写进正文。</Text> : null}
          <Selector
            label="关联诊断"
            description="可选。选一次诊断后，可以指定一个未通过的检查项。"
            value={diagnosisId}
            options={[
              { value: '', label: '不关联诊断' },
              ...diagnoses.map((item) => ({
                value: item.id,
                label: `${formatTime(item.createdAt)} ${item.finalUrl || item.url}`,
              })),
            ]}
            onChange={(value) => {
              setDiagnosisId(value || '')
              setGapId('')
            }}
          />
          <Selector
            label="诊断缺口"
            value={gapId}
            isDisabled={!diagnosisId}
            options={[{ value: '', label: '不指定缺口' }, ...gaps.map((item) => ({ value: item.id, label: item.label, description: item.detail }))]}
            onChange={(value) => setGapId(value || '')}
          />
        </VStack>
      </Collapsible>
    </VStack>
  )

  const bodyArea = (props: { value: string; onChange: (value: string) => void }) => (
    <StackItem size="fill" xstyle={styles.fill}>
      <div className="citepilot-draft-body">
        <TextArea label="正文" value={props.value} onChange={props.onChange} rows={8} width="100%" />
      </div>
    </StackItem>
  )

  const editor = editing ? (
    <VStack gap={3} height="100%" minHeight={0}>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Badge variant="info" label="已保存草稿" />
        <Heading level={2}>编辑草稿</Heading>
      </HStack>
      <Text color="secondary">
        创建于 {formatTime(editing.createdAt)} · 最后编辑 {formatTime(editing.updatedAt)}
        {editing.promptText ? ` · 题目：${editing.promptText}` : ''}
        {editing.gapLabel ? ` · 缺口：${editing.gapLabel}` : ''}
      </Text>
      <HStack gap={2} wrap="wrap">
        <Button label="保存修改" variant="primary" onClick={() => void saveEdit()} isLoading={editSaving} />
        <Button label="复制全文" variant="secondary" onClick={() => void copyText(formatDraftForCopy(editingBrief()))} />
        <Button label="返回列表" variant="ghost" onClick={() => navigate('/drafts')} />
      </HStack>
      <Selector
        label="渠道"
        value={editChannel}
        options={DRAFT_CHANNELS.map((item) => ({ value: item.id, label: item.label, description: item.hint }))}
        onChange={(value) => {
          const next = DRAFT_CHANNELS.find((item) => item.id === value)
          if (next) setEditChannel(next.id)
        }}
      />
      <TextInput label="标题" value={editTitle} onChange={setEditTitle} width="100%" />
      {bodyArea({ value: editBody, onChange: setEditBody })}
      <TextArea label="建议被引用的句子" description="一行一句。" value={editCites} onChange={setEditCites} rows={4} width="100%" />
      <TextInput label="建议落地网址" value={editUrl} onChange={setEditUrl} width="100%" />
    </VStack>
  ) : preview ? (
    <VStack gap={3} height="100%" minHeight={0}>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Badge variant="neutral" label="生成预览" />
        <Heading level={2}>草稿</Heading>
      </HStack>
      {missing.length > 0 ? <WarningBanner title="信息不足" description={missing.join(' ')} /> : null}
      {flags.length > 0 ? (
        <VStack gap={2}>
          <InfoBanner title="已标出空话" description="套话已改成资料里的事实，或换成【待补充】。发布前请补上这些空位。" />
          {flags.map((flag) => (
            <Text key={flag} color="secondary">
              {flag}
            </Text>
          ))}
        </VStack>
      ) : null}
      <Text color="secondary">
        {channelLabel(preview.channel)} · {SOURCE_LABEL[preview.source] ?? preview.source}
        {preview.promptText ? ` · 题目：${preview.promptText}` : ''}
        {preview.gapLabel ? ` · 缺口：${preview.gapLabel}` : ''}
      </Text>
      <HStack gap={2} wrap="wrap">
        <Button label="复制全文" variant="secondary" onClick={() => void copyText(formatDraftForCopy(currentBrief()))} />
        <Button label={saved ? '已保存' : '保存草稿'} variant="primary" onClick={() => void save()} isLoading={saving} isDisabled={saved} />
      </HStack>
      <TextInput
        label="标题"
        value={title}
        onChange={(value) => {
          setTitle(value)
          setSaved(false)
        }}
        width="100%"
      />
      {bodyArea({
        value: body,
        onChange: (value) => {
          setBody(value)
          setSaved(false)
        },
      })}
      <TextArea
        label="建议被引用的句子"
        description="一行一句。回答引擎适合整句引用，所以每句都带上品牌名称。"
        value={cites}
        onChange={(value) => {
          setCites(value)
          setSaved(false)
        }}
        rows={4}
        width="100%"
      />
      <TextInput
        label="建议落地网址"
        description="发布时把这段内容放在你自己的这个地址上。"
        value={urlHint}
        onChange={(value) => {
          setUrlHint(value)
          setSaved(false)
        }}
        width="100%"
      />
    </VStack>
  ) : (
    <VStack gap={3} height="100%" minHeight={0}>
      <Heading level={2}>草稿</Heading>
      <EmptyState
        title={narrow ? '先在上方选素材并生成' : '先在左侧选素材并生成'}
        description="选好内容类型和可公开的素材，再点生成草稿。标题和正文会出现在这里，改完再保存。"
      />
    </VStack>
  )

  const workspace = narrow ? (
    <VStack gap={4}>
      <Section>
        <VStack gap={3}>
          {configFields}
          {generateButton}
        </VStack>
      </Section>
      <Section id="draft-editor">{editor}</Section>
    </VStack>
  ) : (
    <Layout
      height="fill"
      xstyle={styles.workspace}
      start={
        <LayoutPanel width={380} hasDivider isScrollable={false} label="起草配置" padding={0}>
          <Layout height="fill" content={<LayoutContent>{configFields}</LayoutContent>} footer={<LayoutFooter>{generateButton}</LayoutFooter>} />
        </LayoutPanel>
      }
      content={
        <LayoutContent padding={0} isScrollable={false}>
          <Section id="draft-editor" height="100%">
            {editor}
          </Section>
        </LayoutContent>
      }
    />
  )

  return (
    <PageFrame
      title={draftId ? '编辑草稿' : '新建草稿'}
      description="故事优先，不硬广，不凑字。按渠道起草，发布在站外完成。"
    >
      <VStack gap={3} height="100%" xstyle={styles.page}>
        <HStack gap={2} vAlign="center">
          <Button label="← 内容起草" size="sm" variant="ghost" onClick={() => navigate('/drafts')} />
        </HStack>
        <ErrorBanner message={error} />
        {notice ? <InfoBanner title={notice} /> : null}
        {llm && !llm.enabled ? (
          <InfoBanner title="当前使用品牌资料模板" description="没有模型密钥时，草稿按渠道套模板。到「设置」配上密钥后，模型会在同一份事实边界里改写。" />
        ) : null}
        <StackItem size="fill" xstyle={styles.grow}>
          {workspace}
        </StackItem>
      </VStack>
      <Dialog isOpen={pickerOpen} onOpenChange={setPickerOpen} width={760} maxHeight="80dvh" purpose="form">
        <Layout
          height="fill"
          header={<DialogHeader title="从素材库挑选" subtitle="勾选后点确定。不可公开的素材不能用来起草。" onOpenChange={setPickerOpen} />}
          content={
            <LayoutContent>
              <VStack gap={3}>
                <HStack gap={2} wrap="wrap" vAlign="end">
                  <StackItem size="fill">
                    <TextInput label="搜索" value={pickerQuery} onChange={setPickerQuery} width="100%" />
                  </StackItem>
                  <Selector
                    label="类型"
                    value={pickerType}
                    options={[{ value: '', label: '全部类型' }, ...ASSET_TYPES.map((item) => ({ value: item.id, label: item.label }))]}
                    onChange={(value) => setPickerType(value || '')}
                  />
                </HStack>
                {pickerRows.length === 0 ? <Text color="secondary">没有符合的素材。</Text> : renderAssetTable(pickerRows)}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} vAlign="center">
                <Button label="去素材库" variant="ghost" onClick={() => navigate('/library')} />
                <StackItem size="fill" />
                <Button label="取消" variant="secondary" onClick={() => setPickerOpen(false)} />
                <Button label="确定" variant="primary" onClick={applyPicker} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
      <style>{`.citepilot-draft-body{height:100%;min-height:0;display:flex;flex-direction:column}.citepilot-draft-body>div{flex:1 1 auto;min-height:0;height:100%}.citepilot-draft-body>div>div:last-child{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}.citepilot-draft-body>div>div:last-child>div{flex:1 1 auto;min-height:120px;display:flex;flex-direction:column}.citepilot-draft-body textarea{flex:1 1 auto;min-height:0;height:auto;resize:none}`}</style>
    </PageFrame>
  )
}
