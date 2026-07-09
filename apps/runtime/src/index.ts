import path from 'node:path';
import { seededSkillDefaultEntries } from './agent-engine/skill-library.ts';
import { refreshRuntimeCapabilities } from './capabilities/store.ts';
import { dispatch } from './cli/main.ts';
import { ensureCliOnPath } from './cli-path.ts';
import { DATA_DIR } from './config.ts';
import { type RuntimeCronManager, startRuntimeCronManager } from './cron/scheduler.ts';
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
import { materializePluginSkills } from './plugins/materialize-skills.ts';
import { startSkillCuratorScheduler, stopSkillCuratorScheduler } from './skills/curator.ts';
import { startSkillReviewScheduler, stopSkillReviewScheduler } from './skills/review-queue.ts';
import { recordSkillSource, sha256 } from './skills/store.ts';
import { startTaskDispatcher, type TaskDispatcherHandle } from './tasks/dispatcher.ts';
import { recoverSettledTaskDispatches } from './tasks/recovery.ts';
import { demoAgentId } from './tavern/development-chat-demo-types.ts';
import { seedDevelopmentChatDemos } from './tavern/development-chat-demos.ts';
import { seedDevelopmentWikiDemos } from './tavern/development-memory-demos.ts';
import { seedDevelopmentMemoryJobDemos } from './tavern/development-memory-job-demos.ts';
import { ensurePrimaryManagedAgent } from './tavern/managed-agent.ts';
import { startTavernRuntimeServer } from './tavern/server.ts';
import { recoverInterruptedChatResponses } from './tavern/turn-recovery.ts';
import { loadQmd } from './wiki/recall/qmd-loader.ts';
import {
    startRecallIndexMaintenance,
    stopRecallIndexMaintenance,
} from './wiki/recall/recall-index.ts';
import { prepareWikiRoot, resolveWikiConfig } from './wiki/store.ts';
import { closeWikiWatcher, restartWikiWatcher, startWikiWatcher } from './wiki/watcher.ts';
import { seedDevelopmentWorkspaceDemos } from './workspace/development-demos.ts';
import { getAgentWorkspaceSource } from './workspace/instructions.ts';
import { closeAgentNotesWatchers } from './workspace/notes-watcher.ts';

let runtimeServer: ReturnType<typeof startTavernRuntimeServer> | null = null;
let runtimeJobs: RuntimeJobsManager | null = null;
let runtimeCron: RuntimeCronManager | null = null;
let taskDispatcher: TaskDispatcherHandle | null = null;
let shuttingDown = false;

