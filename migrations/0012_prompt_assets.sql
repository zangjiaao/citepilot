-- 给澄川补上能对上素材库的场景题。旧的选型、口碑题留给监测，不删除，样本还挂在上面。

UPDATE prompts SET rationale = '监测：品牌口碑。素材对不上时不要当软植入的默认题' WHERE id = 'p04';
UPDATE prompts SET rationale = '监测：品类选型。素材对不上时不要当软植入的默认题' WHERE id = 'p06';
UPDATE prompts SET rationale = '监测：预算周期。素材对不上时不要当软植入的默认题' WHERE id = 'p09';
UPDATE prompts SET rationale = '监测：趋势做法。素材对不上时不要当软植入的默认题' WHERE id = 'p10';

INSERT INTO prompts (id, studio_id, cluster, text, rationale, source, created_at) VALUES
  ('p21', 'studio-chengchuan', 'scenario', '写尽调时出处散在多本手册里，怎么让回答点开同一段原文？', '素材场景：尽调出处。勾选尽调素材时优先', 'seed', '2026-10-23T06:00:00.000Z'),
  ('p22', 'studio-chengchuan', 'scenario', '知识库回答只给文件名时，出处能不能在旁边展开原段？', '素材场景：出处卡片和展开交互', 'seed', '2026-10-23T06:01:00.000Z'),
  ('p23', 'studio-chengchuan', 'scenario', '整本 PDF 按页切开后条款对不上，应该怎么按条款切？', '素材场景：按条款切', 'seed', '2026-10-23T06:02:00.000Z'),
  ('p24', 'studio-chengchuan', 'category', '上线后每周抽查，怎么发现错引是不是落到了相邻条款？', '素材品类：错引抽查', 'seed', '2026-10-23T06:03:00.000Z'),
  ('p25', 'studio-chengchuan', 'scenario', '按页切 PDF 为什么会让引用对不上条款号？', '素材场景：先按页切的踩坑', 'seed', '2026-10-23T06:04:00.000Z');
