import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import MDEditor, { commands, type ICommand } from '@uiw/react-md-editor'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/Layout'
import { insertMarkdownSnippet } from '../../shared/richText.ts'

export function MarkdownPreview({ value }: { value: string }) {
  return (
    <div className="citepilot-md-preview" data-color-mode="light">
      <MDEditor.Markdown source={value} />
    </div>
  )
}

export interface MarkdownBodyEditorHandle {
  insert: (snippet: string) => void
}

export const MarkdownBodyEditor = forwardRef<
  MarkdownBodyEditorHandle,
  {
    value: string
    onChange: (markdown: string) => void
    onUpload?: (file: File) => Promise<string>
    placeholder?: string
  }
>(function MarkdownBodyEditor({ value, onChange, onUpload, placeholder }, ref) {
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onUploadRef = useRef(onUpload)
  const selectionRef = useRef<{ start: number; end: number } | null>(null)
  const pendingCursor = useRef<number | null>(null)
  const [hint, setHint] = useState('')
  const [uploading, setUploading] = useState(false)
  valueRef.current = value
  onChangeRef.current = onChange
  onUploadRef.current = onUpload

  const rememberSelection = (target: HTMLTextAreaElement) => {
    selectionRef.current = { start: target.selectionStart, end: target.selectionEnd }
  }

  const insert = (snippet: string) => {
    const area = rootRef.current?.querySelector('textarea') ?? null
    const current = valueRef.current
    const focused = area && document.activeElement === area
    const start = focused ? area.selectionStart : (selectionRef.current?.start ?? current.length)
    const end = focused ? area.selectionEnd : (selectionRef.current?.end ?? current.length)
    const next = insertMarkdownSnippet(current, snippet, start, end)
    selectionRef.current = { start: next.cursor, end: next.cursor }
    pendingCursor.current = next.cursor
    onChangeRef.current(next.value)
  }

  useImperativeHandle(ref, () => ({ insert }), [])

  useEffect(() => {
    const cursor = pendingCursor.current
    if (cursor == null) return
    pendingCursor.current = null
    const area = rootRef.current?.querySelector('textarea')
    if (!area) return
    area.focus()
    area.setSelectionRange(cursor, cursor)
  }, [value])

  const uploadFiles = async (files: File[]) => {
    const upload = onUploadRef.current
    if (!upload) return
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    setHint('')
    setUploading(true)
    try {
      const lines: string[] = []
      for (const file of images) {
        const url = await upload(file)
        const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '')
        lines.push(`![${alt}](${url})`)
      }
      insert(lines.join('\n'))
    } catch (error) {
      setHint(error instanceof Error ? error.message : '图片没有插进去')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const uploadCommand: ICommand = {
    ...commands.image,
    buttonProps: { 'aria-label': '插入图片', title: uploading ? '正在上传' : '插入图片' },
    execute: (state) => {
      selectionRef.current = state.selection
      fileRef.current?.click()
    },
  }

  const placeholderText =
    placeholder ?? (onUpload ? '用 Markdown 写。标题、列表、链接都可以，也可以粘贴图片。' : '用 Markdown 写。标题、列表、链接都可以。')

  return (
    <VStack gap={2} height="100%" minHeight={0}>
      <div ref={rootRef} className="citepilot-md" data-color-mode="light">
        <MDEditor
          value={value}
          preview="live"
          height="100%"
          minHeight={240}
          visibleDragbar={false}
          highlightEnable={false}
          textareaProps={{
            placeholder: placeholderText,
            onSelect: (event) => rememberSelection(event.currentTarget),
            onKeyUp: (event) => rememberSelection(event.currentTarget),
            onClick: (event) => rememberSelection(event.currentTarget),
            onBlur: (event) => rememberSelection(event.currentTarget),
            onPaste: (event) => {
              if (!onUploadRef.current) return
              const files = [...(event.clipboardData?.files ?? [])]
              if (!files.some((file) => file.type.startsWith('image/'))) return
              rememberSelection(event.currentTarget)
              event.preventDefault()
              void uploadFiles(files)
            },
            onDrop: (event) => {
              if (!onUploadRef.current) return
              const files = [...(event.dataTransfer?.files ?? [])]
              if (!files.some((file) => file.type.startsWith('image/'))) return
              rememberSelection(event.currentTarget)
              event.preventDefault()
              void uploadFiles(files)
            },
          }}
          commandsFilter={(command) => {
            if (command.keyCommand !== 'image') return command
            return onUpload ? uploadCommand : false
          }}
          onChange={(next, event) => {
            if (event?.currentTarget) rememberSelection(event.currentTarget)
            onChange(next ?? '')
          }}
        />
      </div>
      {onUpload ? (
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={(event) => {
            const files = [...(event.target.files ?? [])]
            void uploadFiles(files)
          }}
        />
      ) : null}
      <Text color="secondary">
        {uploading ? '正在上传图片。' : onUpload ? '左侧写 Markdown，右侧是预览。图片会上传后再写成 ![](地址)。' : '左侧写 Markdown，右侧是预览。'}
      </Text>
      {hint ? <Text color="secondary">{hint}</Text> : null}
      <style>{`.citepilot-md{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;height:100%}.citepilot-md .w-md-editor{flex:1 1 auto;min-height:240px;height:100%;box-shadow:none}.citepilot-md .w-md-editor-content{flex:1 1 auto;height:auto;min-height:0}`}</style>
    </VStack>
  )
})
