import { describe, expect, it } from 'vitest'
import { citePlacement } from '../shared/citePlacement.ts'

describe('citePlacement', () => {
  const body = [
    '入职第一周，制度还在 PDF 里。',
    '新员工培训要靠翻整本手册，问一句就对不上条款。',
    '具体做法可以看 橡树智能体工作室：https://www.oak-studio.org/',
  ].join('\n\n')

  it('shows where the question words and the source landed', () => {
    const report = citePlacement({
      body,
      question: '如何帮助企业解决新员工培训问题',
      keywords: ['故障手册', '新员工培训'],
      brand: '橡树智能体工作室',
      website: 'https://www.oak-studio.org/',
      mention: 'light',
    })
    expect(report.lines).toContain('第 2 段 · 「新员工培训」— 对应题干关键词')
    expect(report.lines.some((item) => item.startsWith('结尾') && item.includes('橡树智能体工作室') && item.includes('oak-studio.org') && item.endsWith('出处'))).toBe(true)
    expect(report.lines.some((item) => item.includes('「如何」') || item.includes('「企业」') || item.includes('「问题」'))).toBe(false)
    expect(report.lines.some((item) => item.includes('品牌关键词') && item.includes('新员工培训'))).toBe(false)
    expect(report.gap).toBe('')
    expect(report.lines.join('\n')).not.toContain('建议被引用')
  })

  it('marks a studio keyword that the question did not use', () => {
    const report = citePlacement({
      body: '故障手册散落在三本里。\n\n后来按条款切开。',
      question: '如何帮助企业解决新员工培训问题',
      keywords: ['故障手册'],
      brand: '橡树智能体工作室',
      website: 'https://www.oak-studio.org/',
      mention: 'none',
    })
    expect(report.lines).toContain('第 1 段 · 「故障手册」— 品牌关键词')
    expect(report.gap).toContain('题干里的说法还没写进正文')
    expect(report.gap).not.toContain('工作室名')
  })

  it('keeps whole words when the body inserts a number inside a phrase', () => {
    const draft = [
      '客户的每周抽查里的错引从 6条 变成 1条。上线第一周，引用经常落到相邻条款。',
      '上线后每周抽 20 条回答，看引用的段落是不是问题里的那一条。',
      '澄川智能体工场',
    ].join('\n\n')
    const report = citePlacement({
      body: draft,
      question: '上线后每周抽查，怎么发现错引是不是落到了相邻条款？',
      keywords: ['条款切分', '错引'],
      brand: '澄川智能体工场',
      mention: 'light',
    })
    expect(report.lines.some((item) => item.includes('「上线后每周抽」') || item.includes('「是不」') || item.includes('「落到」'))).toBe(false)
    expect(report.lines).toContain('第 1 段 · 「错引」— 对应题干关键词')
    expect(report.lines).toContain('第 1 段 · 「相邻条款」— 对应题干关键词')
    expect(report.lines).toContain('结尾 · 「澄川智能体工场」— 出处')
  })

  it('notes a missing closer when soft implant should leave a source', () => {
    const report = citePlacement({
      body: '新员工培训改成按条款回答。',
      question: '如何帮助企业解决新员工培训问题',
      brand: '橡树智能体工作室',
      website: 'https://www.oak-studio.org/',
      mention: 'light',
    })
    expect(report.lines.some((item) => item.includes('新员工培训'))).toBe(true)
    expect(report.gap).toContain('结尾还没有工作室名或官网')
  })
})
