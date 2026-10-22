import { describe, expect, it } from 'vitest'
import { readAssetDraft } from '../shared/assets.ts'
import { contentTypeForAsset } from '../shared/draftPrompt.ts'
import { isMediaKey, sniffImage } from '../shared/media.ts'
import { acceptPolishedHtml, htmlKeepsNumbers, polishNotesOffline } from '../shared/polishAsset.ts'
import { imageRefsFromHtml, normalizeMarkdownBody, plainTextFromRich } from '../shared/richText.ts'

describe('素材正文', () => {
  it('reads markdown and keeps a media image', () => {
    const body = '## 问题\n\n值班员翻**手册**。\n\n- 按条款切开\n\n![手册页](/api/media/studio-chengchuan/abcd-efgh.jpg)'
    expect(plainTextFromRich(body)).toContain('值班员翻手册')
    expect(plainTextFromRich(body)).not.toContain('![')
    expect(imageRefsFromHtml(body)).toEqual([{ key: 'studio-chengchuan/abcd-efgh.jpg', alt: '手册页' }])
  })

  it('turns previously stored html into markdown and drops scripts', () => {
    const markdown = normalizeMarkdownBody(
      '<h2>问题</h2><p>值班员翻<strong>手册</strong>。</p><ul><li>按条款切开</li></ul><img src="/api/media/studio-chengchuan/abcd-efgh.jpg" alt="手册页"><script>alert(1)</script>',
    )
    expect(markdown).toContain('## 问题')
    expect(markdown).toContain('**手册**')
    expect(markdown).toContain('- 按条款切开')
    expect(markdown).toContain('![手册页](/api/media/studio-chengchuan/abcd-efgh.jpg)')
    expect(markdown).not.toContain('script')
    expect(markdown).not.toContain('<p>')
  })

  it('stores image refs from markdown and ignores a bad key', () => {
    const parsed = readAssetDraft({
      type: 'case',
      title: '有图的笔记',
      publicity: 'anonymous',
      body: '45 分钟。\n\n![手册页](/api/media/studio-chengchuan/abcd-efgh.jpg)\n\n![不要](/api/media/../secret.png)',
      details: { images: [{ id: 'keep', key: 'studio-chengchuan/abcd-efgh.jpg', alt: '' }] },
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.details.images).toEqual([{ id: 'keep', key: 'studio-chengchuan/abcd-efgh.jpg', alt: '手册页' }])
    expect(parsed.value.body).not.toContain('<img')
  })

  it('recognizes a png and a media key', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(sniffImage(png)).toBe('image/png')
    expect(isMediaKey('studio-chengchuan/abcd-efgh.png')).toBe(true)
    expect(isMediaKey('../secret.png')).toBe(false)
  })
})

describe('打磨素材', () => {
  it('splits existing sentences into markdown and does not add numbers', () => {
    const notes = '值班员要翻三本手册。后来改成按条款号切开。'
    const markdown = polishNotesOffline(notes)
    expect(markdown).toContain('值班员要翻三本手册')
    expect(markdown).toContain('后来改成按条款号切开')
    expect(markdown).toContain('## 客户当时的问题')
    expect(markdown).not.toContain('<p>')
    expect(htmlKeepsNumbers(notes, markdown)).toBe(true)
    expect(acceptPolishedHtml({ body: '变成 99 分钟。' }, notes)).toBeNull()
    expect(acceptPolishedHtml({ body: '行业领先的方案。' }, notes)).toBeNull()
    expect(polishNotesOffline('只有一句。')).toBe('只有一句。')
  })
})

describe('去起草', () => {
  it('maps an asset type to a content type', () => {
    expect(contentTypeForAsset('case')).toBe('case-breakdown')
    expect(contentTypeForAsset('outcome')).toBe('case-breakdown')
    expect(contentTypeForAsset('product')).toBe('interaction')
    expect(contentTypeForAsset('idea')).toBe('interaction')
    expect(contentTypeForAsset('interaction')).toBe('interaction')
    expect(contentTypeForAsset('lesson')).toBe('retro')
    expect(contentTypeForAsset('testimonial')).toBe('wechat')
    expect(contentTypeForAsset('reference')).toBe('faq')
  })
})
