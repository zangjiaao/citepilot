import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { Overview } from '../../../shared/types.ts'
import { api } from '../api'
import { formatTime, percent } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, PageFrame, TipBanner } from '../ui'

export function OverviewPage() {
  const navigate = useNavigate()
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

  const ops = overview?.ops
  return (
    <PageFrame title="概览" description="看这个品牌的素材、题库、草稿和监测，下一步直接点进去。">
      <VStack gap={4}>
        <ErrorBanner message={shellError || error} />
        {loading ? <Text type="supporting">正在读取品牌…</Text> : null}
        {!loading && !studioId ? <Text>还没有品牌。到品牌页新建一个。</Text> : null}
        {ops?.empty ? (
          <Card>
            <VStack gap={3}>
              <Heading level={2}>先加产品或案例素材</Heading>
              <Text color="secondary">先把产品和客户场景放进素材库，再到题库评估并补盲区，然后起草。</Text>
              <HStack gap={2} wrap="wrap">
                <Button label="去素材库" variant="primary" onClick={() => navigate('/library')} />
                <Button label="去题库" variant="secondary" onClick={() => navigate('/prompts')} />
                <Button label="去起草" variant="secondary" onClick={() => navigate('/drafts/new')} />
              </HStack>
            </VStack>
          </Card>
        ) : null}
        {ops && !ops.empty ? (
          <Grid columns={{ minWidth: 180, max: 4 }} gap={3}>
            <StatusCard
              label="可公开素材"
              value={String(ops.counts.publicAssets)}
              detail={ops.counts.publicAssets === 0 ? '还没有可公开素材' : `产品 ${ops.counts.products} · 案例 ${ops.counts.cases}`}
              cta="打开素材库"
              onOpen={() => navigate('/library')}
            />
            <StatusCard
              label="题库"
              value={String(ops.counts.prompts)}
              detail={promptDetail(ops)}
              cta="打开题库"
              onOpen={() => navigate('/prompts')}
            />
            <StatusCard
              label="草稿"
              value={String(ops.counts.drafts)}
              detail={ops.counts.drafts === 0 ? '还没有草稿。发布在站外完成' : '发布在站外完成，这里只记草稿'}
              cta={ops.counts.drafts === 0 ? '去起草' : '打开草稿'}
              onOpen={() => navigate(ops.counts.drafts === 0 ? '/drafts/new' : '/drafts')}
            />
            <StatusCard
              label="近期被提及的题"
              value={ops.counts.cycleName ? String(ops.counts.mentionedPrompts) : '—'}
              detail={monitorDetail(ops)}
              cta="打开监测"
              onOpen={() => navigate('/monitor')}
            />
          </Grid>
        ) : null}
        {ops && !ops.empty ? (
          <VStack gap={3}>
            <Heading level={2}>下一步</Heading>
            {ops.actions.map((action) => (
              <Card key={action.id}>
                <VStack gap={2}>
                  <Heading level={3}>{action.title}</Heading>
                  <Text color="secondary">{action.detail}</Text>
                  <HStack>
                    <Button label={action.cta} variant={action.id === 'steady' ? 'secondary' : 'primary'} onClick={() => navigate(action.href)} />
                  </HStack>
                </VStack>
              </Card>
            ))}
          </VStack>
        ) : null}
        {ops && !ops.empty ? (
          <VStack gap={3}>
            <Heading level={2}>最近</Heading>
            {ops.recent.length === 0 ? <Text color="secondary">还没有草稿或监测记录。</Text> : null}
            {ops.recent.map((item) => (
              <Card key={`${item.kind}-${item.id}`}>
                <HStack gap={3} vAlign="center" wrap="wrap">
                  <VStack gap={1}>
                    <Text>{item.title}</Text>
                    <Text type="supporting" color="secondary">
                      {item.detail} · {formatTime(item.at)}
                    </Text>
                  </VStack>
                  <Button label="打开" size="sm" variant="ghost" onClick={() => navigate(item.href)} />
                </HStack>
              </Card>
            ))}
          </VStack>
        ) : null}
        {llm && !llm.enabled ? <TipBanner id="llm-off" page="overview" title="没有模型密钥，题库和诊断走本地规则。到设置里配上密钥后再用模型。" /> : null}
        {llm?.enabled ? <TipBanner id="llm-on" page="overview" title={`已连接 ${llm.label || llm.model}，生成和诊断优先用这套模型。`} /> : null}
      </VStack>
    </PageFrame>
  )
}

function promptDetail(ops: NonNullable<Overview['ops']>): string {
  const coverage = ops.actions.find((item) => item.id === 'coverage' || item.id === 'prompts' || item.id === 'brand-gaps')
  if (coverage) return coverage.title
  if (ops.counts.prompts === 0) return '还没有题'
  return '已盖住当前素材'
}

function monitorDetail(ops: NonNullable<Overview['ops']>): string {
  if (!ops.counts.cycleName) return '还没有监测轮次'
  const rate = percent(ops.counts.mentionRate)
  return `${ops.counts.cycleName} · 样本提及率 ${rate}`
}

function StatusCard({ label, value, detail, cta, onOpen }: { label: string; value: string; detail: string; cta: string; onOpen: () => void }) {
  return (
    <Card>
      <VStack gap={2}>
        <Text type="supporting" color="secondary">
          {label}
        </Text>
        <Heading level={2}>{value}</Heading>
        <Text type="supporting" color="secondary">
          {detail}
        </Text>
        <Button label={cta} size="sm" variant="ghost" onClick={onOpen} />
      </VStack>
    </Card>
  )
}
