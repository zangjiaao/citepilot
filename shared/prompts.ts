import type { Cluster, GeneratedPrompt, Studio } from './types.ts'

export function normalizeQuestion(text: string): string {
  return text.replace(/\s+/g, '').trim().toLowerCase()
}

export function templatePrompts(studio: Pick<Studio, 'name' | 'services' | 'competitors' | 'keywords'>, existing: string[]): GeneratedPrompt[] {
  const name = studio.name.trim() || '这家工作室'
  const competitor = studio.competitors[0]?.trim() || '同类工作室'
  const competitor2 = studio.competitors[1]?.trim() || competitor
  const keyword = studio.keywords[0]?.trim() || '企业智能体'
  const keyword2 = studio.keywords[1]?.trim() || keyword
  const service = studio.services[0]?.trim() || '智能体应用落地'
  const drafts: GeneratedPrompt[] = [
    { cluster: 'brand', text: `${name}是做什么的？适合哪类企业？`, rationale: '品牌认知：回答引擎能不能说清定位' },
    { cluster: 'brand', text: `${name}靠谱吗？有哪些可以核实的案例或客户评价？`, rationale: '品牌信任：是否给出可核对的证据' },
    { cluster: 'brand', text: `${name}的官网、服务范围和联系方式是什么？`, rationale: '品牌导航：是否引用官网' },
    { cluster: 'category', text: `企业要做${keyword}，应该怎么选服务商？`, rationale: '品类选型：品牌会不会进入候选名单' },
    { cluster: 'category', text: `${keyword2}项目一般怎么验收？`, rationale: '品类标准：公开页是否被当成答案来源' },
    { cluster: 'category', text: `${service}通常包含哪些交付物？`, rationale: '服务定义：回答是否复述你的交付边界' },
    { cluster: 'comparison', text: `${name}和${competitor}做${keyword}，差别在哪里？`, rationale: '对比题：品牌和竞品是否被同时点名' },
    { cluster: 'comparison', text: `选${name}还是${competitor2}，更适合第一次落地${keyword2}？`, rationale: '对比决策：是否给出偏向和理由' },
    { cluster: 'scenario', text: `团队想做「${service}」，第一步应该问服务商什么？`, rationale: '场景题：工作室会不会出现在实施建议里' },
    { cluster: 'scenario', text: `已经有内部知识库，还要不要找${name}这类团队做${keyword}？`, rationale: '场景取舍：自建和外购时品牌是否被提到' },
  ]
  const seen = new Set(existing.map(normalizeQuestion))
  const fresh = drafts.filter((draft) => !seen.has(normalizeQuestion(draft.text)))
  const picked: GeneratedPrompt[] = []
  for (const cluster of ['brand', 'category', 'comparison', 'scenario'] as const) {
    const found = fresh.find((draft) => draft.cluster === cluster)
    if (found) picked.push(found)
  }
  for (const draft of fresh) {
    if (picked.length >= 8) break
    if (!picked.includes(draft)) picked.push(draft)
  }
  return picked
}

export function isCluster(value: string): value is Cluster {
  return value === 'brand' || value === 'category' || value === 'comparison' || value === 'scenario'
}
