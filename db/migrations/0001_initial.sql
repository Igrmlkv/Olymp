-- Audit and provenance schema. Three separate concerns, per docs/spec-v4.md section 9:
--   1. pipeline provenance  — how each task came to exist
--   2. proxy log            — what the Anthropic key was spent on
--   3. telemetry            — anonymised usage (raw events live in Analytics Engine)
--
-- Nothing in this database identifies a child: no names, no IPs, no accounts.

-- 1. Pipeline provenance -----------------------------------------------------

CREATE TABLE prompt_versions (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('generation', 'verification', 'hint')),
  subject       TEXT NOT NULL CHECK (subject IN ('math', 'russian')),
  model         TEXT NOT NULL,
  template      TEXT NOT NULL,
  template_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE task_provenance (
  task_id           TEXT PRIMARY KEY,
  package_id        TEXT NOT NULL,
  origin            TEXT NOT NULL CHECK (origin IN ('generated', 'archive')),
  prompt_version_id TEXT REFERENCES prompt_versions(id),
  model             TEXT,
  source_name       TEXT,
  source_url        TEXT,
  source_year       INTEGER,
  source_stage      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_task_provenance_package ON task_provenance(package_id);

CREATE TABLE verification_verdicts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id           TEXT NOT NULL REFERENCES task_provenance(task_id),
  verdict           TEXT NOT NULL CHECK (verdict IN ('pass', 'fail', 'needs_review')),
  method            TEXT NOT NULL,
  model             TEXT NOT NULL,
  -- Independent solver runs that agreed, for self-consistency voting.
  agreement_count   INTEGER,
  agreement_total   INTEGER,
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_verification_task ON verification_verdicts(task_id);

CREATE TABLE package_versions (
  package_id           TEXT NOT NULL,
  version              TEXT NOT NULL,
  subject              TEXT NOT NULL CHECK (subject IN ('math', 'russian')),
  grade                INTEGER NOT NULL,
  task_count           INTEGER NOT NULL,
  checksum             TEXT NOT NULL,
  prompt_version_id    TEXT REFERENCES prompt_versions(id),
  verification_passed  INTEGER NOT NULL DEFAULT 0,
  verification_failed  INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL CHECK (status IN ('draft', 'published', 'rolled_back')),
  published_at         TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (package_id, version)
);

-- 2. Proxy log ---------------------------------------------------------------

CREATE TABLE proxy_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  route         TEXT NOT NULL,
  model         TEXT NOT NULL,
  status        INTEGER NOT NULL,
  latency_ms    INTEGER NOT NULL,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_usd      REAL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_proxy_requests_created ON proxy_requests(created_at);

-- 3. Telemetry rollups -------------------------------------------------------
-- Raw events go to Analytics Engine. This table holds only daily aggregates,
-- which carry no installation id at all and so fall outside GDPR entirely.

CREATE TABLE telemetry_daily (
  day           TEXT NOT NULL,
  event_name    TEXT NOT NULL,
  subject       TEXT,
  grade         INTEGER,
  topic         TEXT,
  event_count   INTEGER NOT NULL,
  solved_count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event_name, subject, grade, topic)
);
