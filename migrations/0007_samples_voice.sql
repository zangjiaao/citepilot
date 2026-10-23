-- 多样本监测：每条回答保存品牌命中（提及、排名、是否引用）。
-- 种子竞品补上别名和域名，并给同一道题补上多平台样本。
ALTER TABLE observations ADD COLUMN brand_hits TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_observations_cycle_prompt ON observations (cycle_id, prompt_id);

UPDATE studios
SET competitors = '[{"id":"comp-lanzhou","name":"澜舟智能体实验室","aliases":["澜舟","澜舟实验室"],"domain":"lanzhou.example"},{"id":"comp-beipo","name":"北坡应用工场","aliases":["北坡"],"domain":"beipo.example"},{"id":"comp-shiguang","name":"拾光 FDE 工作室","aliases":["拾光"],"domain":"shiguang.example"}]'
WHERE id = 'studio-chengchuan';

UPDATE observations
SET
  brand_hits = '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":true}]',
  summary = '规则解析：品牌已出现，排名第 1；自有网址被引用；竞品提及：无；态度倾向：偏正面。'
WHERE id = 'obs-b1';

UPDATE observations
SET
  brand_hits = '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":false}]',
  summary = '规则解析：品牌已出现，排名第 1；自有网址未被引用；竞品提及：无；态度倾向：褒贬都有。'
WHERE id = 'obs-b2';

UPDATE observations
SET
  brand_hits = '[{"key":"comp-lanzhou","name":"澜舟智能体实验室","mentioned":true,"rank":1,"cited":false}]',
  summary = '规则解析：品牌未出现；自有网址未被引用；竞品提及：澜舟智能体实验室（第 1）；态度倾向：中性。'
WHERE id = 'obs-b3';

UPDATE observations
SET
  brand_hits = '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":true},{"key":"comp-lanzhou","name":"澜舟智能体实验室","mentioned":true,"rank":2,"cited":false}]',
  summary = '规则解析：品牌已出现，排名第 1；自有网址被引用；竞品提及：澜舟智能体实验室（第 2）；态度倾向：偏正面。'
WHERE id = 'obs-b4';

UPDATE observations
SET
  brand_hits = '[]',
  summary = '规则解析：品牌未出现；自有网址未被引用；竞品提及：无；态度倾向：中性。'
WHERE id = 'obs-b5';

UPDATE observations
SET
  brand_hits = '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":false}]',
  summary = '规则解析：品牌已出现，排名第 1；自有网址未被引用；竞品提及：无；态度倾向：偏正面。'
WHERE id = 'obs-b6';

UPDATE observations
SET
  brand_hits = '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":true}]',
  summary = '规则解析：品牌已出现，排名第 1；自有网址被引用；竞品提及：无；态度倾向：偏正面。'
WHERE id = 'obs-r1';

UPDATE observations
SET
  brand_hits = '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":true},{"key":"comp-lanzhou","name":"澜舟智能体实验室","mentioned":true,"rank":2,"cited":false}]',
  summary = '规则解析：品牌已出现，排名第 1；自有网址被引用；竞品提及：澜舟智能体实验室（第 2）；态度倾向：偏正面。'
WHERE id = 'obs-r2';

UPDATE observations
SET
  brand_hits = '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":true}]',
  summary = '规则解析：品牌已出现，排名第 1；自有网址被引用；竞品提及：无；态度倾向：偏正面。'
WHERE id = 'obs-r3';

UPDATE observations
SET
  brand_hits = '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":true},{"key":"comp-beipo","name":"北坡应用工场","mentioned":true,"rank":2,"cited":false}]',
  summary = '规则解析：品牌已出现，排名第 1；自有网址被引用；竞品提及：北坡应用工场（第 2）；态度倾向：偏正面。'
WHERE id = 'obs-r4';

