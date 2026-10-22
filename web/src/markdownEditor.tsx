import { useRef, useState } from 'react'
import MDEditor, { commands, type ICommand } from '@uiw/react-md-editor'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/Layout'

export function MarkdownBodyEditor({
  value,
  onChange,
  onUpload,
}: {
  value: string
  onChange: (markdown: string) => void
  onUpload: (file: File) => Promise<string>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const selectionRef = useRef<{ start: number; end: number } | null>(null)
  const [hint, setHint] = useState('')
  const [uploading, setUploading] = useState(false)
  valueRef.current = value
  onChangeRef.current = onChange

  const insert = (snippet: string) => {
    const current = valueRef.current
    const range = selectionRef.current
    const start = range?.start ?? current.length
    const end = range?.end ?? current.length
    const next = `${current.slice(0, start)}${snippet}${current.slice(end)}`
    onChangeRef.current(next)
    selectionRef.current = { start: start + snippet.length, end: start + snippet.length }
  }

  const uploadFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    setHint('')
    setUploading(true)
    try {
      const lines: string[] = []
      for (const file of images) {
        const url = await onUpload(file)
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

  return (
    <VStack gap={2} height="100%" minHeight={0}>
      <div className="citepilot-md" data-color-mode="light">
        <MDEditor
          value={value}
          preview="live"
          height="100%"
          minHeight={240}
          visibleDragbar={false}
          highlightEnable={false}
          textareaProps={{
            placeholder: '用 Markdown 写。标题、列表、链接都可以，也可以粘贴图片。',
            onPaste: (event) => {
              const files = [...(event.clipboardData?.files ?? [])]
              if (!files.some((file) => file.type.startsWith('image/'))) return
              const target = event.currentTarget
              selectionRef.current = { start: target.selectionStart, end: target.selectionEnd }
              event.preventDefault()
              void uploadFiles(files)
            },
            onDrop: (event) => {
              const files = [...(event.dataTransfer?.files ?? [])]
              if (!files.some((file) => file.type.startsWith('image/'))) return
              const target = event.currentTarget
              selectionRef.current = { start: target.selectionStart, end: target.selectionEnd }
              event.preventDefault()
              void uploadFiles(files)
            },
          }}
          commandsFilter={(command) => (command.keyCommand === 'image' ? uploadCommand : command)}
          onChange={(next) => onChange(next ?? '')}
        />
      </div>
      <input
        id="library-image-input"
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          void uploadFiles(files)
        }}
      />
      <Text color="secondary">{uploading ? '正在上传图片。' : '左侧写 Markdown，右侧是预览。图片会上传后再写成 ![](地址)。'}</Text>
      {hint ? <Text color="secondary">{hint}</Text> : null}
      <style>{`.citepilot-md{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;height:100%}.citepilot-md .w-md-editor{flex:1 1 auto;min-height:240px;height:100%;box-shadow:none}.citepilot-md .w-md-editor-content{flex:1 1 auto;height:auto;min-height:0}`}</style>
    </VStack>
  )
}
