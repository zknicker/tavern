import path from 'node:path';
import { refreshRuntimeCapabilities } from './capabilities/store';
import { dispatch } from './cli/main';
import { DATA_DIR } from './config';
import { initDb } from './db/connection';
import { ensureRuntimeSchema } from './db/schema';
import { type ManagedHermesHandle, startHermesForRuntime } from './hermes/supervisor';
import { type RuntimeJobsManager, startRuntimeJobsManager } from './jobs/manager';
import { ensureRuntimeJobsSchema } from './jobs/schema';
import { log } from './log';
import { startTavernRuntimeServer } from './tavern/server';
import { ensureWorkspaceInstructionSchema } from './workspace/instructions';

let runtimeServer: ReturnType<typeof startTavernRuntimeServer> | null = null;
let hermes: ManagedHermesHandle | null = null;
let runtimeJobs: RuntimeJobsManager | null = null;
let hermesStartup: Promise<ManagedHermesHandle> | null = null;
let shuttingDown = false;

async function main(): Promise<void> {
    log.info('Tavern Runtime starting');

    const dbPath = path.join(DATA_DIR, 'runtime.db');
    const db = initDb(dbPath);
    ensureRuntimeSchema(db);
    ensureRuntimeJobsSchema(db);
    ensureWorkspaceInstructionSchema(db);
    log.info('Runtime DB ready', { path: dbPath });
    runtimeJobs = await startRuntimeJobsManager();

    runtimeServer = startTavernRuntimeServer();
    log.info('Tavern Runtime running', { url: runtimeServer.url.toString() });

    hermesStartup = startHermesForRuntime()
        .then(async (handle) => {
            hermes = handle;
            await refreshRuntimeCapabilities({
                ids: ['cortexWiki'],
                publishUpdated: true,
            }).catch((err) => {
                log.warn('Managed wiki capability refresh failed after Hermes startup', { err });
            });
            if (shuttingDown) {
                void handle.stop();
            }
            return handle;
        })
        .catch((err) => {
            log.error('Managed Hermes API startup failed', { err });
            throw err;
        });

    void hermesStartup.catch(() => undefined);
}

async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
        log.warn('Shutdown already in progress; forcing managed Hermes API stop', {
            signal,
        });
        const handle = hermes ?? (await hermesStartup?.catch(() => null));
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
    const handle = hermes ?? (await hermesStartup?.catch(() => null));
    if (handle) {
        log.info('Waiting for managed Hermes API to stop');
    }
    await handle?.stop();
    if (handle) {
        log.info('Managed Hermes API stopped');
    }
    process.exit(0);
}

const result = await dispatch(process.argv.slice(2));

if (result.kind === 'serve') {
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
} else {
    process.exit(result.code);
}
