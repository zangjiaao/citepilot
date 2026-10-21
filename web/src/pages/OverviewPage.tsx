import { useEffect, useState } from 'react'
import { Card } from '@astryxdesign/core/Card'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
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
      title="GEO/AEO 自测"
      description="用题库问回答引擎，粘贴回答，诊断公开页，再比较基线和复测。不登录、不爬取任何对话产品。"
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
              label="基线提及率"
              value={percent(overview.baseline?.metrics.mentionRate)}
              detail={overview.baseline ? overview.baseline.name : '还没有基线轮次'}
            />
            <Metric
              label="复测提及率"
              value={percent(overview.retest?.metrics.mentionRate)}
              detail={overview.retest ? `${overview.retest.name} · 引用 ${percent(overview.retest.metrics.citationRate)}` : '还没有复测'}
            />
          </Grid>
        ) : null}
        <Section>
          <VStack gap={3}>
            <Heading level={2}>四周自测</Heading>
            {PLAYBOOK.map((step) => (
              <VStack key={step.week} gap={1}>
                <Heading level={3}>
                  {step.week} · {step.title}
                </Heading>
                <Text color="secondary">{step.detail}</Text>
              </VStack>
            ))}
          </VStack>
        </Section>
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
