import path from 'node:path';
import { refreshRuntimeCapabilities } from './capabilities/store';
import { dispatch } from './cli/main';
import { DATA_DIR } from './config';
import { initDb } from './db/connection';
import { ensureRuntimeSchema } from './db/schema';
import { runRuntimeDoctor } from './doctor/runtime-doctor';
import { type RuntimeJobsManager, startRuntimeJobsManager } from './jobs/manager';
import { ensureRuntimeJobsSchema } from './jobs/schema';
import { log } from './log';
import { demoAgentId } from './tavern/development-chat-demo-types';
import { seedDevelopmentChatDemos } from './tavern/development-chat-demos';
import { seedDevelopmentVaultDemos } from './tavern/development-vault-demos';
import { ensurePrimaryManagedAgent } from './tavern/managed-agent';
import { startTavernRuntimeServer } from './tavern/server';
import { recoverInterruptedChatResponses } from './tavern/turn-recovery';
import { resolveVaultConfig } from './vault/store';
import { closeVaultWatcher, restartVaultWatcher, startVaultWatcher } from './vault/watcher';
import { seedDevelopmentWorkspaceDemos } from './workspace/development-demos';
import { getAgentWorkspaceSource } from './workspace/instructions';
import { closeAgentNotesWatchers } from './workspace/notes-watcher';

let runtimeServer: ReturnType<typeof startTavernRuntimeServer> | null = null;
let runtimeJobs: RuntimeJobsManager | null = null;
let shuttingDown = false;

async function main(): Promise<void> {
    log.info('Tavern Runtime starting');

    const dbPath = path.join(DATA_DIR, 'runtime.db');
    const db = initDb(dbPath);
    ensureRuntimeSchema(db);
    ensureRuntimeJobsSchema(db);
    ensurePrimaryManagedAgent(db);
    await runRuntimeDoctor({ db, reason: 'runtime_start' }).catch((err) => {
        log.warn('Runtime Doctor failed during startup', { err });
    });
    log.info('Runtime DB ready', { path: dbPath });
    const recoveredRecords = recoverInterruptedChatResponses(db);
    if (recoveredRecords > 0) {
        log.info('Recovered interrupted agent records', { count: recoveredRecords });
    }
    const demoSeed = seedDevelopmentChatDemos({ db });
    if (demoSeed.seeded > 0) {
        log.info('Development chat demos ready', { count: demoSeed.seeded });
    }
    const demoWorkspaceSource = getAgentWorkspaceSource(db, demoAgentId);
    const workspaceDemoSeed = demoWorkspaceSource
        ? await seedDevelopmentWorkspaceDemos({ sources: [demoWorkspaceSource] })
        : { seeded: 0 };
    if (workspaceDemoSeed.seeded > 0) {
        log.info('Development workspace demos ready', { count: workspaceDemoSeed.seeded });
    }
    const vaultDemoSeed = await seedDevelopmentVaultDemos();
    if (vaultDemoSeed.seeded > 0) {
        log.info('Development Vault demos ready', { count: vaultDemoSeed.seeded });
    }
    void startVaultWatcher(resolveVaultConfig).catch((err) => {
        log.warn('Vault live updates failed to start', { err });
    });
    runtimeJobs = await startRuntimeJobsManager();

    runtimeServer = startTavernRuntimeServer();
    log.info('Tavern Runtime running', { url: runtimeServer.url.toString() });

    await restartVaultWatcher({ emitRootChanged: false }).catch((err) => {
        log.warn('Vault live updates failed to refresh after agent startup', {
            err,
        });
    });
    await refreshRuntimeCapabilities({
        ids: ['vault', 'gateway', 'apiServer', 'modelExecution', 'skills'],
        publishUpdated: true,
    }).catch((err) => {
        log.warn('Capability refresh failed after agent startup', {
            err,
        });
    });
}

async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
        log.warn('Shutdown already in progress; exiting', { signal });
        process.exit(signal === 'SIGINT' ? 130 : 143);
        return;
    }

    shuttingDown = true;
    log.info('Shutdown signal received', { signal });
    closeAgentNotesWatchers();
    log.info('Stopping Vault live updates');
    await closeVaultWatcher();
    log.info('Vault live updates stopped');
    log.info('Stopping Runtime jobs');
    await runtimeJobs?.stop();
    log.info('Runtime jobs stopped');
    log.info('Stopping Runtime server');
    runtimeServer?.stop();
    log.info('Runtime server stopped');
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
