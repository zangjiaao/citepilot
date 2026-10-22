import { contentTypeForExtension, extensionForImage, isMediaKey, MAX_MEDIA_BYTES, mediaUrl, sniffImage } from '../shared/media.ts'
import type { AppBindings } from './env.ts'
import { HttpError } from './errors.ts'

export async function storeStudioImage(env: AppBindings, studioId: string, file: File): Promise<{ key: string; url: string }> {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(studioId)) throw new HttpError(400, '品牌编号不能用来保存图片')
  if (file.size > MAX_MEDIA_BYTES) throw new HttpError(400, '图片超过 4MB')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.byteLength === 0) throw new HttpError(400, '这张图片是空的')
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new HttpError(400, '图片超过 4MB')
  const contentType = sniffImage(bytes)
  const extension = contentType ? extensionForImage(contentType) : null
  if (!contentType || !extension) throw new HttpError(400, '只接受 JPEG、PNG、GIF 或 WebP')
  const key = `${studioId}/${crypto.randomUUID()}.${extension}`
  if (!isMediaKey(key)) throw new HttpError(400, '图片地址没有生成')
  await writeMedia(env, key, bytes, contentType)
  return { key, url: mediaUrl(key) }
}

export async function readStoredMedia(env: AppBindings, key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!isMediaKey(key)) return null
  if (env.MEDIA) {
    const object = await env.MEDIA.get(key)
    if (!object) return null
    const bytes = new Uint8Array(await object.arrayBuffer())
    const contentType = object.httpMetadata?.contentType || contentTypeForExtension(key.split('.').pop() ?? '')
    return { bytes, contentType }
  }
  return readLocal(key)
}

async function writeMedia(env: AppBindings, key: string, bytes: Uint8Array, contentType: string) {
  if (env.MEDIA) {
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } })
    return
  }
  const { mkdir, writeFile } = await import('node:fs/promises')
  const file = await localPath(key)
  const { dirname } = await import('node:path')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, bytes)
  await writeFile(`${file}.type`, contentType)
}

async function readLocal(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const { readFile } = await import('node:fs/promises')
  try {
    const file = await localPath(key)
    const bytes = new Uint8Array(await readFile(file))
    let contentType = contentTypeForExtension(key.split('.').pop() ?? '')
    try {
      contentType = (await readFile(`${file}.type`, 'utf8')).trim() || contentType
    } catch {
      // 没有旁路类型文件时按扩展名判断。
    }
    return { bytes, contentType }
  } catch (error) {
    if (error instanceof HttpError) throw error
    return null
  }
}

async function localPath(key: string): Promise<string> {
  const { resolve, sep } = await import('node:path')
  const root = resolve(process.cwd(), '.data', 'media')
  const file = resolve(root, key)
  if (file !== root && !file.startsWith(`${root}${sep}`)) throw new HttpError(400, '图片地址不正确')
  return file
}
