import { useEffect, useState } from 'react'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { CLUSTER_LABEL, CYCLE_KIND_LABEL, platformLabel } from '../../../shared/platforms.ts'
import type { CompareReport, Cycle, CycleMetrics } from '../../../shared/types.ts'
import { api } from '../api'
import { percent } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, PageFrame } from '../ui'

interface CompareTableRow extends Record<string, unknown> {
  promptId: string
  cluster: string
  text: string
  fromMentioned: string
  toMentioned: string
  fromCited: string
  toCited: string
  competitors: string
}

export function ComparePage() {
  const { studioId } = useStudio()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [report, setReport] = useState<CompareReport | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!studioId) return
    api<{ cycles: Cycle[] }>(`/api/studios/${studioId}/cycles`)
      .then((payload) => {
        setCycles(payload.cycles)
        setFromId(payload.cycles[0]?.id || '')
        setToId(payload.cycles.at(-1)?.id || '')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '轮次加载失败'))
  }, [studioId])

  useEffect(() => {
    if (!studioId || !fromId || !toId) return
    const params = new URLSearchParams({ from: fromId, to: toId })
    api<CompareReport>(`/api/studios/${studioId}/compare?${params.toString()}`)
      .then(setReport)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '对比加载失败'))
  }, [studioId, fromId, toId])

  const rows: CompareTableRow[] = (report?.rows ?? []).map((row) => ({
    promptId: row.promptId,
    cluster: CLUSTER_LABEL[row.cluster] ?? row.cluster,
    text: row.text,
    fromMentioned: flag(row.fromMentioned),
    toMentioned: flag(row.toMentioned),
    fromCited: flag(row.fromCited),
    toCited: flag(row.toCited),
    competitors: [...new Set([...row.fromCompetitors, ...row.toCompetitors])].join('、') || '无',
  }))

  return (
    <PageFrame title="轮次对比" description="任选两轮，看同一道题有没有提到品牌、有没有引用官网。种子数据用第 0 周和第 4 周做第一对示例。">
      <VStack gap={4}>
        <ErrorBanner message={error} />
        {fromId && fromId === toId ? <Text color="secondary">两轮选的是同一个。再建一轮，才能看出优化前后的差别。</Text> : null}
        <HStack gap={3} wrap="wrap">
          <Selector
            label="对照轮次"
            value={fromId}
            hasSearch
            options={cycleOptions(cycles)}
            onChange={(value) => setFromId(value || '')}
          />
          <Selector
            label="本轮"
            value={toId}
            hasSearch
            options={cycleOptions(cycles)}
            onChange={(value) => setToId(value || '')}
          />
        </HStack>
        {report ? (
          <HStack gap={3} wrap="wrap">
            <RateBlock title={report.from?.name ?? '对照轮次'} metrics={report.from?.metrics} />
            <RateBlock title={report.to?.name ?? '本轮'} metrics={report.to?.metrics} />
          </HStack>
        ) : null}
        <Table
          data={rows}
          idKey="promptId"
          density="compact"
          hasHover
          verticalAlign="top"
          columns={[
            { key: 'cluster', header: '簇', width: pixel(80) },
            { key: 'text', header: '提示词', width: proportional(2, { minWidth: 220 }) },
            { key: 'fromMentioned', header: '对照提及', width: pixel(96) },
            { key: 'toMentioned', header: '本轮提及', width: pixel(96) },
            { key: 'fromCited', header: '对照引用', width: pixel(96) },
            { key: 'toCited', header: '本轮引用', width: pixel(96) },
            { key: 'competitors', header: '竞品', width: proportional(1, { minWidth: 140 }) },
          ]}
        />
      </VStack>
    </PageFrame>
  )
}

function RateBlock({ title, metrics }: { title: string; metrics?: CycleMetrics }) {
  return (
    <Section>
      <VStack gap={1}>
        <Heading level={2}>{title}</Heading>
        <Text>记录 {metrics?.observations ?? 0} 条，覆盖 {metrics?.promptsCovered ?? 0} 题</Text>
        <Text>品牌提及 {percent(metrics?.mentionRate)}</Text>
        <Text>自有网址 {percent(metrics?.citationRate)}</Text>
        <Text>出现竞品 {percent(metrics?.competitorRate)}</Text>
        {(metrics?.byPlatform ?? []).map((item) => (
          <Text key={item.platform} type="supporting" color="secondary">
            {platformLabel(item.platform)} {item.observations} 条，提及 {percent(item.mentionRate)}
          </Text>
        ))}
      </VStack>
    </Section>
  )
}

function cycleOptions(cycles: Cycle[]) {
  return cycles.map((cycle) => ({
    value: cycle.id,
    label: cycle.name,
    description: CYCLE_KIND_LABEL[cycle.kind] ?? cycle.kind,
  }))
}

function flag(value: boolean | null): string {
  if (value === null) return '未记录'
  return value ? '是' : '否'
}
