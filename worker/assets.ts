import { detailsFromStored, emptyDetails, type Asset, type AssetDraft, type AssetType } from '../shared/assets.ts'
import { HttpError } from './errors.ts'

interface AssetRow {
  id: string
  studio_id: string
  type: AssetType
  title: string
  body: string
  details: string
  tags: string
  links: string
  publicity: Asset['publicity']
  created_at: string
  updated_at: string
}

export async function listAssets(db: D1Database, studioId: string): Promise<Asset[]> {
  const { results } = await db.prepare('SELECT * FROM assets WHERE studio_id = ? ORDER BY updated_at DESC').bind(studioId).all<AssetRow>()
  return results.map(mapAsset)
}

export async function getAsset(db: D1Database, studioId: string, id: string): Promise<Asset | null> {
  const row = await db.prepare('SELECT * FROM assets WHERE studio_id = ? AND id = ?').bind(studioId, id).first<AssetRow>()
  return row ? mapAsset(row) : null
}

export async function countAssets(db: D1Database, studioId: string): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS total FROM assets WHERE studio_id = ?').bind(studioId).first<{ total: number }>()
  return row?.total ?? 0
}

export async function insertAsset(db: D1Database, asset: Asset): Promise<void> {
  await db
    .prepare(
      `INSERT INTO assets (
         id, studio_id, type, title, body, details, tags, links, publicity, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      asset.id,
      asset.studioId,
      asset.type,
      asset.title,
      asset.body,
      JSON.stringify(asset.details),
      JSON.stringify(asset.tags),
      JSON.stringify(asset.links),
      asset.publicity,
      asset.createdAt,
      asset.updatedAt,
    )
    .run()
}

export async function updateAsset(db: D1Database, asset: Asset): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE assets
       SET type = ?, title = ?, body = ?, details = ?, tags = ?, links = ?, publicity = ?, updated_at = ?
       WHERE id = ? AND studio_id = ?`,
    )
    .bind(
      asset.type,
      asset.title,
      asset.body,
      JSON.stringify(asset.details),
      JSON.stringify(asset.tags),
      JSON.stringify(asset.links),
      asset.publicity,
      asset.updatedAt,
      asset.id,
      asset.studioId,
    )
    .run()
  if ((result.meta.changes ?? 0) === 0) throw new HttpError(404, '没有找到这条素材')
}

export async function deleteAsset(db: D1Database, studioId: string, id: string): Promise<void> {
  const result = await db.prepare('DELETE FROM assets WHERE id = ? AND studio_id = ?').bind(id, studioId).run()
  if ((result.meta.changes ?? 0) === 0) throw new HttpError(404, '没有找到这条素材')
}

export function assetFromDraft(id: string, studioId: string, draft: AssetDraft, now: string, createdAt = now): Asset {
  return { id, studioId, ...draft, createdAt, updatedAt: now }
}

function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    studioId: row.studio_id,
    type: row.type,
    title: row.title,
    body: row.body,
    details: parseDetails(row.details),
    tags: parseStringList(row.tags),
    links: parseLinks(row.links),
    publicity: row.publicity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseDetails(value: string): Asset['details'] {
  try {
    return detailsFromStored(JSON.parse(value) as unknown)
  } catch {
    return emptyDetails()
  }
}

function parseLinks(value: string): Asset['links'] {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      if (typeof record.url !== 'string') return []
      return [{ id: typeof record.id === 'string' ? record.id : 'link', label: asText(record.label), url: record.url }]
    })
  } catch {
    return []
  }
}

function parseStringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
