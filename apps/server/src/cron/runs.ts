import { listCronRuns as listStoredCronRuns } from '../storage/cron-runs.ts';
import { syncAgentRuntimeCron } from '../sync/agent-runtime-sync.ts';
import { cronJobRunListSchema, listCronRunsInputSchema } from './contracts.ts';

export async function listCronRuns(input?: unknown) {
    const parsed = listCronRunsInputSchema.parse(input);
    await refreshCronState();
    const runs = await listStoredCronRuns(parsed?.jobId ? { jobId: parsed.jobId } : undefined);
    const limit = parsed?.limit ?? runs.length;

    return cronJobRunListSchema.parse({
        runs: runs.slice(0, limit).map((run) => ({
            deliveryError: run.error,
            deliveryStatus: run.deliveryStatus,
            executionErrorCode: null,
            executionErrorMessage: run.error,
            finishedAt: resolveFinishedAt(run),
            id: run.sessionKey,
            jobId: run.jobId,
            scheduledFor: run.runAt,
            sessionId: run.sessionId,
            sessionKey: run.runtimeSessionKey ? run.sessionKey : null,
            startedAt: run.runAt,
            status: run.status ?? 'success',
            summary: run.summary,
            trigger: run.trigger,
        })),
    });
}

async function refreshCronState() {
    try {
        await syncAgentRuntimeCron();
    } catch (error) {
        console.warn('[tavern] failed to refresh cron runs', error);
    }
}

function resolveFinishedAt(run: { durationMs: null | number; runAt: string }) {
    if (run.durationMs === null) {
        return null;
    }

    const startedAtMs = Date.parse(run.runAt);
    if (Number.isNaN(startedAtMs)) {
        return null;
    }

    return new Date(startedAtMs + run.durationMs).toISOString();
}
