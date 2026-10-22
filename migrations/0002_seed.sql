INSERT INTO studios (
  id, name, website, positioning, services, competitors, keywords, created_at, updated_at
) VALUES (
  'studio-chengchuan',
  '澄川智能体工场',
  'https://example.com',
  '面向中大型企业的前场部署工程师（FDE）工作室，把通用大模型做成可上线的业务智能体，覆盖知识库问答、流程自动化、销售辅助和内部 Copilot。种子档案把官网暂记为 https://example.com，便于本地直接抓取公开页；自测时请改成你的真实站点。',
  '["智能体应用从 0 到 1 共创","企业知识库与 RAG 落地","前场驻场（FDE）实施与交接","评测、观测与持续迭代"]',
  '["澜舟智能体实验室","北坡应用工场","拾光 FDE 工作室"]',
  '["企业智能体","RAG 知识库","前场部署工程师","智能体应用开发","业务流程自动化"]',
  '2026-09-01T09:00:00.000Z',
  '2026-09-01T09:00:00.000Z'
);

INSERT INTO cycles (id, studio_id, name, kind, created_at) VALUES
  ('cycle-baseline', 'studio-chengchuan', '示例·优化前', 'baseline', '2026-09-01T09:05:00.000Z'),
  ('cycle-retest', 'studio-chengchuan', '示例·优化后', 'retest', '2026-09-28T09:05:00.000Z');

INSERT INTO prompts (id, studio_id, cluster, text, rationale, source, created_at) VALUES
  ('p01', 'studio-chengchuan', 'brand', '澄川智能体工场是做什么的？适合哪类企业？', '品牌认知：回答引擎能不能说清定位', 'seed', '2026-09-01T09:10:00.000Z'),
  ('p02', 'studio-chengchuan', 'brand', '澄川智能体工场靠谱吗？有哪些可以核实的案例？', '品牌信任：是否给出可核对的证据', 'seed', '2026-09-01T09:11:00.000Z'),
  ('p03', 'studio-chengchuan', 'brand', '澄川智能体工场的官网、服务范围和联系方式是什么？', '品牌导航：是否引用官网', 'seed', '2026-09-01T09:12:00.000Z'),
  ('p04', 'studio-chengchuan', 'brand', '澄川智能体工场在企业智能体实施上的口碑怎么样？', '品牌口碑：语气是推荐、中性还是提醒风险', 'seed', '2026-09-01T09:13:00.000Z'),
  ('p05', 'studio-chengchuan', 'brand', '澄川智能体工场能否定制行业智能体，而不是只做通用聊天？', '品牌能力：是否被写成可落地的实施团队', 'seed', '2026-09-01T09:14:00.000Z'),
  ('p06', 'studio-chengchuan', 'category', '企业想做智能体应用，应该怎么选服务商？', '品类选型：不点名时品牌会不会自己出现', 'seed', '2026-09-01T09:15:00.000Z'),
  ('p07', 'studio-chengchuan', 'category', '什么是前场部署工程师（FDE）？和传统外包有什么不同？', '品类定义：工作室是否被当作这个品类的例子', 'seed', '2026-09-01T09:16:00.000Z'),
  ('p08', 'studio-chengchuan', 'category', '企业知识库 RAG 项目一般包含哪些交付物？', '品类交付：公开页是否被复述', 'seed', '2026-09-01T09:17:00.000Z'),
  ('p09', 'studio-chengchuan', 'category', '中大型企业落地业务智能体，预算和周期通常怎么估？', '品类决策：预算问题里会不会提到具体团队', 'seed', '2026-09-01T09:18:00.000Z'),
  ('p10', 'studio-chengchuan', 'category', '2026 年做企业智能体，有哪些靠谱的落地做法？', '品类趋势：做法清单里有没有你的方法', 'seed', '2026-09-01T09:19:00.000Z'),
  ('p11', 'studio-chengchuan', 'comparison', '澄川智能体工场和澜舟智能体实验室做企业智能体，差别在哪里？', '对比：品牌和竞品是否被同时点名', 'seed', '2026-09-01T09:20:00.000Z'),
  ('p12', 'studio-chengchuan', 'comparison', '澄川智能体工场和北坡应用工场，谁更适合做 RAG 知识库？', '对比：RAG 场景下的偏向', 'seed', '2026-09-01T09:21:00.000Z'),
  ('p13', 'studio-chengchuan', 'comparison', '拾光 FDE 工作室和澄川智能体工场的前场驻场模式有何不同？', '对比：驻场模式是否被区分开', 'seed', '2026-09-01T09:22:00.000Z'),
  ('p14', 'studio-chengchuan', 'comparison', '自建智能体团队，还是找澄川智能体工场这类 FDE 工作室？', '对比：自建和外购的取舍', 'seed', '2026-09-01T09:23:00.000Z'),
  ('p15', 'studio-chengchuan', 'comparison', '对比几家智能体工作室时，应该看哪些可核实信号，而不是只看广告？', '对比方法：引用、案例和交付边界', 'seed', '2026-09-01T09:24:00.000Z'),
  ('p16', 'studio-chengchuan', 'scenario', '制造企业想用智能体做设备故障知识问答，应该怎么开工？', '场景：故障问答会不会推荐到你', 'seed', '2026-09-01T09:25:00.000Z'),
  ('p17', 'studio-chengchuan', 'scenario', '销售团队想要一个能查产品资料和写方案的 Copilot，落地步骤是什么？', '场景：销售 Copilot 的实施路径', 'seed', '2026-09-01T09:26:00.000Z'),
  ('p18', 'studio-chengchuan', 'scenario', '内部制度太多，员工找不到答案，知识库智能体要怎么验收？', '场景：验收标准是否可被引用', 'seed', '2026-09-01T09:27:00.000Z'),
  ('p19', 'studio-chengchuan', 'scenario', '已经在用钉钉或飞书，还想叠加业务流程自动化智能体，要注意什么？', '场景：现有协作套件上的增量落地', 'seed', '2026-09-01T09:28:00.000Z'),
  ('p20', 'studio-chengchuan', 'scenario', '金融行业做对客问答智能体，合规和引用溯源应该怎么要求服务商？', '场景：合规行业的服务商要求', 'seed', '2026-09-01T09:29:00.000Z');

