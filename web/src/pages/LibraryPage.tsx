import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, Layout, LayoutContent, LayoutFooter, LayoutPanel, VStack } from '@astryxdesign/core/Layout'
import { Section } from '@astryxdesign/core/Section'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import * as stylex from '@stylexjs/stylex'
import {
  ASSET_TYPES,
  assetTypeLabel,
  authorizedMetrics,
  emptyDetails,
  formatMetric,
  publicityLabel,
  type Asset,
  type AssetImage,
  type AssetLink,
  type AssetType,
  type CaseMetric,
  type Publicity,
} from '../../../shared/assets.ts'
import { plainTextFromRich } from '../../../shared/richText.ts'
import { api } from '../api'
import { RichTextEditor } from '../richText'
import { useStudio } from '../studio'
import { ErrorBanner, InfoBanner, PageFrame } from '../ui'

const styles = stylex.create({
  workspace: {
    height: 'min(780px, 74vh)',
    minHeight: 560,
  },
})

interface AssetRow extends Record<string, unknown> {
  id: string
  typeLabel: string
  title: string
  publicityLabel: string
  asset: Asset
}

interface FormState {
  id: string
  type: AssetType
  title: string
  body: string
  tags: string
  publicity: Publicity
  industry: string
  problem: string
  approach: string
  howItWorks: string
  quote: string
  quoteAuthorized: boolean
  links: AssetLink[]
  metrics: CaseMetric[]
  images: AssetImage[]
}

