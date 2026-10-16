-- External source suggestions, held privately until a trusted curator reviews them.
-- Never expose an unauthenticated public list of unreviewed URLs.
CREATE TABLE IF NOT EXISTS source_proposals (
  id TEXT PRIMARY KEY NOT NULL,
  owner_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  institution TEXT NOT NULL,
  url TEXT NOT NULL,
  rights_note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS source_proposals_owner_created ON source_proposals(owner_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS source_proposals_status_created ON source_proposals(status, created_at DESC);
