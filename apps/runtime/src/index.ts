import path from 'node:path';
import { refreshRuntimeCapabilities } from './capabilities/store';
import { parseCli, printHelp, runCortexCli } from './cli';
import { runRestartCommand, runUpdateCommand } from './cli/maintenance-commands';
import { parseRestartFlags, parseUpdateFlags, UsageError } from './cli/maintenance-flags';
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

let cli: ReturnType<typeof parseCli>;
try {
    cli = parseCli(process.argv.slice(2));
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printHelp();
    process.exit(1);
}
const command = cli.command;

if (command === 'help') {
    printHelp();
} else if (command === 'version') {
    const runtimePackage = await import('../package.json');
    console.log(runtimePackage.default.version);
} else if (command === 'update') {
    try {
        const flags = parseUpdateFlags(cli.rest);
        process.exit(await runUpdateCommand(flags));
    } catch (error) {
        if (error instanceof UsageError) {
            console.error(error.message);
            process.exit(2);
        }
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
} else if (command === 'restart') {
    try {
        const flags = parseRestartFlags(cli.rest);
        process.exit(await runRestartCommand(flags));
    } catch (error) {
        if (error instanceof UsageError) {
            console.error(error.message);
            process.exit(2);
        }
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
} else if (cli.rest[0] === 'cortex') {
    runCortexCli(cli.rest.slice(1)).catch((err) => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    });
} else if (cli.rest[0] === 'engine') {
    const { runEngineCli } = await import('./hermes/engine-cli');
    runEngineCli(cli.rest.slice(1)).catch((err) => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    });
} else {
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
}
