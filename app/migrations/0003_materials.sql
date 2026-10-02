-- Imported quizzes remain drafts. Answers are stored only in private server rows.
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY NOT NULL,
  owner_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_url TEXT,
  track TEXT NOT NULL CHECK (track IN ('math', 'finance', 'biology', 'custom')),
  origin TEXT NOT NULL CHECK (origin IN ('ai', 'agent')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted')),
  questions_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS materials_owner_created ON materials(owner_hash, created_at);
