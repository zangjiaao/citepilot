import { describe, expect, it } from 'vitest'
import { readAssetDraft } from '../shared/assets.ts'
import { contentTypeForAsset } from '../shared/draftPrompt.ts'
import { isMediaKey, sniffImage } from '../shared/media.ts'
import { acceptPolishedHtml, htmlKeepsNumbers, polishNotesOffline } from '../shared/polishAsset.ts'
import { plainTextFromRich, sanitizeRichHtml } from '../shared/richText.ts'

describe('素材正文', () => {
  it('keeps headings, lists and media images, and drops scripts', () => {
    const html = sanitizeRichHtml(
      '<h2>问题</h2><p>值班员翻<strong>手册</strong>。</p><ul><li>按条款切开</li></ul><a href="javascript:alert(1)">坏链接</a><a href="https://example.com/a">出处</a><img src="/api/media/studio-chengchuan/abcd-efgh.jpg" alt="手册页" onerror="alert(1)"><script>alert(1)</script>',
    )
    expect(html).toContain('<h2>问题</h2>')
    expect(html).toContain('<strong>手册</strong>')
    expect(html).toContain('<li>按条款切开</li>')
    expect(html).toContain('href="https://example.com/a"')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('script')
    expect(html).toContain('src="/api/media/studio-chengchuan/abcd-efgh.jpg"')
    expect(plainTextFromRich(html)).toContain('值班员翻 手册')
    expect(plainTextFromRich(html)).not.toContain('<')
  })

  it('stores image refs from the body and ignores a bad key', () => {
    const parsed = readAssetDraft({
      type: 'case',
      title: '有图的笔记',
      publicity: 'anonymous',
      body: '<p>45 分钟。</p><img src="/api/media/studio-chengchuan/abcd-efgh.jpg" alt="手册页"><img src="/api/media/../secret.png" alt="不要">',
      details: { images: [{ id: 'keep', key: 'studio-chengchuan/abcd-efgh.jpg', alt: '' }] },
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.details.images).toEqual([{ id: 'keep', key: 'studio-chengchuan/abcd-efgh.jpg', alt: '手册页' }])
    expect(parsed.value.body).not.toContain('secret')
  })

  it('recognizes a png and a media key', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(sniffImage(png)).toBe('image/png')
    expect(isMediaKey('studio-chengchuan/abcd-efgh.png')).toBe(true)
    expect(isMediaKey('../secret.png')).toBe(false)
  })
})

describe('打磨素材', () => {
  it('splits existing sentences and does not add numbers', () => {
    const notes = '值班员要翻三本手册。后来改成按条款号切开。'
    const html = polishNotesOffline(notes)
    expect(html).toContain('值班员要翻三本手册')
    expect(html).toContain('后来改成按条款号切开')
    expect(html).toContain('<h2>客户当时的问题</h2>')
    expect(htmlKeepsNumbers(notes, html)).toBe(true)
    expect(acceptPolishedHtml({ body: '<p>变成 99 分钟。</p>' }, notes)).toBeNull()
    expect(acceptPolishedHtml({ body: '<p>行业领先的方案。</p>' }, notes)).toBeNull()
    expect(polishNotesOffline('只有一句。')).toBe('<p>只有一句。</p>')
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
