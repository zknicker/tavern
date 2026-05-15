import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const databaseDirectory = fileURLToPath(new URL('../../../.context/e2e/', import.meta.url));
const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const databasePath = fileURLToPath(
    new URL(`../../../.context/e2e/tavern-e2e-${runId}.sqlite`, import.meta.url)
);
const jobsDatabasePath = `${databasePath}.jobs.sqlite`;

mkdirSync(databaseDirectory, { recursive: true });
rmSync(databasePath, { force: true });
rmSync(`${databasePath}-shm`, { force: true });
rmSync(`${databasePath}-wal`, { force: true });
rmSync(jobsDatabasePath, { force: true });
rmSync(`${jobsDatabasePath}-shm`, { force: true });
rmSync(`${jobsDatabasePath}-wal`, { force: true });

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3101';
process.env.DATABASE_PATH = databasePath;
process.env.TAVERN_RUNTIME_URL = process.env.TAVERN_RUNTIME_URL ?? 'http://127.0.0.1:4310';
process.env.SERVER_PORT = process.env.SERVER_PORT ?? '8081';

process.chdir(workspaceRoot);

await import('../../server/src/index.ts');
