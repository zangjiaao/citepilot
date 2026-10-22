import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import {
  ASSET_TYPES,
  assetAngles,
  assetTypeLabel,
  emptyDetails,
  publicityLabel,
  type Asset,
  type AssetLink,
  type AssetType,
  type CaseMetric,
  type Publicity,
} from '../../../shared/assets.ts'
import { api } from '../api'
import { formatTime } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, InfoBanner, PageFrame } from '../ui'

interface AssetRow extends Record<string, unknown> {
  id: string
  typeLabel: string
  title: string
  publicityLabel: string
  tagsLabel: string
  updatedLabel: string
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
}

export function LibraryPage() {
  const { studioId } = useStudio()
  const [assets, setAssets] = useState<Asset[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editorOpen, setEditorOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async (id: string) => {
    const result = await api<{ assets: Asset[] }>(`/api/studios/${id}/assets`)
    setAssets(result.assets)
  }

  useEffect(() => {
    if (!studioId) return
    setEditorOpen(false)
    setForm(emptyForm)
    load(studioId).catch((err: unknown) => setError(err instanceof Error ? err.message : '素材库加载失败'))
  }, [studioId])

  const tags = useMemo(() => [...new Set(assets.flatMap((item) => item.tags))].sort(), [assets])
  const visible = assets.filter((item) => {
    if (typeFilter && item.type !== typeFilter) return false
    if (tagFilter && !item.tags.includes(tagFilter)) return false
    const haystack = `${item.title}\n${item.body}\n${item.tags.join(' ')}`.toLowerCase()
    return !query.trim() || haystack.includes(query.trim().toLowerCase())
  })
  const rows = useMemo<AssetRow[]>(
    () =>
      visible.map((asset) => ({
        id: asset.id,
        typeLabel: assetTypeLabel(asset.type),
        title: asset.title,
        publicityLabel: publicityLabel(asset.publicity),
        tagsLabel: asset.tags.join('、') || '无',
        updatedLabel: formatTime(asset.updatedAt),
        asset,
      })),
    [visible],
  )

  const closeEditor = () => {
    setEditorOpen(false)
    setForm(emptyForm)
    setFormError('')
  }

  const openCreate = () => {
    setForm(emptyForm)
    setFormError('')
    setEditorOpen(true)
  }

  const openEdit = (asset: Asset) => {
    setForm({
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
    })
    setFormError('')
    setEditorOpen(true)
  }

  const updateMetric = (id: string, patch: Partial<CaseMetric>) => {
    setForm((current) => ({ ...current, metrics: current.metrics.map((item) => (item.id === id ? { ...item, ...patch } : item)) }))
  }

  const updateLink = (id: string, patch: Partial<AssetLink>) => {
    setForm((current) => ({ ...current, links: current.links.map((item) => (item.id === id ? { ...item, ...patch } : item)) }))
  }

  const save = async () => {
    if (!studioId) return
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        type: form.type,
        title: form.title,
        body: form.body,
        tags: form.tags.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
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
        },
      }
      if (form.id) await api(`/api/studios/${studioId}/assets/${form.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await api(`/api/studios/${studioId}/assets`, { method: 'POST', body: JSON.stringify(payload) })
      closeEditor()
      setNotice(form.id ? '已保存修改。' : '已加入素材库。')
      await load(studioId)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!studioId || !window.confirm('删除这条素材？')) return
    setError('')
    try {
      await api(`/api/studios/${studioId}/assets/${id}`, { method: 'DELETE' })
      if (form.id === id) closeEditor()
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const showMetrics = form.type === 'case' || form.type === 'outcome'
  const showQuote = form.type === 'case' || form.type === 'testimonial'
  const showProblem = form.type === 'case' || form.type === 'product' || form.type === 'idea' || form.type === 'interaction'
  const showHow = form.type === 'product' || form.type === 'idea'
  const columns: TableColumn<AssetRow>[] = [
    {
      key: 'typeLabel',
      header: '类型',
      width: pixel(110),
      renderCell: (row) => <Badge variant="info" label={row.typeLabel} />,
    },
    { key: 'title', header: '标题', width: proportional(2, { minWidth: 180 }) },
    {
      key: 'publicityLabel',
      header: '公开程度',
      width: pixel(120),
      renderCell: (row) => <Badge variant={publicityVariant(row.asset.publicity)} label={row.publicityLabel} />,
    },
    { key: 'tagsLabel', header: '标签', width: proportional(1, { minWidth: 120 }) },
    { key: 'updatedLabel', header: '更新时间', width: pixel(150) },
    {
      key: 'id',
      header: '操作',
      width: pixel(150),
      resizable: false,
      renderCell: (row) => (
        <HStack gap={1}>
          <Button label="编辑" size="sm" variant="secondary" onClick={() => openEdit(row.asset)} />
          <Button label="删除" size="sm" variant="destructive" onClick={() => void remove(row.asset.id)} />
        </HStack>
      ),
    },
  ]

  return (
    <PageFrame
      title="素材库"
      description="案例、产品、巧思、交互、数据成效、客户评价、踩坑和参考资料都放在这里。起草时再勾选要用的几条。"
      actions={<Button label="添加素材" variant="primary" onClick={openCreate} isDisabled={!studioId} />}
    >
      <VStack gap={4}>
        <ErrorBanner message={error} />
        {notice ? <InfoBanner title={notice} /> : null}
        <FormLayout direction="horizontal">
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
        </FormLayout>
        <Text color="secondary">
          {visible.length} / {assets.length} 条
        </Text>
        {rows.length === 0 ? <Text color="secondary">没有符合条件的素材。</Text> : null}
        <Table data={rows} columns={columns} idKey="id" hasHover density="compact" textOverflow="truncate" />
      </VStack>
      <Dialog
        isOpen={editorOpen}
        onOpenChange={(next) => {
          if (!next) closeEditor()
        }}
        purpose="form"
        width={720}
        maxHeight="85dvh"
      >
        <Layout
          header={<DialogHeader title={form.id ? '编辑素材' : '添加素材'} onOpenChange={() => closeEditor()} />}
          content={
            <LayoutContent>
              <VStack gap={3}>
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
          <TextArea label="正文" description="发生了什么。句子里的逗号会保留。" value={form.body} onChange={(value) => setForm({ ...form, body: value })} rows={5} width="100%" />
          <TextInput label="标签" description="用逗号分隔，方便以后筛选。" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} width="100%" />
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
          {showProblem ? <TextArea label="客户的问题" value={form.problem} onChange={(value) => setForm({ ...form, problem: value })} rows={3} width="100%" /> : null}
          {form.type === 'case' ? <TextInput label="客户行业" description="可以匿名，只写行业。" value={form.industry} onChange={(value) => setForm({ ...form, industry: value })} width="100%" /> : null}
          {form.type === 'case' ? <TextArea label="做法" value={form.approach} onChange={(value) => setForm({ ...form, approach: value })} rows={3} width="100%" /> : null}
          {showHow ? <TextArea label="它是什么 / 怎么运作" value={form.howItWorks} onChange={(value) => setForm({ ...form, howItWorks: value })} rows={4} width="100%" /> : null}
          {showMetrics ? (
            <VStack gap={2}>
              <Heading level={3}>前后数据</Heading>
              <Text color="secondary">指标名、优化前、优化后、单位、口径。没有客户授权的数字，起草时不会写出来。</Text>
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
          <VStack gap={2}>
            <Heading level={3}>链接 / 截图</Heading>
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
          {form.id ? <Text color="secondary">{assetAngles(fakeAsset(form))[0]}</Text> : null}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button label="取消" variant="secondary" onClick={closeEditor} />
                <Button label={form.id ? '保存修改' : '加入素材库'} variant="primary" onClick={() => void save()} isLoading={saving} isDisabled={!studioId} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </PageFrame>
  )
}

function publicityVariant(value: Publicity): 'success' | 'warning' | 'neutral' {
  if (value === 'public') return 'success'
  if (value === 'anonymous') return 'warning'
  return 'neutral'
}

function fakeAsset(form: FormState): Asset {
  return {
    id: form.id,
    studioId: '',
    type: form.type,
    title: form.title,
    body: form.body,
    tags: [],
    links: form.links,
    publicity: form.publicity,
    createdAt: '',
    updatedAt: '',
    details: {
      ...emptyDetails(),
      industry: form.industry,
      problem: form.problem,
      approach: form.approach,
      howItWorks: form.howItWorks,
      quote: form.quote,
      quoteAuthorized: form.quoteAuthorized,
      metrics: form.metrics,
    },
  }
}
