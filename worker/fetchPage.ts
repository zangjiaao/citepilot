import { assertPublicHttpUrl } from '../shared/ssrf.ts'

export interface PublicPage {
  url: string
  status: number
  text: string
  contentType: string
}

export async function fetchPublic(input: string, maxBytes = 500_000): Promise<PublicPage> {
  let current = assertPublicHttpUrl(input).toString()
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'user-agent': 'CitePilot/0.1 (public page diagnosis)',
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('重定向缺少 Location')
      current = assertPublicHttpUrl(new URL(location, current).toString()).toString()
      continue
    }
    return {
      url: current,
      status: response.status,
      text: await readLimited(response, maxBytes),
      contentType: response.headers.get('content-type') ?? '',
    }
  }
  throw new Error('重定向次数过多')
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let received = 0
  let output = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    if (received + value.byteLength > maxBytes) {
      output += decoder.decode(value.subarray(0, Math.max(0, maxBytes - received)), { stream: true })
      await reader.cancel()
      break
    }
    received += value.byteLength
    output += decoder.decode(value, { stream: true })
  }
  output += decoder.decode()
  return output
}
