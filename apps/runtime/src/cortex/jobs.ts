import type { CortexJobName, CortexJobRun } from '@tavern/api';
import { getDb } from '../db/connection';
import { writeCortexAudit } from './audit';
import { runCortexChatIngestion } from './chat-ingestion';
import type { CortexDatabase } from './db';
import { runCortexDream } from './dream';
import { generateStaleCortexEmbeddings } from './embeddings';
import { detectCortexIssues, summarizeCortexIssues } from './lint';
import { runCortexRepairDerivedState } from './repair-derived-state';
import { nowIso } from './rows';
import { syncCortexMarkdown } from './sync';

interface RunCortexJobOptions {
    dryRun?: boolean;
    recordRuntimeRun?: boolean;
    stale?: boolean;
}

export { countCortexEmbeddingBacklog, generateStaleCortexEmbeddings } from './embeddings';

export async function runCortexJob(
    db: CortexDatabase,
    job: CortexJobName,
    options: RunCortexJobOptions = {}
): Promise<CortexJobRun> {
    const startedAt = nowIso();
    const jobOptions = {
        dryRun: options.dryRun ?? false,
        stale: options.stale ?? true,
    };
    try {
        const summary = await runJobSteps(db, job, startedAt, jobOptions);
        return await writeCortexJobAudit(db, {
            completedAt: nowIso(),
            job,
            startedAt,
            status: 'success',
            summary,
        });
    } catch (error) {
        const summary = readErrorMessage(error);
        await writeCortexJobAudit(db, {
            completedAt: nowIso(),
            job,
            startedAt,
            status: 'error',
            summary,
        });
        throw error;
    }
}

export async function recordSkippedCortexJob(
    db: CortexDatabase,
    job: CortexJobName,
    summary: string
): Promise<CortexJobRun> {
    const startedAt = nowIso();
    return await writeCortexJobAudit(db, {
        completedAt: nowIso(),
        job,
        startedAt,
        status: 'skipped',
        summary,
    });
}

async function writeCortexJobAudit(
    db: CortexDatabase,
    input: {
        completedAt: string;
        job: CortexJobName;
        startedAt: string;
        status: 'error' | 'skipped' | 'success';
        summary: string;
    }
): Promise<CortexJobRun> {
    const auditId = await writeCortexAudit(db, {
        kind: `job.${input.job}`,
        recordRefs: [],
        sourceRefs: [],
        status: input.status,
        summary: input.summary,
    });

    return {
        auditId,
        completedAt: input.completedAt,
        job: input.job,
        status: input.status,
        summary: input.summary,
    };
}

async function runJobSteps(
    db: CortexDatabase,
    job: CortexJobName,
    now: string,
    options: {
        dryRun: boolean;
        stale: boolean;
    }
): Promise<string> {
    switch (job) {
        case 'dream': {
            const result = await runCortexDream(getDb(), db);
            const mode = result.modelReviewed ? 'with model review' : 'without model review';
            return `Dream consolidated ${result.reviewed} Cortex work item(s) ${mode}; captured ${result.captured} Cortex memory page(s).`;
        }
        case 'generate-embeddings': {
            if (!options.stale) {
                throw new Error(
                    'Cortex generate-embeddings currently supports stale-only embedding generation. Pass stale: true.'
                );
            }
            const records = await generateStaleCortexEmbeddings(db, now);
            return `Generated embeddings for ${records.length} Cortex chunk(s).`;
        }
        case 'lint':
            return summarizeCortexIssues(await detectCortexIssues(db));
        case 'repair-derived-state': {
            const result = await runCortexRepairDerivedState(db, { dryRun: options.dryRun, now });
            return result.summary;
        }
        case 'chat-ingestion': {
            const result = await runCortexChatIngestion(getDb(), db);
            const mode = result.modelReviewed ? 'with model review' : 'without model review';
            return `Chat ingestion reviewed ${result.reviewed} chat message(s) across ${result.chatsReviewed} chat(s) ${mode}; captured ${result.captured} Cortex memory page(s).`;
        }
        case 'sync': {
            const result = await syncCortexMarkdown(db);
            return `Synced ${result.pagesSynced} Cortex markdown page(s).`;
        }
    }
}

function readErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }
    return 'Cortex job failed.';
}
