import crypto from 'node:crypto';
import type { AgentRuntimeModelName } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import {
    modelCategoryModelRef,
    resolveModelCategorySelection,
} from '../models/category-settings.ts';
import { supportsLanguageModelForRuntime } from '../models/language-model.ts';
import { isMemoryEnabled } from './settings.ts';
import {
    type MemoryDreamOutcome,
    type MemoryDreamWorker,
    MemoryDreamWorkerError,
    runAiSdkMemoryDream,
} from './worker.ts';

const dreamExtractionThreshold = 5;
const dreamAgeThresholdMs = 24 * 60 * 60 * 1000;
const dreamFailureBackoffMs = 60 * 60 * 1000;
const memoryDreamSweepIntervalMs = 60 * 1000;

interface DreamJobRow {
    agent_id: string;
    id: string;
}

let sweepInterval: ReturnType<typeof setInterval> | null = null;
let processingPromise: Promise<{ completed: number; failed: number; skipped: number }> | null =
    null;

export function maybeQueueMemoryDreamForAgent(input: {
    agentId: string;
    db?: Database;
    now?: Date;
}) {
    if (!isMemoryEnabled()) {
        return null;
    }
    const db = input.db ?? getDb();
    const now = input.now ?? new Date();
    if (!isDreamEligible(input.agentId, now, db)) {
        return null;
    }
    try {
        return queueMemoryDream({ agentId: input.agentId, db, explicit: false, now });
    } catch {
        return null;
    }
}

export function queueMemoryDream(input: {
    agentId: string;
    db?: Database;
    explicit?: boolean;
    now?: Date;
}) {
    if (!isMemoryEnabled()) {
        throw new Error('Memory is disabled.');
    }
    const db = input.db ?? getDb();
    const existing = db
        .prepare(
            `SELECT id FROM memory_jobs
             WHERE kind = 'dream'
               AND agent_id = $agentId
               AND status IN ('queued', 'running')
             ORDER BY created_at DESC
             LIMIT 1`
        )
        .get(namedParams({ agentId: input.agentId })) as { id: string } | undefined;
    if (existing) {
        return existing.id;
    }
    const now = input.now ?? new Date();
    const model = resolveModelCategorySelection('standard');
    if (!supportsLanguageModelForRuntime(model)) {
        throw new Error(
            `Memory dreaming cannot use provider "${model.provider}" without a direct LanguageModel adapter.`
        );
    }
    const jobId = `memdream_${crypto.randomUUID().replaceAll('-', '')}`;
    db.prepare(
        `INSERT INTO memory_jobs (
            id, kind, status, agent_id, model_category, model_json,
            file_changes_json, usage_json, transcript_json, metadata_json,
            created_at, updated_at
         )
         VALUES (
            $jobId, 'dream', 'queued', $agentId, 'standard', $modelJson,
            '[]', '{}', '[]', $metadataJson, $now, $now
         )`
    ).run(
        namedParams({
            agentId: input.agentId,
            jobId,
            metadataJson: JSON.stringify({ explicit: Boolean(input.explicit) }),
            modelJson: JSON.stringify(model),
            now: now.toISOString(),
        })
    );
    return jobId;
}

export async function processQueuedMemoryDreams(
    input: { now?: Date; worker?: MemoryDreamWorker } = {}
) {
    if (processingPromise) {
        return await processingPromise;
    }
    processingPromise = processQueuedMemoryDreamsOnce(input);
    try {
        return await processingPromise;
    } finally {
        processingPromise = null;
    }
}

export function startMemoryDreamScheduler() {
    if (sweepInterval) {
        return;
    }
    void processQueuedMemoryDreams().catch(() => {});
    sweepInterval = setInterval(() => {
        void processQueuedMemoryDreams().catch(() => {});
    }, memoryDreamSweepIntervalMs);
    sweepInterval.unref?.();
}

export function recoverInterruptedMemoryJobs(input: { db?: Database; now?: Date } = {}) {
    const db = input.db ?? getDb();
    const now = input.now ?? new Date();
    const result = db
        .prepare(
            `UPDATE memory_jobs
             SET status = 'failed',
                 error = $error,
                 completed_at = $now,
                 updated_at = $now
             WHERE status = 'running'`
        )
        .run(
            namedParams({
                error: 'Memory job interrupted by Runtime shutdown.',
                now: now.toISOString(),
            })
        );
    return result.changes;
}

export function stopMemoryDreamScheduler() {
    if (sweepInterval) {
        clearInterval(sweepInterval);
        sweepInterval = null;
    }
    processingPromise = null;
}

export function resetMemoryDreamSchedulerForTesting() {
    stopMemoryDreamScheduler();
}

async function processQueuedMemoryDreamsOnce(input: { now?: Date; worker?: MemoryDreamWorker }) {
    if (!isMemoryEnabled()) {
        return { completed: 0, failed: 0, skipped: 0 };
    }
    const db = getDb();
    queueEligibleMemoryDreams(input.now ?? new Date(), db);
    const rows = db
        .prepare(
            `SELECT id, agent_id
             FROM memory_jobs
             WHERE kind = 'dream' AND status = 'queued'
             ORDER BY created_at ASC`
        )
        .all() as DreamJobRow[];
    const counts = { completed: 0, failed: 0, skipped: 0 };
    for (const row of rows) {
        try {
            await runDreamJob(
                row,
                input.worker ?? runAiSdkMemoryDream,
                input.now ?? new Date(),
                db
            );
            counts.completed += 1;
        } catch (error) {
            const fileChanges = error instanceof MemoryDreamWorkerError ? error.fileChanges : [];
            failDreamJob(row.id, error, input.now ?? new Date(), db, fileChanges);
            counts.failed += 1;
        }
    }
    return counts;
}

