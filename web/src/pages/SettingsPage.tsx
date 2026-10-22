import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { LLM_PRESETS, type LlmProviderId } from '../../../shared/llmProviders.ts'
import { ApiError, api } from '../api'
import { ErrorBanner, InfoBanner, PageFrame } from '../ui'

interface PublicConfig {
  id: string
  label: string
  provider: LlmProviderId | string
  providerLabel: string
  baseUrl: string
  model: string
  temperature: number | null
  maxTokens: number | null
  isDefault: boolean
  keyHint: string
}

interface SettingsPayload {
  configs: PublicConfig[]
  settings: { generateConfigId: string; analyzeConfigId: string }
  active: { enabled: boolean; label: string; model: string; source: string; generate: { label: string; model: string; source: string }; analyze: { label: string; model: string; source: string } }
}

const emptyForm = {
  id: '',
  label: '',
  provider: 'deepseek' as string,
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  apiKey: '',
  temperature: '',
  maxTokens: '',
  isDefault: false,
}

export function SettingsPage() {
  const [data, setData] = useState<SettingsPayload | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [generateConfigId, setGenerateConfigId] = useState('')
  const [analyzeConfigId, setAnalyzeConfigId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const load = async () => {
    const payload = await api<SettingsPayload>('/api/llm/configs')
    setData(payload)
    setGenerateConfigId(payload.settings.generateConfigId)
    setAnalyzeConfigId(payload.settings.analyzeConfigId)
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : '模型配置加载失败'))
  }, [])

  const applyPreset = (provider: string) => {
    const preset = LLM_PRESETS.find((item) => item.id === provider)
    setForm((current) => ({
      ...current,
      provider,
      baseUrl: preset?.baseUrl || current.baseUrl,
      model: preset?.model || current.model,
    }))
  }

  const edit = (config: PublicConfig) => {
    setForm({
      id: config.id,
      label: config.label,
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: '',
      temperature: config.temperature === null ? '' : String(config.temperature),
      maxTokens: config.maxTokens === null ? '' : String(config.maxTokens),
      isDefault: config.isDefault,
    })
    setNotice(config.keyHint ? `密钥${config.keyHint}。留空则不修改。` : '')
    setError('')
  }

  const payload = () => ({
    label: form.label,
    provider: form.provider,
    baseUrl: form.baseUrl,
    model: form.model,
    apiKey: form.apiKey,
    temperature: form.temperature === '' ? null : Number(form.temperature),
    maxTokens: form.maxTokens === '' ? null : Number(form.maxTokens),
    isDefault: form.isDefault,
  })

  const save = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (form.id) await api(`/api/llm/configs/${form.id}`, { method: 'PUT', body: JSON.stringify(payload()) })
      else await api('/api/llm/configs', { method: 'POST', body: JSON.stringify(payload()) })
      setForm(emptyForm)
      setNotice('模型配置已保存。密钥不会再显示出来。')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('删除这套模型配置？')) return
    setError('')
    try {
      await api(`/api/llm/configs/${id}`, { method: 'DELETE' })
      if (form.id === id) setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const saveTasks = async () => {
    setError('')
    try {
      await api('/api/llm/settings', {
        method: 'PUT',
        body: JSON.stringify({ generateConfigId, analyzeConfigId }),
      })
      setNotice('已分开内容生成和分析所用的配置。留空则用默认配置，没有默认时用环境变量。')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const test = async () => {
    setTesting(true)
    setError('')
    setNotice('')
    try {
      const body = form.id ? { id: form.id, ...payload() } : payload()
      const result = await api<{ reply: string }>('/api/llm/test', { method: 'POST', body: JSON.stringify(body) })
      setNotice(`连接成功。模型回复：${result.reply}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败')
    } finally {
      setTesting(false)
    }
  }

  const options = [
    { value: '', label: '跟随默认 / 环境变量' },
    ...(data?.configs ?? []).map((item) => ({ value: item.id, label: `${item.label} · ${item.model}` })),
  ]

  return (
    <PageFrame title="模型配置" description="内容起草和回答分析可以各用一套 OpenAI 兼容接口。密钥只在保存时写入，之后只显示末四位。">
      <VStack gap={4}>
        <ErrorBanner message={error} />
        {notice ? <InfoBanner title={notice} /> : null}
        {data?.active ? (
          <InfoBanner
            title={data.active.enabled ? `当前：${data.active.label || data.active.model}` : '还没有可用模型'}
            description={
              data.active.enabled
                ? `内容生成用 ${data.active.generate.label || data.active.generate.model || '环境变量'}。分析用 ${data.active.analyze.label || data.active.analyze.model || '环境变量'}。没有保存配置时，仍使用 DEEPSEEK_API_KEY。`
                : '可以在这里添加配置，或在 .dev.vars 里设置 DEEPSEEK_API_KEY。没有密钥时，起草和摘要走模板与规则。'
            }
          />
        ) : null}
        <VStack gap={2}>
          <Heading level={2}>已保存的配置</Heading>
          {(data?.configs ?? []).map((item) => (
            <VStack key={item.id} gap={1}>
              <Text>
                {item.label} · {item.providerLabel} · {item.model}
                {item.isDefault ? ' · 默认' : ''}
              </Text>
              <Text color="secondary">
                {item.baseUrl} · {item.keyHint}
              </Text>
              <FormLayout direction="horizontal">
                <Button label="编辑" variant="secondary" onClick={() => edit(item)} />
                <Button label="删除" variant="destructive" onClick={() => void remove(item.id)} />
              </FormLayout>
            </VStack>
          ))}
          {(data?.configs.length ?? 0) === 0 ? <Text color="secondary">还没有保存的配置。</Text> : null}
        </VStack>
        <FormLayout direction="vertical">
          <Heading level={2}>{form.id ? '编辑配置' : '添加配置'}</Heading>
          <TextInput label="名称" value={form.label} onChange={(value) => setForm({ ...form, label: value })} width="100%" />
          <Selector
            label="服务商"
            value={form.provider}
            options={LLM_PRESETS.map((item) => ({ value: item.id, label: item.label }))}
            onChange={(value) => applyPreset(value || 'custom')}
          />
          <TextInput label="接口地址" description="https 的 OpenAI 兼容地址，请求会发到 /chat/completions。" value={form.baseUrl} onChange={(value) => setForm({ ...form, baseUrl: value })} width="100%" />
          <TextInput label="模型 ID" description="豆包请填接入点 ID，例如 ep- 开头。" value={form.model} onChange={(value) => setForm({ ...form, model: value })} width="100%" />
          <TextInput label="API 密钥" description={form.id ? '留空表示不修改已保存的密钥。' : '只在这次保存时提交，之后不会回显。'} value={form.apiKey} onChange={(value) => setForm({ ...form, apiKey: value })} type="text" width="100%" />
          <TextInput label="温度" description="可空。0 到 2。" value={form.temperature} onChange={(value) => setForm({ ...form, temperature: value })} width="100%" />
          <TextInput label="最大输出" description="可空。整数。" value={form.maxTokens} onChange={(value) => setForm({ ...form, maxTokens: value })} width="100%" />
          <Selector
            label="设为默认"
            value={form.isDefault ? 'yes' : 'no'}
            options={[
              { value: 'no', label: '否' },
              { value: 'yes', label: '是，内容生成和分析都默认用它' },
            ]}
            onChange={(value) => setForm({ ...form, isDefault: value === 'yes' })}
          />
          <FormLayout direction="horizontal">
            <Button label={form.id ? '保存修改' : '添加'} variant="primary" onClick={() => void save()} isLoading={saving} />
            <Button label="测试连接" variant="secondary" onClick={() => void test()} isLoading={testing} />
            {form.id ? <Button label="取消编辑" variant="ghost" onClick={() => setForm(emptyForm)} /> : null}
          </FormLayout>
        </FormLayout>
        <VStack gap={2}>
          <Heading level={2}>分开使用</Heading>
          <Text color="secondary">留空表示跟随默认配置。默认也没有时，用环境变量里的 DeepSeek。</Text>
          <Selector label="内容生成" value={generateConfigId} options={options} onChange={(value) => setGenerateConfigId(value || '')} />
          <Selector label="分析 / 抽取" value={analyzeConfigId} options={options} onChange={(value) => setAnalyzeConfigId(value || '')} />
          <Button label="保存分工" variant="secondary" onClick={() => void saveTasks()} />
        </VStack>
      </VStack>
    </PageFrame>
  )
}
