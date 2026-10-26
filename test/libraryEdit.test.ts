import { describe, expect, it } from 'vitest'
import { allowedNumbers, assetBlock, assetTypeLabel, detailsFromStored, isAssetType, readAssetDraft } from '../shared/assets.ts'
import { contentTypeForAsset, platformForAssetType } from '../shared/draftPrompt.ts'
import { isMediaKey, sniffImage } from '../shared/media.ts'
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
    expect(contentTypeForAsset('service')).toBe('xianyu')
    expect(platformForAssetType('service')).toBe('xianyu')
    expect(assetTypeLabel('service')).toBe('服务')
    expect(isAssetType('service')).toBe(true)
  })
})

describe('服务素材', () => {
  it('keeps optional sell fields and still reads older details', () => {
    const parsed = readAssetDraft({
      type: 'service',
      title: '数据标注',
      body: '按验收题标一批评测集。',
      publicity: 'public',
      details: {
        problem: '评测集对不上条款',
        boundaries: '不标未授权的内部文档',
        deliverables: '评测集和标注说明',
        priceNote: '100 到 200 元一条',
      },
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.type).toBe('service')
    expect(parsed.value.details.boundaries).toContain('不标')
    expect(parsed.value.details.deliverables).toContain('评测集')
    const stored = {
      id: 'svc',
      studioId: 's',
      createdAt: '',
      updatedAt: '',
      ...parsed.value,
    }
    expect(allowedNumbers([stored]).has('100')).toBe(true)
    expect(allowedNumbers([stored]).has('200')).toBe(true)
    expect(assetBlock(stored)).toContain('价格说明（只可照抄')
    expect(assetBlock({ ...stored, details: { ...stored.details, priceNote: '' } })).toContain('不要编造报价')
    const legacy = detailsFromStored({ problem: '旧问题' })
    expect(legacy.problem).toBe('旧问题')
    expect(legacy.deliverables).toBe('')
    expect(legacy.boundaries).toBe('')
    expect(legacy.priceNote).toBe('')
  })
})
