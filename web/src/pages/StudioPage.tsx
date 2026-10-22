import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { Competitor, Studio } from '../../../shared/types.ts'
import { api } from '../api'
import { joinLines, splitList } from '../format'
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
  capabilities: string
  cases: string
  targetCustomers: string
  solutions: string
}

const emptyDraft: Draft = {
  name: '',
  website: 'https://',
  positioning: '',
  services: '',
  competitors: [],
  keywords: '',
  capabilities: '',
  cases: '',
  targetCustomers: '',
  solutions: '',
}

export function StudioPage() {
  const { studio, refresh } = useStudio()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (studio && !creating) setDraft(fromStudio(studio))
  }, [studio, creating])

  const update = (key: Exclude<keyof Draft, 'competitors'>) => (value: string) => setDraft((current) => ({ ...current, [key]: value }))

  const updateCompetitor = (id: string, key: keyof Omit<CompetitorDraft, 'id'>, value: string) => {
    setDraft((current) => ({
      ...current,
      competitors: current.competitors.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    }))
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    const payload = {
      name: draft.name,
      website: draft.website,
      positioning: draft.positioning,
      services: splitList(draft.services),
      competitors: draft.competitors
        .filter((item) => item.name.trim())
        .map((item) => ({
          id: item.id,
          name: item.name.trim(),
          aliases: splitAliases(item.aliases),
          domain: item.domain.trim(),
        })),
      keywords: splitList(draft.keywords),
      capabilities: splitList(draft.capabilities),
      cases: splitList(draft.cases),
      targetCustomers: splitList(draft.targetCustomers),
      solutions: splitList(draft.solutions),
    }
    try {
      if (creating || !studio) {
        await api('/api/studios', { method: 'POST', body: JSON.stringify(payload) })
        setCreating(false)
        setMessage('已新建工作室，并准备了今天的抽查批次。')
      } else {
        await api(`/api/studios/${studio.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        setMessage('档案已保存。之后生成的题目和监测解析都会用这份资料。')
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageFrame
      title="工作室档案"
      description="名称、官网、定位、服务、竞品和关键词会用来出题，也会用来判断回答里有没有提到你。竞品可以写别名和域名。能力、案例、目标客户和解决方案会用来起草可引用的内容。"
      actions={
        <Button
          label="新建工作室"
          variant="secondary"
          onClick={() => {
            setCreating(true)
            setDraft(emptyDraft)
            setMessage('')
          }}
        />
      }
    >
      <VStack as="form" gap={4} onSubmit={(event) => void save(event)}>
        <ErrorBanner message={error} />
        {message ? <Text color="secondary">{message}</Text> : null}
        <FormLayout direction="vertical">
          <TextInput label="名称" value={draft.name} onChange={update('name')} isRequired width="100%" />
          <TextInput
            label="官网"
            type="text"
            description="只抓取这个公开地址，不会登录后台。"
            value={draft.website}
            onChange={update('website')}
            isRequired
            width="100%"
          />
          <TextArea label="定位" value={draft.positioning} onChange={update('positioning')} rows={5} isRequired width="100%" />
          <TextArea label="服务" description="一行一项。" value={draft.services} onChange={update('services')} rows={4} width="100%" />
          <VStack gap={2}>
            <Text type="label">竞品</Text>
            <Text color="secondary">名称、别名和域名。别名用顿号或逗号分隔。监测按名称和别名判断有没有被提到，按域名判断有没有被引用，并记下第一次出现的顺序。</Text>
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
          <TextArea label="关键词" description="逗号或换行分隔。" value={draft.keywords} onChange={update('keywords')} rows={3} width="100%" />
          <TextArea label="能力" description="一行一项。内容起草会把这些句子写成可被引用的事实。" value={draft.capabilities} onChange={update('capabilities')} rows={4} width="100%" />
          <TextArea label="案例" description="一行一个可公开的例子。不要写无法核对的客户名或效果数字。" value={draft.cases} onChange={update('cases')} rows={4} width="100%" />
          <TextArea label="目标客户" description="一行一类客户。" value={draft.targetCustomers} onChange={update('targetCustomers')} rows={3} width="100%" />
          <TextArea label="解决方案" description="一行一项。产品宣传和官网长文会按这些范围来写。" value={draft.solutions} onChange={update('solutions')} rows={4} width="100%" />
        </FormLayout>
        <Button label={creating || !studio ? '创建' : '保存档案'} variant="primary" type="submit" isLoading={saving} />
        {studio && !creating ? (
          <Link href={studio.website} isExternalLink isStandalone newTabLabel="（在新标签页打开）">
            打开当前官网
          </Link>
        ) : null}
      </VStack>
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
    capabilities: joinLines(studio.capabilities),
    cases: joinLines(studio.cases),
    targetCustomers: joinLines(studio.targetCustomers),
    solutions: joinLines(studio.solutions),
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

function splitAliases(value: string): string[] {
  return value
    .split(/\n|，|,|、/)
    .map((item) => item.trim())
    .filter(Boolean)
}
