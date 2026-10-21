import { useEffect, useState } from 'react'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { SOURCE_LABEL } from '../../../shared/platforms.ts'
import type { CheckItem, Diagnosis } from '../../../shared/types.ts'
import { api } from '../api'
import { formatTime } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, PageFrame } from '../ui'

interface CheckRow extends Record<string, unknown> {
  id: string
  label: string
  status: CheckItem['status']
  detail: string
}

interface HistoryRow extends Record<string, unknown> {
  id: string
  when: string
  url: string
  title: string
  source: string
  score: string
}

export function DiagnosisPage() {
  const { studio, studioId } = useStudio()
  const [url, setUrl] = useState('')
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [currentId, setCurrentId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (studio && !url) setUrl(studio.website)
  }, [studio, url])

  const load = async (id: string) => {
    const payload = await api<{ diagnoses: Diagnosis[] }>(`/api/studios/${id}/diagnoses`)
    setDiagnoses(payload.diagnoses)
    setCurrentId((current) => current || payload.diagnoses[0]?.id || '')
  }

  useEffect(() => {
    if (!studioId) return
    load(studioId).catch((err: unknown) => setError(err instanceof Error ? err.message : '诊断记录加载失败'))
  }, [studioId])

  const run = async () => {
    if (!studioId) return
    setError('')
    const result = await api<{ diagnosis: Diagnosis }>(`/api/studios/${studioId}/diagnoses`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
    setCurrentId(result.diagnosis.id)
    await load(studioId)
    setCurrentId(result.diagnosis.id)
  }

  const current = diagnoses.find((item) => item.id === currentId) ?? diagnoses[0]
  const rows: CheckRow[] = (current?.checklist ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    status: item.status,
    detail: item.detail,
  }))
  const history: HistoryRow[] = diagnoses.map((item) => ({
    id: item.id,
    when: formatTime(item.createdAt),
    url: item.finalUrl,
    title: item.title || '（无标题）',
    source: SOURCE_LABEL[item.suggestionSource] ?? item.suggestionSource,
    score: `${item.checklist.filter((check) => check.status === 'fail').length} 项缺失 / ${item.checklist.filter((check) => check.status === 'warn').length} 项待改进`,
  }))

  return (
    <PageFrame
      title="门户诊断"
      description="抓取官网公开 HTML、robots.txt 和 llms.txt，给出 GEO/SEO 清单。不会登录，也不会执行页面脚本。"
      actions={<Button label="抓取并诊断" variant="primary" clickAction={run} isDisabled={!studioId || url.trim().length < 8} />}
    >
      <VStack gap={4}>
        <ErrorBanner message={error} />
        <TextInput label="诊断地址" value={url} onChange={setUrl} width="100%" description="默认使用档案里的官网，也可以换成站内某一篇公开文章。" />
        {current ? (
          <VStack gap={3}>
            <Heading level={2}>{current.title || '未读到标题'}</Heading>
            <Text type="supporting" color="secondary">
              {current.finalUrl} · HTTP {current.httpStatus} · 建议来自{SOURCE_LABEL[current.suggestionSource] ?? current.suggestionSource}
            </Text>
            {current.excerpt ? <Text color="secondary">{current.excerpt}</Text> : null}
            <Table
              data={rows}
              idKey="id"
              density="compact"
              verticalAlign="top"
              columns={[
                { key: 'label', header: '检查项', width: pixel(140) },
                {
                  key: 'status',
                  header: '结果',
                  width: pixel(100),
                  renderCell: (row) =>
                    row.status === 'pass' ? (
                      <Text type="supporting">通过</Text>
                    ) : (
                      <Badge variant={row.status === 'fail' ? 'error' : 'warning'} label={row.status === 'fail' ? '缺失' : '待改进'} />
                    ),
                },
                { key: 'detail', header: '说明', width: proportional(2, { minWidth: 220 }) },
              ]}
            />
            <Heading level={2}>改进建议</Heading>
            <VStack gap={2}>
              {current.suggestions.map((suggestion) => (
                <Text key={suggestion}>{suggestion}</Text>
              ))}
            </VStack>
          </VStack>
        ) : (
          <Text type="supporting">还没有诊断。种子官网是 example.com，可以直接抓一次看清单。</Text>
        )}
        {history.length > 0 ? (
          <VStack gap={2}>
            <Heading level={2}>历史</Heading>
            <Table
              data={history}
              idKey="id"
              density="compact"
              hasHover
              columns={[
                { key: 'when', header: '时间', width: pixel(120) },
                { key: 'title', header: '标题', width: proportional(1, { minWidth: 140 }) },
                { key: 'score', header: '结果', width: pixel(180) },
                { key: 'source', header: '建议来源', width: pixel(110) },
                {
                  key: 'id',
                  header: '操作',
                  width: pixel(88),
                  renderCell: (row) => <Button label="查看" size="sm" variant="ghost" onClick={() => setCurrentId(row.id)} />,
                },
              ]}
            />
          </VStack>
        ) : null}
      </VStack>
    </PageFrame>
  )
}
