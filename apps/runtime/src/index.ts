import path from 'node:path';
import { DATA_DIR } from './config';
import { ensureCortexSchema } from './cortex/schema';
import { initDb } from './db/connection';
import { ensureRuntimeSchema } from './db/schema';
import { log } from './log';
import { type ManagedOpenClawHandle, startOpenClawForRuntime } from './openclaw/supervisor';
import { startTavernRuntimeServer } from './tavern/server';
import { ensureWorkspaceInstructionSchema } from './workspace/instructions';

let runtimeServer: ReturnType<typeof startTavernRuntimeServer> | null = null;
let openClaw: ManagedOpenClawHandle | null = null;

async function main(): Promise<void> {
    log.info('Tavern Runtime starting');

    const dbPath = path.join(DATA_DIR, 'runtime.db');
    const db = initDb(dbPath);
    ensureRuntimeSchema(db);
    ensureCortexSchema(db);
    ensureWorkspaceInstructionSchema(db);
    log.info('Runtime DB ready', { path: dbPath });

    runtimeServer = startTavernRuntimeServer();
    openClaw = await startOpenClawForRuntime();
    log.info('Tavern Runtime running', { url: runtimeServer.url.toString() });
}

function shutdown(signal: string): void {
    log.info('Shutdown signal received', { signal });
    runtimeServer?.stop();
    openClaw?.stop();
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
    log.fatal('Startup failed', { err });
    process.exit(1);
});
