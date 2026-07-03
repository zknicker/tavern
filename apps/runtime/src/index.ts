import path from 'node:path';
import { refreshRuntimeCapabilities } from './capabilities/store.ts';
import { dispatch } from './cli/main.ts';
import { DATA_DIR } from './config.ts';
import { initDb } from './db/connection.ts';
import { ensureRuntimeSchema } from './db/schema.ts';
import { runRuntimeDoctor } from './doctor/runtime-doctor.ts';
import { type RuntimeJobsManager, startRuntimeJobsManager } from './jobs/manager.ts';
import { ensureRuntimeJobsSchema } from './jobs/schema.ts';
import { log } from './log.ts';
import {
    recoverInterruptedMemoryJobs,
    startMemoryDreamScheduler,
    stopMemoryDreamScheduler,
} from './memory/dreaming.ts';
import {
    startMemoryExtractionScheduler,
    stopMemoryExtractionScheduler,
} from './memory/extraction.ts';
import { resolveSemanticMemoryConfig } from './memory/semantic/store.ts';
import {
    closeSemanticMemoryWatcher,
    restartSemanticMemoryWatcher,
    startSemanticMemoryWatcher,
} from './memory/semantic/watcher.ts';
import { demoAgentId } from './tavern/development-chat-demo-types.ts';
import { seedDevelopmentChatDemos } from './tavern/development-chat-demos.ts';
import { seedDevelopmentSemanticMemoryDemos } from './tavern/development-memory-demos.ts';
import { ensurePrimaryManagedAgent } from './tavern/managed-agent.ts';
import { startTavernRuntimeServer } from './tavern/server.ts';
import { recoverInterruptedChatResponses } from './tavern/turn-recovery.ts';
import { seedDevelopmentWorkspaceDemos } from './workspace/development-demos.ts';
import { getAgentWorkspaceSource } from './workspace/instructions.ts';
import { closeAgentNotesWatchers } from './workspace/notes-watcher.ts';

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
    const recoveredMemoryJobs = recoverInterruptedMemoryJobs({ db });
    if (recoveredMemoryJobs > 0) {
        log.info('Recovered interrupted Memory jobs', { count: recoveredMemoryJobs });
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
    const semanticMemoryDemoSeed = await seedDevelopmentSemanticMemoryDemos();
    if (semanticMemoryDemoSeed.seeded > 0) {
        log.info('Development SemanticMemory demos ready', {
            count: semanticMemoryDemoSeed.seeded,
        });
    }
    void startSemanticMemoryWatcher(resolveSemanticMemoryConfig).catch((err) => {
        log.warn('SemanticMemory live updates failed to start', { err });
    });
    runtimeJobs = await startRuntimeJobsManager();
    startMemoryExtractionScheduler();
    startMemoryDreamScheduler();

    runtimeServer = startTavernRuntimeServer();
    log.info('Tavern Runtime running', { url: runtimeServer.url.toString() });

    await restartSemanticMemoryWatcher({ emitRootChanged: false }).catch((err) => {
        log.warn('SemanticMemory live updates failed to refresh after agent startup', {
            err,
        });
    });
    await refreshRuntimeCapabilities({
        ids: ['semanticMemory', 'gateway', 'apiServer', 'modelExecution', 'skills'],
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
    log.info('Stopping Memory extraction scheduler');
    stopMemoryExtractionScheduler();
    log.info('Memory extraction scheduler stopped');
    log.info('Stopping Memory dream scheduler');
    stopMemoryDreamScheduler();
    log.info('Memory dream scheduler stopped');
    log.info('Stopping SemanticMemory live updates');
    await closeSemanticMemoryWatcher();
    log.info('SemanticMemory live updates stopped');
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