const emptyForm: FormState = {
  id: '',
  type: 'case',
  title: '',
  body: '',
  tags: '',
  publicity: 'anonymous',
  industry: '',
  problem: '',
  approach: '',
  howItWorks: '',
  quote: '',
  quoteAuthorized: false,
  links: [],
  metrics: [],
  images: [],
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

export function LibraryPage() {
  const navigate = useNavigate()
  const narrow = useNarrow()
  const { studioId } = useStudio()
  const [assets, setAssets] = useState<Asset[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [baseline, setBaseline] = useState('')
  const [editing, setEditing] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [polishing, setPolishing] = useState(false)

  const load = async (id: string) => {
    const result = await api<{ assets: Asset[] }>(`/api/studios/${id}/assets`)
    setAssets(result.assets)
  }

  useEffect(() => {
    if (!studioId) return
    setEditing(false)
    setForm(emptyForm)
    setBaseline('')
    load(studioId).catch((err: unknown) => setError(err instanceof Error ? err.message : '素材库加载失败'))
  }, [studioId])

  const tags = useMemo(() => [...new Set(assets.flatMap((item) => item.tags))].sort(), [assets])
  const visible = assets.filter((item) => {
    if (typeFilter && item.type !== typeFilter) return false
    if (tagFilter && !item.tags.includes(tagFilter)) return false
    const haystack = `${item.title}\n${plainTextFromRich(item.body)}\n${item.tags.join(' ')}`.toLowerCase()
    return !query.trim() || haystack.includes(query.trim().toLowerCase())
  })
  const rows = useMemo<AssetRow[]>(
    () =>
      visible.map((asset) => ({
        id: asset.id,
        typeLabel: assetTypeLabel(asset.type),
        title: asset.title,
        publicityLabel: publicityLabel(asset.publicity),
        asset,
      })),
    [visible],
  )

  const openCreate = () => {
    setForm(emptyForm)
    setBaseline(JSON.stringify(emptyForm))
    setFormError('')
    setEditing(true)
  }

  const openEdit = (asset: Asset) => {
    const next = formFromAsset(asset)
    setForm(next)
    setBaseline(JSON.stringify(next))
    setFormError('')
    setEditing(true)
  }

  const backToList = () => {
    if (JSON.stringify(form) !== baseline && !window.confirm('放弃还没保存的修改？')) return
    setEditing(false)
    setForm(emptyForm)
    setFormError('')
  }

  const updateMetric = (id: string, patch: Partial<CaseMetric>) => {
    setForm((current) => ({ ...current, metrics: current.metrics.map((item) => (item.id === id ? { ...item, ...patch } : item)) }))
  }

  const updateLink = (id: string, patch: Partial<AssetLink>) => {
    setForm((current) => ({ ...current, links: current.links.map((item) => (item.id === id ? { ...item, ...patch } : item)) }))
  }

  const save = async (): Promise<string | null> => {
    if (!studioId) return null
    setSaving(true)
    setFormError('')
    try {
      const payload = payloadFrom(form)
      const path = form.id ? `/api/studios/${studioId}/assets/${form.id}` : `/api/studios/${studioId}/assets`
      const result = await api<{ asset: Asset }>(path, { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(payload) })
      const next = formFromAsset(result.asset)
      setForm(next)
      setBaseline(JSON.stringify(next))
      setNotice(form.id ? '已保存修改。' : '已加入素材库。')
      await load(studioId)
      return result.asset.id
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存失败')
      return null
    } finally {
      setSaving(false)
    }
  }

  const polish = async () => {
    if (!studioId) return
    const notes = plainTextFromRich(form.body)
    if (!notes) {
      setFormError('先在右侧写下笔记，再一起整理。')
      return
    }
    setPolishing(true)
    setFormError('')
    try {
      const result = await api<{ body: string; source: 'model' | 'notes' }>(`/api/studios/${studioId}/assets/polish`, {
        method: 'POST',
        body: JSON.stringify({
          notes,
          title: form.title,
          type: form.type,
          metrics: form.metrics.filter((item) => item.customerAuthorized).map((item) => formatMetric(item)),
        }),
      })
      setForm((current) => ({ ...current, body: result.body }))
      setNotice(result.source === 'model' ? '已按你的笔记整理，没有另补事实。发布前再看一遍。' : '没有调用模型，只把现有句子分成问题和做法。')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '整理失败')
    } finally {
      setPolishing(false)
    }
  }

  const goDraft = async () => {
    if (form.publicity === 'private') {
      setFormError('不可公开的素材不能用来起草。')
      return
    }
    const id = await save()
    if (id) navigate(`/drafts?asset=${encodeURIComponent(id)}`)
  }

  const remove = async (id: string) => {
    if (!studioId || !window.confirm('删除这条素材？')) return
    setError('')
    try {
      await api(`/api/studios/${studioId}/assets/${id}`, { method: 'DELETE' })
      if (form.id === id) {
        setEditing(false)
        setForm(emptyForm)
      }
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const uploadImage = async (file: File) => {
    if (!studioId) throw new Error('先选择品牌')
    const body = new FormData()
    body.set('file', file)
    const response = await fetch(`/api/studios/${studioId}/media`, { method: 'POST', body })
    const data = (await response.json().catch(() => ({}))) as { error?: string; url?: string }
    if (!response.ok || !data.url) throw new Error(data.error || '图片没有上传')
    return data.url
  }

  const showMetrics = form.type === 'case' || form.type === 'outcome'
  const showQuote = form.type === 'case' || form.type === 'testimonial'
  const showProblem = form.type === 'case' || form.type === 'product' || form.type === 'idea' || form.type === 'interaction'
  const showHow = form.type === 'product' || form.type === 'idea'
  const authorized = authorizedMetrics({ ...emptyDetails(), metrics: form.metrics })
  const dirty = editing && JSON.stringify(form) !== baseline
  const columns: TableColumn<AssetRow>[] = [
    {
      key: 'typeLabel',
      header: '类型',
      width: pixel(88),
      renderCell: (row) => <Badge variant="info" label={row.typeLabel} />,
    },
    {
      key: 'title',
      header: '标题',
      width: proportional(2, { minWidth: 140 }),
      renderCell: (row) => <Button label={row.title} size="sm" variant="ghost" onClick={() => openEdit(row.asset)} />,
    },
    {
      key: 'publicityLabel',
      header: '公开',
      width: pixel(88),
      renderCell: (row) => <Badge variant={publicityVariant(row.asset.publicity)} label={row.publicityLabel} />,
    },
    {
      key: 'id',
      header: '',
      width: pixel(72),
      resizable: false,
      renderCell: (row) => <Button label="删除" size="sm" variant="ghost" onClick={() => void remove(row.asset.id)} />,
    },
  ]

  const metadata = (
    <VStack gap={3}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Button label="返回列表" size="sm" variant="ghost" onClick={backToList} />
        <Text color="secondary">{form.id ? (dirty ? '有未保存的修改' : '已保存') : '还没保存'}</Text>
      </HStack>
      <ErrorBanner message={formError} />
      <Selector
        label="类型"
        value={form.type}
        options={ASSET_TYPES.map((item) => ({ value: item.id, label: item.label }))}
        onChange={(value) => {
          if (ASSET_TYPES.some((item) => item.id === value)) setForm({ ...form, type: value as AssetType })
        }}
      />
      <TextInput label="标题" value={form.title} onChange={(value) => setForm({ ...form, title: value })} width="100%" />
      <Selector
        label="公开程度"
        value={form.publicity}
        options={[
          { value: 'public', label: '公开' },
          { value: 'anonymous', label: '匿名' },
          { value: 'private', label: '不可公开' },
        ]}
        onChange={(value) => {
          if (value === 'public' || value === 'anonymous' || value === 'private') setForm({ ...form, publicity: value })
        }}
      />
      <TextInput label="标签 / 关键词" description="用逗号分隔。" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} width="100%" />
      <Text color="secondary">{authorized.length > 0 ? `已授权 ${authorized.length} 组前后数据` : '还没有已授权的前后数据'}</Text>
      {showProblem ? <TextArea label="客户的问题" value={form.problem} onChange={(value) => setForm({ ...form, problem: value })} rows={3} width="100%" /> : null}
      {form.type === 'case' ? <TextInput label="客户行业" description="可以匿名，只写行业。" value={form.industry} onChange={(value) => setForm({ ...form, industry: value })} width="100%" /> : null}
      {form.type === 'case' ? <TextArea label="做法" value={form.approach} onChange={(value) => setForm({ ...form, approach: value })} rows={3} width="100%" /> : null}
      {showHow ? <TextArea label="它是什么 / 怎么运作" value={form.howItWorks} onChange={(value) => setForm({ ...form, howItWorks: value })} rows={3} width="100%" /> : null}
      {showMetrics ? (
        <VStack gap={2}>
          <Heading level={3}>前后数据</Heading>
          <Text color="secondary">没有客户授权的数字，起草时不会写出来。</Text>
          {form.metrics.map((metric) => (
            <VStack key={metric.id} gap={2}>
              <FormLayout direction="horizontal">
                <TextInput label="指标名" value={metric.name} onChange={(value) => updateMetric(metric.id, { name: value })} width="100%" />
                <TextInput label="优化前" value={metric.before} onChange={(value) => updateMetric(metric.id, { before: value })} width="100%" />
                <TextInput label="优化后" value={metric.after} onChange={(value) => updateMetric(metric.id, { after: value })} width="100%" />
                <TextInput label="单位" value={metric.unit} onChange={(value) => updateMetric(metric.id, { unit: value })} width="100%" />
              </FormLayout>
              <TextInput label="来源 / 口径" value={metric.source} onChange={(value) => updateMetric(metric.id, { source: value })} width="100%" />
              <Selector
                label="客户是否授权公开"
                value={metric.customerAuthorized ? 'yes' : 'no'}
                options={[
                  { value: 'no', label: '未授权' },
                  { value: 'yes', label: '已授权' },
                ]}
                onChange={(value) => updateMetric(metric.id, { customerAuthorized: value === 'yes' })}
              />
              <Button label="移除这组指标" size="sm" variant="ghost" onClick={() => setForm({ ...form, metrics: form.metrics.filter((item) => item.id !== metric.id) })} />
            </VStack>
          ))}
          <Button
            label="添加一组指标"
            size="sm"
            variant="secondary"
            onClick={() =>
              setForm({
                ...form,
                metrics: [...form.metrics, { id: crypto.randomUUID(), name: '', before: '', after: '', unit: '', source: '', customerAuthorized: false }],
              })
            }
          />
        </VStack>
      ) : null}
      {showQuote ? (
        <VStack gap={2}>
          <TextArea label="客户原话" value={form.quote} onChange={(value) => setForm({ ...form, quote: value })} rows={3} width="100%" />
          <Selector
            label="客户是否授权引用"
            value={form.quoteAuthorized ? 'yes' : 'no'}
            options={[
              { value: 'no', label: '未授权' },
              { value: 'yes', label: '已授权' },
            ]}
            onChange={(value) => setForm({ ...form, quoteAuthorized: value === 'yes' })}
          />
        </VStack>
      ) : null}
      <Collapsible defaultIsOpen={false} trigger="链接">
        <VStack gap={2}>
          {form.links.map((link) => (
            <FormLayout key={link.id} direction="horizontal">
              <TextInput label="说明" value={link.label} onChange={(value) => updateLink(link.id, { label: value })} width="100%" />
              <TextInput label="地址" value={link.url} onChange={(value) => updateLink(link.id, { url: value })} width="100%" />
              <Button label="移除" size="sm" variant="ghost" onClick={() => setForm({ ...form, links: form.links.filter((item) => item.id !== link.id) })} />
            </FormLayout>
          ))}
          <Button
            label="添加链接"
            size="sm"
            variant="secondary"
            onClick={() => setForm({ ...form, links: [...form.links, { id: crypto.randomUUID(), label: '', url: '' }] })}
          />
        </VStack>
      </Collapsible>
      <VStack gap={2}>
        <Button label="和 AI 一起打磨成可分享素材" variant="secondary" onClick={() => void polish()} isLoading={polishing} isDisabled={!studioId} />
        <Text color="secondary">只整理你已经写下的句子，不补数字，不写成硬广或凑字。故事从客户的问题或变化写起。</Text>
      </VStack>
      {form.publicity === 'private' ? <Text color="secondary">不可公开的素材不能去起草。</Text> : null}
      <Text color="secondary">{form.id ? '保存后可以去起草，内容类型会按素材类型带过去。' : '先保存，再去起草。'}</Text>
    </VStack>
  )

  const editor = editing ? (
    <Section id="library-editor">
      <VStack gap={3}>
        <Heading level={2}>{form.title.trim() || '正文'}</Heading>
        <RichTextEditor value={form.body} onChange={(body) => setForm((current) => ({ ...current, body }))} onUpload={uploadImage} />
      </VStack>
    </Section>
  ) : (
    <VStack gap={3} id="library-empty">
      <EmptyState title="先选择或新建一条素材" description="从左侧列表点一条标题，或新建。正文在这里排版，也可以插入图片。" />
    </VStack>
  )

  const list = (
    <VStack gap={3}>
      <TextInput label="搜索" value={query} onChange={setQuery} width="100%" />
      <Selector
        label="类型"
        value={typeFilter}
        options={[{ value: '', label: '全部类型' }, ...ASSET_TYPES.map((item) => ({ value: item.id, label: item.label }))]}
        onChange={(value) => setTypeFilter(value || '')}
      />
      <Selector
        label="标签"
        value={tagFilter}
        options={[{ value: '', label: '全部标签' }, ...tags.map((item) => ({ value: item, label: item }))]}
        onChange={(value) => setTagFilter(value || '')}
      />
      <Text color="secondary">
        {visible.length} / {assets.length} 条。点标题打开。
      </Text>
      {rows.length === 0 ? <Text color="secondary">没有符合条件的素材。</Text> : null}
      <Table data={rows} columns={columns} idKey="id" hasHover density="compact" textOverflow="truncate" verticalAlign="middle" />
    </VStack>
  )

  const workspace = narrow ? (
    <VStack gap={4}>
      <Section>{editing ? metadata : list}</Section>
      {editing ? (
        <HStack gap={2} wrap="wrap">
          <Button label={form.id ? '保存修改' : '加入素材库'} variant="primary" onClick={() => void save()} isLoading={saving} isDisabled={!studioId} />
          <Button label="去起草" variant="secondary" onClick={() => void goDraft()} isDisabled={!studioId || form.publicity === 'private'} />
        </HStack>
      ) : null}
      <Section>{editor}</Section>
    </VStack>
  ) : (
    <Layout
      height="fill"
      xstyle={styles.workspace}
      start={
        <LayoutPanel width={400} hasDivider isScrollable={false} label={editing ? '素材信息' : '素材列表'} padding={0}>
          {editing ? (
            <Layout
              height="fill"
              content={<LayoutContent>{metadata}</LayoutContent>}
              footer={
                <LayoutFooter>
                  <HStack gap={2}>
                    <Button label={form.id ? '保存修改' : '加入素材库'} variant="primary" onClick={() => void save()} isLoading={saving} isDisabled={!studioId} />
                    <Button label="去起草" variant="secondary" onClick={() => void goDraft()} isDisabled={!studioId || form.publicity === 'private'} />
                  </HStack>
                </LayoutFooter>
              }
            />
          ) : (
            <LayoutContent>{list}</LayoutContent>
          )}
        </LayoutPanel>
      }
      content={<LayoutContent>{editor}</LayoutContent>}
    />
  )

  return (
    <PageFrame
      title="素材库"
      description="和 AI 把一条案例整理成可分享的素材，再去起草。故事优先，不硬广，不凑字。"
      actions={<Button label="新建素材" variant="primary" onClick={openCreate} isDisabled={!studioId} />}
    >
      <VStack gap={4}>
        <ErrorBanner message={error} />
        {notice ? <InfoBanner title={notice} /> : null}
        {workspace}
      </VStack>
    </PageFrame>
  )
}

function formFromAsset(asset: Asset): FormState {
  return {
    id: asset.id,
    type: asset.type,
    title: asset.title,
    body: asset.body,
    tags: asset.tags.join('，'),
    publicity: asset.publicity,
    industry: asset.details.industry,
    problem: asset.details.problem,
    approach: asset.details.approach,
    howItWorks: asset.details.howItWorks,
    quote: asset.details.quote,
    quoteAuthorized: asset.details.quoteAuthorized,
    links: asset.links,
    metrics: asset.details.metrics,
    images: asset.details.images ?? [],
  }
}

function payloadFrom(form: FormState) {
  return {
    type: form.type,
    title: form.title,
    body: form.body,
    tags: form.tags
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean),
    publicity: form.publicity,
    links: form.links,
    details: {
      ...emptyDetails(),
      industry: form.industry,
      problem: form.problem,
      approach: form.approach,
      howItWorks: form.howItWorks,
      quote: form.quote,
      quoteAuthorized: form.quoteAuthorized,
      metrics: form.metrics,
      images: form.images,
    },
  }
}

function publicityVariant(value: Publicity): 'success' | 'warning' | 'neutral' {
  if (value === 'public') return 'success'
  if (value === 'anonymous') return 'warning'
  return 'neutral'
}
