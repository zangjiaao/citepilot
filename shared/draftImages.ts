import type { Asset } from './assets.ts'
import { isMediaKey, mediaUrl } from './media.ts'
import { imageRefsFromHtml } from './richText.ts'

export interface DraftImage {
  index: number
  label: string
  url: string
  alt: string
  key: string
}

export function draftImages(assets: Asset[]): DraftImage[] {
  const seen = new Set<string>()
  const items: Array<{ key: string; alt: string }> = []
  const push = (key: string, alt: string) => {
    if (!isMediaKey(key) || seen.has(key)) return
    seen.add(key)
    items.push({ key, alt: alt.replace(/\s+/g, ' ').trim() })
  }
  for (const asset of assets) {
    for (const image of asset.details.images) push(image.key, image.alt)
    for (const ref of imageRefsFromHtml(asset.body)) push(ref.key, ref.alt)
  }
  return items.slice(0, 12).map((item, index) => ({
    index: index + 1,
    label: `图片${index + 1}`,
    url: mediaUrl(item.key),
    alt: item.alt,
    key: item.key,
  }))
}

export function draftImageRule(images: DraftImage[]): string {
  if (images.length === 0) return '没有配图。不要编造图片地址，也不要写【图片1】。'
  const list = images.map((item) => `${item.label}（${item.alt || '无说明'}）`).join('、')
  return `配图只允许用占位符，按这个顺序：${list}。需要放图时单独一行，写成【图片1】或 ![说明](图片1)。不要写图片的真实网址，不要编造地址。没用到的图可以不写。`
}

export function backfillDraftImages(body: string, images: DraftImage[]): string {
  let next = body
  const ordered = [...images].sort((a, b) => b.index - a.index)
  for (const image of ordered) {
    const label = `图片${image.index}`
    const alt = image.alt || image.label
    const markdown = `![${alt}](${image.url})`
    next = next.replace(new RegExp(`!\\[([^\\]]*)]\\(\\s*${label}(?!\\d)\\s*\\)`, 'g'), (_all, captured: string) => {
      const useAlt = captured.trim() || alt
      return `![${useAlt}](${image.url})`
    })
    next = next.replace(new RegExp(`【\\s*${label}(?!\\d)\\s*】`, 'g'), markdown)
  }
  return next
}

export function withDraftImages(body: string, assets: Asset[]): string {
  const images = draftImages(assets)
  let next = body
  if (images.length > 0 && !/【\s*图片\d+\s*】/.test(next) && !/\]\(\s*图片\d+\s*\)/.test(next) && !images.some((item) => next.includes(item.url))) {
    const marker = `【${images[0].label}】`
    const parts = next.split(/\n\n+/).filter((item) => item.trim())
    if (parts.length <= 1) next = `${next.trim()}\n\n${marker}`
    else {
      parts.splice(1, 0, marker)
      next = parts.join('\n\n')
    }
  }
  return backfillDraftImages(next, images)
}
