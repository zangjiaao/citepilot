import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { api } from '../api'
import { MarkdownPreview } from '../markdownEditor'
import { ErrorBanner, PageFrame } from '../ui'

interface SharedDraft {
  title: string
  body: string
  channel: string
  channelLabel: string
  citeSentences: string[]
  urlHint: string
  updatedAt: string
}

export function ShareDraftPage() {
  const { token } = useParams()
  const [draft, setDraft] = useState<SharedDraft | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    api<SharedDraft>(`/api/shares/${token}`)
      .then((result) => {
        if (!cancelled) setDraft(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '分享链接已经失效')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <PageFrame title={draft?.title || '分享的草稿'} description={draft ? `${draft.channelLabel} · 只读，不能修改` : '只读分享'}>
      <VStack gap={3}>
        <ErrorBanner message={error} />
        {draft ? (
          <VStack gap={3}>
            <MarkdownPreview value={draft.body} />
            <Heading level={2}>可引用的句子</Heading>
            {draft.citeSentences.map((sentence) => (
              <Text key={sentence}>{sentence}</Text>
            ))}
            <Text color="secondary">落点：{draft.urlHint}</Text>
          </VStack>
        ) : error ? null : (
          <Text color="secondary">正在打开这篇草稿。</Text>
        )}
      </VStack>
    </PageFrame>
  )
}
