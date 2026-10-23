-- 种子品牌「澄川」填好品牌页上还在用的字段，并放一批可分享素材。
-- 只动 studio-chengchuan。竞品名称、别名和域名保持 0007，监测样本才对得上。
-- 澄川素材库以这批样例为准，之前迁进去的旧案例和参考资料会被换掉。

UPDATE studios
SET
  positioning = '给已经有手册、工单和制度，但回答对不上原文的团队，把知识库做成能点开出处的问答。驻场一起写验收题，做完交接。不接只演示的聊天机器人。',
  services = '["把故障手册和工单接成可引用的问答","销售资料问答，回答旁边展开原文","驻场两周，和业务一起写验收题再交接","上线后按错引和耗时复盘"]',
  keywords = '["企业知识库","引用溯源","故障手册","尽调报告","驻场交付","验收题","销售资料","错引","工单","条款切分"]',
  voice = '口语。先写客户那边发生了什么，再写做法。不写团队规模、奖项和领先。',
  banned_words = '行业领先、赋能数字化、一站式、降本增效、打造闭环、极致体验',
  compliance = '不编造客户名、合同金额和未授权的数字。匿名素材不写能认出客户的信息。标成不可公开的素材不进稿。',
  updated_at = '2026-10-22T09:00:00.000Z'
WHERE id = 'studio-chengchuan';

DELETE FROM assets WHERE studio_id = 'studio-chengchuan';

INSERT INTO assets (
  id, studio_id, type, title, body, details, tags, links, publicity, created_at, updated_at
) VALUES
(
  'seed-cc-case-diligence',
  'studio-chengchuan',
  'case',
  '尽调报告从翻手册变成点开出处',
  '分析师写尽调时，要对上三本制度手册里的同一段。以前单次查询要翻到具体页，现在回答旁边直接展开那一段。客户同意公开耗时，不公开公司名。',
  '{"industry":"装备制造","problem":"写尽调时，出处散在三本手册里，两个人对不上同一段原文。","approach":"先把手册按条款切开，回答只允许引用已经入库的段落。","howItWorks":"","metrics":[{"id":"m-query","name":"单次查询","before":"45","after":"8","unit":"分钟","source":"工单系统导出","customerAuthorized":true}],"quote":"","quoteAuthorized":false}',
  '["尽调","出处"]',
  '[{"id":"link-diligence","label":"出处展开截图","url":"https://example.com/demo/diligence"}]',
  'anonymous',
  '2026-10-22T08:00:00.000Z',
  '2026-10-22T08:50:00.000Z'
),
(
  'seed-cc-case-private',
  'studio-chengchuan',
  'case',
  '内部试点的验收题还没获准公开',
  '另一家客户的试点已经跑完验收题，合同写明过程编号不能对外。留在这里给自己复盘，起草时不要勾。',
  '{"industry":"","problem":"验收题里有未公开的内部流程编号。","approach":"只在内部对照错引，不写进可分享的稿子。","howItWorks":"","metrics":[{"id":"m-private","name":"内部复核耗时","before":"3","after":"1","unit":"小时","source":"内部周报","customerAuthorized":false}],"quote":"","quoteAuthorized":false}',
  '["内部","验收"]',
  '[]',
  'private',
  '2026-10-22T08:00:00.000Z',
  '2026-10-22T08:10:00.000Z'
),
(
  'seed-cc-product-card',
  'studio-chengchuan',
  'product',
  '出处卡片',
  '回答下面不是一个光秃秃的链接。点开后是手册原段、条款号和这次入库的版本。',
  '{"industry":"","problem":"只给文件名时，读者还是会回到网盘里翻。","approach":"","howItWorks":"检索先召回段落，再把段落嵌进回答。页码只做旁证，不代替条款号。","metrics":[],"quote":"","quoteAuthorized":false}',
  '["产品","出处"]',
  '[{"id":"link-card","label":"出处卡片","url":"https://example.com/demo/source-card"}]',
  'public',
  '2026-10-22T08:00:00.000Z',
  '2026-10-22T08:40:00.000Z'
),
(
  'seed-cc-idea-clause',
  'studio-chengchuan',
  'idea',
  '按条款切，不按整本 PDF 切',
  '整本 PDF 切出来的块经常跨了两条制度。改成按条款号切开之后，引用才对得上分析师说的「第 4.2 条」。',
  '{"industry":"","problem":"按页切开时，一条条款会被截在两块中间。","approach":"","howItWorks":"条款号当主键，段落是条款正文，PDF 页码只标在旁边。","metrics":[],"quote":"","quoteAuthorized":false}',
  '["切分","条款"]',
  '[]',
  'public',
  '2026-10-22T08:00:00.000Z',
  '2026-10-22T08:35:00.000Z'
),
(
  'seed-cc-interaction-expand',
  'studio-chengchuan',
  'interaction',
  '点一下就展开原段',
  '回答右侧有一条细线。点出处，原段在回答旁边展开，不用另开 PDF。展开时带上条款号和版本。',
  '{"industry":"","problem":"只给链接时，大家还是会回到文件夹里翻。","approach":"点击出处就地展开，不跳走。","howItWorks":"","metrics":[],"quote":"","quoteAuthorized":false}',
  '["交互","展开"]',
  '[{"id":"link-expand","label":"展开交互","url":"https://example.com/demo/expand"}]',
  'public',
  '2026-10-22T08:00:00.000Z',
  '2026-10-22T08:45:00.000Z'
),
(
  'seed-cc-outcome-misquote',
  'studio-chengchuan',
  'outcome',
  '每周抽查里的错引被数出来',
  '上线后每周抽 20 条回答，看引用的段落是不是问题里的那一条。客户授权公开错引条数，不公开抽查名单。',
  '{"industry":"装备制造","problem":"上线第一周，引用经常落到相邻条款。","approach":"改成按条款切分后再抽查。","howItWorks":"","metrics":[{"id":"m-misquote","name":"每周抽查里的错引","before":"6","after":"1","unit":"条","source":"每周固定抽 20 条","customerAuthorized":true}],"quote":"","quoteAuthorized":false}',
  '["错引","抽查"]',
  '[]',
  'anonymous',
  '2026-10-22T08:00:00.000Z',
  '2026-10-22T08:30:00.000Z'
),
(
  'seed-cc-lesson-pdf',
  'studio-chengchuan',
  'lesson',
  '先按页切 PDF，引用对不上条款',
  '第一周按页切 PDF。分析师说的「第 4.2 条」落在块的中间，回答经常引用到相邻条款。后来改成按条款号切，这种错引才停。',
  '{"industry":"","problem":"按页切会把一条制度截成两段。","approach":"停掉按页切，改成条款号为主键。","howItWorks":"","metrics":[],"quote":"","quoteAuthorized":false}',
  '["踩坑","切分"]',
  '[]',
  'public',
  '2026-10-22T08:00:00.000Z',
  '2026-10-22T08:20:00.000Z'
),
(
  'seed-cc-quote-analyst',
  'studio-chengchuan',
  'testimonial',
  '分析师说点开就是那一段',
  '客户同意引用这句话，不要写出姓名和公司。',
  '{"industry":"","problem":"","approach":"","howItWorks":"","metrics":[],"quote":"以前对一条出处要翻三本，现在点开就是那一段。","quoteAuthorized":true}',
  '["原话"]',
  '[]',
  'anonymous',
  '2026-10-22T08:00:00.000Z',
  '2026-10-22T08:25:00.000Z'
);
