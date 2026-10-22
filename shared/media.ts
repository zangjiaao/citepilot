const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export const MAX_MEDIA_BYTES = 4 * 1024 * 1024

export function extensionForImage(contentType: string): string | null {
  return EXTENSIONS[contentType] ?? null
}

export function contentTypeForExtension(extension: string): string {
  const found = Object.entries(EXTENSIONS).find(([, value]) => value === extension)
  return found?.[0] ?? 'application/octet-stream'
}

export function isMediaKey(key: string): boolean {
  return /^[a-zA-Z0-9_-]{1,80}\/[a-zA-Z0-9-]{8,80}\.(jpg|png|gif|webp)$/.test(key)
}

export function mediaUrl(key: string): string {
  return `/api/media/${key.split('/').map((part) => encodeURIComponent(part)).join('/')}`
}

export function keyFromMediaUrl(src: string): string | null {
  const trimmed = src.trim()
  if (!trimmed.startsWith('/api/media/')) return null
  let key = ''
  try {
    key = trimmed
      .slice('/api/media/'.length)
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/')
  } catch {
    return null
  }
  return isMediaKey(key) ? key : null
}

export function sniffImage(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}
