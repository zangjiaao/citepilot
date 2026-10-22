import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { CaseStudy, Objection, ReferenceSnippet } from '../../../shared/brandProfile.ts'

export function ProfileTextAreas({
  values,
  onChange,
  status,
}: {
  values: {
    introduction: string
    teamBackground: string
    differentiation: string
    methodology: string
    pricing: string
    customerProfile: string
    customerPains: string
    evidence: string
    voice: string
    bannedWords: string
    compliance: string
  }
  onChange: (key: string, value: string) => void
  status: (key: string) => { type: 'error'; message: string } | undefined
}) {
  return (
    <VStack gap={3}>
      <Heading level={2}>品牌细节</Heading>
      <Text color="secondary">这些都是可选项。句子里的逗号会保留。写得越具体，起草越不像套话。</Text>
      <TextArea label="品牌介绍" description="一段长文即可，不必拆成条目。" value={values.introduction} onChange={(value) => onChange('introduction', value)} rows={5} width="100%" statusVariant="detached" status={status('introduction')} />
      <TextArea label="创始人与团队背景" value={values.teamBackground} onChange={(value) => onChange('teamBackground', value)} rows={4} width="100%" statusVariant="detached" status={status('teamBackground')} />
      <TextArea label="差异化优势" description="和竞品相比，具体哪里不同。起草对比文会用到。" value={values.differentiation} onChange={(value) => onChange('differentiation', value)} rows={4} width="100%" statusVariant="detached" status={status('differentiation')} />
      <TextArea label="方法论 / 交付流程" value={values.methodology} onChange={(value) => onChange('methodology', value)} rows={4} width="100%" statusVariant="detached" status={status('methodology')} />
      <TextArea label="服务与报价区间 / 合作模式" value={values.pricing} onChange={(value) => onChange('pricing', value)} rows={4} width="100%" statusVariant="detached" status={status('pricing')} />
      <TextArea label="目标客户画像" value={values.customerProfile} onChange={(value) => onChange('customerProfile', value)} rows={4} width="100%" statusVariant="detached" status={status('customerProfile')} />
      <TextArea label="典型痛点" value={values.customerPains} onChange={(value) => onChange('customerPains', value)} rows={4} width="100%" statusVariant="detached" status={status('customerPains')} />
      <TextArea label="证据素材" description="资质、合作伙伴、媒体报道。没有的不要写。" value={values.evidence} onChange={(value) => onChange('evidence', value)} rows={4} width="100%" statusVariant="detached" status={status('evidence')} />
      <TextArea label="品牌语气 / 写作风格" value={values.voice} onChange={(value) => onChange('voice', value)} rows={3} width="100%" statusVariant="detached" status={status('voice')} />
      <TextArea label="禁用词" description="起草时会避开这些说法。" value={values.bannedWords} onChange={(value) => onChange('bannedWords', value)} rows={3} width="100%" statusVariant="detached" status={status('bannedWords')} />
      <TextArea label="不能说的内容" description="合规红线。模型不得越过这里。" value={values.compliance} onChange={(value) => onChange('compliance', value)} rows={3} width="100%" statusVariant="detached" status={status('compliance')} />
    </VStack>
  )
}

