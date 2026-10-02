-- Anonymous learning attempts: private question keys are stored server-side only.
CREATE TABLE IF NOT EXISTS learning_attempts (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  topic_id TEXT,
  material_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('diagnostic','practice','transfer')),
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  CHECK ((topic_id IS NOT NULL AND material_id IS NULL) OR
         (topic_id IS NULL AND material_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS learning_attempts_owner_completed
  ON learning_attempts(owner_hash, completed_at, topic_id);
CREATE TABLE IF NOT EXISTS learning_rate_limits (
  day TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  bucket TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY (day, ip_hash, bucket)
);
