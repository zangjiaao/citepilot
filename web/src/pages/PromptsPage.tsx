import { useEffect, useState, type FormEvent } from 'react'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { HStack } from '@astryxdesign/core/HStack'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { CLUSTER_LABEL, SOURCE_LABEL } from '../../../shared/platforms.ts'
import type { Cluster, Prompt } from '../../../shared/types.ts'
import { api } from '../api'
import { useStudio } from '../studio'
import { ErrorBanner, InfoBanner, PageFrame } from '../ui'

interface PromptRow extends Record<string, unknown> {
  id: string
  cluster: Cluster
  text: string
  rationale: string
  source: string
}

const CLUSTER_VARIANT = {
  brand: 'blue',
  category: 'teal',
  comparison: 'purple',
  scenario: 'orange',
} as const

export function PromptsPage() {
  const { studioId, llm } = useStudio()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [cluster, setCluster] = useState('all')
  const [text, setText] = useState('')
  const [newCluster, setNewCluster] = useState<Cluster>('brand')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async (id: string) => {
    const payload = await api<{ prompts: Prompt[] }>(`/api/studios/${id}/prompts`)
    setPrompts(payload.prompts)
  }

  useEffect(() => {
    if (!studioId) return
    load(studioId).catch((err: unknown) => setError(err instanceof Error ? err.message : '题库加载失败'))
  }, [studioId])

  const generate = async () => {
    if (!studioId) return
    setError('')
    setNotice('')
    const result = await api<{ source: string; warning: string; summary?: string; prompts: Prompt[] }>(`/api/studios/${studioId}/prompts/generate`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const summary = result.summary?.trim() || ''
    const warning = result.warning?.trim() || ''
    setNotice([summary, warning].filter(Boolean).join('') || (result.source === 'covered' ? '题库已覆盖当前品牌和素材。' : '已按盲区补题。'))
    await load(studioId)
  }

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!studioId) return
    setError('')
    try {
      await api(`/api/studios/${studioId}/prompts`, {
        method: 'POST',
        body: JSON.stringify({ cluster: newCluster, text }),
      })
      setText('')
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败')
    }
  }

  const remove = async (id: string) => {
    if (!studioId || !window.confirm('删除这道题？已有监测记录的题目会保留。')) return
    try {
      await api(`/api/studios/${studioId}/prompts/${id}`, { method: 'DELETE' })
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const rows: PromptRow[] = prompts
    .filter((prompt) => cluster === 'all' || prompt.cluster === cluster)
    .map((prompt) => ({
      id: prompt.id,
      cluster: prompt.cluster,
      text: prompt.text,
      rationale: prompt.rationale,
      source: SOURCE_LABEL[prompt.source] ?? prompt.source,
    }))

  return (
    <PageFrame
      title="题库"
      description="结合品牌资料和素材库出题。先评估覆盖，只补还没有题的盲区。场景题要对得上已有素材；品牌题和对比题留给监测。"
      actions={<Button label="评估并补盲区" variant="primary" clickAction={generate} isDisabled={!studioId} />}
    >
      <VStack gap={4}>
        <ErrorBanner message={error} />
        {notice ? <InfoBanner title={notice} onDismiss={() => setNotice('')} /> : null}
        {llm && !llm.enabled ? <Text type="supporting">未配置密钥时，仍先评估覆盖，只补还没有题的盲区。</Text> : null}
        <Text type="supporting">先看题库是否盖住品牌和素材，只补还没有题的部分。</Text>
        <HStack gap={2} wrap="wrap" vAlign="end">
          <Selector
            label="筛选簇"
            value={cluster}
            options={[{ value: 'all', label: '全部' }, ...Object.entries(CLUSTER_LABEL).map(([value, label]) => ({ value, label }))]}
            onChange={(value) => setCluster(value || 'all')}
          />
        </HStack>
        <Table
          data={rows}
          idKey="id"
          density="compact"
          hasHover
          textOverflow="wrap"
          columns={[
            {
              key: 'cluster',
              header: '簇',
              width: pixel(96),
              renderCell: (row) => <Badge variant={CLUSTER_VARIANT[row.cluster]} label={CLUSTER_LABEL[row.cluster] ?? row.cluster} />,
            },
            { key: 'text', header: '问题', width: proportional(2, { minWidth: 240 }) },
            { key: 'rationale', header: '为什么问', width: proportional(1, { minWidth: 160 }) },
            { key: 'source', header: '来源', width: pixel(96) },
            {
              key: 'id',
              header: '操作',
              width: pixel(88),
              renderCell: (row) => <Button label="删除" size="sm" variant="ghost" onClick={() => void remove(row.id)} />,
            },
          ]}
        />
        <VStack as="form" gap={3} onSubmit={(event) => void add(event)}>
          <Text type="label">手写一题</Text>
          <FormLayout direction="vertical">
            <Selector
              label="簇"
              value={newCluster}
              options={Object.entries(CLUSTER_LABEL).map(([value, label]) => ({ value, label }))}
              onChange={(value) => {
                if (value === 'brand' || value === 'category' || value === 'comparison' || value === 'scenario') setNewCluster(value)
              }}
            />
            <TextInput label="问题" value={text} onChange={setText} width="100%" />
          </FormLayout>
          <Button label="加入题库" type="submit" variant="secondary" isDisabled={!studioId || text.trim().length < 4} />
        </VStack>
      </VStack>
    </PageFrame>
  )
}
