import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LlmCallConfig } from '../shared/llmProviders.ts'
import { parseDraftToolCalls } from '../shared/draftTools.ts'
import {
  DRAFT_TEMPLATE_WARNING,
  LLM_GENERATE_TIMEOUT_MS,
  LLM_TEST_MAX_TOKENS,
  LLM_TEST_TIMEOUT_MS,
  completeJson,
  completeWithTools,
  draftModelWarning,
  testLlmConnection,
} from '../worker/llm.ts'

const cloudflare: LlmCallConfig = {
  apiKey: 'cf-test-key',
  baseUrl: 'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1',
  model: 'openai/gpt-4.1',
  apiStyle: 'chat',
  completionsUrl: 'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1/chat/completions',
  temperature: null,
  maxTokens: null,
}

const sol: LlmCallConfig = {
  ...cloudflare,
  model: 'openai/gpt-5.6-sol',
  apiStyle: 'responses',
  completionsUrl: 'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1/responses',
}

const deepseek: LlmCallConfig = {
  ...cloudflare,
  apiKey: 'sk-deepseek-test',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  completionsUrl: 'https://api.deepseek.com/chat/completions',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function chat(content: string) {
  return { choices: [{ message: { content } }] }
}

function sseResponse(chunks: unknown[], options?: { separator?: string; contentType?: string | null }): Response {
  const separator = options?.separator ?? '\n\n'
  const body = chunks.map((chunk) => `data: ${typeof chunk === 'string' ? chunk : JSON.stringify(chunk)}`).join(separator) + separator
  const headers = new Headers()
  if (options?.contentType !== null) headers.set('content-type', options?.contentType ?? 'text/event-stream; charset=utf-8')
  return new Response(body, { status: 200, headers })
}

function delta(content: unknown, extra?: Record<string, unknown>) {
  return { choices: [{ index: 0, delta: { ...extra, content } }] }
}

function timeoutError(): Error {
  const error = new Error('The operation was aborted due to timeout')
  error.name = 'TimeoutError'
  return error
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('completeJson', () => {
  it('keeps json mode when the provider accepts response_format', async () => {
    const bodies: unknown[] = []
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return jsonResponse(chat('{"summary":"可以引用官网说明"}'))
      }),
    )

    await expect(completeJson(deepseek, '系统', '用户', 0.2)).resolves.toEqual({ summary: '可以引用官网说明' })
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      stream: true,
    })
    expect(bodies[0]).not.toHaveProperty('max_tokens')
    expect(bodies[0]).not.toHaveProperty('max_completion_tokens')
    expect(timeout).toHaveBeenCalledWith(LLM_GENERATE_TIMEOUT_MS)
  })

  it('retries once without response_format after a non-400 failure', async () => {
    const bodies: unknown[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        if (bodies.length === 1) return jsonResponse({ error: { message: 'response_format is not supported' } }, 500)
        return jsonResponse(chat('{"ok":true}'))
      }),
    )

    await expect(completeJson(cloudflare, '系统', '用户', 0.4)).resolves.toEqual({ ok: true })
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toMatchObject({ response_format: { type: 'json_object' }, model: 'openai/gpt-4.1' })
    expect(bodies[1]).not.toHaveProperty('response_format')
  })

  it('also retries when json mode returns 422', async () => {
    const bodies: unknown[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        if (bodies.length === 1) return jsonResponse({ errors: [{ message: 'unsupported response_format' }] }, 422)
        return jsonResponse(chat('{"ok":true}'))
      }),
    )

    await expect(completeJson(cloudflare, '系统', '用户', 0.4)).resolves.toEqual({ ok: true })
    expect(bodies[1]).not.toHaveProperty('response_format')
  })

  it('does not retry a timed-out generate call, and names the timeout in the draft warning', async () => {
    const fetchMock = vi.fn(async () => {
      throw timeoutError()
    })
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal('fetch', fetchMock)

    let warning = ''
    await completeJson(cloudflare, '系统', '用户', 0.4).catch((error: unknown) => {
      warning = draftModelWarning(error)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(warning).toContain('模型请求超时')
    expect(warning).toContain('没有写成完整稿')
    expect(warning.startsWith('模型请求超时')).toBe(true)
    expect(warning).not.toContain('The operation was aborted')
    expect(DRAFT_TEMPLATE_WARNING.length).toBeGreaterThan(0)
    expect(warning).toContain(DRAFT_TEMPLATE_WARNING)
  })

  it('puts an HTTP failure from completeJson into the draft warning', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { message: 'upstream model failed' } }, 500)),
    )

    let warning = ''
    await completeJson(cloudflare, '系统', '用户', 0.4).catch((error: unknown) => {
      warning = draftModelWarning(error)
    })

    expect(warning).toContain('模型返回 HTTP 500')
    expect(warning).toContain('upstream model failed')
    expect(warning).toContain(DRAFT_TEMPLATE_WARNING)
  })

  it('calls the Responses API and retries without json format', async () => {
    const urls: string[] = []
    const bodies: unknown[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        urls.push(url)
        bodies.push(JSON.parse(String(init?.body)))
        if (bodies.length === 1) return jsonResponse({ error: { message: 'text.format is not supported' } }, 400)
        return jsonResponse({
          status: 'completed',
          output: [
            { type: 'reasoning', content: [{ type: 'reasoning_text', text: '先想一下' }] },
            { type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] },
          ],
        })
      }),
    )

    await expect(completeJson(sol, '系统', '用户', 0.4)).resolves.toEqual({ ok: true })
    expect(urls).toEqual([
      'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1/responses',
      'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1/responses',
    ])
    expect(bodies[0]).toMatchObject({
      model: 'openai/gpt-5.6-sol',
      text: { format: { type: 'json_object' } },
      input: [
        { role: 'system', content: '系统' },
        { role: 'user', content: '用户' },
      ],
    })
    expect(bodies[0]).not.toHaveProperty('messages')
    expect(bodies[0]).not.toHaveProperty('response_format')
    expect(bodies[0]).not.toHaveProperty('temperature')
    expect(bodies[0]).not.toHaveProperty('stream')
    expect(bodies[1]).not.toHaveProperty('text')
    expect(bodies[1]).not.toHaveProperty('messages')
    expect(bodies[1]).not.toHaveProperty('stream')
  })

  it('drops temperature when a Responses model rejects it', async () => {
    const bodies: unknown[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        if (bodies.length === 1) return jsonResponse({ error: { message: 'Unsupported parameter: temperature' } }, 400)
        return jsonResponse({ output_text: '{"ok":true}' })
      }),
    )

    await expect(completeJson({ ...sol, temperature: 0.4 }, '系统', '用户', 0.2)).resolves.toEqual({ ok: true })
    expect(bodies[0]).toHaveProperty('temperature')
    expect(bodies[1]).not.toHaveProperty('temperature')
    expect(bodies[1]).not.toHaveProperty('text')
  })

  it('puts a Responses billing error into the draft warning', async () => {
    const urls: string[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        return jsonResponse({ errors: [{ message: 'Unified billing unavailable' }] }, 422)
      }),
    )

    let warning = ''
    await completeJson(sol, '系统', '用户', 0.4).catch((error: unknown) => {
      warning = draftModelWarning(error)
    })

    expect(urls.every((url) => url.endsWith('/responses'))).toBe(true)
    expect(warning).toContain('模型返回 HTTP 422')
    expect(warning).toContain('Unified billing unavailable')
    expect(warning).toContain(DRAFT_TEMPLATE_WARNING)
  })

  it('surfaces a failed Responses payload even when HTTP is 200', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ status: 'failed', error: { message: 'Unified billing unavailable' }, output: [] })),
    )

    let warning = ''
    await completeJson(sol, '系统', '用户', 0.4).catch((error: unknown) => {
      warning = draftModelWarning(error)
    })

    expect(warning).toContain('Unified billing unavailable')
    expect(warning).toContain(DRAFT_TEMPLATE_WARNING)
  })

  it('keeps generate calls on the configured maxTokens, including MiniMax', async () => {
    const bodies: unknown[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return jsonResponse(chat('{"ok":true}'))
      }),
    )

    await expect(completeJson({ ...cloudflare, model: 'minimax/m3', maxTokens: 1000 }, '系统', '用户', 0.4)).resolves.toEqual({
      ok: true,
    })
    expect(bodies[0]).toMatchObject({ model: 'minimax/m3', max_tokens: 1000, response_format: { type: 'json_object' }, stream: true })
    expect(bodies[0]).not.toHaveProperty('max_completion_tokens')
    expect(bodies[0]).not.toHaveProperty('max_output_tokens')
  })

  it('aggregates a streamed MiniMax completion and ignores reasoning_content', async () => {
    const bodies: unknown[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return sseResponse([
          delta(null, { reasoning_content: '{"ok":false}' }),
          delta('{"ok":'),
          delta('true}'),
          '[DONE]',
        ])
      }),
    )

    await expect(completeJson({ ...cloudflare, model: 'minimax/m2.7', maxTokens: 2048 }, '系统', '用户', 0.4)).resolves.toEqual({
      ok: true,
    })
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({ model: 'minimax/m2.7', max_tokens: 2048, stream: true })
  })

  it('prefers a streamed final message over concatenated deltas', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          delta('{"ok":'),
          { choices: [{ index: 0, delta: { content: 'false}' }, message: { content: '{"ok":true}' } }] },
          '[DONE]',
        ]),
      ),
    )

    await expect(completeJson(cloudflare, '系统', '用户', 0.4)).resolves.toEqual({ ok: true })
  })
})