async function runDreamJob(row: DreamJobRow, worker: MemoryDreamWorker, now: Date, db: Database) {
    db.prepare(
        `UPDATE memory_jobs
         SET status = 'running',
             started_at = $now,
             updated_at = $now
         WHERE id = $jobId AND status = 'queued'`
    ).run(namedParams({ jobId: row.id, now: now.toISOString() }));
    const outcome = await worker({ agentId: row.agent_id, jobId: row.id });
    completeDreamJob(row.id, outcome, new Date(), db);
}

function completeDreamJob(jobId: string, outcome: MemoryDreamOutcome, now: Date, db: Database) {
    db.prepare(
        `UPDATE memory_jobs
         SET status = 'completed',
             model_json = $modelJson,
             output_path = $outputPath,
             file_changes_json = $fileChangesJson,
             usage_json = $usageJson,
             transcript_json = $transcriptJson,
             metadata_json = $metadataJson,
             completed_at = $now,
             updated_at = $now
         WHERE id = $jobId`
    ).run(
        namedParams({
            fileChangesJson: JSON.stringify(outcome.fileChanges),
            jobId,
            metadataJson: JSON.stringify({ summary: outcome.text.trim() }),
            modelJson: JSON.stringify(outcome.model),
            now: now.toISOString(),
            outputPath: outcome.fileChanges.at(0)?.path ?? null,
            transcriptJson: JSON.stringify(outcome.transcript),
            usageJson: JSON.stringify(outcome.usage ?? {}),
        })
    );
}

function failDreamJob(
    jobId: string,
    error: unknown,
    now: Date,
    db: Database,
    fileChanges: unknown[] = []
) {
    db.prepare(
        `UPDATE memory_jobs
         SET status = 'failed',
             error = $error,
             file_changes_json = $fileChangesJson,
             completed_at = $now,
             updated_at = $now
         WHERE id = $jobId`
    ).run(
        namedParams({
            error: error instanceof Error ? error.message : String(error),
            fileChangesJson: JSON.stringify(fileChanges),
            jobId,
            now: now.toISOString(),
        })
    );
}

function queueEligibleMemoryDreams(now: Date, db: Database) {
    const rows = db
        .prepare(
            `SELECT DISTINCT agent_id
             FROM memory_jobs
             WHERE kind = 'extraction' AND status = 'completed'
             ORDER BY agent_id ASC`
        )
        .all() as Array<{ agent_id: string }>;
    for (const row of rows) {
        maybeQueueMemoryDreamForAgent({ agentId: row.agent_id, db, now });
    }
}

function isDreamEligible(agentId: string, now: Date, db: Database) {
    if (hasActiveDream(agentId, db)) {
        return false;
    }
    const newestFailedDream = latestFailedDream(agentId, db);
    if (
        newestFailedDream &&
        now.getTime() - Date.parse(newestFailedDream.created_at) < dreamFailureBackoffMs
    ) {
        return false;
    }
    const newestExtraction = latestCompletedJob(agentId, 'extraction', db);
    if (!newestExtraction) {
        return false;
    }
    const newestDream = latestCompletedJob(agentId, 'dream', db);
    if (!newestDream) {
        return true;
    }
    const extractionsSinceDream = countCompletedExtractionsSince(
        agentId,
        newestDream.created_at,
        db
    );
    if (extractionsSinceDream >= dreamExtractionThreshold) {
        return true;
    }
    return now.getTime() - Date.parse(newestDream.created_at) >= dreamAgeThresholdMs;
}

function hasActiveDream(agentId: string, db: Database) {
    return Boolean(
        db
            .prepare(
                `SELECT 1 FROM memory_jobs
             WHERE kind = 'dream'
               AND agent_id = $agentId
               AND status IN ('queued', 'running')
             LIMIT 1`
            )
            .get(namedParams({ agentId }))
    );
}

function latestCompletedJob(agentId: string, kind: 'dream' | 'extraction', db: Database) {
    return db
        .prepare(
            `SELECT id, created_at
             FROM memory_jobs
             WHERE agent_id = $agentId AND kind = $kind AND status = 'completed'
             ORDER BY created_at DESC
             LIMIT 1`
        )
        .get(namedParams({ agentId, kind })) as { created_at: string; id: string } | undefined;
}

function latestFailedDream(agentId: string, db: Database) {
    return db
        .prepare(
            `SELECT id, created_at
             FROM memory_jobs
             WHERE agent_id = $agentId AND kind = 'dream' AND status = 'failed'
             ORDER BY created_at DESC
             LIMIT 1`
        )
        .get(namedParams({ agentId })) as { created_at: string; id: string } | undefined;
}

function countCompletedExtractionsSince(agentId: string, createdAt: string, db: Database) {
    const row = db
        .prepare(
            `SELECT COUNT(*) AS count
             FROM memory_jobs
             WHERE agent_id = $agentId
               AND kind = 'extraction'
               AND status = 'completed'
               AND created_at > $createdAt`
        )
        .get(namedParams({ agentId, createdAt })) as { count: number };
    return row.count;
}

export function dreamModelRef(model: AgentRuntimeModelName) {
    return modelCategoryModelRef(model);
}
