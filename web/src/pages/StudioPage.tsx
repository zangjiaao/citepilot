import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { Studio } from '../../../shared/types.ts'
import { api } from '../api'
import { joinLines, splitList } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, PageFrame } from '../ui'

interface Draft {
  name: string
  website: string
  positioning: string
  services: string
  competitors: string
  keywords: string
}

const emptyDraft: Draft = {
  name: '',
  website: 'https://',
  positioning: '',
  services: '',
  competitors: '',
  keywords: '',
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

  const update = (key: keyof Draft) => (value: string) => setDraft((current) => ({ ...current, [key]: value }))

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
      competitors: splitList(draft.competitors),
      keywords: splitList(draft.keywords),
    }
    try {
      if (creating || !studio) {
        await api('/api/studios', { method: 'POST', body: JSON.stringify(payload) })
        setCreating(false)
        setMessage('已新建工作室，并准备了基线和复测两个轮次。')
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
      description="名称、官网、定位、服务、竞品和关键词会用来出题，也会用来判断回答里有没有提到你。"
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
          <TextArea label="竞品" description="一行一个名称，监测时按这些名字查找。" value={draft.competitors} onChange={update('competitors')} rows={4} width="100%" />
          <TextArea label="关键词" description="逗号或换行分隔。" value={draft.keywords} onChange={update('keywords')} rows={3} width="100%" />
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
    competitors: joinLines(studio.competitors),
    keywords: joinLines(studio.keywords),
  }
}
