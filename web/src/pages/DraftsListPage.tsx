import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { contentTypeForChannel, contentTypeLabel } from '../../../shared/draftPrompt.ts'
import type { ContentDraft } from '../../../shared/types.ts'
import { api } from '../api'
import { formatTime } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, PageFrame } from '../ui'

interface DraftRow extends Record<string, unknown> {
  id: string
  when: string
  contentType: string
  title: string
}

export function DraftsListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { studioId } = useStudio()
  const [drafts, setDrafts] = useState<ContentDraft[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const asset = searchParams.get('asset')
    if (asset) navigate(`/drafts/new?asset=${encodeURIComponent(asset)}`, { replace: true })
  }, [searchParams, navigate])

  useEffect(() => {
    if (!studioId) return
    api<{ drafts: ContentDraft[] }>(`/api/studios/${studioId}/drafts`)
      .then((result) => setDrafts(result.drafts))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '草稿加载失败'))
  }, [studioId])

  const remove = async (id: string) => {
    if (!studioId || !window.confirm('删除这篇草稿？')) return
    setError('')
    try {
      await api(`/api/studios/${studioId}/drafts/${id}`, { method: 'DELETE' })
      setDrafts((current) => current.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const rows: DraftRow[] = drafts.map((item) => ({
    id: item.id,
    when: formatTime(item.updatedAt || item.createdAt),
    contentType: contentTypeLabel(contentTypeForChannel(item.channel)),
    title: item.title,
  }))

  return (
    <PageFrame
      title="内容起草"
      description="已保存的稿子在这里。新建一篇时再选素材、内容类型和植入强度。"
      actions={<Button label="新建草稿" variant="primary" onClick={() => navigate('/drafts/new')} isDisabled={!studioId} />}
    >
      <VStack gap={4}>
        <ErrorBanner message={error} />
        {rows.length === 0 ? (
          <EmptyState title="还没有保存的草稿" description="点「新建草稿」，选好可公开的素材后再生成。发布仍在站外完成。" />
        ) : (
          <Table
            data={rows}
            idKey="id"
            density="compact"
            hasHover
            verticalAlign="middle"
            textOverflow="truncate"
            columns={[
              {
                key: 'title',
                header: '标题',
                width: proportional(2, { minWidth: 180 }),
                renderCell: (row) => <Button label={row.title} size="sm" variant="ghost" onClick={() => navigate(`/drafts/${row.id}`)} />,
              },
              { key: 'contentType', header: '内容类型', width: pixel(160) },
              { key: 'when', header: '更新时间', width: pixel(150) },
              {
                key: 'id',
                header: '操作',
                width: pixel(150),
                resizable: false,
                renderCell: (row) => (
                  <HStack gap={1}>
                    <Button label="编辑" size="sm" variant="secondary" onClick={() => navigate(`/drafts/${row.id}`)} />
                    <Button label="删除" size="sm" variant="ghost" onClick={() => void remove(row.id)} />
                  </HStack>
                ),
              },
            ]}
          />
        )}
        {rows.length > 0 ? <Text color="secondary">{rows.length} 篇</Text> : null}
      </VStack>
    </PageFrame>
  )
}
