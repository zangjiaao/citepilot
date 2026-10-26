import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, pixel, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { ASSET_TYPES, assetTypeLabel, publicityLabel, type Asset, type Publicity } from '../../../shared/assets.ts'
import { plainTextFromRich } from '../../../shared/richText.ts'
import { api } from '../api'
import { formatTime } from '../format'
import { useStudio } from '../studio'
import { ErrorBanner, PageFrame } from '../ui'

interface AssetRow extends Record<string, unknown> {
  id: string
  typeLabel: string
  title: string
  publicityLabel: string
  tagsLabel: string
  updatedLabel: string
  asset: Asset
}

export function LibraryPage() {
  const navigate = useNavigate()
  const { studioId } = useStudio()
  const [assets, setAssets] = useState<Asset[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const load = async (id: string) => {
    const result = await api<{ assets: Asset[] }>(`/api/studios/${id}/assets`)
    setAssets(result.assets)
  }

  useEffect(() => {
    if (!studioId) return
    load(studioId).catch((err: unknown) => setError(err instanceof Error ? err.message : '素材库加载失败'))
  }, [studioId])

  const tags = useMemo(() => [...new Set(assets.flatMap((item) => item.tags))].sort(), [assets])
  const visible = assets.filter((item) => {
    if (typeFilter && item.type !== typeFilter) return false
    if (tagFilter && !item.tags.includes(tagFilter)) return false
    const haystack = `${item.title}\n${plainTextFromRich(item.body)}\n${item.tags.join(' ')}`.toLowerCase()
    return !query.trim() || haystack.includes(query.trim().toLowerCase())
  })
  const rows = useMemo<AssetRow[]>(
    () =>
      visible.map((asset) => ({
        id: asset.id,
        typeLabel: assetTypeLabel(asset.type),
        title: asset.title,
        publicityLabel: publicityLabel(asset.publicity),
        tagsLabel: asset.tags.join('、') || '无',
        updatedLabel: formatTime(asset.updatedAt),
        asset,
      })),
    [visible],
  )

  const remove = async (id: string) => {
    if (!studioId || !window.confirm('删除这条素材？')) return
    setError('')
    try {
      await api(`/api/studios/${studioId}/assets/${id}`, { method: 'DELETE' })
      await load(studioId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const open = (id: string) => navigate(`/library/${id}`)

  const columns: TableColumn<AssetRow>[] = [
    {
      key: 'typeLabel',
      header: '类型',
      width: pixel(110),
      renderCell: (row) => <Badge variant="info" label={row.typeLabel} />,
    },
    {
      key: 'title',
      header: '标题',
      width: proportional(2, { minWidth: 180 }),
      renderCell: (row) => <Button label={row.title} size="sm" variant="ghost" onClick={() => open(row.id)} />,
    },
    {
      key: 'publicityLabel',
      header: '公开程度',
      width: pixel(120),
      renderCell: (row) => <Badge variant={publicityVariant(row.asset.publicity)} label={row.publicityLabel} />,
    },
    { key: 'tagsLabel', header: '标签', width: proportional(1, { minWidth: 120 }) },
    { key: 'updatedLabel', header: '更新时间', width: pixel(150) },
    {
      key: 'id',
      header: '操作',
      width: pixel(150),
      resizable: false,
      renderCell: (row) => (
        <HStack gap={1}>
          <Button label="编辑" size="sm" variant="secondary" onClick={() => open(row.id)} />
          <Button label="删除" size="sm" variant="ghost" onClick={() => void remove(row.id)} />
        </HStack>
      ),
    },
  ]

  return (
    <PageFrame
      title="素材库"
      description="案例、产品、服务和数据成效都在这里。点一条去编辑，写成可分享的故事后再去起草。"
      actions={<Button label="新建素材" variant="primary" onClick={() => navigate('/library/new')} isDisabled={!studioId} />}
    >
      <VStack gap={4}>
        <ErrorBanner message={error} />
        <HStack gap={3} wrap="wrap">
          <TextInput label="搜索" value={query} onChange={setQuery} width="100%" />
          <Selector
            label="类型"
            value={typeFilter}
            options={[{ value: '', label: '全部类型' }, ...ASSET_TYPES.map((item) => ({ value: item.id, label: item.label }))]}
            onChange={(value) => setTypeFilter(value || '')}
          />
          <Selector
            label="标签"
            value={tagFilter}
            options={[{ value: '', label: '全部标签' }, ...tags.map((item) => ({ value: item, label: item }))]}
            onChange={(value) => setTagFilter(value || '')}
          />
        </HStack>
        <Text color="secondary">
          {visible.length} / {assets.length} 条
        </Text>
        {rows.length === 0 ? <Text color="secondary">没有符合条件的素材。点右上角新建一条。</Text> : null}
        {rows.length > 0 ? <Table data={rows} columns={columns} idKey="id" hasHover density="compact" textOverflow="truncate" verticalAlign="middle" /> : null}
      </VStack>
    </PageFrame>
  )
}

function publicityVariant(value: Publicity): 'success' | 'warning' | 'neutral' {
  if (value === 'public') return 'success'
  if (value === 'anonymous') return 'warning'
  return 'neutral'
}
