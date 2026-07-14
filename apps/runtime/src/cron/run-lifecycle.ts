import type { AgentRuntimeCronRun, AgentRuntimeCronRunStatus } from '@tavern/api';
import type { Database } from '../db/sqlite.ts';
import { settleCronJobRunState, updateCronRun } from './store.ts';

export function finishCronRun(input: {
    db: Database;
    errorCode?: AgentRuntimeCronRun['executionErrorCode'];
    jobId: string;
    message?: string;
    quiet?: boolean;
    runId: string;
    scriptExitCode?: number | null;
    scriptStderr?: string | null;
    startedAt: string;
    status: AgentRuntimeCronRunStatus;
    turnId?: string;
}): AgentRuntimeCronRun {
    const finishedAt = new Date().toISOString();
    const startedMs = Date.parse(input.startedAt);
    const finishedMs = Date.parse(finishedAt);
    settleCronJobRunState(
        {
            durationMs: Math.max(0, finishedMs - startedMs),
            errorCode: input.errorCode ?? null,
            errorMessage: input.message ?? null,
            id: input.jobId,
            runAtMs: startedMs,
            status: input.status,
        },
        input.db
    );
    return updateCronRun(
        input.runId,
        {
            executionErrorCode: input.errorCode ?? null,
            executionErrorMessage: input.message ?? null,
            finishedAt,
            quiet: input.quiet ?? false,
            scriptExitCode: input.scriptExitCode,
            scriptStderr: input.scriptStderr,
            status: input.status,
            turnId: input.turnId,
        },
        input.db
    );
}

export function readErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
