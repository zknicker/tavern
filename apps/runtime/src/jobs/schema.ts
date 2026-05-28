import type { Database } from '../db/sqlite';

export const RUNTIME_JOBS_SCHEMA = `
CREATE TABLE IF NOT EXISTS runtime_job_runs (
  id               TEXT PRIMARY KEY,
  job_slug         TEXT NOT NULL,
  job_display_name TEXT NOT NULL,
  trigger          TEXT NOT NULL CHECK (trigger IN ('manual', 'schedule', 'startup', 'unknown', 'write')),
  state            TEXT NOT NULL CHECK (state IN ('active', 'completed', 'delayed', 'failed', 'unknown', 'waiting')),
  attempts_made    INTEGER NOT NULL DEFAULT 0,
  progress         INTEGER NOT NULL DEFAULT 0,
  error            TEXT,
  logs_json        TEXT NOT NULL DEFAULT '[]',
  metadata_json    TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL,
  started_at       TEXT,
  finished_at      TEXT,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runtime_job_runs_job_created
  ON runtime_job_runs(job_slug, created_at);

CREATE INDEX IF NOT EXISTS idx_runtime_job_runs_state_created
  ON runtime_job_runs(state, created_at);
`;

export function ensureRuntimeJobsSchema(db: Database): void {
    db.exec(RUNTIME_JOBS_SCHEMA);
}
