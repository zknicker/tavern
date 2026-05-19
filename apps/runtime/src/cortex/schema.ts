import type { Database } from '../db/sqlite';

export const CORTEX_SCHEMA = `
CREATE TABLE IF NOT EXISTS cortex_sources (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,
  locator       TEXT,
  hash          TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE(kind, locator)
);

CREATE TABLE IF NOT EXISTS cortex_pages (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  type            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted', 'stale')),
  compiled_truth  TEXT NOT NULL DEFAULT '',
  body            TEXT NOT NULL DEFAULT '',
  frontmatter_json TEXT NOT NULL DEFAULT '{}',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  content_hash    TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS cortex_page_aliases (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL REFERENCES cortex_pages(id) ON DELETE CASCADE,
  alias      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(alias),
  UNIQUE(page_id, alias)
);

CREATE TABLE IF NOT EXISTS cortex_claims (
  id               TEXT PRIMARY KEY,
  page_id           TEXT NOT NULL REFERENCES cortex_pages(id) ON DELETE CASCADE,
  subject           TEXT NOT NULL,
  predicate         TEXT NOT NULL,
  value             TEXT NOT NULL,
  confidence        REAL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'contradicted', 'stale', 'superseded')),
  source_refs_json  TEXT NOT NULL DEFAULT '[]',
  supersedes_claim_id TEXT REFERENCES cortex_claims(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_timeline_entries (
  id               TEXT PRIMARY KEY,
  page_id           TEXT NOT NULL REFERENCES cortex_pages(id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_links (
  id              TEXT PRIMARY KEY,
  from_page_id    TEXT NOT NULL REFERENCES cortex_pages(id) ON DELETE CASCADE,
  target_slug     TEXT NOT NULL,
  target_page_id  TEXT REFERENCES cortex_pages(id) ON DELETE SET NULL,
  heading         TEXT,
  label           TEXT,
  link_kind       TEXT NOT NULL DEFAULT 'mentions',
  source_location TEXT,
  created_at      TEXT NOT NULL,
  UNIQUE(from_page_id, target_slug, heading, link_kind, source_location)
);

CREATE TABLE IF NOT EXISTS cortex_files (
  id            TEXT PRIMARY KEY,
  source_id     TEXT REFERENCES cortex_sources(id) ON DELETE SET NULL,
  path          TEXT NOT NULL,
  media_type    TEXT,
  hash          TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_citations (
  id             TEXT PRIMARY KEY,
  page_id         TEXT REFERENCES cortex_pages(id) ON DELETE CASCADE,
  source_id       TEXT REFERENCES cortex_sources(id) ON DELETE SET NULL,
  file_id         TEXT REFERENCES cortex_files(id) ON DELETE SET NULL,
  locator         TEXT NOT NULL,
  quote           TEXT,
  metadata_json   TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_chunks (
  id             TEXT PRIMARY KEY,
  page_id         TEXT REFERENCES cortex_pages(id) ON DELETE CASCADE,
  source_id       TEXT REFERENCES cortex_sources(id) ON DELETE CASCADE,
  section         TEXT NOT NULL,
  ordinal         INTEGER NOT NULL,
  text            TEXT NOT NULL,
  token_count     INTEGER NOT NULL,
  text_hash       TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE(page_id, source_id, section, ordinal)
);

CREATE TABLE IF NOT EXISTS cortex_encodings (
  id             TEXT PRIMARY KEY,
  chunk_id        TEXT NOT NULL REFERENCES cortex_chunks(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,
  dimensions      INTEGER NOT NULL,
  vector_json     TEXT NOT NULL,
  input_text_hash TEXT NOT NULL,
  job_run_id      TEXT,
  audit_id        TEXT,
  embedded_at     TEXT NOT NULL,
  UNIQUE(chunk_id, provider, model, dimensions)
);

CREATE TABLE IF NOT EXISTS cortex_captures (
  id              TEXT PRIMARY KEY,
  capture_key     TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'error', 'skipped')),
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  output_refs_json TEXT NOT NULL DEFAULT '[]',
  error_message   TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_jobs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'queued', 'running', 'paused')),
  checkpoint_json TEXT NOT NULL DEFAULT '{}',
  schedule_json   TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_job_runs (
  id              TEXT PRIMARY KEY,
  audit_id        TEXT NOT NULL DEFAULT '',
  job_name         TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('error', 'skipped', 'success')),
  summary          TEXT NOT NULL,
  records_json     TEXT NOT NULL DEFAULT '[]',
  error_message    TEXT,
  started_at       TEXT NOT NULL,
  completed_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_audit_events (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('error', 'skipped', 'success')),
  actor_json     TEXT NOT NULL DEFAULT '{}',
  record_refs_json TEXT NOT NULL DEFAULT '[]',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  summary        TEXT NOT NULL,
  metadata_json  TEXT NOT NULL DEFAULT '{}',
  error_message  TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_telemetry_events (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  value         REAL NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cortex_pages_updated ON cortex_pages(updated_at);
CREATE INDEX IF NOT EXISTS idx_cortex_pages_type ON cortex_pages(type);
CREATE INDEX IF NOT EXISTS idx_cortex_alias_page ON cortex_page_aliases(page_id);
CREATE INDEX IF NOT EXISTS idx_cortex_claims_page ON cortex_claims(page_id);
CREATE INDEX IF NOT EXISTS idx_cortex_claims_subject ON cortex_claims(subject);
CREATE INDEX IF NOT EXISTS idx_cortex_timeline_page ON cortex_timeline_entries(page_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cortex_links_from ON cortex_links(from_page_id);
CREATE INDEX IF NOT EXISTS idx_cortex_links_target_slug ON cortex_links(target_slug);
CREATE INDEX IF NOT EXISTS idx_cortex_chunks_page ON cortex_chunks(page_id);
CREATE INDEX IF NOT EXISTS idx_cortex_chunks_hash ON cortex_chunks(text_hash);
CREATE INDEX IF NOT EXISTS idx_cortex_encodings_chunk ON cortex_encodings(chunk_id);
CREATE INDEX IF NOT EXISTS idx_cortex_audit_kind ON cortex_audit_events(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_cortex_job_runs_name ON cortex_job_runs(job_name, completed_at);
`;

export function ensureCortexSchema(db: Database): void {
    db.exec(CORTEX_SCHEMA);
    try {
        db.exec(`ALTER TABLE cortex_job_runs ADD COLUMN audit_id TEXT NOT NULL DEFAULT '';`);
    } catch {
        /* column already exists */
    }
}
