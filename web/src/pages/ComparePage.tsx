import { useEffect, useState } from 'react'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { sampleStabilityNote } from '../../../shared/compare.ts'
import { CLUSTER_LABEL, CYCLE_KIND_LABEL, platformLabel } from '../../../shared/platforms.ts'
import { SELF_BRAND_KEY, type CompareReport, type Cycle, type CycleMetrics } from '../../../shared/types.ts'
import { api } from '../api'
import { formatRank, percent, sampleFraction } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, PageFrame, WarningBanner } from '../ui'

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
    fromMentioned: sampleFraction(row.fromMentionedSamples, row.fromSamples),
    toMentioned: sampleFraction(row.toMentionedSamples, row.toSamples),
    fromCited: sampleFraction(row.fromCitedSamples, row.fromSamples),
    toCited: sampleFraction(row.toCitedSamples, row.toSamples),
    competitors: [...new Set([...row.fromCompetitors, ...row.toCompetitors])].join('、') || '无',
  }))

  return (
    <PageFrame
      title="与基线对比"
      description="左侧选基线，右侧选后来的监测。提及和引用按样本计，分子是命中的样本。两侧同时给出声量占比、平均排名和样本量。"
    >
      <VStack gap={4}>
        <ErrorBanner message={error} />
        {fromId && fromId === toId ? (
          <Text color="secondary">选的是同一个批次。过一段时间再用同一套题测一批，才能看出相对基线的抬升。</Text>
        ) : null}
        <Text color="secondary">一轮见效后，可以把最近这批当作新的基线：下一轮对比时把它放在左侧，或新建时把类型选成基线。</Text>
        <HStack gap={3} wrap="wrap">
          <Selector
            label="基线"
            value={fromId}
            hasSearch
            options={cycleOptions(cycles)}
            onChange={(value) => setFromId(value || '')}
          />
          <Selector
            label="后续监测"
            value={toId}
            hasSearch
            options={cycleOptions(cycles)}
            onChange={(value) => setToId(value || '')}
          />
        </HStack>
        {report ? (
          <HStack gap={3} wrap="wrap">
            <RateBlock title={report.from?.name ?? '基线'} metrics={report.from?.metrics} />
            <RateBlock title={report.to?.name ?? '后续监测'} metrics={report.to?.metrics} />
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
            { key: 'fromMentioned', header: '基线提及', width: pixel(110) },
            { key: 'toMentioned', header: '后续提及', width: pixel(110) },
            { key: 'fromCited', header: '基线引用', width: pixel(110) },
            { key: 'toCited', header: '后续引用', width: pixel(110) },
            { key: 'competitors', header: '竞品', width: proportional(1, { minWidth: 140 }) },
          ]}
        />
      </VStack>
    </PageFrame>
  )
}

function RateBlock({ title, metrics }: { title: string; metrics?: CycleMetrics }) {
  const note = sampleStabilityNote(metrics?.observations ?? 0)
  const brands = (metrics?.brands ?? []).filter((brand) => brand.key === SELF_BRAND_KEY || brand.mentions > 0 || brand.citedSamples > 0)
  return (
    <Section>
      <VStack gap={1}>
        <Heading level={2}>{title}</Heading>
        {note ? <WarningBanner title="结论不稳定" description={note} /> : null}
        <Text>
          样本量 {metrics?.observations ?? 0}，覆盖 {metrics?.promptsCovered ?? 0} 题
        </Text>
        <Text>提及率 {percent(metrics?.mentionRate)}</Text>
        <Text>引用率 {percent(metrics?.citationRate)}</Text>
        <Text>声量占比 {percent(metrics?.shareOfVoice)}</Text>
        <Text>平均排名 {formatRank(metrics?.averageRank)}</Text>
        {brands.map((brand) => (
          <Text key={brand.key} type="supporting" color="secondary">
            {brand.name} 提及 {brand.mentions} 次 · 占比 {percent(brand.share)} · 均排 {formatRank(brand.averageRank)}
          </Text>
        ))}
        {(metrics?.byPlatform ?? []).map((item) => (
          <Text key={item.platform} type="supporting" color="secondary">
            {platformLabel(item.platform)} {item.observations} 条样本，提及 {percent(item.mentionRate)}，声量 {percent(item.shareOfVoice)}
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
