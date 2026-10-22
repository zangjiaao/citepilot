import { describe, expect, it } from 'vitest'
import { splitLines, splitList } from '../web/src/format.ts'
import { readStudioList } from '../shared/studioLists.ts'

const positioning =
  '橡树智能体科技有限公司面向中大型企业，把通用大模型做成可上线、可验收的业务智能体。团队会驻场，和业务方一起改流程、写验收题，而不是只交付一次演示。服务覆盖知识库问答、流程自动化、销售辅助和内部 Copilot，公开说明以官网为准。'

const services = [
  '把通用大模型做成可验收的业务智能体，覆盖知识库问答、流程自动化、销售辅助和内部 Copilot 的驻场交接，并写清验收边界，适合第一次落地的团队。',
  '和企业一起整理文档、权限和评测集，把知识库问答做成带来源的回答，而不是一次演示聊天，验收题由业务方确认，避免只看演示。交付时留下可核对的记录。',
  '销售团队按产品资料、方案模板和禁用说法生成初稿，并标出引用段落，方便人工复核后再发出，避免空泛承诺，资料范围事先限定。交付时留下可核对的记录。',
  '上线后保留观测、回归题和交接说明，业务方可以自己判断回答有没有偏，而不是只看演示效果，迭代节奏写进交接，权限按部门切开。交付时留下可核对的记录。',
]

const keywords = [
  '企业智能体',
  'RAG 知识库',
  '前场部署',
  '知识库问答',
  '流程自动化',
  '销售 Copilot',
  '引用溯源',
  '评测集',
  '驻场实施',
  '业务交接',
  '权限控制',
  '内部 Copilot',
  '方案生成',
  '验收标准',
  '观测回归',
  '智能体应用',
  '橡树智能体',
  '公开网页',
]

describe('splitLines', () => {
  it('keeps commas inside a service sentence and still splits keywords on commas', () => {
    const pasted = services.join('\n')
    expect(splitLines(pasted)).toEqual(services)
    expect(splitList(pasted).length).toBeGreaterThan(services.length)
    expect(splitList(keywords.join('，'))).toEqual(keywords)
    expect((positioning.match(/，/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
})

describe('oak studio profile', () => {
  it('accepts the real profile: four long services and eighteen keywords', () => {
    expect(services).toHaveLength(4)
    for (const item of services) {
      expect(item.length).toBeGreaterThanOrEqual(70)
      expect(item.length).toBeLessThanOrEqual(90)
      expect(item).toContain('、')
      expect(item).toContain('，')
    }
    expect(keywords).toHaveLength(18)
    const savedServices = readStudioList(splitLines(services.join('\n')), 'services')
    const savedKeywords = readStudioList(splitList(keywords.join('，')), 'keywords')
    expect(savedServices).toEqual({ ok: true, items: services })
    expect(savedKeywords).toEqual({ ok: true, items: keywords })
    const capability = readStudioList(
      ['驻场交付知识库、流程自动化和销售辅助，并把评测题留给业务方复核。'],
      'capabilities',
    )
    expect(capability.ok).toBe(true)
  })
})

describe('readStudioList', () => {
  it('names the field, the actual size, and the limit', () => {
    const tooMany = readStudioList(Array.from({ length: 21 }, (_, index) => `服务${index}`), 'services')
    expect(tooMany).toEqual({ ok: false, field: 'services', error: '服务有 21 项，上限是 20 项' })
    const tooLong = readStudioList(['案'.repeat(501)], 'cases')
    expect(tooLong).toEqual({ ok: false, field: 'cases', error: '案例有一项长 501 字，上限是 500 字' })
    expect(readStudioList(['词'.repeat(80)], 'keywords').ok).toBe(true)
    expect(readStudioList(['词'.repeat(81)], 'keywords')).toMatchObject({
      ok: false,
      field: 'keywords',
      error: '关键词有一项长 81 字，上限是 80 字',
    })
    expect(readStudioList(Array.from({ length: 41 }, () => '词'), 'keywords').ok).toBe(false)
  })
})
