import { describe, expect, it } from 'vitest'
import { isShareToken, newShareToken, publicDraftFromShare } from '../shared/draftShare.ts'

const record = {
  token: 'a'.repeat(32),
  revokedAt: '',
  title: '闲鱼：先写验收题',
  body: '客户要先写清验收题，再谈上线。',
  channel: 'xianyu',
  citeSentences: ['客户要先写清验收题，再谈上线范围。', '交付时把评测题和知识库一起交接。'],
  urlHint: '闲鱼主页：澄川智能体工场',
  updatedAt: '2026-10-26T00:00:00.000Z',
}

describe('草稿分享', () => {
  it('reads an open token into a public view', () => {
    const view = publicDraftFromShare(record)
    expect(isShareToken(newShareToken())).toBe(true)
    expect(isShareToken(record.token)).toBe(true)
    expect(isShareToken('not-a-token')).toBe(false)
    expect(view).toEqual({
      title: record.title,
      body: record.body,
      channel: 'xianyu',
      channelLabel: '闲鱼',
      citeSentences: record.citeSentences,
      urlHint: record.urlHint,
      updatedAt: record.updatedAt,
    })
    expect(view && 'token' in view).toBe(false)
  })

  it('hides a revoked or malformed token', () => {
    expect(publicDraftFromShare({ ...record, revokedAt: '2026-10-26T01:00:00.000Z' })).toBeNull()
    expect(publicDraftFromShare({ ...record, token: 'short' })).toBeNull()
    expect(publicDraftFromShare(null)).toBeNull()
  })
})