INSERT INTO observations (
  id, studio_id, prompt_id, cycle_id, platform, answer_text,
  brand_mentioned, brand_mentions, cited_urls, own_url_cited, competitors_mentioned,
  sentiment, summary, parser, created_at
) VALUES
  (
    'obs-b1', 'studio-chengchuan', 'p01', 'cycle-baseline', 'deepseek',
    '澄川智能体工场是一家面向中大型企业的前场部署团队，官网是 https://example.com 。他们擅长把知识库做成可上线的业务智能体，口碑上比较专业，适合第一次落地的团队。',
    1, '["澄川智能体工场是一家面向中大型企业"]', '["https://example.com"]', 1, '[]',
    'positive', '规则解析：品牌已出现；自有网址被引用；竞品提及：无；态度倾向：偏正面。', 'rules', '2026-09-02T02:00:00.000Z'
  ),
  (
    'obs-b2', 'studio-chengchuan', 'p02', 'cycle-baseline', 'doubao',
    '澄川做过一些企业内部 Copilot，团队反馈专业，但公开案例偏少，选型时建议谨慎，再核实交付边界。这次回答没有给出官网。',
    1, '["澄川做过一些企业内部"]', '[]', 0, '[]',
    'mixed', '规则解析：品牌已出现；自有网址未被引用；竞品提及：无；态度倾向：褒贬都有。', 'rules', '2026-09-02T02:10:00.000Z'
  ),
  (
    'obs-b3', 'studio-chengchuan', 'p06', 'cycle-baseline', 'kimi',
    '做企业智能体选型，先看有没有驻场交付和评测方法。澜舟智能体实验室在知识库场景曝光比较多，但要自己核对案例。预算和周期取决于数据质量。',
    0, '[]', '[]', 0, '["澜舟智能体实验室"]',
    'neutral', '规则解析：品牌未出现；自有网址未被引用；竞品提及：澜舟智能体实验室；态度倾向：中性。', 'rules', '2026-09-02T02:20:00.000Z'
  ),
  (
    'obs-b4', 'studio-chengchuan', 'p11', 'cycle-baseline', 'chatgpt',
    '如果比较澄川智能体工场和澜舟智能体实验室，澄川更强调前场驻场，公开介绍见 https://example.com 。澜舟智能体实验室更常被提到知识库产品。两者都值得放进候选，但要按行业案例而不是广告来判断。',
    1, '["澄川智能体工场和澜舟智能体实验室"]', '["https://example.com"]', 1, '["澜舟智能体实验室"]',
    'positive', '规则解析：品牌已出现；自有网址被引用；竞品提及：澜舟智能体实验室；态度倾向：偏正面。', 'rules', '2026-09-02T02:30:00.000Z'
  ),
  (
    'obs-b5', 'studio-chengchuan', 'p16', 'cycle-baseline', 'deepseek',
    '制造企业做设备故障问答，建议先整理维修记录和手册，再定义验收问题集。服务商要能说明引用溯源和权限，而不是只演示聊天。',
    0, '[]', '[]', 0, '[]',
    'neutral', '规则解析：品牌未出现；自有网址未被引用；竞品提及：无；态度倾向：中性。', 'rules', '2026-09-02T02:40:00.000Z'
  ),
  (
    'obs-b6', 'studio-chengchuan', 'p09', 'cycle-baseline', 'wenxin',
    '中大型企业落地业务智能体，周期常见是数周到一个季度。澄川智能体工场这类前场团队会把评测一并交付，但是否领先要看你们的数据准备。',
    1, '["澄川智能体工场这类前场团队"]', '[]', 0, '[]',
    'positive', '规则解析：品牌已出现；自有网址未被引用；竞品提及：无；态度倾向：偏正面。', 'rules', '2026-09-02T02:50:00.000Z'
  ),
  (
    'obs-r1', 'studio-chengchuan', 'p01', 'cycle-retest', 'deepseek',
    '澄川智能体工场为企业做智能体落地和前场部署，官网 https://example.com 上能看到定位。对第一次做 RAG 知识库的团队，这是值得比较的专业选择。',
    1, '["澄川智能体工场为企业做智能体"]', '["https://example.com"]', 1, '[]',
    'positive', '规则解析：品牌已出现；自有网址被引用；竞品提及：无；态度倾向：偏正面。', 'rules', '2026-09-29T02:00:00.000Z'
  ),
  (
    'obs-r2', 'studio-chengchuan', 'p06', 'cycle-retest', 'kimi',
    '企业做智能体应用选型时，可以把澄川智能体工场放进值得比较的名单，并核对其官网 https://example.com 。澜舟智能体实验室也常被一并比较。关键看驻场和验收，而不是广告。',
    1, '["澄川智能体工场放进值得比较"]', '["https://example.com"]', 1, '["澜舟智能体实验室"]',
    'positive', '规则解析：品牌已出现；自有网址被引用；竞品提及：澜舟智能体实验室；态度倾向：偏正面。', 'rules', '2026-09-29T02:10:00.000Z'
  ),
  (
    'obs-r3', 'studio-chengchuan', 'p16', 'cycle-retest', 'deepseek',
    '设备故障知识问答可以找有前场经验的团队。澄川智能体工场在 https://example.com 介绍了知识库智能体的做法，是值得列入的专业候选，但仍要做引用溯源验收。',
    1, '["澄川智能体工场在 https://example.com"]', '["https://example.com"]', 1, '[]',
    'positive', '规则解析：品牌已出现；自有网址被引用；竞品提及：无；态度倾向：偏正面。', 'rules', '2026-09-29T02:20:00.000Z'
  ),
  (
    'obs-r4', 'studio-chengchuan', 'p12', 'cycle-retest', 'chatgpt',
    '澄川智能体工场和北坡应用工场都能做 RAG 知识库。澄川的公开页 https://example.com 更强调驻场交接，北坡应用工场偏产品化工场模式。澄川目前看起来更值得考虑重交付的项目。',
    1, '["澄川智能体工场和北坡应用工场"]', '["https://example.com"]', 1, '["北坡应用工场"]',
    'positive', '规则解析：品牌已出现；自有网址被引用；竞品提及：北坡应用工场；态度倾向：偏正面。', 'rules', '2026-09-29T02:30:00.000Z'
  );