async function main(): Promise<void> {
    log.info('Tavern Runtime starting');

    // The recall search engine swaps in an extension-capable SQLite build via
    // bun:sqlite setCustomSQLite, which only works before the first Database
    // instance exists in the process — load it before any runtime database.
    await loadQmd().catch((err) => {
        log.warn('Wiki recall search engine failed to load; recall is unavailable', { err });
    });

    // Homebrew/launchd services strip the user PATH; heal well-known CLI
    // homes so harness bridges and CLI spawns keep working under the service.
    for (const cli of ['codex', 'claude']) {
        ensureCliOnPath(cli);
    }

    const dbPath = path.join(DATA_DIR, 'runtime.db');
    const db = initDb(dbPath);
    ensureRuntimeSchema(db);
    ensureRuntimeJobsSchema(db);
    ensurePrimaryManagedAgent(db);
    // The lazy seed during instruction prep can run before the DB exists and
    // skip source recording; without this the seeded skills read as external.
    for (const [skillId, content] of seededSkillDefaultEntries()) {
        recordSkillSource({
            db,
            installedHash: sha256(content),
            skillId,
            source: 'seeded',
        });
    }
    await materializePluginSkills({ db }).catch((err) => {
        log.warn('Plugin skills failed to materialize during startup', { err });
    });
    await runRuntimeDoctor({ db, reason: 'runtime_start' }).catch((err) => {
        log.warn('Runtime Doctor failed during startup', { err });
    });
    log.info('Runtime DB ready', { path: dbPath });
    const recoveredRecords = recoverInterruptedChatResponses(db);
    if (recoveredRecords > 0) {
        log.info('Recovered interrupted agent records', {
            count: recoveredRecords,
        });
    }
    const recoveredTaskDispatches = recoverSettledTaskDispatches(db);
    if (recoveredTaskDispatches > 0) {
        log.info('Recovered interrupted task dispatches', { count: recoveredTaskDispatches });
    }
    const recoveredMemoryJobs = recoverInterruptedMemoryJobs({ db });
    if (recoveredMemoryJobs > 0) {
        log.info('Recovered interrupted Memory jobs', {
            count: recoveredMemoryJobs,
        });
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
        log.info('Development workspace demos ready', {
            count: workspaceDemoSeed.seeded,
        });
    }
    const wikiDemoSeed = await seedDevelopmentWikiDemos();
    if (wikiDemoSeed.seeded > 0) {
        log.info('Development Wiki demos ready', {
            count: wikiDemoSeed.seeded,
        });
    }
    const memoryJobDemoSeed = await seedDevelopmentMemoryJobDemos({ db }).catch((err) => {
        log.warn('Development Memory job demos failed to seed', { err });
        return { seeded: 0 };
    });
    if (memoryJobDemoSeed.seeded > 0) {
        log.info('Development Memory job demos ready', {
            count: memoryJobDemoSeed.seeded,
        });
    }
    await prepareWikiRoot((await resolveWikiConfig()).wikiPath).catch((err) => {
        log.warn('Wiki root failed to prepare', { err });
    });
    void startWikiWatcher(resolveWikiConfig).catch((err) => {
        log.warn('Wiki live updates failed to start', { err });
    });
    startRecallIndexMaintenance();
    runtimeJobs = await startRuntimeJobsManager();
    log.info('Runtime jobs ready');
    runtimeCron = await startRuntimeCronManager();
    log.info('Runtime cron ready');
    taskDispatcher = startTaskDispatcher();
    log.info('Task dispatcher ready');
    startMemoryExtractionScheduler();
    startSkillReviewScheduler();
    startSkillCuratorScheduler();
    startMemoryDreamScheduler();

    runtimeServer = startTavernRuntimeServer();
    log.info('Tavern Runtime running', { url: runtimeServer.url.toString() });

    await restartWikiWatcher({ emitRootChanged: false }).catch((err) => {
        log.warn('Wiki live updates failed to refresh after agent startup', {
            err,
        });
    });
    await refreshRuntimeCapabilities({
        ids: [
            'memory',
            'wiki',
            'wikiRecall',
            'memoryExtraction',
            'memoryDreaming',
            'gateway',
            'apiServer',
            'cron',
            'autoDispatch',
            'modelExecution',
            'skills',
        ],
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
    log.info('Stopping skill review scheduler');
    stopSkillReviewScheduler();
    log.info('Skill review scheduler stopped');
    log.info('Stopping skill curator scheduler');
    stopSkillCuratorScheduler();
    log.info('Skill curator scheduler stopped');
    log.info('Stopping Memory dream scheduler');
    stopMemoryDreamScheduler();
    log.info('Memory dream scheduler stopped');
    log.info('Stopping Wiki live updates');
    await closeWikiWatcher();
    log.info('Wiki live updates stopped');
    log.info('Stopping Wiki recall index');
    await stopRecallIndexMaintenance();
    log.info('Wiki recall index stopped');
    log.info('Stopping Runtime jobs');
    await runtimeJobs?.stop();
    log.info('Runtime jobs stopped');
    log.info('Stopping Runtime cron');
    await runtimeCron?.stop();
    log.info('Runtime cron stopped');
    log.info('Stopping task dispatcher');
    taskDispatcher?.stop();
    log.info('Task dispatcher stopped');
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
