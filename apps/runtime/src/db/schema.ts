import type { Database } from './sqlite';

export const RUNTIME_SCHEMA = `
CREATE TABLE IF NOT EXISTS runtime_metadata (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export function ensureRuntimeSchema(db: Database): void {
    db.exec(RUNTIME_SCHEMA);
}
