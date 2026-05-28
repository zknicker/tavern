import type { AgentRuntimeJobDetail } from '@tavern/api';
import type { Job } from 'bunqueue/client';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';
import type {
    RuntimeJobDefinition,
    RuntimeJobQueuePayload,
    RuntimeJobRunState,
    RuntimeJobTrigger,
} from './types';

interface RuntimeJobRunRow {
    attempts_made: number;
    created_at: string;
    error: string | null;
    finished_at: string | null;
    id: string;
    logs_json: string;
    progress: number;
    started_at: string | null;
    state: RuntimeJobRunState;
}

interface RuntimeJobRunStateInput {
    attemptsMade: number;
    createdAt: string;
    error?: string | null;
    finishedAt?: string | null;
    id: string;
    jobDisplayName: string;
    jobSlug: string;
    progress: number;
    startedAt?: string | null;
    state: RuntimeJobRunState;
    trigger: RuntimeJobTrigger;
    updatedAt: string;
}

export function listRuntimeJobRuns(
    jobSlug: string,
    limit = 20
): AgentRuntimeJobDetail['recentRuns'] {
    const rows = getDb()
        .prepare(
            `SELECT id,
                    state,
                    attempts_made,
                    progress,
                    error,
                    logs_json,
                    created_at,
                    started_at,
                    finished_at
             FROM runtime_job_runs
             WHERE job_slug = $jobSlug
             ORDER BY created_at DESC
             LIMIT $limit`
        )
        .all(namedParams({ jobSlug, limit })) as RuntimeJobRunRow[];

    return rows.map(toRunDetail);
}

export function listRuntimeJobRunCounts(jobSlug: string) {
    const counts = {
        active: 0,
        completed: 0,
        delayed: 0,
        failed: 0,
        waiting: 0,
    };
    const rows = getDb()
        .prepare(
            `SELECT state, COUNT(*) AS count
             FROM runtime_job_runs
             WHERE job_slug = $jobSlug
             GROUP BY state`
        )
        .all(namedParams({ jobSlug })) as { count: number; state: RuntimeJobRunState }[];

    for (const row of rows) {
        if (row.state in counts) {
            counts[row.state as keyof typeof counts] = row.count;
        }
    }

    return counts;
}

export function recoverInterruptedRuntimeJobRuns(): void {
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `UPDATE runtime_job_runs
             SET state = 'failed',
                 error = 'Runtime stopped before this job completed.',
                 finished_at = $now,
                 updated_at = $now
             WHERE state = 'active'`
        )
        .run(namedParams({ now }));
}

export function recordRuntimeJobQueued(
    definition: RuntimeJobDefinition,
    job: Job<RuntimeJobQueuePayload>,
    trigger: RuntimeJobTrigger
): void {
    upsertRuntimeJobRunState(
        createStateInput(definition, job, 'waiting', trigger, {
            startedAt: null,
        })
    );
}

export function recordRuntimeJobActive(
    definition: RuntimeJobDefinition,
    job: Job<RuntimeJobQueuePayload>
): void {
    upsertRuntimeJobRunState(
        createStateInput(definition, job, 'active', getJobTrigger(job), {
            progress: job.progress,
        })
    );
}

export function recordRuntimeJobProgress(
    definition: RuntimeJobDefinition,
    job: Job<RuntimeJobQueuePayload>,
    progress: number
): void {
    upsertRuntimeJobRunState(
        createStateInput(definition, job, 'active', getJobTrigger(job), {
            progress,
        })
    );
}

export function recordRuntimeJobCompleted(
    definition: RuntimeJobDefinition,
    job: Job<RuntimeJobQueuePayload>
): void {
    upsertRuntimeJobRunState(
        createStateInput(definition, job, 'completed', getJobTrigger(job), {
            finishedAt: toIsoString(job.finishedOn) ?? new Date().toISOString(),
            progress: Math.max(job.progress, 100),
        })
    );
}

export function recordRuntimeJobFailed(
    definition: RuntimeJobDefinition,
    job: Job<RuntimeJobQueuePayload>,
    error: string
): void {
    upsertRuntimeJobRunState(
        createStateInput(definition, job, 'failed', getJobTrigger(job), {
            error,
            finishedAt: toIsoString(job.finishedOn) ?? new Date().toISOString(),
            startedAt: toIsoString(job.processedOn),
        })
    );
}

