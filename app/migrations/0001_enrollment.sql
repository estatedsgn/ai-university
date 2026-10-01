-- Additive migration: preview and production share D1. Never drop user data.
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
  goal TEXT NOT NULL CHECK (length(goal) BETWEEN 3 AND 1000),
  minutes INTEGER NOT NULL CHECK (minutes IN (15, 30, 60)),
  game_percent INTEGER NOT NULL CHECK (game_percent BETWEEN 0 AND 100),
  consent_version TEXT NOT NULL,
  consent_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Only a daily hash is persisted. Raw IP addresses are never written to D1.
CREATE TABLE IF NOT EXISTS enrollment_rate_limits (
  day TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts BETWEEN 1 AND 5),
  PRIMARY KEY (day, ip_hash)
);
