import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, Layout, LayoutContent, LayoutFooter, LayoutPanel, VStack } from '@astryxdesign/core/Layout'
import { Section } from '@astryxdesign/core/Section'
import { Selector } from '@astryxdesign/core/Selector'
import { StackItem } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import * as stylex from '@stylexjs/stylex'
import {
  ASSET_TYPES,
  authorizedMetrics,
  emptyDetails,
  formatMetric,
  type Asset,
  type AssetImage,
  type AssetLink,
  type AssetType,
  type CaseMetric,
  type Publicity,
} from '../../../shared/assets.ts'
import { plainTextFromRich } from '../../../shared/richText.ts'
import { api } from '../api'
import { MarkdownBodyEditor } from '../markdownEditor'
import { useStudio } from '../studio'
import { ErrorBanner, InfoBanner, PageFrame } from '../ui'

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

export function LibraryEditPage() {
  const navigate = useNavigate()
  const { assetId } = useParams()
  const narrow = useNarrow()
  const { studioId } = useStudio()
  const loadedFor = useRef('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [baseline, setBaseline] = useState(JSON.stringify(emptyForm))
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [polishing, setPolishing] = useState(false)

  useEffect(() => {
    if (!studioId || !assetId) return
    let cancelled = false
    api<{ assets: Asset[] }>(`/api/studios/${studioId}/assets`)
      .then((result) => {
        if (cancelled) return
        const asset = result.assets.find((item) => item.id === assetId)
        if (!asset) {
          setError('没有找到这条素材')
          return
        }
        if (loadedFor.current === assetId) return
        loadedFor.current = assetId
        const next = formFromAsset(asset)
        setForm(next)
        setBaseline(JSON.stringify(next))
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '素材加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [studioId, assetId])

  const dirty = JSON.stringify(form) !== baseline
  const showMetrics = form.type === 'case' || form.type === 'outcome'
  const showQuote = form.type === 'case' || form.type === 'testimonial'
  const showProblem = form.type === 'case' || form.type === 'product' || form.type === 'idea' || form.type === 'interaction'
  const showHow = form.type === 'product' || form.type === 'idea'
  const authorized = authorizedMetrics({ ...emptyDetails(), metrics: form.metrics })

  const back = () => {
    if (dirty && !window.confirm('放弃还没保存的修改？')) return
    navigate('/library')
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
      loadedFor.current = result.asset.id
      setForm(next)
      setBaseline(JSON.stringify(next))
      setNotice(form.id ? '已保存修改。' : '已加入素材库。')
      if (!form.id) navigate(`/library/${result.asset.id}`, { replace: true })
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
    if (id) navigate(`/drafts/new?asset=${encodeURIComponent(id)}`)
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

  const metadata = (
    <VStack gap={3}>
      <ErrorBanner message={formError} />
      <Text color="secondary">{form.id ? (dirty ? '有未保存的修改' : '已保存') : '还没保存'}</Text>
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
    </VStack>
  )

  const editor = (
    <Section id="library-editor" height="100%">
      <VStack gap={2} height="100%" minHeight={0}>
        <Heading level={2}>{form.title.trim() || '正文'}</Heading>
        <StackItem size="fill" xstyle={styles.fill}>
          <MarkdownBodyEditor value={form.body} onChange={(body) => setForm((current) => ({ ...current, body }))} onUpload={uploadImage} />
        </StackItem>
      </VStack>
    </Section>
  )

  const actions = (
    <HStack gap={2}>
      <Button label={form.id ? '保存修改' : '加入素材库'} variant="primary" onClick={() => void save()} isLoading={saving} isDisabled={!studioId} />
      <Button label="去起草" variant="secondary" onClick={() => void goDraft()} isDisabled={!studioId || form.publicity === 'private'} />
    </HStack>
  )

  const workspace = narrow ? (
    <VStack gap={4}>
      <Section>{metadata}</Section>
      {actions}
      {editor}
    </VStack>
  ) : (
    <Layout
      height="fill"
      xstyle={styles.workspace}
      start={
        <LayoutPanel width={400} hasDivider isScrollable={false} label="素材信息" padding={0}>
          <Layout height="fill" content={<LayoutContent>{metadata}</LayoutContent>} footer={<LayoutFooter>{actions}</LayoutFooter>} />
        </LayoutPanel>
      }
      content={
        <LayoutContent padding={0} isScrollable={false}>
          {editor}
        </LayoutContent>
      }
    />
  )

  return (
    <PageFrame title={form.id ? '编辑素材' : '新建素材'} description="左侧是类型、公开程度和已授权数据。右侧用 Markdown 写正文，可以插图。">
      <VStack gap={3} height="100%" xstyle={styles.page}>
        <HStack gap={2} vAlign="center">
          <Button label="← 素材库" size="sm" variant="ghost" onClick={back} />
        </HStack>
        <ErrorBanner message={error} />
        {notice ? <InfoBanner title={notice} /> : null}
        <StackItem size="fill" xstyle={styles.grow}>
          {workspace}
        </StackItem>
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
