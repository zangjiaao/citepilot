import { useEffect, useState } from 'react'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { CLUSTER_LABEL, platformLabel } from '../../../shared/platforms.ts'
import type { CompareReport, Cycle, CycleMetrics } from '../../../shared/types.ts'
import { api } from '../api'
import { percent } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, PageFrame } from '../ui'

interface CompareTableRow extends Record<string, unknown> {
  promptId: string
  cluster: string
  text: string
  baselineMentioned: string
  retestMentioned: string
  baselineCited: string
  retestCited: string
  competitors: string
}

export function ComparePage() {
  const { studioId } = useStudio()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [baselineId, setBaselineId] = useState('')
  const [retestId, setRetestId] = useState('')
  const [report, setReport] = useState<CompareReport | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!studioId) return
    api<{ cycles: Cycle[] }>(`/api/studios/${studioId}/cycles`)
      .then((payload) => {
        setCycles(payload.cycles)
        setBaselineId((current) => current || payload.cycles.find((item) => item.kind === 'baseline')?.id || '')
        setRetestId((current) => current || [...payload.cycles].reverse().find((item) => item.kind === 'retest')?.id || '')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '轮次加载失败'))
  }, [studioId])

  useEffect(() => {
    if (!studioId || !baselineId || !retestId) return
    const params = new URLSearchParams({ baseline: baselineId, retest: retestId })
    api<CompareReport>(`/api/studios/${studioId}/compare?${params.toString()}`)
      .then(setReport)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '对比加载失败'))
  }, [studioId, baselineId, retestId])

  const rows: CompareTableRow[] = (report?.rows ?? []).map((row) => ({
    promptId: row.promptId,
    cluster: CLUSTER_LABEL[row.cluster] ?? row.cluster,
    text: row.text,
    baselineMentioned: flag(row.baselineMentioned),
    retestMentioned: flag(row.retestMentioned),
    baselineCited: flag(row.baselineCited),
    retestCited: flag(row.retestCited),
    competitors: [...new Set([...row.baselineCompetitors, ...row.retestCompetitors])].join('、') || '无',
  }))

  return (
    <PageFrame title="基线对比复测" description="同一道题在两个轮次里是否提到品牌、是否引用官网。种子数据里，复测比基线多提到了澄川。">
      <VStack gap={4}>
        <ErrorBanner message={error} />
        <HStack gap={3} wrap="wrap">
          <Selector
            label="基线轮次"
            value={baselineId}
            options={cycles.filter((cycle) => cycle.kind === 'baseline').map((cycle) => ({ value: cycle.id, label: cycle.name }))}
            onChange={(value) => setBaselineId(value || '')}
          />
          <Selector
            label="复测轮次"
            value={retestId}
            options={cycles.filter((cycle) => cycle.kind === 'retest').map((cycle) => ({ value: cycle.id, label: cycle.name }))}
            onChange={(value) => setRetestId(value || '')}
          />
        </HStack>
        {report ? (
          <HStack gap={3} wrap="wrap">
            <RateBlock title={report.baseline?.name ?? '基线'} metrics={report.baseline?.metrics} />
            <RateBlock title={report.retest?.name ?? '复测'} metrics={report.retest?.metrics} />
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
            { key: 'baselineMentioned', header: '基线提及', width: pixel(96) },
            { key: 'retestMentioned', header: '复测提及', width: pixel(96) },
            { key: 'baselineCited', header: '基线引用', width: pixel(96) },
            { key: 'retestCited', header: '复测引用', width: pixel(96) },
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

function flag(value: boolean | null): string {
  if (value === null) return '未记录'
  return value ? '是' : '否'
}