export function recordRuntimeJobLog(
    definition: RuntimeJobDefinition,
    job: Job<RuntimeJobQueuePayload>,
    message: string
): void {
    const row = getDb()
        .prepare('SELECT logs_json FROM runtime_job_runs WHERE id = $id')
        .get(namedParams({ id: job.id })) as { logs_json: string } | null;
    const logs = row ? parseLogs(row.logs_json) : [];
    logs.push(message);
    upsertRuntimeJobRunState(
        createStateInput(definition, job, 'active', getJobTrigger(job), {
            logs,
            progress: job.progress,
        })
    );
}

function upsertRuntimeJobRunState(input: RuntimeJobRunStateInput & { logs?: string[] }): void {
    getDb()
        .prepare(
            `INSERT INTO runtime_job_runs
             (id, job_slug, job_display_name, trigger, state, attempts_made, progress, error, logs_json, metadata_json, created_at, started_at, finished_at, updated_at)
             VALUES ($id, $jobSlug, $jobDisplayName, $trigger, $state, $attemptsMade, $progress, $error, $logsJson, '{}', $createdAt, $startedAt, $finishedAt, $updatedAt)
             ON CONFLICT(id) DO UPDATE SET
               state = excluded.state,
               attempts_made = excluded.attempts_made,
               progress = excluded.progress,
               error = excluded.error,
               logs_json = CASE
                 WHEN excluded.logs_json = '[]' THEN runtime_job_runs.logs_json
                 ELSE excluded.logs_json
               END,
               started_at = COALESCE(excluded.started_at, runtime_job_runs.started_at),
               finished_at = excluded.finished_at,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                attemptsMade: input.attemptsMade,
                createdAt: input.createdAt,
                error: input.error ?? null,
                finishedAt: input.finishedAt ?? null,
                id: input.id,
                jobDisplayName: input.jobDisplayName,
                jobSlug: input.jobSlug,
                logsJson: JSON.stringify(input.logs ?? []),
                progress: input.progress,
                startedAt: input.startedAt ?? null,
                state: input.state,
                trigger: input.trigger,
                updatedAt: input.updatedAt,
            })
        );
}

function createStateInput(
    definition: RuntimeJobDefinition,
    job: Job<RuntimeJobQueuePayload>,
    state: RuntimeJobRunState,
    trigger: RuntimeJobTrigger,
    overrides: {
        error?: string | null;
        finishedAt?: string | null;
        logs?: string[];
        progress?: number;
        startedAt?: string | null;
    } = {}
) {
    return {
        attemptsMade: job.attemptsMade,
        createdAt: new Date(job.timestamp).toISOString(),
        error: overrides.error ?? null,
        finishedAt: overrides.finishedAt ?? null,
        id: job.id,
        jobDisplayName: definition.displayName,
        jobSlug: definition.slug,
        logs: overrides.logs,
        progress: overrides.progress ?? job.progress,
        startedAt: overrides.startedAt ?? getStartedAt(job),
        state,
        trigger,
        updatedAt: new Date().toISOString(),
    };
}

function toRunDetail(row: RuntimeJobRunRow): AgentRuntimeJobDetail['recentRuns'][number] {
    return {
        attemptsMade: row.attempts_made,
        createdAt: row.created_at,
        durationMs: getDurationMs(row.started_at, row.finished_at),
        error: row.error,
        finishedAt: row.finished_at,
        id: row.id,
        logs: parseLogs(row.logs_json),
        progress: row.progress,
        startedAt: row.started_at,
        state: row.state,
    };
}

function getJobTrigger(job: Job<RuntimeJobQueuePayload>): RuntimeJobTrigger {
    return job.data?.trigger ?? 'unknown';
}

function getStartedAt(job: Job<RuntimeJobQueuePayload>) {
    return toIsoString(job.processedOn) ?? new Date().toISOString();
}

function toIsoString(value: number | undefined) {
    if (value === undefined) {
        return null;
    }
    return new Date(value).toISOString();
}

function getDurationMs(startedAt: string | null, finishedAt: string | null) {
    if (!(startedAt && finishedAt)) {
        return null;
    }
    const startMs = new Date(startedAt).getTime();
    const finishMs = new Date(finishedAt).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(finishMs) || finishMs < startMs) {
        return null;
    }
    return finishMs - startMs;
}

function parseLogs(value: string): string[] {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
            ? parsed.filter((entry): entry is string => typeof entry === 'string')
            : [];
    } catch {
        return [];
    }
}
