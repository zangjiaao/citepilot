import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
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
import type { DraftChatTurn } from '../../../shared/draftChat.ts'
import { IMPLANT_LEVELS, PUBLISH_PLATFORMS, REQUIREMENT_TEMPLATES, platformForAssetType, publishPlatform, type BrandMention, type PublishPlatformId } from '../../../shared/draftPrompt.ts'
import { platformFormatHint } from '../../../shared/platformFormats.ts'
import { draftImages, type DraftImage } from '../../../shared/draftImages.ts'
import { draftPickCap, recommendDraftSelection, type PromptMention } from '../../../shared/recommendDraft.ts'
import { ASSET_TYPES, assetTypeLabel, publicityLabel, type Asset, type Publicity } from '../../../shared/assets.ts'
import { plainTextFromRich } from '../../../shared/richText.ts'
import { citePlacement } from '../../../shared/citePlacement.ts'
import { channelLabel, DRAFT_CHANNELS, formatDraftForCopy } from '../../../shared/drafts.ts'
import { SOURCE_LABEL } from '../../../shared/platforms.ts'
import type { ContentDraft, DraftChannel, DraftPreview, Prompt } from '../../../shared/types.ts'
import { api } from '../api'
import { formatTime } from '../format'
import { MarkdownBodyEditor, type MarkdownBodyEditorHandle } from '../markdownEditor'
import { useStudio } from '../studio'
import { ErrorBanner, InfoBanner, PageFrame, TipBanner } from '../ui'

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
  configScroll: {
    height: '100%',
    minHeight: 0,
    overflow: 'auto',
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

function implantNote(mention: BrandMention, platformId: PublishPlatformId): string {
  if (mention === 'none') return '不带品牌：主题仍然可以写。正文只用素材，不出现品牌名，也不写成问答。'
  const ending =
    platformId === 'xianyu'
      ? '结尾写闲鱼主页；有真实官网再附一次链接。'
      : platformId === 'shipinhao'
        ? '结尾写视频号私信；有真实官网再附一次链接。'
        : platformId === 'xiaohongshu'
          ? '结尾写私信，或留下一次真实链接。'
          : mention === 'light'
            ? '结尾轻轻留下一次品牌名或真实官网。'
            : '结尾单独成段，写出品牌、官网和下一步。'
  if (mention === 'light') return `轻轻带一次：故事围绕主题，引用句能对上它。${ending}`
  return `明确带出：篇幅跟这个平台走。${ending}`
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
  const appliedRecommendation = useRef('')
  const editorRef = useRef<MarkdownBodyEditorHandle>(null)
  const [drafts, setDrafts] = useState<ContentDraft[]>([])
  const [platformId, setPlatformId] = useState<PublishPlatformId>('xiaohongshu')
  const [assetIds, setAssetIds] = useState<string[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerIds, setPickerIds] = useState<string[]>([])
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerType, setPickerType] = useState('')
  const [brandMention, setBrandMention] = useState<BrandMention>('none')
  const [theme, setTheme] = useState('')
  const [requirements, setRequirements] = useState('')
  const [missing, setMissing] = useState<string[]>([])
  const [flags, setFlags] = useState<string[]>([])
  const [promptId, setPromptId] = useState('')
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
  const [chat, setChat] = useState<DraftChatTurn[]>([])
  const [chatInput, setChatInput] = useState('')
  const [revising, setRevising] = useState(false)
  const [showConfig, setShowConfig] = useState(() => !draftId)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [libraryPin, setLibraryPin] = useState('')
  const { draftId } = useParams()
  const openedDraft = useRef('')
  const [searchParams] = useSearchParams()
  const presetAsset = searchParams.get('asset')
  const handledPreset = useRef('')

  const load = async (id: string) => {
    const [promptPayload, draftPayload, assetPayload, observationPayload] = await Promise.all([
      api<{ prompts: Prompt[] }>(`/api/studios/${id}/prompts`),
      api<{ drafts: ContentDraft[] }>(`/api/studios/${id}/drafts`),
      api<{ assets: Asset[] }>(`/api/studios/${id}/assets`),
      api<{ observations: Array<{ promptId: string; brandMentioned: boolean }> }>(`/api/studios/${id}/observations`).catch(() => ({
        observations: [],
      })),
    ])
    setPrompts(promptPayload.prompts)
    setMentions(observationPayload.observations.map((item) => ({ promptId: item.promptId, mentioned: item.brandMentioned })))
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
    setPromptId('')
    setTheme('')
    setRequirements('')
    setBrandMention('none')
    setLibraryPin('')
    handledPreset.current = ''
    openedDraft.current = ''
    setChat([])
    setChatInput('')
    setShareToken(null)
    setShowConfig(true)
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
    setTheme(found.promptText || '')
    setPromptId(found.promptId || '')
    const matched = PUBLISH_PLATFORMS.find((item) => item.channel === found.channel)
    if (matched) setPlatformId(matched.id)
    setPreview(null)
    setShowConfig(false)
  }, [draftId, drafts])

  useEffect(() => {
    if (!studioId || !draftId) return
    let cancelled = false
    setChat([])
    setShareToken(null)
    Promise.all([
      api<{ messages: DraftChatTurn[] }>(`/api/studios/${studioId}/drafts/${draftId}/messages`),
      api<{ share: { token: string } | null }>(`/api/studios/${studioId}/drafts/${draftId}/share`),
    ])
      .then(([messages, share]) => {
        if (cancelled) return
        setChat(messages.messages)
        setShareToken(share.share?.token ?? null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '对话加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [studioId, draftId])

  useEffect(() => {
    if (!editing || !narrow) return
    document.getElementById('draft-editor')?.scrollIntoView({ block: 'start' })
  }, [editing?.id, narrow])

  const platform = publishPlatform(platformId)
  const contentType = platform.contentType
  const channel = platform.channel
  const recommendation = useMemo(() => {
    if (!studio) return { assetIds: [] as string[], rankedIds: [] as string[], promptId: null as string | null, promptIds: [] as string[] }
    return recommendDraftSelection({ contentType, assets, studio, prompts, mentions, selectedIds: assetIds })
  }, [studio, contentType, assets, prompts, mentions, assetIds])
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
    setPlatformId(platformForAssetType(asset.type))
    setLibraryPin(asset.id)
    appliedRecommendation.current = ''
  }, [presetAsset, studio, assets, navigate])

  useEffect(() => {
    if (!studio || assets.length === 0) return
    const key = `${studio.id}:${platformId}:${assets.map((item) => item.id).join(',')}:${libraryPin}`
    if (appliedRecommendation.current === key) return
    appliedRecommendation.current = key
    const next = recommendDraftSelection({ contentType, assets, studio, prompts, mentions })
    const cap = draftPickCap(contentType)
    const pinned = libraryPin ? assets.find((item) => item.id === libraryPin && item.publicity !== 'private') : undefined
    const ids = pinned ? [pinned.id, ...next.assetIds.filter((id) => id !== pinned.id)].slice(0, cap) : next.assetIds
    setAssetIds(ids)
  }, [studio, platformId, contentType, assets, prompts, mentions, libraryPin])

  const rerank = () => {
    if (!studio) return
    setLibraryPin('')
    const next = recommendDraftSelection({ contentType, assets, studio, prompts, mentions })
    setAssetIds(next.assetIds)
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
      const result = await api<{ draft: DraftPreview; gaps?: string[]; flags?: string[]; warning?: string }>(`/api/studios/${studioId}/drafts/generate`, {
        method: 'POST',
        body: JSON.stringify({
          channel,
          contentType,
          requirements,
          theme,
          brandMention,
          assetIds,
          promptId: promptId || null,
          linkPrompt: false,
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
      setChat([])
      setChatInput('')
      setShareToken(null)
      setShowConfig(false)
      setNotice(
        result.warning
          ? result.warning
          : result.draft.source === 'deepseek'
            ? '模型按品牌资料改写了这篇草稿。'
            : '已按品牌资料套用模板。请先核对，再复制到你自己的站点。',
      )
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
          messages: chat,
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

  const revise = async () => {
    if (!studioId) return
    const instruction = chatInput.trim()
    if (!instruction || (!preview && !editing)) return
    const fields = editing
      ? { channel, title: editTitle.trim(), body: editBody.trim(), citeSentences: splitLines(editCites), urlHint: editUrl.trim() }
      : { channel, ...currentBrief() }
    setRevising(true)
    setError('')
    try {
      const result = await api<{
        changed: boolean
        note: string
        title: string
        body: string
        citeSentences: string[]
        urlHint: string
        draft?: ContentDraft
      }>(`/api/studios/${studioId}/drafts/revise`, {
        method: 'POST',
        body: JSON.stringify({
          draftId: editing?.id,
          ...fields,
          message: instruction,
          history: chat,
          assetIds,
          contentType,
          brandMention,
          requirements,
          theme,
        }),
      })
      setChat((current) => [...current, { role: 'user', content: instruction }, { role: 'assistant', content: result.note }])
      setChatInput('')
      if (result.changed) {
        if (editing) {
          setEditChannel(channel)
          setEditTitle(result.title)
          setEditBody(result.body)
          setEditCites(result.citeSentences.join('\n'))
          setEditUrl(result.urlHint)
          if (result.draft) setEditing(result.draft)
        } else {
          setTitle(result.title)
          setBody(result.body)
          setCites(result.citeSentences.join('\n'))
          setUrlHint(result.urlHint)
          setPreview((current) =>
            current
              ? { ...current, channel, title: result.title, body: result.body, citeSentences: result.citeSentences, urlHint: result.urlHint }
              : current,
          )
          setSaved(false)
        }
      }
      setNotice(result.changed ? '已按对话改了这篇草稿。' : result.note)
    } catch (err) {
      setError(err instanceof Error ? err.message : '改稿失败')
    } finally {
      setRevising(false)
    }
  }

  const shareLink = async () => {
    if (!studioId || !editing) {
      setNotice('先保存这篇草稿，再复制分享链接。')
      return
    }
    setShareBusy(true)
    setError('')
    try {
      const result = await api<{ share: { token: string } }>(`/api/studios/${studioId}/drafts/${editing.id}/share`, {
        method: 'POST',
        body: '{}',
      })
      setShareToken(result.share.token)
      const url = `${window.location.origin}/share/${result.share.token}`
      try {
        await navigator.clipboard.writeText(url)
        setNotice('已复制分享链接。对方只能看渲染效果，不能改。')
      } catch {
        setNotice(`分享链接：${url}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '分享链接没有生成')
    } finally {
      setShareBusy(false)
    }
  }

  const revokeShare = async () => {
    if (!studioId || !editing) return
    setShareBusy(true)
    setError('')
    try {
      await api(`/api/studios/${studioId}/drafts/${editing.id}/share`, { method: 'DELETE' })
      setShareToken(null)
      setNotice('已停止分享。旧链接打不开了。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '没有停止分享')
    } finally {
      setShareBusy(false)
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

  const selectedImages = draftImages(
    assetIds.map((id) => assets.find((item) => item.id === id)).filter((item): item is Asset => Boolean(item)),
  )
  const uploadImage = async (file: File) => {
    if (!studioId) throw new Error('先选择品牌')
    const form = new FormData()
    form.set('file', file)
    const response = await fetch(`/api/studios/${studioId}/media`, { method: 'POST', body: form })
    const data = (await response.json().catch(() => ({}))) as { error?: string; url?: string }
    if (!response.ok || !data.url) throw new Error(data.error || '图片没有上传')
    return data.url
  }
  const insertImage = (image: DraftImage) => {
    editorRef.current?.insert(`![${image.alt || image.label}](${image.url})`)
  }
  const imageStrip =
    selectedImages.length === 0 ? null : (
      <div className="citepilot-draft-images">
        <Text color="secondary">本稿可用图片。点一下，把这张图插进正文。</Text>
        <div className="citepilot-draft-thumbs">
          {selectedImages.map((image) => (
            <button
              key={image.key}
              type="button"
              className="citepilot-draft-thumb"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertImage(image)}
            >
              <img src={image.url} alt={image.alt || image.label} />
              <span>{image.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  const imageList =
    selectedImages.length === 0 ? null : (
      <VStack gap={1}>
        <Text color="secondary">本稿可用图片</Text>
        {selectedImages.map((image) => (
          <Button
            key={image.key}
            size="sm"
            variant="ghost"
            label={`${image.label}${image.alt ? ` ${image.alt}` : ''}`}
            onClick={() => insertImage(image)}
          />
        ))}
      </VStack>
    )

  const placementBlock = (value: string, question: string, mention?: BrandMention) => {
    const report = citePlacement({
      body: value,
      question,
      keywords: studio?.keywords ?? [],
      brand: studio?.name ?? '',
      website: studio?.website ?? '',
      mention,
    })
    return (
      <VStack gap={1}>
        <Text>关键词落在这些位置</Text>
        {report.lines.length === 0 ? (
          <Text color="secondary">{report.gap || '正文里还没有对上题目或品牌的词。'}</Text>
        ) : (
          report.lines.map((item) => (
            <Text key={item} color="secondary">
              {item}
            </Text>
          ))
        )}
        {report.lines.length > 0 && report.gap ? <Text color="secondary">{report.gap}</Text> : null}
      </VStack>
    )
  }

  const generateButton = (
    <Button label="生成草稿" variant="primary" width="100%" onClick={() => void generate()} isLoading={generating} isDisabled={!studioId} />
  )

  const configFields = (
    <VStack gap={3}>
      <Heading level={2}>配置</Heading>
      <Selector
        label="发布平台"
        description="先选发到哪里。小红书是服务短帖，闲鱼是商品说明，视频号是口播；公众号、知乎和官网仍按原来的篇幅。"
        value={platformId}
        options={PUBLISH_PLATFORMS.map((item) => ({ value: item.id, label: item.label, description: item.format }))}
        onChange={(value) => {
          const next = PUBLISH_PLATFORMS.find((item) => item.id === value)
          if (!next) return
          setLibraryPin('')
          setPlatformId(next.id)
          setEditChannel(next.channel)
        }}
      />
      <Text color="secondary">{platformFormatHint(platform.id)}</Text>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Heading level={3}>素材</Heading>
          <Button label="重新推荐" size="sm" variant="ghost" onClick={rerank} isDisabled={!studio || assets.length === 0} />
        </HStack>
        <Text color="secondary">已按发布平台推荐，可取消勾选或打开素材库另选</Text>
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
      <VStack gap={2}>
        <Heading level={3}>主题</Heading>
        <Text color="secondary">这篇围绕什么问题来写。可以从题库选，也可以自己写。不带品牌时也可以留主题，正文仍只用素材。</Text>
        <Selector
          label="从题库填入"
          value={promptId}
          hasSearch
          options={[{ value: '', label: '自己写主题' }, ...prompts.map((item) => ({ value: item.id, label: item.text }))]}
          onChange={(value) => {
            const next = value || ''
            setPromptId(next)
            const text = prompts.find((item) => item.id === next)?.text ?? ''
            if (text) setTheme(text)
          }}
        />
        <TextArea
          label="主题"
          description="切入点。留空就只按素材来写。"
          value={theme}
          rows={3}
          width="100%"
          onChange={(value) => {
            setTheme(value)
            const selected = prompts.find((item) => item.id === promptId)
            if (selected && value.trim() !== selected.text) setPromptId('')
          }}
        />
        {recommendedPrompt && theme.trim() !== recommendedPrompt.text ? (
          <Button
            label="用相关题目作主题"
            size="sm"
            variant="ghost"
            onClick={() => {
              setPromptId(recommendedPrompt.id)
              setTheme(recommendedPrompt.text)
            }}
          />
        ) : null}
        <Selector
          label="品牌带出"
          description="不带品牌时，主题仍然有效，只是正文不写品牌名。"
          value={brandMention}
          options={IMPLANT_LEVELS.map((item) => ({ value: item.id, label: item.label, description: item.description }))}
          onChange={(value) => {
            if (value === 'none' || value === 'light' || value === 'guide') setBrandMention(value)
          }}
        />
        <Text color="secondary">{implantNote(brandMention, platform.id)}</Text>
      </VStack>
      <VStack gap={2}>
        <Heading level={3}>需求</Heading>
        <Text color="secondary">点一个模板会填进下面，可以再改。语气、读者和篇幅都写在这里。</Text>
        <HStack gap={2} wrap="wrap">
          {REQUIREMENT_TEMPLATES.map((item) => (
            <Button key={item.id} label={item.label} size="sm" variant="secondary" onClick={() => setRequirements(item.requirements)} />
          ))}
        </HStack>
        <TextArea label="需求" value={requirements} onChange={setRequirements} rows={4} width="100%" />
      </VStack>
    </VStack>
  )

  const bodyArea = (props: { value: string; onChange: (value: string) => void; images?: ReactNode }) => (
    <StackItem size="fill" xstyle={styles.fill}>
      <Text>正文</Text>
      <div className="citepilot-draft-body">
        <MarkdownBodyEditor
          ref={editorRef}
          value={props.value}
          onChange={props.onChange}
          onUpload={uploadImage}
          placeholder="用 Markdown 写正文。点下方图片，会在光标处插入 ![](地址)。"
        />
      </div>
      {props.images}
    </StackItem>
  )

  const shareControls = editing ? (
    <VStack gap={2}>
      <HStack gap={2} wrap="wrap">
        <Button label="复制分享链接" variant="secondary" onClick={() => void shareLink()} isLoading={shareBusy} />
        {shareToken ? <Button label="停止分享" variant="ghost" onClick={() => void revokeShare()} isDisabled={shareBusy} /> : null}
      </HStack>
      {shareToken ? <Text color="secondary">{`${window.location.origin}/share/${shareToken}`}</Text> : null}
    </VStack>
  ) : (
    <Text color="secondary">先保存这篇草稿，再复制分享链接。同事打开后只能看渲染效果。</Text>
  )

  const hasDraft = Boolean(preview || editing)
  const chatPanel = (
    <VStack gap={2}>
      <Heading level={2}>对话改稿</Heading>
      <Text color="secondary">当前配置会带进每一轮。改了平台、素材、主题或需求之后，下一句按新配置改，不必重新生成。说清要改哪一段；要整篇重写时直接说。</Text>
      {chat.length === 0 ? (
        <Text color="secondary">还没有对话。</Text>
      ) : (
        chat.map((turn, index) => (
          <Text key={`${turn.role}-${index}`} color={turn.role === 'assistant' ? 'secondary' : undefined}>
            {turn.role === 'user' ? `你：${turn.content}` : `改动：${turn.content}`}
          </Text>
        ))
      )}
    </VStack>
  )
  const chatComposer = (
    <VStack gap={2}>
      <TextArea label="修改要求" value={chatInput} onChange={setChatInput} rows={3} width="100%" />
      <Button label="按这句话改" variant="primary" width="100%" onClick={() => void revise()} isLoading={revising} isDisabled={!chatInput.trim() || revising} />
      <Button label="查看/修改配置" variant="ghost" width="100%" onClick={() => setShowConfig(true)} />
    </VStack>
  )
  const configActions = hasDraft ? (
    <VStack gap={2}>
      <Button label="返回对话" variant="secondary" width="100%" onClick={() => setShowConfig(false)} />
      {generateButton}
    </VStack>
  ) : (
    generateButton
  )
  const showChat = hasDraft && !showConfig

  const editor = editing ? (
    <VStack gap={3}>
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
          if (!next) return
          setEditChannel(next.id)
          const matched = PUBLISH_PLATFORMS.find((item) => item.channel === next.id)
          if (matched) setPlatformId(matched.id)
        }}
      />
      <TextInput label="标题" value={editTitle} onChange={setEditTitle} width="100%" />
      {bodyArea({ value: editBody, onChange: setEditBody, images: imageStrip })}
      {placementBlock(editBody, editing.promptText)}
      {imageList}
      {shareControls}
    </VStack>
  ) : preview ? (
    <VStack gap={3}>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Badge variant="neutral" label="生成预览" />
        <Heading level={2}>草稿</Heading>
      </HStack>
      {missing.length > 0 ? (
        <TipBanner id="gaps" page="drafts" status="warning" title={missing.length > 1 ? `${missing[0]}。另外还有 ${missing.length - 1} 条。` : `${missing[0]}。`} />
      ) : flags.length > 0 ? (
        <TipBanner id="flags" page="drafts" title={body.includes('【待补充') ? '有一句待补充，发布前补上。' : '有一句对不上已授权的素材，发布前核对。'} />
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
        images: imageStrip,
      })}
      {placementBlock(body, preview.promptText, brandMention)}
      {imageList}
      {shareControls}
    </VStack>
  ) : (
    <VStack gap={3} height="100%" minHeight={0}>
      <Heading level={2}>草稿</Heading>
      <EmptyState
        title={narrow ? '先在上方选素材并生成' : '先在左侧选素材并生成'}
        description="选好发布平台、素材、主题和需求，再点生成草稿。生成后可以用对话改标题和正文。"
      />
    </VStack>
  )

  const workspace = narrow ? (
    <VStack gap={4}>
      <Section>
        <VStack gap={3}>
          {showChat ? chatPanel : configFields}
          {showChat ? chatComposer : configActions}
        </VStack>
      </Section>
      <Section id="draft-editor">{editor}</Section>
    </VStack>
  ) : (
    <Layout
      height="fill"
      xstyle={styles.workspace}
      start={
        <LayoutPanel width={380} hasDivider isScrollable={false} label={showChat ? '对话改稿' : '起草配置'} padding={0}>
          <Layout
            height="fill"
            content={
              <LayoutContent>
                <div {...stylex.props(styles.configScroll)}>{showChat ? chatPanel : configFields}</div>
              </LayoutContent>
            }
            footer={<LayoutFooter>{showChat ? chatComposer : configActions}</LayoutFooter>}
          />
        </LayoutPanel>
      }
      content={
        <LayoutContent>
          <Section id="draft-editor">{editor}</Section>
        </LayoutContent>
      }
    />
  )

  return (
    <PageFrame
      title={draftId ? '编辑草稿' : '新建草稿'}
      description="配置只有平台、素材、主题和需求。生成后左侧换成对话改稿，也可以回去改配置。发布仍在站外完成。"
    >
      <VStack gap={3} height="100%" xstyle={styles.page}>
        <HStack gap={2} vAlign="center">
          <Button label="← 内容起草" size="sm" variant="ghost" onClick={() => navigate('/drafts')} />
        </HStack>
        <ErrorBanner message={error} />
        {notice ? (
          <InfoBanner title={notice} onDismiss={() => setNotice('')} />
        ) : llm && !llm.enabled ? (
          <TipBanner id="llm-template" page="drafts" title="没有模型密钥，草稿按素材模板写。到设置配上密钥后再改写。" />
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
      <style>{`.citepilot-draft-body{flex:1 1 auto;min-height:280px;display:flex;flex-direction:column}.citepilot-draft-images{display:flex;flex-direction:column;gap:8px;margin-top:8px}.citepilot-draft-thumbs{display:flex;flex-wrap:wrap;gap:8px}.citepilot-draft-thumb{display:flex;flex-direction:column;align-items:center;gap:4px;padding:4px;border:1px solid #d7d7d7;background:#fff;cursor:pointer}.citepilot-draft-thumb img{width:88px;height:64px;object-fit:cover;display:block;background:#f3f3f3}`}</style>
    </PageFrame>
  )
}
