import { mkdtempSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { closeDb, initDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';

export function initAgentApiTestDb(prefix: string): string {
    const root = mkdtempSync(path.join(os.tmpdir(), prefix));
    ensureRuntimeSchema(initDb(path.join(root, 'runtime.db')));
    return root;
}

export async function closeAgentApiTestDb(root: string): Promise<void> {
    closeDb();
    await fs.rm(root, { force: true, recursive: true });
}
