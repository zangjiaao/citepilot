import { describe, expect, it } from 'vitest'
import { blankBrandProfile } from '../shared/brandProfile.ts'
import { assembleDraftPrompt, PARAGRAPH_RULE, softCloser, type ContentType, type DraftLength, type PublishPlatformId } from '../shared/draftPrompt.ts'
import { platformFormatHint, platformFormatRule } from '../shared/platformFormats.ts'
import type { Studio } from '../shared/types.ts'

const studio: Studio = {
  id: 's',
  name: '橡树智能体科技有限公司',
  website: 'https://www.oak-studio.org/',
  positioning: '',
  services: [],
  competitors: [],
  keywords: [],
  capabilities: [],
  cases: [],
  targetCustomers: [],
  solutions: [],
  ...blankBrandProfile(),
  createdAt: '',
  updatedAt: '',
}

const markers: Record<PublishPlatformId, string> = {
  xiaohongshu: '不要用 Markdown',
  wechat: '小标题少',
  zhihu: '感谢邀请',
  thread: '1/N',
  site: '清楚的小节',
  faq: '直接回答',
}

const contentTypes: Record<PublishPlatformId, ContentType> = {
  xiaohongshu: 'short-post',
  wechat: 'wechat',
  zhihu: 'zhihu',
  thread: 'thread',
  site: 'case-breakdown',
  faq: 'faq',
}

function promptFor(contentType: ContentType, length: DraftLength = 'medium', brandMention: 'none' | 'light' | 'guide' = 'none') {
  return assembleDraftPrompt(
    studio,
    { audience: '', contentType, tone: '', length, allowBragging: false, brandMention },
    { channelLabel: contentType },
    [],
  )
}

describe('platform format rules', () => {
  it('gives each publish platform a distinct block and keeps short paragraphs', () => {
    const seen = new Set<string>()
    for (const id of Object.keys(contentTypes) as PublishPlatformId[]) {
      const rule = platformFormatRule(contentTypes[id], 'medium', 'light')
      expect(rule).toContain(markers[id])
      expect(seen.has(rule)).toBe(false)
      seen.add(rule)
      const prompt = promptFor(contentTypes[id], 'medium', 'light')
      expect(prompt.system).toContain(rule)
      expect(prompt.user).toContain(rule)
      expect(prompt.system).toContain(PARAGRAPH_RULE)
      expect(prompt.user).toContain('段与段之间空一行')
    }
  })

  it('matches length and implant habits without dropping the soft closer', () => {
    const note = promptFor('short-post')
    expect(note.user).toContain('300 到 800')
    expect(note.system).toContain('不超过约 1000')
    expect(note.system).not.toContain('300 字以内')

    expect(promptFor('wechat', 'medium').system).toContain('900 到 2000')
    expect(promptFor('wechat', 'long').system).toContain('1800 到 2800')

    const quietThread = promptFor('thread', 'medium', 'none')
    expect(quietThread.system).toContain('不要出现品牌名或链接')
    const loudThread = promptFor('thread', 'medium', 'light')
    expect(loudThread.system).toContain('只放在最后一条')
    expect(loudThread.system).toContain(softCloser(studio.name, studio.website))

    const site = promptFor('case-breakdown', 'medium', 'light')
    expect(site.system).toContain('真实官网只出现一次')
    expect(site.system).toContain('结尾必须有且只有一句软收束')
  })

  it('uses the same one-line hint the platform picker shows', () => {
    expect(platformFormatHint('xiaohongshu')).toBe('小红书：短段、无 Markdown、标题约20字内')
    expect(platformFormatHint('wechat')).toBe('公众号：先写场景，手机上两三句一段，小标题少')
    expect(platformFormatHint('zhihu')).toBe('知乎：第一段先回答，再给案例，不要「感谢邀请」')
    expect(platformFormatHint('thread')).toBe('thread：5 到 8 条，每条一个点，标成 1/N')
    expect(platformFormatHint('site')).toBe('官网：分节写，正文里留可引用的句子')
    expect(platformFormatHint('faq')).toBe('FAQ：先直接回答，再补一句细节')
    expect(platformFormatHint('unknown')).toBe(platformFormatHint('xiaohongshu'))
    expect(platformFormatRule('build-log', 'medium', 'none')).toContain('公众号')
    expect(platformFormatRule('interaction', 'medium', 'none')).toContain('官网案例拆解')
  })
})