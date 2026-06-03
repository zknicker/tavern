import { spawnSync } from 'node:child_process';
import path from 'node:path';
import runtimePackage from '../package.json';
import { DATA_DIR } from './config';
import { ensureCortexFilesystem } from './cortex/filesystem';
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

function printHelp(): void {
    console.log(`Tavern Runtime ${runtimePackage.version}

Usage:
  tavern serve
  tavern update
  tavern restart
  tavern --version
  tavern --help

Commands:
  serve        Run the foreground Tavern Runtime server.
  update       Stage a Runtime upgrade through Homebrew without restarting the service.
  restart      Restart the Homebrew tavern-runtime service.

Environment:
  TAVERN_RUNTIME_HOST   Bind host. Defaults to 127.0.0.1.
  TAVERN_RUNTIME_PORT   Bind port. Defaults to 18790.
  TAVERN_RUNTIME_ROOT   Runtime data root. Defaults to ~/.tavern/runtime.`);
}

function resolveCommand(args: string[]): 'help' | 'restart' | 'serve' | 'update' | 'version' {
    const [command] = args;

    if (!command || command === 'serve') {
        return 'serve';
    }

    if (command === '--help' || command === '-h' || command === 'help') {
        return 'help';
    }

    if (command === '--version' || command === '-v' || command === 'version') {
        return 'version';
    }

    if (command === 'update' || command === 'restart') {
        return command;
    }

    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}

function runBrew(args: string[]): void {
    const result = spawnSync('brew', args, {
        env: process.env,
        stdio: 'inherit',
    });

    if (result.error) {
        console.error(`brew ${args.join(' ')} failed: ${result.error.message}`);
        process.exit(1);
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function updateRuntime(): void {
    runBrew(['update']);
    runBrew(['upgrade', 'tavern-runtime']);
}

function restartRuntime(): void {
    runBrew(['services', 'restart', 'tavern-runtime']);
}

async function main(): Promise<void> {
    log.info('Tavern Runtime starting');

    const dbPath = path.join(DATA_DIR, 'runtime.db');
    const db = initDb(dbPath);
    ensureRuntimeSchema(db);
    ensureCortexSchema(db);
    ensureCortexFilesystem();
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

const command = resolveCommand(process.argv.slice(2));

if (command === 'help') {
    printHelp();
} else if (command === 'version') {
    console.log(runtimePackage.version);
} else if (command === 'update') {
    updateRuntime();
} else if (command === 'restart') {
    restartRuntime();
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
