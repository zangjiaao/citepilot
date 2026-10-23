import { describe, expect, it } from 'vitest'
import { completionsUrl, responsesUrl } from '../shared/json.ts'
import { LLM_PRESETS, apiStyleHint, keepsStoredKey, maskApiKey, parseLlmDraft, pickConfigId } from '../shared/llmProviders.ts'

describe('llm providers', () => {
  it('includes the requested presets and masks a stored key', () => {
    expect(LLM_PRESETS.map((item) => item.id)).toEqual([
      'deepseek',
      'openai',
      'qwen',
      'moonshot',
      'zhipu',
      'doubao',
      'openrouter',
      'custom',
    ])
    expect(maskApiKey('sk-test-secret-1234')).toBe('已保存 ····1234')
    expect(maskApiKey('sk-test-secret-1234')).not.toContain('secret')
    expect(keepsStoredKey('')).toBe(true)
    expect(keepsStoredKey('已保存 ····1234')).toBe(true)
    expect(keepsStoredKey('sk-new-key-value')).toBe(false)
  })

  it('uses the task config, then the default', () => {
    const configs = [
      { id: 'a', isDefault: true },
      { id: 'b', isDefault: false },
    ]
    expect(pickConfigId(configs, { generateConfigId: 'b', analyzeConfigId: '' }, 'generate')).toBe('b')
    expect(pickConfigId(configs, { generateConfigId: '', analyzeConfigId: '' }, 'analyze')).toBe('a')
    expect(pickConfigId(configs, { generateConfigId: 'missing', analyzeConfigId: '' }, 'generate')).toBe('a')
  })

  it('rejects a private base URL and accepts DeepSeek', () => {
    const bad = parseLlmDraft(
      { label: '内网', provider: 'custom', baseUrl: 'http://127.0.0.1:11434/v1', model: 'local', apiKey: 'sk-local-key' },
      { requireKey: true },
    )
    expect(bad.ok).toBe(false)
    const good = parseLlmDraft(
      { label: 'DeepSeek', provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: 'sk-live-key-1234', temperature: 0.2 },
      { requireKey: true },
    )
    expect(good.ok).toBe(true)
    if (good.ok) {
      expect(good.value.apiKey).toBe('sk-live-key-1234')
      expect(good.value.apiStyle).toBe('chat')
    }
  })

  it('stores Responses API separately and keeps DeepSeek on chat completions', () => {
    const missing = parseLlmDraft(
      {
        label: 'Sol',
        provider: 'custom',
        baseUrl: 'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1',
        model: 'openai/gpt-5.6-sol',
        apiKey: 'cf-test-key',
        apiStyle: 'other',
      },
      { requireKey: true },
    )
    expect(missing.ok).toBe(false)
    const saved = parseLlmDraft(
      {
        label: 'Sol',
        provider: 'custom',
        baseUrl: 'https://api.cloudflare.com/client/v4/accounts/abc/ai/v1/chat/completions',
        model: 'openai/gpt-5.6-sol',
        apiKey: 'cf-test-key',
        apiStyle: 'responses',
      },
      { requireKey: true },
    )
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.value.apiStyle).toBe('responses')
    expect(responsesUrl(saved.value.baseUrl)).toBe('https://api.cloudflare.com/client/v4/accounts/abc/ai/v1/responses')
    expect(completionsUrl('https://api.deepseek.com')).toBe('https://api.deepseek.com/chat/completions')
    expect(completionsUrl('https://api.openai.com/v1/responses')).toBe('https://api.openai.com/v1/chat/completions')
    expect(apiStyleHint('chat')).toContain('minimax/m2.7')
    expect(apiStyleHint('chat')).toContain('minimax/m3')
    expect(apiStyleHint('chat')).not.toContain('m2.5')
  })
})