export function CaseStudyEditor({
  items,
  onChange,
}: {
  items: CaseStudy[]
  onChange: (items: CaseStudy[]) => void
}) {
  const update = (id: string, key: keyof CaseStudy, value: string | boolean) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [key]: value } : item)))
  }
  return (
    <VStack gap={2}>
      <Heading level={2}>案例详情</Heading>
      <Text color="secondary">一条案例一张卡片。不可公开的案例只会用来概括方法，不会写出客户身份。</Text>
      {items.map((item, index) => (
        <VStack key={item.id} gap={2}>
          <Text type="label">案例 {index + 1}</Text>
          <FormLayout direction="horizontal">
            <TextInput label="客户行业 / 类型" value={item.industry} onChange={(value) => update(item.id, 'industry', value)} width="100%" />
            <TextInput label="交付周期" value={item.duration} onChange={(value) => update(item.id, 'duration', value)} width="100%" />
            <Selector
              label="可否公开"
              value={item.isPublic ? 'yes' : 'no'}
              options={[
                { value: 'yes', label: '可公开' },
                { value: 'no', label: '不可公开' },
              ]}
              onChange={(value) => update(item.id, 'isPublic', value === 'yes')}
            />
          </FormLayout>
          <TextArea label="痛点" value={item.pain} onChange={(value) => update(item.id, 'pain', value)} rows={3} width="100%" />
          <TextArea label="方案" value={item.approach} onChange={(value) => update(item.id, 'approach', value)} rows={3} width="100%" />
          <TextArea label="结果 / 指标" description="只写已经发生、可以核对的结果。" value={item.outcome} onChange={(value) => update(item.id, 'outcome', value)} rows={3} width="100%" />
          <Button label="移除这条案例" size="sm" variant="ghost" onClick={() => onChange(items.filter((row) => row.id !== item.id))} />
        </VStack>
      ))}
      <Button
        label="添加案例"
        variant="secondary"
        onClick={() =>
          onChange([...items, { id: crypto.randomUUID(), industry: '', pain: '', approach: '', duration: '', outcome: '', isPublic: false }])
        }
      />
    </VStack>
  )
}

export function ObjectionEditor({ items, onChange }: { items: Objection[]; onChange: (items: Objection[]) => void }) {
  const update = (id: string, key: 'question' | 'answer', value: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [key]: value } : item)))
  }
  return (
    <VStack gap={2}>
      <Heading level={2}>常见异议与回应</Heading>
      {items.map((item, index) => (
        <VStack key={item.id} gap={2}>
          <Text type="label">问答 {index + 1}</Text>
          <TextInput label="异议 / 问题" value={item.question} onChange={(value) => update(item.id, 'question', value)} width="100%" />
          <TextArea label="回应" value={item.answer} onChange={(value) => update(item.id, 'answer', value)} rows={3} width="100%" />
          <Button label="移除这条问答" size="sm" variant="ghost" onClick={() => onChange(items.filter((row) => row.id !== item.id))} />
        </VStack>
      ))}
      <Button
        label="添加问答"
        variant="secondary"
        onClick={() => onChange([...items, { id: crypto.randomUUID(), question: '', answer: '' }])}
      />
    </VStack>
  )
}

export function ReferenceEditor({
  items,
  onChange,
}: {
  items: ReferenceSnippet[]
  onChange: (items: ReferenceSnippet[]) => void
}) {
  const update = (id: string, key: keyof ReferenceSnippet, value: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [key]: value } : item)))
  }
  return (
    <VStack gap={2}>
      <Heading level={2}>资料库</Heading>
      <Text color="secondary">贴已有页面的正文，或只留一个公开链接。只有链接、没有摘录时，起草不会假装读过那一页。</Text>
      {items.map((item, index) => (
        <VStack key={item.id} gap={2}>
          <Text type="label">资料 {index + 1}</Text>
          <TextInput label="标题" value={item.title} onChange={(value) => update(item.id, 'title', value)} width="100%" />
          <TextInput label="链接" value={item.url} onChange={(value) => update(item.id, 'url', value)} width="100%" />
          <TextArea label="摘录" value={item.excerpt} onChange={(value) => update(item.id, 'excerpt', value)} rows={4} width="100%" />
          <Button label="移除这条资料" size="sm" variant="ghost" onClick={() => onChange(items.filter((row) => row.id !== item.id))} />
        </VStack>
      ))}
      <Button
        label="添加资料"
        variant="secondary"
        onClick={() => onChange([...items, { id: crypto.randomUUID(), title: '', url: '', excerpt: '' }])}
      />
    </VStack>
  )
}
