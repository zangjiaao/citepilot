import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { PLATFORMS, SENTIMENT_LABEL, platformLabel } from '../../../shared/platforms.ts'
import type { Cycle, CycleKind, Observation, Prompt } from '../../../shared/types.ts'
import { api } from '../api'
import { formatTime } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, InfoBanner, PageFrame } from '../ui'

interface ObsRow extends Record<string, unknown> {
  id: string
  when: string
  cycleName: string
  platform: string
  promptText: string
  brand: string
  cited: string
  competitors: string
  sentiment: string
  summary: string
}

export function MonitorPage() {
  const { studioId } = useStudio()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [promptId, setPromptId] = useState('')
  const [cycleId, setCycleId] = useState('')
  const [platform, setPlatform] = useState('deepseek')
  const [answer, setAnswer] = useState('')
  const [cycleName, setCycleName] = useState('')
  const [cycleKind, setCycleKind] = useState<CycleKind>('retest')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async (id: string) => {
    const [promptPayload, cyclePayload, observationPayload] = await Promise.all([
      api<{ prompts: Prompt[] }>(`/api/studios/${id}/prompts`),
      api<{ cycles: Cycle[] }>(`/api/studios/${id}/cycles`),
      api<{ observations: Observation[] }>(`/api/studios/${id}/observations`),
    ])
    setPrompts(promptPayload.prompts)
    setCycles(cyclePayload.cycles)
    setObservations(observationPayload.observations)
    setPromptId((current) => current || promptPayload.prompts[0]?.id || '')
    setCycleId((current) => current || cyclePayload.cycles[0]?.id || '')
  }

  useEffect(() => {
    if (!studioId) return
    load(studioId).catch((err: unknown) => setError(err instanceof Error ? err.message : '监测数据加载失败'))
  }, [studioId])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!studioId) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api<{ observation: Observation }>(`/api/studios/${studioId}/observations`, {
        method: 'POST',
        body: JSON.stringify({ promptId, cycleId, platform, answerText: answer }),
      })
      setAnswer('')
      setNotice(result.observation.summary)
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const addCycle = async () => {
    if (!studioId) return
    setError('')
    const result = await api<{ cycle: Cycle }>(`/api/studios/${studioId}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ name: cycleName, kind: cycleKind }),
    })
    setCycleName('')
    setCycleId(result.cycle.id)
    await load(studioId)
  }

  const remove = async (id: string) => {
    if (!studioId || !window.confirm('删除这条粘贴记录？')) return
    await api(`/api/studios/${studioId}/observations/${id}`, { method: 'DELETE' })
    await load(studioId)
  }

  const rows: ObsRow[] = observations.map((item) => ({
    id: item.id,
    when: formatTime(item.createdAt),
    cycleName: item.cycleName,
    platform: platformLabel(item.platform),
    promptText: item.promptText,
    brand: item.brandMentioned ? '已提及' : '未提及',
    cited: item.ownUrlCited ? '已引用' : '未引用',
    competitors: item.competitorsMentioned.join('、') || '无',
    sentiment: SENTIMENT_LABEL[item.sentiment] ?? item.sentiment,
    summary: item.summary,
  }))

  return (
    <PageFrame title="监测" description="选一道题和一个平台，把回答引擎的原文粘贴进来。解析只看文本，不访问登录后的对话页面。">
      <VStack gap={4}>
        <ErrorBanner message={error} />
        {notice ? <InfoBanner title="这条回答已记下" description={notice} /> : null}
        <VStack as="form" gap={3} onSubmit={(event) => void save(event)}>
          <FormLayout direction="vertical">
            <Selector
              label="轮次"
              value={cycleId}
              hasSearch
              options={cycles.map((cycle) => ({
                value: cycle.id,
                label: cycle.name,
                description: cycle.kind === 'baseline' ? '基线' : '复测',
              }))}
              onChange={(value) => setCycleId(value || '')}
            />
            <Selector
              label="提示词"
              value={promptId}
              hasSearch
              options={prompts.map((prompt) => ({ value: prompt.id, label: prompt.text }))}
              onChange={(value) => setPromptId(value || '')}
            />
            <Selector
              label="平台"
              value={platform}
              options={PLATFORMS.map((item) => ({ value: item.id, label: item.label }))}
              onChange={(value) => setPlatform(value || 'deepseek')}
            />
            <TextArea
              label="回答原文"
              description="整段粘贴即可，包含它给出的网址。"
              value={answer}
              onChange={setAnswer}
              rows={8}
              width="100%"
            />
          </FormLayout>
          <Button label="解析并保存" variant="primary" type="submit" isLoading={saving} isDisabled={answer.trim().length < 10} />
        </VStack>
        <VStack gap={2}>
          <Text type="label">新轮次</Text>
          <FormLayout direction="horizontal">
            <TextInput label="名称" value={cycleName} onChange={setCycleName} placeholder="例如第 3 周抽查" />
            <Selector
              label="类型"
              value={cycleKind}
              options={[
                { value: 'baseline', label: '基线' },
                { value: 'retest', label: '复测' },
              ]}
              onChange={(value) => {
                if (value === 'baseline' || value === 'retest') setCycleKind(value)
              }}
            />
          </FormLayout>
          <Button label="添加轮次" variant="secondary" onClick={() => void addCycle()} isDisabled={cycleName.trim().length < 2} />
        </VStack>
        <Table
          data={rows}
          idKey="id"
          density="compact"
          hasHover
          verticalAlign="top"
          columns={[
            { key: 'when', header: '时间', width: pixel(120) },
            { key: 'cycleName', header: '轮次', width: pixel(120) },
            { key: 'platform', header: '平台', width: pixel(110) },
            { key: 'promptText', header: '提示词', width: proportional(2, { minWidth: 180 }) },
            { key: 'brand', header: '品牌', width: pixel(88) },
            { key: 'cited', header: '官网', width: pixel(88) },
            { key: 'competitors', header: '竞品', width: proportional(1, { minWidth: 120 }) },
            { key: 'sentiment', header: '语气', width: pixel(96) },
            { key: 'summary', header: '摘要', width: proportional(2, { minWidth: 220 }) },
            {
              key: 'id',
              header: '操作',
              width: pixel(88),
              renderCell: (row) => <Button label="删除" size="sm" variant="ghost" onClick={() => void remove(row.id)} />,
            },
          ]}
        />
      </VStack>
    </PageFrame>
  )
}
