import { describe, expect, it } from 'vitest'
import { applyDraftTools, cleanChangedParagraphs, parseDraftToolCalls, type DraftToolCall } from '../shared/draftTools.ts'

const first = '第一段写验收题，客户要先写清范围再谈上线。'
const second = '第二段写交付，评测题和知识库一起交接，不另报价格。'
const third = '第三段写边界，没有写明的价格不要出现。'

const draft = {
  title: '闲鱼：驻场把验收题写清',
  body: `${first}\n\n${second}\n\n${third}`,
  citeSentences: ['客户要先写清验收题，再谈上线范围。', '交付时把评测题和知识库一起交接。'],
  urlHint: '闲鱼主页：澄川智能体工场',
}

function call(name: DraftToolCall['name'], args: Record<string, unknown>): DraftToolCall {
  return { name, arguments: args }
}

describe('草稿修改工具', () => {
  it('replaces one paragraph and leaves the others byte-identical', () => {
    const result = applyDraftTools(draft, [call('replace_paragraph', { id: 'p2', text: '第二段只改交付顺序，评测题仍和知识库一起交接。' })])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parts = result.draft.body.split('\n\n')
    expect(parts).toEqual([first, '第二段只改交付顺序，评测题仍和知识库一起交接。', third])
    expect(result.draft.title).toBe(draft.title)
    expect(result.draft.urlHint).toBe(draft.urlHint)
    expect(result.draft.citeSentences).toEqual(draft.citeSentences)
  })

  it('updates a section by index without touching the neighboring paragraph', () => {
    const result = applyDraftTools(draft, [call('update_section', { index: 0, text: '开头改成清单：先写验收题，再谈上线。' })])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.body.startsWith('开头改成清单：先写验收题，再谈上线。\n\n')).toBe(true)
    expect(result.draft.body.endsWith(third)).toBe(true)
    expect(result.draft.body).toContain(second)
  })

  it('appends after a paragraph and deletes one without rewriting the rest', () => {
    const appended = applyDraftTools(draft, [call('append_paragraph', { after: 'p1', text: '插在第一段后面，说明不另报价格。' })])
    expect(appended.ok).toBe(true)
    if (!appended.ok) return
    expect(appended.draft.body.split('\n\n')).toEqual([first, '插在第一段后面，说明不另报价格。', second, third])

    const deleted = applyDraftTools(draft, [call('delete_paragraph', { id: 'p2' })])
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    expect(deleted.draft.body).toBe(`${first}\n\n${third}`)
  })

  it('updates only the title when update_draft omits the body', () => {
    const result = applyDraftTools(draft, [call('update_draft', { title: '闲鱼：先写验收题' })])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.title).toBe('闲鱼：先写验收题')
    expect(result.draft.body).toBe(draft.body)
    expect(result.draft.citeSentences).toEqual(draft.citeSentences)
    expect(result.draft.urlHint).toBe(draft.urlHint)
  })

  it('rejects an invalid index and does not apply the earlier call in that batch', () => {
    const snapshot = draft.body
    const result = applyDraftTools(draft, [
      call('replace_paragraph', { id: 'p1', text: '这一段不会留下，因为后面的调用无效。' }),
      call('delete_paragraph', { index: 9 }),
    ])
    expect(result.ok).toBe(false)
    expect(draft.body).toBe(snapshot)
  })

  it('reads OpenAI tool calls and a calls array, and ignores a bare draft object', () => {
    expect(
      parseDraftToolCalls({
        choices: [
          {
            message: {
              tool_calls: [{ function: { name: 'replace_paragraph', arguments: '{"id":"p2","text":"新段落"}' } }],
            },
          },
        ],
      }),
    ).toEqual([call('replace_paragraph', { id: 'p2', text: '新段落' })])
    expect(parseDraftToolCalls({ calls: [{ name: 'delete_paragraph', arguments: { id: 'p1' } }] })).toEqual([call('delete_paragraph', { id: 'p1' })])
    expect(
      parseDraftToolCalls({
        output: [{ type: 'function_call', name: 'update_section', arguments: '{"index":1,"text":"只改这一节"}' }],
      }),
    ).toEqual([call('update_section', { index: 1, text: '只改这一节' })])
    expect(parseDraftToolCalls({ title: draft.title, body: draft.body, citeSentences: draft.citeSentences, urlHint: draft.urlHint })).toEqual([])
  })

  it('cleans only paragraphs whose text is new', () => {
    const before = `${first}\n\n${second}`
    const after = `${first}\n\n第二段已经换了说法，仍然不另报价格。`
    expect(cleanChangedParagraphs(before, after, (text) => text.replace('已经换了说法', '清洗过'))).toBe(`${first}\n\n第二段清洗过，仍然不另报价格。`)
  })
})
