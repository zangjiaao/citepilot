-- 样本对题目的外键原先没有 ON DELETE CASCADE。删品牌时若先删题目，会留下仍指向题目的样本。
-- 重建后，品牌、题目、批次删除都会带走样本。单题、单批次的删除仍由应用层先检查「已有监测记录」。

CREATE TABLE observations_cascade (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  brand_mentioned INTEGER NOT NULL,
  brand_mentions TEXT NOT NULL,
  cited_urls TEXT NOT NULL,
  own_url_cited INTEGER NOT NULL,
  competitors_mentioned TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  summary TEXT NOT NULL,
  parser TEXT NOT NULL CHECK (parser IN ('rules', 'deepseek')),
  created_at TEXT NOT NULL,
  brand_hits TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE,
  FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
  FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
);

INSERT INTO observations_cascade (
  id, studio_id, prompt_id, cycle_id, platform, answer_text, brand_mentioned, brand_mentions,
  cited_urls, own_url_cited, competitors_mentioned, sentiment, summary, parser, created_at, brand_hits
)
SELECT
  id, studio_id, prompt_id, cycle_id, platform, answer_text, brand_mentioned, brand_mentions,
  cited_urls, own_url_cited, competitors_mentioned, sentiment, summary, parser, created_at, brand_hits
FROM observations;

DROP TABLE observations;
ALTER TABLE observations_cascade RENAME TO observations;

CREATE INDEX idx_observations_studio ON observations (studio_id, cycle_id);
CREATE INDEX idx_observations_cycle_prompt ON observations (cycle_id, prompt_id);

CREATE TABLE llm_configs (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  provider TEXT NOT NULL,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key TEXT NOT NULL,
  temperature REAL,
  max_tokens INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE llm_settings (
  id TEXT PRIMARY KEY CHECK (id = 'app'),
  generate_config_id TEXT,
  analyze_config_id TEXT,
  FOREIGN KEY (generate_config_id) REFERENCES llm_configs (id) ON DELETE SET NULL,
  FOREIGN KEY (analyze_config_id) REFERENCES llm_configs (id) ON DELETE SET NULL
);

INSERT INTO llm_settings (id, generate_config_id, analyze_config_id) VALUES ('app', NULL, NULL);
