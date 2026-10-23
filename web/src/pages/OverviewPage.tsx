import { useEffect, useState } from 'react'
import { Card } from '@astryxdesign/core/Card'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { NEXT_BASELINE_NOTE, PRODUCT_LOOP } from '../../../shared/loop.ts'
import { PLAYBOOK } from '../../../shared/playbook.ts'
import { CLUSTER_LABEL, CYCLE_KIND_LABEL } from '../../../shared/platforms.ts'
import type { CycleTrendPoint, Overview } from '../../../shared/types.ts'
import { api } from '../api'
import { formatRank, percent } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, PageFrame, TipBanner } from '../ui'

export function OverviewPage() {
  const { studioId, llm, loading, error: shellError } = useStudio()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!studioId) return
    let active = true
    api<Overview>(`/api/studios/${studioId}/overview`)
      .then((data) => {
        if (active) setOverview(data)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : '概览加载失败')
      })
    return () => {
      active = false
    }
  }, [studioId])

  const counts = overview?.counts
  return (
    <PageFrame
      title="GEO/AEO 监测"
      description="先做基线监测，再整站和内容分发，过一段时间用同一套题再测，然后与基线对比，看提及和引用有没有抬升。不登录、不爬取任何对话产品。"
    >
      <VStack gap={4}>
        <ErrorBanner message={shellError || error} />
        {loading ? <Text type="supporting">正在读取品牌…</Text> : null}
        {!loading && !studioId ? <Text>还没有品牌。到品牌页新建一个。</Text> : null}
        {llm && !llm.enabled ? <TipBanner id="llm-off" page="overview" title="没有模型密钥，题库和诊断走本地规则。到设置里配上密钥后再用模型。" /> : null}
        {llm?.enabled ? <TipBanner id="llm-on" page="overview" title={`已连接 ${llm.label || llm.model}，生成和诊断优先用这套模型。`} /> : null}
        <VStack gap={3}>
          <Heading level={2}>监测循环</Heading>
          {PRODUCT_LOOP.map((step) => (
            <VStack key={step.step} gap={1}>
              <Heading level={3}>
                {step.step}. {step.title}
              </Heading>
              <Text color="secondary">{step.detail}</Text>
            </VStack>
          ))}
          <Text color="secondary">{NEXT_BASELINE_NOTE}</Text>
        </VStack>
        {overview ? (
          <Grid columns={{ minWidth: 180, max: 4 }} gap={3}>
            <Metric label="题库" value={String(counts?.prompts ?? 0)} detail={clusterDetail(counts?.byCluster)} />
            <Metric label="监测样本" value={String(counts?.observations ?? 0)} detail="同一题的多条回答各算一个样本" />
            <Metric
              label="最早一批提及率"
              value={percent(overview.earliest?.metrics.mentionRate)}
              detail={overview.earliest ? `${overview.earliest.name} · 声量 ${percent(overview.earliest.metrics.shareOfVoice)}` : '还没有抽查批次'}
            />
            <Metric
              label="最近一批提及率"
              value={percent(overview.latest?.metrics.mentionRate)}
              detail={
                overview.latest
                  ? overview.latest.id === overview.earliest?.id
                    ? `${overview.latest.name} · 再抽查一次就能看趋势`
                    : `${overview.latest.name} · 声量 ${percent(overview.latest.metrics.shareOfVoice)} · 样本 ${overview.latest.metrics.observations}`
                  : '还没有抽查批次'
              }
            />
          </Grid>
        ) : null}
        {overview && overview.trend.length > 0 ? <Trend trend={overview.trend} /> : null}
        <Collapsible defaultIsOpen={false} trigger="四周自测（可选）">
          <VStack gap={3}>
            <Text color="secondary">只在第一次验证时用。日常按上面的监测循环，不用按周。</Text>
            {PLAYBOOK.map((step) => (
              <VStack key={step.week} gap={1}>
                <Heading level={3}>
                  {step.week} · {step.title}
                </Heading>
                <Text color="secondary">{step.detail}</Text>
              </VStack>
            ))}
          </VStack>
        </Collapsible>
      </VStack>
    </PageFrame>
  )
}

function Trend({ trend }: { trend: CycleTrendPoint[] }) {
  return (
    <VStack gap={3}>
      <Heading level={2}>批次趋势</Heading>
      <Text color="secondary">按批次看提及率和声量占比。条越长越高。样本量少于 5 时，这一批的结论不稳定。</Text>
      {trend.map((point) => (
        <VStack key={point.id} gap={2}>
          <Text>
            {point.name} · {CYCLE_KIND_LABEL[point.kind] ?? point.kind} · 样本 {point.samples}
            {point.stable ? '' : ' · 结论不稳'}
            {` · 平均排名 ${formatRank(point.averageRank)}`}
          </Text>
          <ProgressBar
            label="提及率"
            value={(point.mentionRate ?? 0) * 100}
            hasValueLabel
            variant={point.stable ? 'accent' : 'warning'}
            formatValueLabel={() => percent(point.mentionRate)}
          />
          <ProgressBar
            label="声量占比"
            value={(point.shareOfVoice ?? 0) * 100}
            hasValueLabel
            variant="neutral"
            formatValueLabel={() => percent(point.shareOfVoice)}
          />
        </VStack>
      ))}
    </VStack>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <VStack gap={1}>
        <Text type="supporting" color="secondary">
          {label}
        </Text>
        <Heading level={2}>{value}</Heading>
        <Text type="supporting" color="secondary">
          {detail}
        </Text>
      </VStack>
    </Card>
  )
}

function clusterDetail(byCluster: Overview['counts']['byCluster'] | undefined): string {
  if (!byCluster) return ''
  const keys = ['brand', 'category', 'comparison', 'scenario'] as const
  return keys.map((key) => `${CLUSTER_LABEL[key]} ${byCluster[key]}`).join(' · ')
}