describe('testLlmConnection', () => {
  it('uses the shorter timeout and does not send response_format', async () => {
    const bodies: unknown[] = []
    const urls: string[] = []
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        urls.push(url)
        bodies.push(JSON.parse(String(init?.body)))
        return jsonResponse(chat('好'))
      }),
    )

    await expect(testLlmConnection(cloudflare)).resolves.toEqual({ ok: true, reply: '好' })
    expect(timeout).toHaveBeenCalledTimes(1)
    expect(timeout).toHaveBeenCalledWith(LLM_TEST_TIMEOUT_MS)
    expect(LLM_TEST_TIMEOUT_MS).toBeLessThan(LLM_GENERATE_TIMEOUT_MS)
    expect(bodies[0]).not.toHaveProperty('response_format')
    expect(bodies[0]).toMatchObject({
      max_tokens: LLM_TEST_MAX_TOKENS,
      stream: true,
      messages: [{ role: 'user', content: '只回复一个字：好' }],
    })
    expect(bodies[0]).not.toHaveProperty('max_completion_tokens')
    expect(LLM_TEST_MAX_TOKENS).toBeGreaterThan(16)
    expect(LLM_TEST_MAX_TOKENS).toBeLessThanOrEqual(512)
    expect(urls[0]).toBe('https://api.cloudflare.com/client/v4/accounts/abc/ai/v1/chat/completions')
  })

  it('gives MiniMax chat probes both token fields, and leaves DeepSeek on max_tokens', async () => {
    const bodies: unknown[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return jsonResponse(chat('好'))
      }),
    )

    const minimax = { ...cloudflare, model: 'minimax/m3' }
    await expect(testLlmConnection(minimax)).resolves.toEqual({ ok: true, reply: '好' })
    expect(bodies[0]).toMatchObject({
      model: 'minimax/m3',
      max_tokens: LLM_TEST_MAX_TOKENS,
      max_completion_tokens: LLM_TEST_MAX_TOKENS,
      stream: true,
      messages: [{ role: 'user', content: '只回复一个字：好' }],
    })
    expect(bodies[0]).not.toHaveProperty('response_format')

    await expect(testLlmConnection(deepseek)).resolves.toEqual({ ok: true, reply: '好' })
    expect(bodies[1]).toMatchObject({ model: 'deepseek-chat', max_tokens: LLM_TEST_MAX_TOKENS })
    expect(bodies[1]).not.toHaveProperty('max_completion_tokens')
  })

  it('tests a Responses model without chat completions', async () => {
    const bodies: unknown[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/abc/ai/v1/responses')
      return jsonResponse({
        output: [{ type: 'message', content: [{ type: 'output_text', text: '好' }] }],
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(testLlmConnection(sol)).resolves.toEqual({ ok: true, reply: '好' })
    expect(bodies[0]).toMatchObject({
      model: 'openai/gpt-5.6-sol',
      input: [{ role: 'user', content: '只回复一个字：好' }],
      max_output_tokens: LLM_TEST_MAX_TOKENS,
    })
    expect(bodies[0]).not.toHaveProperty('messages')
    expect(bodies[0]).not.toHaveProperty('response_format')
    expect(bodies[0]).not.toHaveProperty('temperature')
    expect(bodies[0]).not.toHaveProperty('max_tokens')
    expect(bodies[0]).not.toHaveProperty('max_completion_tokens')
    expect(bodies[0]).not.toHaveProperty('stream')
  })

  it('reads MiniMax chat SSE and does not treat reasoning_content as the reply', async () => {
    const bodies: unknown[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return sseResponse(
          [
            { choices: [{ delta: { role: 'assistant', reasoning_content: 'The user wants a greeting.' } }] },
            delta('Hi'),
            delta(' there!'),
            { choices: [{ delta: { content: '', reasoning_content: 'done' }, finish_reason: 'stop' }] },
            '[DONE]',
          ],
          { separator: '\n' },
        )
      }),
    )

    await expect(testLlmConnection({ ...cloudflare, model: 'minimax/m2.7' })).resolves.toEqual({ ok: true, reply: 'Hi there!' })
    expect(bodies[0]).toMatchObject({ model: 'minimax/m2.7', stream: true, max_completion_tokens: LLM_TEST_MAX_TOKENS })
  })

  it('does not accept reasoning_content alone as a connection reply', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([{ choices: [{ delta: { reasoning_content: '好' } }] }, '[DONE]'])),
    )

    await expect(testLlmConnection({ ...cloudflare, model: 'minimax/m3' })).resolves.toEqual({
      ok: false,
      error: '模型没有返回内容',
    })
  })

  it('surfaces an SSE error when the stream has no assistant content', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([{ error: { message: 'Response conversion failed: Input is undefined or empty' } }, '[DONE]'], {
          contentType: null,
        }),
      ),
    )

    await expect(testLlmConnection({ ...cloudflare, model: 'minimax/m3' })).resolves.toEqual({
      ok: false,
      error: 'Response conversion failed: Input is undefined or empty',
    })
  })

  it('joins text parts inside streamed delta content', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([delta([{ type: 'text', text: '好' }]), '[DONE]'])),
    )

    await expect(testLlmConnection(deepseek)).resolves.toEqual({ ok: true, reply: '好' })
  })

  it('reports a timed-out connection test as 模型请求超时', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw timeoutError()
      }),
    )

    await expect(testLlmConnection(cloudflare)).resolves.toEqual({ ok: false, error: '模型请求超时' })
  })
})

