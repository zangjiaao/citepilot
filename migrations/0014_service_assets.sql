-- 素材类型增加「服务」。SQLite 不能改 CHECK，所以重建表。details 仍是 JSON，交付物、边界和价格说明都是可选字段。
CREATE TABLE assets_service (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('case', 'product', 'service', 'idea', 'interaction', 'outcome', 'testimonial', 'lesson', 'reference', 'other')),
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

INSERT INTO assets_service (
  id, studio_id, type, title, body, details, tags, links, publicity, created_at, updated_at
)
SELECT
  id, studio_id, type, title, body, details, tags, links, publicity, created_at, updated_at
FROM assets;

DROP TABLE assets;

ALTER TABLE assets_service RENAME TO assets;

CREATE INDEX idx_assets_studio ON assets (studio_id, type, updated_at);
