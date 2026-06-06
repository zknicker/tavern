import type { CortexDatabase } from './db';
import { cortexEmbeddingVectorDimensions } from './settings';

export const CORTEX_PGLITE_SCHEMA = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted', 'stale')),
  compiled_truth   TEXT NOT NULL DEFAULT '',
  body             TEXT NOT NULL DEFAULT '',
  frontmatter_json TEXT NOT NULL DEFAULT '{}',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  content_hash     TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT
);

CREATE TABLE IF NOT EXISTS cortex_page_versions (
  id               TEXT PRIMARY KEY,
  page_id          TEXT NOT NULL REFERENCES cortex_pages(id) ON DELETE CASCADE,
  version_number   INTEGER NOT NULL,
  slug             TEXT NOT NULL,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('active', 'archived', 'deleted', 'stale')),
  compiled_truth   TEXT NOT NULL DEFAULT '',
  body             TEXT NOT NULL DEFAULT '',
  frontmatter_json TEXT NOT NULL DEFAULT '{}',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  content_hash     TEXT NOT NULL DEFAULT '',
  page_updated_at  TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  UNIQUE(page_id, version_number),
  UNIQUE(page_id, content_hash)
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
  id                  TEXT PRIMARY KEY,
  page_id             TEXT NOT NULL REFERENCES cortex_pages(id) ON DELETE CASCADE,
  subject             TEXT NOT NULL,
  predicate           TEXT NOT NULL,
  value               TEXT NOT NULL,
  confidence          REAL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'contradicted', 'stale', 'superseded')),
  source_refs_json    TEXT NOT NULL DEFAULT '[]',
  supersedes_claim_id TEXT REFERENCES cortex_claims(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_timeline_entries (
  id               TEXT PRIMARY KEY,
  page_id          TEXT NOT NULL REFERENCES cortex_pages(id) ON DELETE CASCADE,
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
  id            TEXT PRIMARY KEY,
  page_id       TEXT REFERENCES cortex_pages(id) ON DELETE CASCADE,
  source_id     TEXT REFERENCES cortex_sources(id) ON DELETE SET NULL,
  file_id       TEXT REFERENCES cortex_files(id) ON DELETE SET NULL,
  locator       TEXT NOT NULL,
  quote         TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_chunks (
  id          TEXT PRIMARY KEY,
  page_id     TEXT REFERENCES cortex_pages(id) ON DELETE CASCADE,
  source_id   TEXT REFERENCES cortex_sources(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  ordinal     INTEGER NOT NULL,
  text        TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  text_hash   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE(page_id, source_id, section, ordinal)
);

CREATE TABLE IF NOT EXISTS cortex_encodings (
  id              TEXT PRIMARY KEY,
  chunk_id        TEXT NOT NULL REFERENCES cortex_chunks(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,
  dimensions      INTEGER NOT NULL,
  embedding       vector(${cortexEmbeddingVectorDimensions}),
  input_text_hash TEXT NOT NULL,
  job_run_id      TEXT,
  audit_id        TEXT,
  embedded_at     TEXT NOT NULL,
  UNIQUE(chunk_id, provider, model, dimensions)
);

CREATE TABLE IF NOT EXISTS cortex_captures (
  id               TEXT PRIMARY KEY,
  capture_key      TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'error', 'skipped')),
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  output_refs_json TEXT NOT NULL DEFAULT '[]',
  error_message    TEXT,
  attempts         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS cortex_audit_events (
  id               TEXT PRIMARY KEY,
  kind             TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('error', 'skipped', 'success')),
  actor_json       TEXT NOT NULL DEFAULT '{}',
  record_refs_json TEXT NOT NULL DEFAULT '[]',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  summary          TEXT NOT NULL,
  metadata_json    TEXT NOT NULL DEFAULT '{}',
  error_message    TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_chat_ingestion_cursors (
  chat_id                   TEXT PRIMARY KEY,
  last_processed_sequence   INTEGER NOT NULL DEFAULT 0,
  last_processed_message_id TEXT,
  last_processed_at         TEXT,
  last_source_hash          TEXT,
  updated_at                TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_dream_reports (
  id                 TEXT PRIMARY KEY,
  status             TEXT NOT NULL CHECK (status IN ('error', 'running', 'skipped', 'success')),
  started_at         TEXT NOT NULL,
  completed_at       TEXT,
  duration_ms        INTEGER,
  provider           TEXT,
  model              TEXT,
  estimated_cost_usd REAL,
  summary            TEXT NOT NULL DEFAULT '',
  health_before_json TEXT,
  health_after_json  TEXT,
  warnings_json      TEXT NOT NULL DEFAULT '[]',
  noops_json         TEXT NOT NULL DEFAULT '[]',
  phases_json        TEXT NOT NULL DEFAULT '[]',
  metadata_json      TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_dream_report_items (
  id            TEXT PRIMARY KEY,
  report_id     TEXT NOT NULL REFERENCES cortex_dream_reports(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  page_id       TEXT REFERENCES cortex_pages(id) ON DELETE SET NULL,
  page_slug     TEXT,
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_telemetry_events (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  value         REAL NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_schemas (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  schema_json TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cortex_schema_terms (
  id               TEXT PRIMARY KEY,
  kind             TEXT NOT NULL CHECK (kind IN ('link-type', 'page-type')),
  name             TEXT NOT NULL,
  reason           TEXT NOT NULL,
  example_json     TEXT NOT NULL DEFAULT '{}',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cortex_pages_updated ON cortex_pages(updated_at);
CREATE INDEX IF NOT EXISTS idx_cortex_pages_type ON cortex_pages(type);
CREATE INDEX IF NOT EXISTS idx_cortex_pages_title_trgm ON cortex_pages USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cortex_pages_truth_trgm ON cortex_pages USING GIN (compiled_truth gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cortex_page_versions_page
  ON cortex_page_versions(page_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_cortex_alias_page ON cortex_page_aliases(page_id);
CREATE INDEX IF NOT EXISTS idx_cortex_claims_page ON cortex_claims(page_id);
CREATE INDEX IF NOT EXISTS idx_cortex_claims_subject ON cortex_claims(subject);
CREATE INDEX IF NOT EXISTS idx_cortex_timeline_page ON cortex_timeline_entries(page_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cortex_links_from ON cortex_links(from_page_id);
CREATE INDEX IF NOT EXISTS idx_cortex_links_target_slug ON cortex_links(target_slug);
CREATE INDEX IF NOT EXISTS idx_cortex_chunks_page ON cortex_chunks(page_id);
CREATE INDEX IF NOT EXISTS idx_cortex_chunks_hash ON cortex_chunks(text_hash);
CREATE INDEX IF NOT EXISTS idx_cortex_encodings_chunk ON cortex_encodings(chunk_id);
CREATE INDEX IF NOT EXISTS idx_cortex_encodings_embedding_hnsw
  ON cortex_encodings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_cortex_audit_kind ON cortex_audit_events(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_cortex_chat_ingestion_cursors_updated ON cortex_chat_ingestion_cursors(updated_at);
CREATE INDEX IF NOT EXISTS idx_cortex_dream_reports_started ON cortex_dream_reports(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cortex_dream_report_items_report ON cortex_dream_report_items(report_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cortex_dream_report_items_page ON cortex_dream_report_items(page_id);
CREATE INDEX IF NOT EXISTS idx_cortex_schemas_status ON cortex_schemas(status, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cortex_schema_terms_kind_name
  ON cortex_schema_terms(kind, name);
CREATE INDEX IF NOT EXISTS idx_cortex_schema_terms_updated
  ON cortex_schema_terms(updated_at);
`;

export async function ensureCortexSchema(db: CortexDatabase): Promise<void> {
    await db.exec(CORTEX_PGLITE_SCHEMA);
    await db.exec('DROP TABLE IF EXISTS cortex_job_runs;');
}
