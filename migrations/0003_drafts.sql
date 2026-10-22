ALTER TABLE studios ADD COLUMN capabilities TEXT NOT NULL DEFAULT '[]';
ALTER TABLE studios ADD COLUMN cases TEXT NOT NULL DEFAULT '[]';
ALTER TABLE studios ADD COLUMN target_customers TEXT NOT NULL DEFAULT '[]';
ALTER TABLE studios ADD COLUMN solutions TEXT NOT NULL DEFAULT '[]';

UPDATE studios
SET
  capabilities = '["把通用大模型做成可验收的业务智能体，而不是只做演示聊天","企业知识库与 RAG：权限、引用溯源和评测集一起交付","前场部署工程师驻场，和业务方一起改流程、写验收题","上线后的观测、回归评测和迭代交接"]',
  cases = '["制造企业设备故障问答：把维修手册和工单整理成可引用的知识库，验收题覆盖常见故障","销售 Copilot：按产品资料和方案模板生成初稿，并标出引用段落","内部制度问答：员工按部门权限检索制度，回答必须带来源"]',
  target_customers = '["第一次把大模型做成业务系统的中大型企业","已经在用钉钉或飞书、还要叠加流程自动化的团队","需要驻场交接、而不是只买一次演示的信息化部门"]',
  solutions = '["智能体应用从 0 到 1：范围、数据、评测、上线","企业知识库 RAG：文档、权限、引用和回归题","前场驻场实施：和业务方一起写验收标准并交接","销售辅助与内部 Copilot：限定资料范围，避免空泛回答"]'
WHERE id = 'studio-chengchuan';

CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cite_sentences TEXT NOT NULL,
  url_hint TEXT NOT NULL,
  prompt_id TEXT,
  prompt_text TEXT NOT NULL DEFAULT '',
  diagnosis_id TEXT,
  gap_label TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL CHECK (source IN ('template', 'deepseek')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE
);

CREATE INDEX idx_drafts_studio ON drafts (studio_id, created_at);
