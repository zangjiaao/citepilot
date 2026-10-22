import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { HStack } from '@astryxdesign/core/HStack'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { Competitor, Studio } from '../../../shared/types.ts'
import { ApiError, api } from '../api'
import { joinLines, splitLines, splitList } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, PageFrame } from '../ui'

interface CompetitorDraft {
  id: string
  name: string
  aliases: string
  domain: string
}

interface Draft {
  name: string
  website: string
  positioning: string
  services: string
  competitors: CompetitorDraft[]
  keywords: string
  voice: string
  bannedWords: string
  compliance: string
}

const emptyDraft: Draft = {
  name: '',
  website: 'https://',
  positioning: '',
  services: '',
  competitors: [],
  keywords: '',
  voice: '',
  bannedWords: '',
  compliance: '',
}

export function StudioPage() {
  const navigate = useNavigate()
  const { studio, studios, setStudioId, refresh } = useStudio()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (studio && !creating) setDraft(fromStudio(studio))
  }, [studio, creating])

  const update = (key: TextKey) => (value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => clearField(current, key))
  }

  const updateCompetitor = (id: string, key: keyof Omit<CompetitorDraft, 'id'>, value: string) => {
    setDraft((current) => ({
      ...current,
      competitors: current.competitors.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    }))
    setFieldErrors((current) => clearField(current, 'competitors'))
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})
    setMessage('')
    const payload = {
      name: draft.name,
      website: draft.website,
      positioning: draft.positioning,
      services: splitLines(draft.services),
      competitors: draft.competitors
        .filter((item) => item.name.trim())
        .map((item) => ({
          id: item.id,
          name: item.name.trim(),
          aliases: splitAliases(item.aliases),
          domain: item.domain.trim(),
        })),
      keywords: splitList(draft.keywords),
      voice: draft.voice,
      bannedWords: draft.bannedWords,
      compliance: draft.compliance,
    }
    try {
      if (creating || !studio) {
        const created = await api<{ studio: Studio }>('/api/studios', { method: 'POST', body: JSON.stringify(payload) })
        setStudioId(created.studio.id)
        setCreating(false)
        setMessage('已新建品牌，并准备了今天的抽查批次。')
      } else {
        await api(`/api/studios/${studio.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        setMessage('品牌已保存。出题、监测和起草的语气红线都会用这份资料。')
      }
      await refresh()
    } catch (err) {
      const field = err instanceof ApiError ? err.field : undefined
      const messageText = err instanceof Error ? err.message : '保存失败'
      if (field && isDraftField(field)) setFieldErrors({ [field]: messageText })
      else setError(messageText)
    } finally {
      setSaving(false)
    }
  }

  const removeBrand = async () => {
    if (!studio || confirmName.trim() !== studio.name) return
    setDeleting(true)
    setError('')
    try {
      const next = studios.find((item) => item.id !== studio.id)?.id ?? ''
      await api(`/api/studios/${studio.id}`, { method: 'DELETE', body: JSON.stringify({ confirmName: confirmName.trim() }) })
      setStudioId(next)
      setCreating(false)
      setConfirmOpen(false)
      setConfirmName('')
      await refresh()
      navigate('/studio')
      setMessage(next ? '已删除这个品牌。' : '已删除。可以新建一个品牌。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageFrame
      title="品牌"
      description="品牌页只管出题和监测用的基本信息，以及起草时的语气与红线。案例、产品、巧思、数据成效等可分享素材都去「素材库」。"
      actions={
        <HStack gap={2}>
          <Button label="打开素材库" variant="secondary" onClick={() => navigate('/library')} />
          <Button
            label="新建品牌"
            variant="secondary"
            onClick={() => {
              setCreating(true)
              setDraft(emptyDraft)
              setMessage('')
            }}
          />
        </HStack>
      }
    >
      <VStack as="form" gap={4} onSubmit={(event) => void save(event)}>
        <ErrorBanner message={error} />
        {message ? <Text color="secondary">{message}</Text> : null}
        <FormLayout direction="vertical">
          <TextInput label="名称" value={draft.name} onChange={update('name')} isRequired width="100%" status={fieldStatus(fieldErrors.name)} statusVariant="detached" />
          <TextInput
            label="官网"
            type="text"
            description="只抓取这个公开地址，不会登录后台。"
            value={draft.website}
            onChange={update('website')}
            isRequired
            width="100%"
            statusVariant="detached"
            status={fieldStatus(fieldErrors.website)}
          />
          <TextArea
            label="定位"
            description="一整段即可，句子里的逗号会保留。"
            value={draft.positioning}
            onChange={update('positioning')}
            rows={5}
            isRequired
            width="100%"
            statusVariant="detached"
            status={fieldStatus(fieldErrors.positioning)}
          />
          <TextArea
            label="服务"
            description="一行一项。句子里的逗号会保留，不会拆成多项。"
            value={draft.services}
            onChange={update('services')}
            rows={4}
            width="100%"
            statusVariant="detached"
            status={fieldStatus(fieldErrors.services)}
          />
          <VStack gap={2}>
            <Text type="label">竞品</Text>
            <Text color="secondary">名称、别名和域名。别名用顿号或逗号分隔。监测按名称和别名判断有没有被提到，按域名判断有没有被引用，并记下第一次出现的顺序。</Text>
            {fieldErrors.competitors ? <ErrorBanner message={fieldErrors.competitors} /> : null}
            {draft.competitors.map((item) => (
              <VStack key={item.id} gap={2}>
                <FormLayout direction="horizontal">
                  <TextInput label="名称" value={item.name} onChange={(value) => updateCompetitor(item.id, 'name', value)} width="100%" />
                  <TextInput label="别名" value={item.aliases} onChange={(value) => updateCompetitor(item.id, 'aliases', value)} width="100%" />
                  <TextInput label="域名" value={item.domain} onChange={(value) => updateCompetitor(item.id, 'domain', value)} width="100%" />
                </FormLayout>
                <Button label="移除" size="sm" variant="ghost" onClick={() => setDraft((current) => ({ ...current, competitors: current.competitors.filter((row) => row.id !== item.id) }))} />
              </VStack>
            ))}
            <Button
              label="添加竞品"
              variant="secondary"
              onClick={() => setDraft((current) => ({ ...current, competitors: [...current.competitors, blankCompetitor()] }))}
            />
          </VStack>
          <TextArea
            label="关键词"
            description="逗号或换行分隔。"
            value={draft.keywords}
            onChange={update('keywords')}
            rows={3}
            width="100%"
            statusVariant="detached"
            status={fieldStatus(fieldErrors.keywords)}
          />
          <TextArea
            label="品牌语气 / 写作风格"
            value={draft.voice}
            onChange={update('voice')}
            rows={3}
            width="100%"
            statusVariant="detached"
            status={fieldStatus(fieldErrors.voice)}
          />
          <TextArea
            label="禁用词"
            description="起草时会避开这些说法。"
            value={draft.bannedWords}
            onChange={update('bannedWords')}
            rows={3}
            width="100%"
            statusVariant="detached"
            status={fieldStatus(fieldErrors.bannedWords)}
          />
          <TextArea
            label="合规红线"
            description="起草时不得越过这里。"
            value={draft.compliance}
            onChange={update('compliance')}
            rows={3}
            width="100%"
            statusVariant="detached"
            status={fieldStatus(fieldErrors.compliance)}
          />
        </FormLayout>
        <Button label={creating || !studio ? '创建' : '保存品牌'} variant="primary" type="submit" isLoading={saving} />
        {studio && !creating ? (
          <Button label="删除品牌" variant="destructive" onClick={() => { setConfirmName(''); setConfirmOpen(true) }} />
        ) : null}
        {studio && !creating ? (
          <Link href={studio.website} isExternalLink isStandalone newTabLabel="（在新标签页打开）">
            打开当前官网
          </Link>
        ) : null}
      </VStack>
      <Dialog isOpen={confirmOpen} onOpenChange={setConfirmOpen} purpose="form" width={480}>
        <VStack gap={3}>
          <DialogHeader title="删除品牌" subtitle="题目、批次、样本、诊断、草稿和素材库会一起删除，不能恢复。" onOpenChange={setConfirmOpen} />
          <Text>请输入「{studio?.name ?? ''}」以确认。</Text>
          <TextInput label="品牌名称" value={confirmName} onChange={setConfirmName} width="100%" />
          <Button label="确认删除" variant="destructive" onClick={() => void removeBrand()} isLoading={deleting} isDisabled={!studio || confirmName.trim() !== studio.name} />
        </VStack>
      </Dialog>
    </PageFrame>
  )
}

function fromStudio(studio: Studio): Draft {
  return {
    name: studio.name,
    website: studio.website,
    positioning: studio.positioning,
    services: joinLines(studio.services),
    competitors: studio.competitors.map(competitorDraft),
    keywords: joinLines(studio.keywords),
    voice: studio.voice,
    bannedWords: studio.bannedWords,
    compliance: studio.compliance,
  }
}

function competitorDraft(competitor: Competitor): CompetitorDraft {
  return {
    id: competitor.id,
    name: competitor.name,
    aliases: competitor.aliases.join('、'),
    domain: competitor.domain,
  }
}

function blankCompetitor(): CompetitorDraft {
  return { id: crypto.randomUUID(), name: '', aliases: '', domain: '' }
}

const DRAFT_FIELDS = new Set<keyof Draft>([
  'name',
  'website',
  'positioning',
  'services',
  'competitors',
  'keywords',
  'voice',
  'bannedWords',
  'compliance',
])

type TextKey = {
  [K in keyof Draft]: Draft[K] extends string ? K : never
}[keyof Draft]

function isDraftField(value: string): value is keyof Draft {
  return DRAFT_FIELDS.has(value as keyof Draft)
}

function clearField(current: Partial<Record<keyof Draft, string>>, key: keyof Draft): Partial<Record<keyof Draft, string>> {
  if (!current[key]) return current
  const next = { ...current }
  delete next[key]
  return next
}

function fieldStatus(message: string | undefined): { type: 'error'; message: string } | undefined {
  if (!message) return undefined
  return { type: 'error', message }
}

function splitAliases(value: string): string[] {
  return value
    .split(/\n|，|,|、/)
    .map((item) => item.trim())
    .filter(Boolean)
}
