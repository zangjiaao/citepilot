CREATE TABLE studios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  positioning TEXT NOT NULL,
  services TEXT NOT NULL,
  competitors TEXT NOT NULL,
  keywords TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE cycles (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('baseline', 'retest')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE
);

CREATE TABLE prompts (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  cluster TEXT NOT NULL CHECK (cluster IN ('brand', 'category', 'comparison', 'scenario')),
  text TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL CHECK (source IN ('seed', 'template', 'llm', 'manual')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE
);

CREATE TABLE observations (
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
  FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE,
  FOREIGN KEY (prompt_id) REFERENCES prompts (id),
  FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
);

CREATE TABLE diagnoses (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  title TEXT NOT NULL,
  checklist TEXT NOT NULL,
  suggestions TEXT NOT NULL,
  suggestion_source TEXT NOT NULL CHECK (suggestion_source IN ('rules', 'deepseek')),
  excerpt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE
);

CREATE INDEX idx_prompts_studio ON prompts (studio_id, cluster);
CREATE INDEX idx_cycles_studio ON cycles (studio_id, kind);
CREATE INDEX idx_observations_studio ON observations (studio_id, cycle_id);
CREATE INDEX idx_diagnoses_studio ON diagnoses (studio_id, created_at);
