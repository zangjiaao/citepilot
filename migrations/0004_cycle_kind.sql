-- 允许基线、复测之外再加自定义轮次。SQLite 不能改 CHECK，所以重建 cycles。
-- 监测记录的外键是 ON DELETE CASCADE。先抄出来，避免删表时把记录一起清掉。
PRAGMA defer_foreign_keys = ON;

CREATE TABLE observations_keep AS SELECT * FROM observations;

CREATE TABLE cycles_new (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('baseline', 'retest', 'custom')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE
);

INSERT INTO cycles_new (id, studio_id, name, kind, created_at)
SELECT id, studio_id, name, kind, created_at FROM cycles;

DROP TABLE cycles;

ALTER TABLE cycles_new RENAME TO cycles;

CREATE INDEX idx_cycles_studio ON cycles (studio_id, created_at);

INSERT INTO observations SELECT * FROM observations_keep;

DROP TABLE observations_keep;
