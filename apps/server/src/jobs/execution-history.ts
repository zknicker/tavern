import type { Job, Queue } from 'bunqueue/client';
import type { RegisteredJobDefinition } from '../../../../jobs/index.ts';
import { appendJobExecutionLog, upsertJobExecutionState } from '../storage/jobs.ts';

type JobExecutionState = 'active' | 'completed' | 'failed' | 'unknown';

interface QueueBindingForExecutionHistory {
    definition: RegisteredJobDefinition;
    queue: Queue<Record<string, unknown>>;
}

function toIsoString(value: number | undefined) {
    if (value === undefined) {
        return null;
    }

    return new Date(value).toISOString();
}

function getStartedAt(job: Job<Record<string, unknown>>) {
    return toIsoString(job.processedOn) ?? new Date().toISOString();
}

function createStateInput(
    binding: QueueBindingForExecutionHistory,
    job: Job<Record<string, unknown>>,
    state: JobExecutionState,
    overrides: {
        error?: string | null;
        finishedAt?: string | null;
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
        jobDisplayName: binding.definition.displayName,
        jobSlug: binding.definition.slug,
        progress: overrides.progress ?? job.progress,
        startedAt: overrides.startedAt ?? getStartedAt(job),
        state,
        updatedAt: new Date().toISOString(),
    };
}

export async function recordRecoveredInterruptedJob(
    binding: QueueBindingForExecutionHistory,
    job: Job<Record<string, unknown>>,
    message: string
) {
    await upsertJobExecutionState(
        createStateInput(binding, job, 'failed', {
            error: message,
            finishedAt: new Date().toISOString(),
            startedAt: toIsoString(job.processedOn),
        })
    );
}

export async function recordJobActive(
    binding: QueueBindingForExecutionHistory,
    job: Job<Record<string, unknown>>
) {
    await upsertJobExecutionState(
        createStateInput(binding, job, 'active', {
            progress: job.progress,
        })
    );
}

export async function recordJobProgress(
    binding: QueueBindingForExecutionHistory,
    job: Job<Record<string, unknown>>,
    progress: number
) {
    await upsertJobExecutionState(
        createStateInput(binding, job, 'active', {
            progress,
        })
    );
}

export async function recordJobCompleted(
    binding: QueueBindingForExecutionHistory,
    job: Job<Record<string, unknown>>
) {
    await upsertJobExecutionState(
        createStateInput(binding, job, 'completed', {
            finishedAt: toIsoString(job.finishedOn) ?? new Date().toISOString(),
            progress: Math.max(job.progress, 100),
        })
    );
}

export async function recordJobFailed(
    binding: QueueBindingForExecutionHistory,
    job: Job<Record<string, unknown>>,
    error: string
) {
    await upsertJobExecutionState(
        createStateInput(binding, job, 'failed', {
            error,
            finishedAt: toIsoString(job.finishedOn) ?? new Date().toISOString(),
            startedAt: toIsoString(job.processedOn),
        })
    );
}

export async function recordJobLog(
    binding: QueueBindingForExecutionHistory,
    job: Job<Record<string, unknown>>,
    message: string
) {
    await appendJobExecutionLog({
        createdAt: new Date(job.timestamp).toISOString(),
        id: job.id,
        jobDisplayName: binding.definition.displayName,
        jobSlug: binding.definition.slug,
        message,
        startedAt: toIsoString(job.processedOn),
        updatedAt: new Date().toISOString(),
    });
}
