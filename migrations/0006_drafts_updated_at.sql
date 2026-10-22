ALTER TABLE drafts ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

UPDATE drafts SET updated_at = created_at WHERE updated_at = '';