describe('completeWithTools', () => {
  it('aggregates streamed tool call deltas and does not force json mode', async () => {
    const bodies: unknown[] = []
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return sseResponse([
          { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'replace_paragraph', arguments: '' } }] } }] },
          { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"id":"p1","text":"新段落"}' } }] } }] },
          '[DONE]',
        ])
      }),
    )

    const payload = await completeWithTools(cloudflare, '系统', '用户', [{ type: 'function', function: { name: 'replace_paragraph' } }], 0.3)
    expect(bodies[0]).toMatchObject({ stream: true, tool_choice: 'auto' })
    expect(bodies[0]).not.toHaveProperty('response_format')
    expect(parseDraftToolCalls(payload)).toEqual([{ name: 'replace_paragraph', arguments: { id: 'p1', text: '新段落' } }])
  })

  it('falls back to json calls when the provider rejects tools', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { tools?: unknown }
        if (body.tools) return jsonResponse({ error: { message: 'tools are not supported' } }, 400)
        return jsonResponse(chat('{"calls":[{"name":"update_draft","arguments":{"title":"新的标题在这里"}}]}'))
      }),
    )

    const payload = await completeWithTools(cloudflare, '系统', '用户', [{ type: 'function', function: { name: 'update_draft' } }], 0.3)
    expect(parseDraftToolCalls(payload)).toEqual([{ name: 'update_draft', arguments: { title: '新的标题在这里' } }])
  })
})
