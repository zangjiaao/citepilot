CREATE TABLE draft_messages (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  studio_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (draft_id) REFERENCES drafts (id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE
);

CREATE INDEX idx_draft_messages_draft ON draft_messages (draft_id, created_at);

CREATE TABLE draft_shares (
  token TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  studio_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (draft_id) REFERENCES drafts (id) ON DELETE CASCADE,
  FOREIGN KEY (studio_id) REFERENCES studios (id) ON DELETE CASCADE
);

CREATE INDEX idx_draft_shares_draft ON draft_shares (draft_id, created_at);
