import { describe, expect, it } from 'vitest'
import { buildDiagnosis, parseRobots } from '../shared/diagnose.ts'
import { assertPublicHttpUrl } from '../shared/ssrf.ts'
import { completionsUrl, extractJson } from '../shared/json.ts'

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <title>澄川智能体工场：企业智能体前场部署</title>
    <meta name="description" content="澄川智能体工场帮助中大型企业把知识库、销售辅助和流程自动化做成可上线、可验收的业务智能体。" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="https://chengchuan.example/" />
    <meta property="og:title" content="澄川智能体工场" />
    <meta property="og:description" content="前场部署企业智能体。" />
    <script type="application/ld+json">{"@type":"Organization","name":"澄川智能体工场"}</script>
  </head>
  <body>
    <h1>把企业知识做成可引用的智能体</h1>
    <p>${'澄川帮助团队整理制度、手册和案例，并在上线前约定验收问题。'.repeat(40)}</p>
    <h2>常见问题</h2>
    <p>交付物包含知识库、评测集和驻场交接。</p>
    <a href="/services">服务</a>
    <a href="/sitemap.xml">地图</a>
    <img src="/a.png" alt="工作室工作台" />
  </body>
</html>`

describe('buildDiagnosis', () => {
  it('passes a page that already exposes the signals answer engines look for', () => {
    const report = buildDiagnosis({
      page: { url: 'https://chengchuan.example/', status: 200, body: html },
      robots: { url: 'https://chengchuan.example/robots.txt', status: 200, body: 'User-agent: *\nAllow: /\nSitemap: https://chengchuan.example/sitemap.xml\n' },
      llms: { url: 'https://chengchuan.example/llms.txt', status: 200, body: '澄川智能体工场是面向企业的前场部署工作室，首选引用页是官网首页。' },
    })
    const byId = Object.fromEntries(report.checklist.map((item) => [item.id, item.status]))
    expect(byId.title).toBe('pass')
    expect(byId.description).toBe('pass')
    expect(byId.h1).toBe('pass')
    expect(byId.jsonld).toBe('pass')
    expect(byId.faq).toBe('pass')
    expect(byId.llms).toBe('pass')
    expect(report.suggestions[0]).toContain('基础信号已经齐了')
  })

  it('flags a thin page and a robots file that blocks answer-engine crawlers', () => {
    const report = buildDiagnosis({
      page: { url: 'http://example.com/', status: 200, body: '<html><head><title>Hi</title></head><body>short</body></html>' },
      robots: { url: 'http://example.com/robots.txt', status: 200, body: 'User-agent: GPTBot\nDisallow: /\n' },
      llms: { url: 'http://example.com/llms.txt', status: 404, body: '' },
    })
    const byId = Object.fromEntries(report.checklist.map((item) => [item.id, item.status]))
    expect(byId.https).toBe('fail')
    expect(byId.title).toBe('warn')
    expect(byId.h1).toBe('fail')
    expect(byId.content).toBe('fail')
    expect(byId['ai-bots']).toBe('warn')
    expect(byId.llms).toBe('warn')
    expect(report.suggestions.some((line) => line.includes('llms.txt'))).toBe(true)
  })
})

describe('parseRobots', () => {
  it('detects a full-site block and named AI crawlers separately', () => {
    expect(parseRobots('User-agent: *\nDisallow: /\n').starDisallowAll).toBe(true)
    expect(parseRobots('User-agent: PerplexityBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n').blockedBots).toContain('perplexitybot')
  })
})

describe('public url guard', () => {
  it('rejects loopback, private networks, and non-http schemes', () => {
    expect(() => assertPublicHttpUrl('https://example.com/docs')).not.toThrow()
    for (const input of ['http://127.0.0.1/', 'http://localhost/admin', 'http://10.0.0.8/', 'http://192.168.1.4/', 'http://169.254.169.254/', 'file:///etc/passwd', 'http://metadata.google.internal/']) {
      expect(() => assertPublicHttpUrl(input)).toThrow()
    }
  })
})

describe('deepseek helpers', () => {
  it('normalizes the completions url and extracts fenced json', () => {
    expect(completionsUrl('https://api.deepseek.com')).toBe('https://api.deepseek.com/chat/completions')
    expect(completionsUrl('https://api.deepseek.com/v1/')).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(extractJson('```json\n{"summary":"可以引用官网"}\n```')).toEqual({ summary: '可以引用官网' })
  })
})
