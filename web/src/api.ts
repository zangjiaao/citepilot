export class ApiError extends Error {
  field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'ApiError'
    this.field = field
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const response = await fetch(path, { ...init, headers })
  const data = (await response.json().catch(() => ({}))) as { error?: string; field?: string }
  if (!response.ok) throw new ApiError(data.error || `请求失败（${response.status}）`, data.field)
  return data as T
}
