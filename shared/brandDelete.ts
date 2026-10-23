/** 删除品牌时的顺序。样本必须先于题目和批次，否则外键会挡住删除。 */
export const BRAND_DELETE_ORDER = ['observations', 'drafts', 'diagnoses', 'prompts', 'cycles', 'assets', 'studios'] as const

export type BrandDeleteTable = (typeof BRAND_DELETE_ORDER)[number]
