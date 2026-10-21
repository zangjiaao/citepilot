import { useEffect, useState } from 'react'
import { Card } from '@astryxdesign/core/Card'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { PLAYBOOK } from '../../../shared/playbook.ts'
import { CLUSTER_LABEL } from '../../../shared/platforms.ts'
import type { Overview } from '../../../shared/types.ts'
import { api } from '../api'
import { percent } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, InfoBanner, PageFrame } from '../ui'

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
      description="每次抽样建一个轮次，粘贴回答，诊断公开页，再任选两批对比。不登录、不爬取任何对话产品。"
    >
      <VStack gap={4}>
        <ErrorBanner message={shellError || error} />
        {loading ? <Text type="supporting">正在读取工作室…</Text> : null}
        {!loading && !studioId ? <Text>还没有工作室。到档案页新建一个。</Text> : null}
        {llm && !llm.enabled ? (
          <InfoBanner
            title="当前使用规则和模板"
            description="没有配置 DeepSeek 密钥。题库生成、回答摘要和诊断建议都会走本地规则。配上密钥后，题目和诊断文字会改由模型撰写，监测里的提及和网址判断仍以规则为准。"
          />
        ) : null}
        {llm?.enabled ? (
          <InfoBanner title={`已连接 ${llm.model}`} description="生成题目和诊断建议会优先使用 DeepSeek。模型失败时自动退回模板和规则。" />
        ) : null}
        {overview ? (
          <Grid columns={{ minWidth: 180, max: 4 }} gap={3}>
            <Metric label="题库" value={String(counts?.prompts ?? 0)} detail={clusterDetail(counts?.byCluster)} />
            <Metric label="监测记录" value={String(counts?.observations ?? 0)} detail="含种子示例，可删除后换成你自己的粘贴" />
            <Metric
              label="最早一批提及率"
              value={percent(overview.earliest?.metrics.mentionRate)}
              detail={overview.earliest ? overview.earliest.name : '还没有抽查批次'}
            />
            <Metric
              label="最近一批提及率"
              value={percent(overview.latest?.metrics.mentionRate)}
              detail={
                overview.latest
                  ? overview.latest.id === overview.earliest?.id
                    ? `${overview.latest.name} · 再抽查一次就能对比`
                    : `${overview.latest.name} · 引用 ${percent(overview.latest.metrics.citationRate)}`
                  : '还没有抽查批次'
              }
            />
          </Grid>
        ) : null}
        <Collapsible defaultIsOpen={false} trigger="首次验证剧本（可选）">
          <VStack gap={3}>
            <Text color="secondary">
              第一次做验证时可以按这个顺序走一遍。日常监测不用按周：每次抽样新建一个抽查批次，再任选两批对比。
            </Text>
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
