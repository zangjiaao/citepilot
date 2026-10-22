import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Section } from '@astryxdesign/core/Section'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { channelLabel, DRAFT_CHANNELS, formatDraftForCopy } from '../../../shared/drafts.ts'
import { SOURCE_LABEL } from '../../../shared/platforms.ts'
import type { ContentDraft, Diagnosis, DraftChannel, DraftPreview, Prompt } from '../../../shared/types.ts'
import { api } from '../api'
import { formatTime } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, InfoBanner, PageFrame } from '../ui'

interface DraftRow extends Record<string, unknown> {
  id: string
  when: string
  channel: string
  title: string
  source: string
}

export function DraftsPage() {
  const navigate = useNavigate()
  const { studioId, studio, llm } = useStudio()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [drafts, setDrafts] = useState<ContentDraft[]>([])
  const [channel, setChannel] = useState<DraftChannel>('product-promo')
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

  const load = async (id: string) => {
    const [promptPayload, diagnosisPayload, draftPayload] = await Promise.all([
      api<{ prompts: Prompt[] }>(`/api/studios/${id}/prompts`),
      api<{ diagnoses: Diagnosis[] }>(`/api/studios/${id}/diagnoses`),
      api<{ drafts: ContentDraft[] }>(`/api/studios/${id}/drafts`),
    ])
    setPrompts(promptPayload.prompts)
    setDiagnoses(diagnosisPayload.diagnoses)
    setDrafts(draftPayload.drafts)
  }

  useEffect(() => {
    if (!studioId) return
    setPreview(null)
    setSaved(false)
    setEditing(null)
    load(studioId).catch((err: unknown) => setError(err instanceof Error ? err.message : '草稿加载失败'))
  }, [studioId])

  useEffect(() => {
    if (!editing) return
    document.getElementById('draft-editor')?.scrollIntoView({ block: 'nearest' })
  }, [editing?.id])

  const selectedDiagnosis = diagnoses.find((item) => item.id === diagnosisId)
  const gaps = selectedDiagnosis?.checklist.filter((item) => item.status !== 'pass') ?? []

  const generate = async () => {
    if (!studioId) return
    setGenerating(true)
    setError('')
    setNotice('')
    try {
      const result = await api<{ draft: DraftPreview }>(`/api/studios/${studioId}/drafts/generate`, {
        method: 'POST',
        body: JSON.stringify({
          channel,
          promptId: promptId || null,
          diagnosisId: diagnosisId || null,
          gapId: gapId || null,
        }),
      })
      setPreview(result.draft)
      setTitle(result.draft.title)
      setBody(result.draft.body)
      setCites(result.draft.citeSentences.join('\n'))
      setUrlHint(result.draft.urlHint)
      setSaved(false)
      setNotice(result.draft.source === 'deepseek' ? 'DeepSeek 按档案改写了这篇草稿。' : '已按档案和渠道套用模板。请先核对，再复制到你自己的站点。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const currentBrief = () => ({
    title: title.trim(),
    body: body.trim(),
    citeSentences: cites
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
    urlHint: urlHint.trim(),
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
      await api(`/api/studios/${studioId}/drafts`, {
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
      setNotice('已存入草稿箱。发布仍由你自己完成。')
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!studioId || !window.confirm('删除这篇草稿？已保存的修改会一起删掉。')) return
    try {
      await api(`/api/studios/${studioId}/drafts/${id}`, { method: 'DELETE' })
      if (editing?.id === id) setEditing(null)
      setNotice('已删除这篇草稿。')
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const openEdit = (item: ContentDraft) => {
    setEditing(item)
    setEditChannel(item.channel)
    setEditTitle(item.title)
    setEditBody(item.body)
    setEditCites(item.citeSentences.join('\n'))
    setEditUrl(item.urlHint)
    setError('')
    setNotice('')
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
          citeSentences: editCites
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
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

  const duplicate = async (id: string) => {
    if (!studioId) return
    setError('')
    try {
      const result = await api<{ draft: ContentDraft }>(`/api/studios/${studioId}/drafts/${id}/copy`, { method: 'POST' })
      setNotice(`已另存为「${result.draft.title}」。`)
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '另存失败')
    }
  }

  const rows: DraftRow[] = drafts.map((item) => ({
    id: item.id,
    when: formatTime(item.updatedAt || item.createdAt),
    channel: channelLabel(item.channel),
    title: item.title,
    source: SOURCE_LABEL[item.source] ?? item.source,
  }))

  return (
    <PageFrame
      title="内容起草"
      description="整站诊断之后，在这里起草可引用的稿子。你审完后自己发布，这里不连接公众号、小红书或任何其他平台。"
    >
      <VStack gap={4}>
        <ErrorBanner message={error} />
        {notice ? <InfoBanner title={notice} /> : null}
        {llm && !llm.enabled ? (
          <InfoBanner title="当前使用档案模板" description="没有 DeepSeek 密钥时，草稿按渠道套模板。配上密钥后，模型会在同一份事实边界里改写。" />
        ) : null}
        <Section>
          <VStack gap={3}>
            <Heading level={2}>将使用的档案</Heading>
            <ProfileBlock label="能力" items={studio?.capabilities ?? []} />
            <ProfileBlock label="案例" items={studio?.cases ?? []} />
            <ProfileBlock label="目标客户" items={studio?.targetCustomers ?? []} />
            <ProfileBlock label="解决方案" items={studio?.solutions ?? []} />
            <Button label="到档案里修改" variant="secondary" onClick={() => navigate('/studio')} />
          </VStack>
        </Section>
        <FormLayout direction="vertical">
          <Selector
            label="渠道"
            value={channel}
            options={DRAFT_CHANNELS.map((item) => ({ value: item.id, label: item.label, description: item.hint }))}
            onChange={(value) => {
              const next = DRAFT_CHANNELS.find((item) => item.id === value)
              if (next) setChannel(next.id)
            }}
          />
          <Selector
            label="关联题目"
            description="可选。生成时会针对这道题写一段可以直接引用的回答。"
            value={promptId}
            hasSearch
            options={[{ value: '', label: '不关联题目' }, ...prompts.map((item) => ({ value: item.id, label: item.text }))]}
            onChange={(value) => setPromptId(value || '')}
          />
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
        </FormLayout>
        <Button label="生成草稿" variant="primary" onClick={() => void generate()} isLoading={generating} isDisabled={!studioId} />
        {preview ? (
          <Section>
            <VStack gap={3}>
              <Heading level={2}>草稿预览</Heading>
              <Text color="secondary">
                {channelLabel(preview.channel)} · {SOURCE_LABEL[preview.source] ?? preview.source}
                {preview.promptText ? ` · 题目：${preview.promptText}` : ''}
                {preview.gapLabel ? ` · 缺口：${preview.gapLabel}` : ''}
              </Text>
              <TextInput
                label="标题"
                value={title}
                onChange={(value) => {
                  setTitle(value)
                  setSaved(false)
                }}
                width="100%"
              />
              <TextArea
                label="正文"
                value={body}
                onChange={(value) => {
                  setBody(value)
                  setSaved(false)
                }}
                rows={14}
                width="100%"
              />
              <TextArea
                label="建议被引用的句子"
                description="一行一句。回答引擎适合整句引用，所以每句都带上工作室名称。"
                value={cites}
                onChange={(value) => {
                  setCites(value)
                  setSaved(false)
                }}
                rows={5}
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
              <HStack gap={2} wrap="wrap">
                <Button label="复制全文" variant="secondary" onClick={() => void copyText(formatDraftForCopy(currentBrief()))} />
                <Button
                  label={saved ? '已保存' : '保存草稿'}
                  variant="primary"
                  onClick={() => void save()}
                  isLoading={saving}
                  isDisabled={saved}
                />
              </HStack>
            </VStack>
          </Section>
        ) : null}
        <VStack gap={2}>
          <Heading level={2}>草稿箱</Heading>
          <Text color="secondary">打开一篇已保存的草稿可以改标题、正文和渠道。保存会更新原来的记录。</Text>
          {rows.length === 0 ? <Text color="secondary">还没有保存的草稿。</Text> : null}
          {editing ? (
            <Section id="draft-editor">
              <VStack gap={3}>
                <Heading level={3}>编辑草稿</Heading>
                <Text color="secondary">
                  {channelLabel(editing.channel)} · 创建于 {formatTime(editing.createdAt)} · 最后编辑 {formatTime(editing.updatedAt)}
                  {editing.promptText ? ` · 题目：${editing.promptText}` : ''}
                  {editing.gapLabel ? ` · 缺口：${editing.gapLabel}` : ''}
                </Text>
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
                <TextArea label="正文" value={editBody} onChange={setEditBody} rows={14} width="100%" />
                <TextArea
                  label="建议被引用的句子"
                  description="一行一句。"
                  value={editCites}
                  onChange={setEditCites}
                  rows={5}
                  width="100%"
                />
                <TextInput label="建议落地网址" value={editUrl} onChange={setEditUrl} width="100%" />
                <HStack gap={2} wrap="wrap">
                  <Button label="保存修改" variant="primary" onClick={() => void saveEdit()} isLoading={editSaving} />
                  <Button
                    label="复制全文"
                    variant="secondary"
                    onClick={() =>
                      void copyText(
                        formatDraftForCopy({
                          title: editTitle.trim(),
                          body: editBody.trim(),
                          citeSentences: editCites
                            .split('\n')
                            .map((item) => item.trim())
                            .filter(Boolean),
                          urlHint: editUrl.trim(),
                        }),
                      )
                    }
                  />
                  <Button label="取消" variant="ghost" onClick={() => setEditing(null)} />
                </HStack>
              </VStack>
            </Section>
          ) : null}
          <Table
            data={rows}
            idKey="id"
            density="compact"
            hasHover
            verticalAlign="top"
            columns={[
              { key: 'when', header: '最后编辑', width: pixel(120) },
              { key: 'channel', header: '渠道', width: pixel(140) },
              { key: 'title', header: '标题', width: proportional(2, { minWidth: 180 }) },
              { key: 'source', header: '来源', width: pixel(100) },
              {
                key: 'id',
                header: '操作',
                width: pixel(240),
                renderCell: (row) => (
                  <HStack gap={1} wrap="wrap">
                    <Button
                      label="编辑"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const found = drafts.find((item) => item.id === row.id)
                        if (found) openEdit(found)
                      }}
                    />
                    <Button label="另存" size="sm" variant="ghost" onClick={() => void duplicate(row.id)} />
                    <Button label="删除" size="sm" variant="ghost" onClick={() => void remove(row.id)} />
                  </HStack>
                ),
              },
            ]}
          />
        </VStack>
      </VStack>
    </PageFrame>
  )
}

function ProfileBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <VStack gap={1}>
      <Text type="label">{label}</Text>
      <Text color="secondary">{items.length > 0 ? items.join('；') : '还没有填写。生成时会改用定位和服务，建议先补上。'}</Text>
    </VStack>
  )
}
