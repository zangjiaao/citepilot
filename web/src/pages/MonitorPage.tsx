import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { metricsFor, sampleStabilityNote } from '../../../shared/compare.ts'
import { defaultCycleName } from '../../../shared/cycles.ts'
import { CYCLE_KIND_LABEL, PLATFORMS, SENTIMENT_LABEL, isCycleKind, platformLabel } from '../../../shared/platforms.ts'
import { SELF_BRAND_KEY, type Cycle, type CycleKind, type CycleMetrics, type Observation, type Prompt, type SampleGroup } from '../../../shared/types.ts'
import { api } from '../api'
import { formatRank, formatTime, percent } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, InfoBanner, PageFrame, WarningBanner } from '../ui'

interface ObsRow extends Record<string, unknown> {
  id: string
  when: string
  cycleName: string
  platform: string
  promptText: string
  brand: string
  rank: string
  cited: string
  competitors: string
  sentiment: string
  summary: string
}

interface GroupRow extends Record<string, unknown> {
  id: string
  label: string
  samples: string
  mention: string
  citation: string
  share: string
  rank: string
  note: string
}

export function MonitorPage() {
  const { studioId, studio } = useStudio()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [observations, setObservations] = useState<Observation[]>([])
  const [promptId, setPromptId] = useState('')
  const [cycleId, setCycleId] = useState('')
  const [platformChoice, setPlatformChoice] = useState('deepseek')
  const [customPlatform, setCustomPlatform] = useState('')
  const [answer, setAnswer] = useState('')
  const [cycleName, setCycleName] = useState(() => defaultCycleName())
  const [cycleKind, setCycleKind] = useState<CycleKind>('custom')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const platform = platformChoice === 'custom' ? customPlatform.trim() : platformChoice

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
    setCycleId((current) => (current && cyclePayload.cycles.some((cycle) => cycle.id === current) ? current : cyclePayload.cycles.at(-1)?.id || ''))
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
    setCycleName(defaultCycleName())
    setCycleId(result.cycle.id)
    await load(studioId)
  }

  const removeCycle = async (id: string) => {
    if (!studioId || !window.confirm('删除这个还没有监测记录的轮次？')) return
    setError('')
    try {
      await api(`/api/studios/${studioId}/cycles/${id}`, { method: 'DELETE' })
      if (cycleId === id) setCycleId('')
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除轮次失败')
    }
  }

  const remove = async (id: string) => {
    if (!studioId || !window.confirm('删除这条粘贴记录？')) return
    await api(`/api/studios/${studioId}/observations/${id}`, { method: 'DELETE' })
    await load(studioId)
  }

  const selected = cycles.find((cycle) => cycle.id === cycleId)
  const cycleObservations = observations.filter((item) => item.cycleId === cycleId)
  const samePrompt = cycleObservations.filter((item) => item.promptId === promptId).length
  const metrics = metricsFor(
    cycleObservations,
    studio ? { ownName: studio.name, website: studio.website, competitors: studio.competitors } : undefined,
  )
  const rows: ObsRow[] = cycleObservations.map((item) => ({
    id: item.id,
    when: formatTime(item.createdAt),
    cycleName: item.cycleName,
    platform: platformLabel(item.platform),
    promptText: item.promptText,
    brand: mentionedLabel(item),
    rank: rankLabel(item),
    cited: citedLabel(item),
    competitors: competitorLabel(item),
    sentiment: SENTIMENT_LABEL[item.sentiment] ?? item.sentiment,
    summary: item.summary,
  }))

  return (
    <PageFrame
      title="监测"
      description="选一个批次，把同一套题的回答粘贴进来。同一道题可以贴多条，每条标一个平台，也可以自己填平台名。指标按样本算，不访问登录后的对话页面。"
    >
      <VStack gap={4}>
        <ErrorBanner message={error} />
        {notice ? <InfoBanner title="这条样本已记下" description={notice} /> : null}
        <VStack as="form" gap={3} onSubmit={(event) => void save(event)}>
          <FormLayout direction="vertical">
            <Selector
              label="抽查批次"
              value={cycleId}
              hasSearch
              options={cycles.map((cycle) => ({
                value: cycle.id,
                label: cycle.name,
                description: CYCLE_KIND_LABEL[cycle.kind] ?? cycle.kind,
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
              value={platformChoice}
              options={[...PLATFORMS.map((item) => ({ value: item.id, label: item.label })), { value: 'custom', label: '自定义' }]}
              onChange={(value) => setPlatformChoice(value || 'deepseek')}
            />
            {platformChoice === 'custom' ? (
              <TextInput
                label="自定义平台"
                description="例如元宝、纳米搜索。保存后按这个名字分组。"
                value={customPlatform}
                onChange={setCustomPlatform}
                width="100%"
              />
            ) : null}
            <TextArea
              label="回答原文"
              description={
                samePrompt > 0
                  ? `这道题在当前批次已有 ${samePrompt} 条样本。再贴一条会多算一个样本。整段粘贴即可，包含它给出的网址。`
                  : '整段粘贴即可，包含它给出的网址。同一平台也可以多贴几条。'
              }
              value={answer}
              onChange={setAnswer}
              rows={8}
              width="100%"
            />
          </FormLayout>
          <Button
            label="解析并保存"
            variant="primary"
            type="submit"
            isLoading={saving}
            isDisabled={answer.trim().length < 10 || platform.length === 0 || !promptId || !cycleId}
          />
        </VStack>
        {selected ? <BatchMetrics name={selected.name} metrics={metrics} /> : null}
        <VStack gap={2}>
          <Text type="label">抽查批次</Text>
          <Text color="secondary">第一批把类型选成基线。过一段时间再新建一批，名称默认是今天的日期加「抽查」，题还是同一套。见效后可以把最近这批当作下一轮的基线。</Text>
          <FormLayout direction="horizontal">
            <TextInput label="名称" value={cycleName} onChange={setCycleName} placeholder="例如改站后" />
            <Selector
              label="类型"
              value={cycleKind}
              options={[
                { value: 'custom', label: '抽查' },
                { value: 'baseline', label: '基线' },
                { value: 'retest', label: '复测' },
              ]}
              onChange={(value) => {
                if (value && isCycleKind(value)) setCycleKind(value)
              }}
            />
          </FormLayout>
          <Button label="添加轮次" variant="secondary" onClick={() => void addCycle()} isDisabled={cycleName.trim().length < 2} />
          <Table
            data={cycles.map((cycle) => ({
              id: cycle.id,
              name: cycle.name,
              kind: CYCLE_KIND_LABEL[cycle.kind] ?? cycle.kind,
              count: String(observations.filter((item) => item.cycleId === cycle.id).length),
            }))}
            idKey="id"
            density="compact"
            columns={[
              { key: 'name', header: '名称', width: proportional(2, { minWidth: 160 }) },
              { key: 'kind', header: '类型', width: pixel(100) },
              { key: 'count', header: '样本', width: pixel(80) },
              {
                key: 'id',
                header: '操作',
                width: pixel(88),
                renderCell: (row) => (
                  <Button
                    label="删除"
                    size="sm"
                    variant="ghost"
                    onClick={() => void removeCycle(row.id)}
                    isDisabled={observations.some((item) => item.cycleId === row.id)}
                  />
                ),
              },
            ]}
          />
        </VStack>
        <VStack gap={2}>
          <Text type="label">当前批次的样本</Text>
          <Text color="secondary">同一道题的多条回答都留在这里。旧的一题一答仍算 1 个样本。</Text>
          <Table
            data={rows}
            idKey="id"
            density="compact"
            hasHover
            verticalAlign="top"
            columns={[
              { key: 'when', header: '时间', width: pixel(120) },
              { key: 'platform', header: '平台', width: pixel(110) },
              { key: 'promptText', header: '提示词', width: proportional(2, { minWidth: 180 }) },
              { key: 'brand', header: '品牌', width: pixel(88) },
              { key: 'rank', header: '排名', width: pixel(72) },
              { key: 'cited', header: '官网', width: pixel(88) },
              { key: 'competitors', header: '竞品', width: proportional(1, { minWidth: 140 }) },
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
      </VStack>
    </PageFrame>
  )
}

function BatchMetrics({ name, metrics }: { name: string; metrics: CycleMetrics }) {
  const note = sampleStabilityNote(metrics.observations)
  return (
    <VStack gap={3}>
      <Heading level={2}>{name}</Heading>
      {note ? <WarningBanner title="结论不稳定" description={`${note}。再多贴几条，按平台和按题的比例会更稳。`} /> : null}
      <Text>
        样本量 {metrics.observations}，覆盖 {metrics.promptsCovered} 题。提及率 {percent(metrics.mentionRate)}，引用率 {percent(metrics.citationRate)}
        ，声量占比 {percent(metrics.shareOfVoice)}，平均排名 {formatRank(metrics.averageRank)}。
      </Text>
      <Text type="label">追踪品牌</Text>
      <Table
        data={metrics.brands.map((brand) => ({
          id: brand.key,
          name: brand.name,
          mentions: String(brand.mentions),
          share: percent(brand.share),
          rank: formatRank(brand.averageRank),
          cited: String(brand.citedSamples),
        }))}
        idKey="id"
        density="compact"
        columns={[
          { key: 'name', header: '品牌', width: proportional(2, { minWidth: 140 }) },
          { key: 'mentions', header: '提及次数', width: pixel(100) },
          { key: 'share', header: '声量占比', width: pixel(100) },
          { key: 'rank', header: '平均排名', width: pixel(100) },
          { key: 'cited', header: '引用样本', width: pixel(100) },
        ]}
      />
      <Text type="label">按平台</Text>
      <Table data={groupRows(metrics.byPlatform.map((item) => ({ id: item.platform, label: platformLabel(item.platform), group: item })))} idKey="id" density="compact" columns={groupColumns} />
      <Text type="label">按题</Text>
      <Table
        data={groupRows(metrics.byPrompt.map((item) => ({ id: item.promptId, label: item.promptText, group: item })))}
        idKey="id"
        density="compact"
        verticalAlign="top"
        columns={groupColumns}
      />
    </VStack>
  )
}

const groupColumns = [
  { key: 'label', header: '分组', width: proportional(2, { minWidth: 160 }) },
  { key: 'samples', header: '样本', width: pixel(72) },
  { key: 'mention', header: '提及率', width: pixel(88) },
  { key: 'citation', header: '引用率', width: pixel(88) },
  { key: 'share', header: '声量占比', width: pixel(100) },
  { key: 'rank', header: '平均排名', width: pixel(100) },
  { key: 'note', header: '说明', width: pixel(140) },
]

function groupRows(items: Array<{ id: string; label: string; group: SampleGroup }>): GroupRow[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    samples: String(item.group.observations),
    mention: percent(item.group.mentionRate),
    citation: percent(item.group.citationRate),
    share: percent(item.group.shareOfVoice),
    rank: formatRank(item.group.averageRank),
    note: item.group.observations > 0 && !item.group.stable ? '样本少，不稳定' : '',
  }))
}

function mentionedLabel(item: Observation): string {
  const self = item.brandHits.find((hit) => hit.key === SELF_BRAND_KEY)
  if (self) return self.mentioned ? '已提及' : '未提及'
  return item.brandMentioned ? '已提及' : '未提及'
}

function citedLabel(item: Observation): string {
  const self = item.brandHits.find((hit) => hit.key === SELF_BRAND_KEY)
  if (self) return self.cited ? '已引用' : '未引用'
  return item.ownUrlCited ? '已引用' : '未引用'
}

function rankLabel(item: Observation): string {
  const self = item.brandHits.find((hit) => hit.key === SELF_BRAND_KEY)
  if (!self?.mentioned) return '未出现'
  return self.rank ? String(self.rank) : '—'
}

function competitorLabel(item: Observation): string {
  const named = item.brandHits.filter((hit) => hit.key !== SELF_BRAND_KEY && hit.mentioned)
  if (item.brandHits.length > 0) {
    if (named.length === 0) return '无'
    return named.map((hit) => (hit.rank ? `${hit.name}（第 ${hit.rank}）` : hit.name)).join('、')
  }
  return item.competitorsMentioned.join('、') || '无'
}
