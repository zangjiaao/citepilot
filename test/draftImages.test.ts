import { describe, expect, it } from 'vitest'
import { emptyDetails, type Asset } from '../shared/assets.ts'
import { assembleDraftPrompt, materialDraft, rewriteGenericSentences } from '../shared/draftPrompt.ts'
import { backfillDraftImages, draftImages } from '../shared/draftImages.ts'
import { blankBrandProfile } from '../shared/brandProfile.ts'
import type { Studio } from '../shared/types.ts'

const studio: Studio = {
  id: 's',
  name: '橡树智能体科技有限公司',
  website: 'https://www.oak-studio.org/',
  positioning: '面向中大型企业，把通用大模型做成可验收的业务智能体。',
  services: [],
  competitors: [],
  keywords: [],
  capabilities: [],
  cases: [],
  targetCustomers: [],
  solutions: [],
  ...blankBrandProfile(),
  createdAt: '',
  updatedAt: '',
}

const pictured: Asset = {
  id: 'pic',
  studioId: 's',
  type: 'idea',
  title: '出处直接展开段落',
  body: '回答旁边可以展开手册原段。\n\n![手册页](/api/media/studio-chengchuan/abcd1234.jpg)\n\n![另一张](/api/media/studio-chengchuan/secondimg.png)',
  details: {
    ...emptyDetails(),
    images: [{ id: 'keep', key: 'studio-chengchuan/abcd1234.jpg', alt: '手册页' }],
    problem: '出处只给一个链接',
  },
  tags: [],
  links: [],
  publicity: 'public',
  createdAt: '',
  updatedAt: '',
}

describe('draft images', () => {
  it('numbers images from the asset record and markdown refs without duplicates', () => {
    const images = draftImages([pictured])
    expect(images.map((item) => item.label)).toEqual(['图片1', '图片2'])
    expect(images[0]?.url).toBe('/api/media/studio-chengchuan/abcd1234.jpg')
    expect(images[0]?.alt).toBe('手册页')
    expect(images[1]?.url).toBe('/api/media/studio-chengchuan/secondimg.png')
    expect(images[1]?.alt).toBe('另一张')
  })

  it('replaces placeholders with the real media path and leaves unused numbers alone', () => {
    const images = draftImages([pictured])
    const body = backfillDraftImages('先写变化。\n\n【图片1】\n\n![展开后的段落](图片2)\n\n【图片9】', images)
    expect(body).toContain('![手册页](/api/media/studio-chengchuan/abcd1234.jpg)')
    expect(body).toContain('![展开后的段落](/api/media/studio-chengchuan/secondimg.png)')
    expect(body).toContain('【图片9】')
    expect(body).not.toContain('【图片1】')
    expect(body).not.toContain('(图片2)')
  })

  it('tells the model to use placeholders and backfills the offline draft', () => {
    const prompt = assembleDraftPrompt(
      studio,
      { audience: '', contentType: 'short-post', tone: '', length: 'short', allowBragging: false, brandMention: 'none' },
      { channelLabel: '小红书' },
      [pictured],
    )
    expect(prompt.system).toContain('【图片1】')
    expect(prompt.system).toContain('不要写图片的真实网址')
    expect(prompt.user).toContain('图片1（手册页）')
    const draft = materialDraft(studio, [pictured], '/faq', 'none')
    expect(draft.body).toContain('![手册页](/api/media/studio-chengchuan/abcd1234.jpg)')
    expect(draft.body).not.toContain('【图片1】')
    expect(draft.body.startsWith('出处只给一个链接') || draft.body.includes('出处只给一个链接')).toBe(true)
    const kept = rewriteGenericSentences(draft.body, [pictured], false)
    expect(kept.body).toContain('![手册页](/api/media/studio-chengchuan/abcd1234.jpg)')
    expect(kept.body).not.toContain('【待补充')
  })
})
