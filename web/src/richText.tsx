import { useEffect, useRef, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import * as stylex from '@stylexjs/stylex'
import { richHtmlForEditor, sanitizeRichHtml } from '../../shared/richText.ts'

const styles = stylex.create({
  editor: {
    minHeight: 420,
    padding: 16,
    lineHeight: 1.65,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'color-mix(in srgb, currentColor 18%, transparent)',
    overflow: 'auto',
  },
})

export function RichTextEditor({
  value,
  onChange,
  onUpload,
}: {
  value: string
  onChange: (html: string) => void
  onUpload: (file: File) => Promise<string>
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const last = useRef<string | null>(null)
  const [hint, setHint] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const node = editorRef.current
    if (!node || last.current === value) return
    last.current = value
    node.innerHTML = richHtmlForEditor(value)
  }, [value])

  const emit = () => {
    const html = sanitizeRichHtml(editorRef.current?.innerHTML ?? '')
    last.current = html
    onChange(html)
  }

  const run = (command: string, argument?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, argument)
    emit()
  }

  const insertHtml = (html: string) => {
    editorRef.current?.focus()
    const inserted = document.execCommand('insertHTML', false, html)
    if (!inserted && editorRef.current) editorRef.current.insertAdjacentHTML('beforeend', html)
    emit()
  }

  const addLink = () => {
    const href = window.prompt('链接地址（http 或 https）', 'https://')
    if (!href) return
    run('createLink', href.trim())
  }

  const addImage = async (file: File | undefined) => {
    if (!file) return
    setHint('')
    setUploading(true)
    try {
      const url = await onUpload(file)
      insertHtml(`<img src="${url}" alt="">`)
    } catch (error) {
      setHint(error instanceof Error ? error.message : '图片没有插进去')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <VStack gap={2}>
      <HStack gap={1} wrap="wrap">
        <Button label="标题" size="sm" variant="secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => run('formatBlock', 'h2')} />
        <Button label="小标题" size="sm" variant="secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => run('formatBlock', 'h3')} />
        <Button label="加粗" size="sm" variant="secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => run('bold')} />
        <Button label="列表" size="sm" variant="secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => run('insertUnorderedList')} />
        <Button label="编号" size="sm" variant="secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => run('insertOrderedList')} />
        <Button label="链接" size="sm" variant="secondary" onMouseDown={(event) => event.preventDefault()} onClick={addLink} />
        <Button label={uploading ? '正在插入' : '插入图片'} size="sm" variant="secondary" onClick={() => fileRef.current?.click()} isLoading={uploading} />
      </HStack>
      <style>{'#library-body img{max-width:100%;height:auto;display:block;margin:8px 0;border-radius:8px}'}</style>
      <input
        id="library-image-input"
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        hidden
        onChange={(event) => void addImage(event.target.files?.[0])}
      />
      <div
        id="library-body"
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label="素材正文"
        contentEditable
        {...stylex.props(styles.editor)}
        onInput={emit}
        onBlur={emit}
      />
      <Text color="secondary">标题、加粗、列表、链接和图片。只排你已经写下的事实，不在这里编数字。</Text>
      {hint ? <Text color="secondary">{hint}</Text> : null}
    </VStack>
  )
}