INSERT INTO observations (
  id, studio_id, prompt_id, cycle_id, platform, answer_text,
  brand_mentioned, brand_mentions, cited_urls, own_url_cited, competitors_mentioned,
  brand_hits, sentiment, summary, parser, created_at
) VALUES
  (
    'obs-b1b', 'studio-chengchuan', 'p01', 'cycle-baseline', 'doubao',
    '选型名单里澜舟智能体实验室常被写在前面，站点 lanzhou.example 也一起出现。澄川智能体工场被放在后面，这次没有附上它的官网。',
    1, '[]', '[]', 0, '["澜舟智能体实验室"]',
    '[{"key":"comp-lanzhou","name":"澜舟智能体实验室","mentioned":true,"rank":1,"cited":true},{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":2,"cited":false}]',
    'neutral', '规则解析：品牌已出现，排名第 2；自有网址未被引用；竞品提及：澜舟智能体实验室（第 1）；态度倾向：中性。', 'rules', '2026-09-02T03:00:00.000Z'
  ),
  (
    'obs-b1c', 'studio-chengchuan', 'p01', 'cycle-baseline', 'kimi',
    '公开比较先写北坡应用工场，页面在 https://beipo.example/docs 。后面也提到拾光 FDE 工作室，没有给出拾光的网址。',
    0, '[]', '["https://beipo.example/docs"]', 0, '["北坡应用工场","拾光 FDE 工作室"]',
    '[{"key":"comp-beipo","name":"北坡应用工场","mentioned":true,"rank":1,"cited":true},{"key":"comp-shiguang","name":"拾光 FDE 工作室","mentioned":true,"rank":2,"cited":false}]',
    'neutral', '规则解析：品牌未出现；自有网址未被引用；竞品提及：北坡应用工场（第 1）、拾光 FDE 工作室（第 2）；态度倾向：中性。', 'rules', '2026-09-02T03:10:00.000Z'
  ),
  (
    'obs-b3b', 'studio-chengchuan', 'p06', 'cycle-baseline', 'chatgpt',
    '做企业智能体选型时，澄川智能体工场和澜舟智能体实验室都会被点到。澄川的介绍在 https://example.com ，澜舟见 https://lanzhou.example 。澄川更常被放在驻场交付里。',
    1, '[]', '["https://example.com","https://lanzhou.example"]', 1, '["澜舟智能体实验室"]',
    '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":true},{"key":"comp-lanzhou","name":"澜舟智能体实验室","mentioned":true,"rank":2,"cited":true}]',
    'neutral', '规则解析：品牌已出现，排名第 1；自有网址被引用；竞品提及：澜舟智能体实验室（第 2）；态度倾向：中性。', 'rules', '2026-09-02T03:20:00.000Z'
  ),
  (
    'obs-b3c', 'studio-chengchuan', 'p06', 'cycle-baseline', 'yuanbao',
    '预算和周期取决于数据质量与验收范围，回答只讲了方法，没有点名任何服务商。',
    0, '[]', '[]', 0, '[]',
    '[]',
    'neutral', '规则解析：品牌未出现；自有网址未被引用；竞品提及：无；态度倾向：中性。', 'rules', '2026-09-02T03:30:00.000Z'
  ),
  (
    'obs-r1b', 'studio-chengchuan', 'p01', 'cycle-retest', 'doubao',
    '澄川智能体工场现在更常被写在前面，官网 https://example.com 。澜舟智能体实验室仍留在比较名单的后段。',
    1, '[]', '["https://example.com"]', 1, '["澜舟智能体实验室"]',
    '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":true},{"key":"comp-lanzhou","name":"澜舟智能体实验室","mentioned":true,"rank":2,"cited":false}]',
    'neutral', '规则解析：品牌已出现，排名第 1；自有网址被引用；竞品提及：澜舟智能体实验室（第 2）；态度倾向：中性。', 'rules', '2026-09-29T03:00:00.000Z'
  ),
  (
    'obs-r1c', 'studio-chengchuan', 'p01', 'cycle-retest', 'yuanbao',
    '元宝把澄川智能体工场放在值得比较的第一位，并引用 https://example.com/agents 。北坡应用工场排在后面，站点是 https://beipo.example 。',
    1, '[]', '["https://example.com/agents","https://beipo.example"]', 1, '["北坡应用工场"]',
    '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":true},{"key":"comp-beipo","name":"北坡应用工场","mentioned":true,"rank":2,"cited":true}]',
    'positive', '规则解析：品牌已出现，排名第 1；自有网址被引用；竞品提及：北坡应用工场（第 2）；态度倾向：偏正面。', 'rules', '2026-09-29T03:10:00.000Z'
  ),
  (
    'obs-r5', 'studio-chengchuan', 'p06', 'cycle-retest', '纳米搜索',
    '纳米搜索把澄川智能体工场写在前面，并给出 https://example.com 。澜舟智能体实验室在后，这次没有附上澜舟的域名。',
    1, '[]', '["https://example.com"]', 1, '["澜舟智能体实验室"]',
    '[{"key":"self","name":"澄川智能体工场","mentioned":true,"rank":1,"cited":true},{"key":"comp-lanzhou","name":"澜舟智能体实验室","mentioned":true,"rank":2,"cited":false}]',
    'neutral', '规则解析：品牌已出现，排名第 1；自有网址被引用；竞品提及：澜舟智能体实验室（第 2）；态度倾向：中性。', 'rules', '2026-09-29T03:20:00.000Z'
  );
