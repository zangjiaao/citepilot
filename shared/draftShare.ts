import { channelLabel } from './drafts.ts'

export function isShareToken(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value)
}

export function newShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export interface PublicDraftShare {
  title: string
  body: string
  channel: string
  channelLabel: string
  citeSentences: string[]
  urlHint: string
  updatedAt: string
}

export interface ShareDraftRecord {
  token: string
  revokedAt: string
  title: string
  body: string
  channel: string
  citeSentences: string[]
  urlHint: string
  updatedAt: string
}

export function publicDraftFromShare(record: ShareDraftRecord | null): PublicDraftShare | null {
  if (!record || !isShareToken(record.token) || record.revokedAt.trim()) return null
  return {
    title: record.title,
    body: record.body,
    channel: record.channel,
    channelLabel: channelLabel(record.channel),
    citeSentences: record.citeSentences,
    urlHint: record.urlHint,
    updatedAt: record.updatedAt,
  }
}
