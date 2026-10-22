-- 每个品牌一套素材库。案例、产品、巧思、交互、数据、评价、踩坑和参考资料都是同一种条目。
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('case', 'product', 'idea', 'interaction', 'outcome', 'testimonial', 'lesson', 'reference', 'other')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  links TEXT NOT NULL DEFAULT '[]',
  publicity TEXT NOT NULL DEFAULT 'anonymous' CHECK (publicity IN ('public', 'anonymous', 'private')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE
);

CREATE INDEX idx_assets_studio ON assets (studio_id, type, updated_at);

-- 品牌页上已有的案例详情。
INSERT INTO assets (
  id, studio_id, type, title, body, details, tags, links, publicity, created_at, updated_at
)
SELECT
  'legacy-case-' || studios.id || '-' || json_each.key,
  studios.id,
  'case',
  substr(trim(COALESCE(NULLIF(json_extract(json_each.value, '$.industry'), ''), '未命名案例')), 1, 80),
  trim(COALESCE(json_extract(json_each.value, '$.pain'), '') || char(10) || COALESCE(json_extract(json_each.value, '$.approach'), '') || char(10) || COALESCE(json_extract(json_each.value, '$.outcome'), '')),
  json_object(
    'industry', trim(COALESCE(json_extract(json_each.value, '$.industry'), '')),
    'problem', trim(COALESCE(json_extract(json_each.value, '$.pain'), '')),
    'approach', trim(COALESCE(json_extract(json_each.value, '$.approach'), '')),
    'howItWorks', '',
    'metrics', json_array(),
    'quote', '',
    'quoteAuthorized', json('false')
  ),
  '[]',
  '[]',
  CASE WHEN json_extract(json_each.value, '$.isPublic') IN (1, 'true') THEN 'public' ELSE 'private' END,
  studios.updated_at,
  studios.updated_at
FROM studios, json_each(studios.case_studies)
WHERE json_valid(studios.case_studies)
  AND json_type(studios.case_studies) = 'array'
  AND length(trim(
    COALESCE(json_extract(json_each.value, '$.industry'), '') ||
    COALESCE(json_extract(json_each.value, '$.pain'), '') ||
    COALESCE(json_extract(json_each.value, '$.approach'), '')
  )) > 0;

-- 品牌页上已有的参考资料。
INSERT INTO assets (
  id, studio_id, type, title, body, details, tags, links, publicity, created_at, updated_at
)
SELECT
  'legacy-ref-' || studios.id || '-' || json_each.key,
  studios.id,
  'reference',
  substr(trim(COALESCE(NULLIF(json_extract(json_each.value, '$.title'), ''), '参考资料')), 1, 80),
  trim(COALESCE(json_extract(json_each.value, '$.excerpt'), '')),
  '{}',
  '[]',
  CASE
    WHEN length(trim(COALESCE(json_extract(json_each.value, '$.url'), ''))) = 0 THEN '[]'
    ELSE json_array(json_object(
      'id', 'link-1',
      'label', '链接',
      'url', trim(json_extract(json_each.value, '$.url'))
    ))
  END,
  'public',
  studios.updated_at,
  studios.updated_at
FROM studios, json_each(studios.reference_snippets)
WHERE json_valid(studios.reference_snippets)
  AND json_type(studios.reference_snippets) = 'array'
  AND length(trim(
    COALESCE(json_extract(json_each.value, '$.title'), '') ||
    COALESCE(json_extract(json_each.value, '$.excerpt'), '') ||
    COALESCE(json_extract(json_each.value, '$.url'), '')
  )) > 0;
