import path from 'node:path';
import { DATA_DIR } from './config';
import { ensureCortexSchema } from './cortex/schema';
import { initDb } from './db/connection';
import { ensureRuntimeSchema } from './db/schema';
import { type RuntimeJobsManager, startRuntimeJobsManager } from './jobs/manager';
import { ensureRuntimeJobsSchema } from './jobs/schema';
import { log } from './log';
import { type ManagedOpenClawHandle, startOpenClawForRuntime } from './openclaw/supervisor';
import { startTavernRuntimeServer } from './tavern/server';
import { ensureWorkspaceInstructionSchema } from './workspace/instructions';

let runtimeServer: ReturnType<typeof startTavernRuntimeServer> | null = null;
let openClaw: ManagedOpenClawHandle | null = null;
let runtimeJobs: RuntimeJobsManager | null = null;
let openClawStartup: Promise<ManagedOpenClawHandle> | null = null;
let shuttingDown = false;

async function main(): Promise<void> {
    log.info('Tavern Runtime starting');

    const dbPath = path.join(DATA_DIR, 'runtime.db');
    const db = initDb(dbPath);
    ensureRuntimeSchema(db);
    ensureCortexSchema(db);
    ensureRuntimeJobsSchema(db);
    ensureWorkspaceInstructionSchema(db);
    log.info('Runtime DB ready', { path: dbPath });
    runtimeJobs = await startRuntimeJobsManager();

    runtimeServer = startTavernRuntimeServer();
    log.info('Tavern Runtime running', { url: runtimeServer.url.toString() });

    openClawStartup = startOpenClawForRuntime()
        .then((handle) => {
            openClaw = handle;
            if (shuttingDown) {
                void handle.stop();
            }
            return handle;
        })
        .catch((err) => {
            log.error('Managed OpenClaw Gateway startup failed', { err });
            throw err;
        });

    void openClawStartup.catch(() => undefined);
}

async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
        log.warn('Shutdown already in progress; forcing managed OpenClaw Gateway stop', { signal });
        const handle = openClaw ?? (await openClawStartup?.catch(() => null));
        await handle?.stop({ force: true });
        process.exit(signal === 'SIGINT' ? 130 : 143);
        return;
    }

    shuttingDown = true;
    log.info('Shutdown signal received', { signal });
    log.info('Stopping Runtime jobs');
    await runtimeJobs?.stop();
    log.info('Runtime jobs stopped');
    log.info('Stopping Runtime server');
    runtimeServer?.stop();
    log.info('Runtime server stopped');
    const handle = openClaw ?? (await openClawStartup?.catch(() => null));
    if (handle) {
        log.info('Waiting for managed OpenClaw Gateway to stop');
    }
    await handle?.stop();
    if (handle) {
        log.info('Managed OpenClaw Gateway stopped');
    }
    process.exit(0);
}

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

main().catch((err) => {
    log.fatal('Startup failed', { err });
    process.exit(1);
});
