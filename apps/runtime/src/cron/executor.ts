import type {
    AgentRuntimeCronRun,
    AgentRuntimeCronRunStatus,
    AgentRuntimeCronRunTrigger,
} from '@tavern/api';
import { agentRuntimeCronRunSchema } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { log } from '../log.ts';
import { waitForAgentTurnSettlement } from '../tavern/agent-turn-runner.ts';
import { sendTavernChannelMessage } from '../tavern/channel-relay.ts';
import { createAgentParticipantId } from '../tavern/chat-api/ids.ts';
import { createMessage } from '../tavern/chat-api/index.ts';
import { publishRuntimeEvent } from '../tavern/runtime-events.ts';
import { createCronMessageId } from './ids.ts';
import { validateCronDelivery } from './service.ts';
import {
    createCronRun,
    deleteCronJob,
    getCronJob,
    getCronRunOrThrow,
    markCronJobRunning,
    settleCronJobRunState,
    updateCronRun,
} from './store.ts';

export async function executeCronJob(input: {
    db?: Database;
    jobId: string;
    runId?: string;
    scheduledFor: string;
    trigger: AgentRuntimeCronRunTrigger;
}): Promise<AgentRuntimeCronRun> {
    const db = input.db ?? getDb();
    const run = input.runId
        ? getCronRunOrThrow(input.runId, db)
        : createCronRun(
              { jobId: input.jobId, scheduledFor: input.scheduledFor, trigger: input.trigger },
              db
          );
    const startedAt = new Date().toISOString();
    publishCronRunStarted(input.jobId, run.id);

    let finalRun: AgentRuntimeCronRun;
    const job = getCronJob(input.jobId, db);
    if (!job) {
        finalRun = updateCronRun(
            run.id,
            {
                executionErrorCode: 'execution_failed',
                executionErrorMessage: `Cron job "${input.jobId}" no longer exists.`,
                finishedAt: startedAt,
                startedAt,
                status: 'skipped',
            },
            db
        );
        publishCronRunFinished(input.jobId, run.id);
        return agentRuntimeCronRunSchema.parse(finalRun);
    }

    markCronJobRunning(job.id, Date.parse(startedAt), db);
    updateCronRun(run.id, { chatId: job.delivery.chatId, startedAt, status: 'running' }, db);

    try {
        if (job.enabled) {
            validateCronDelivery({ agentId: job.agentId, delivery: job.delivery, db });
            finalRun =
                job.payload.kind === 'agentTurn'
                    ? await runAgentTurnCron({ db, job, runId: run.id, startedAt })
                    : runSystemEventCron({ db, job, runId: run.id, startedAt });
        } else {
            finalRun = finishRun({
                db,
                jobId: job.id,
                message: `Cron job "${job.id}" is disabled.`,
                runId: run.id,
                startedAt,
                status: 'skipped',
            });
        }
    } catch (error) {
        finalRun = finishRun({
            db,
            errorCode: 'execution_failed',
            jobId: job.id,
            message: readErrorMessage(error),
            runId: run.id,
            startedAt,
            status: 'error',
        });
        log.warn('Cron run failed', { err: error, jobId: job.id, runId: run.id });
    }

    if (job.deleteAfterRun) {
        deleteCronJob(job.id, db);
    }
    publishCronRunFinished(job.id, run.id);
    return agentRuntimeCronRunSchema.parse(finalRun);
}

async function runAgentTurnCron(input: {
    db: Database;
    job: NonNullable<ReturnType<typeof getCronJob>>;
    runId: string;
    startedAt: string;
}) {
    const messageId = createCronMessageId(input.runId);
    const accepted = await sendTavernChannelMessage(input.job.delivery.chatId, {
        agent: { agentId: input.job.agentId },
        message: {
            content: input.job.payload.kind === 'agentTurn' ? input.job.payload.message : '',
            id: messageId,
            metadata: {
                tavern: {
                    cronJobId: input.job.id,
                    cronRunId: input.runId,
                    source: 'cron',
                },
            },
            nonce: `cron:${input.runId}`,
        },
        target: {
            externalId: null,
            target: input.job.delivery.chatId,
            type: 'tavern',
        },
    });
    updateCronRun(input.runId, { turnId: accepted.runId }, input.db);
    const settled = await waitForAgentTurnSettlementBounded(accepted.runId);
    if (settled.status === 'completed') {
        return finishRun({
            db: input.db,
            jobId: input.job.id,
            runId: input.runId,
            startedAt: input.startedAt,
            status: 'success',
            turnId: accepted.runId,
        });
    }
    return finishRun({
        db: input.db,
        errorCode: 'execution_failed',
        jobId: input.job.id,
        message: settled.error ?? `Agent turn ${accepted.runId} ended with ${settled.status}.`,
        runId: input.runId,
        startedAt: input.startedAt,
        status: 'error',
        turnId: accepted.runId,
    });
}

// Turn runner enforces a 5 minute turn timeout; the margin covers settlement
// bookkeeping. Without a bound, one wedged turn blocks the cron worker forever.
const turnSettlementTimeoutMs = 6 * 60 * 1000;

async function waitForAgentTurnSettlementBounded(runId: string) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            waitForAgentTurnSettlement(runId),
            new Promise<{ error: string; status: 'failed' }>((resolve) => {
                timer = setTimeout(() => {
                    resolve({
                        error: `Timed out waiting for agent turn ${runId} to settle.`,
                        status: 'failed',
                    });
                }, turnSettlementTimeoutMs);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

function runSystemEventCron(input: {
    db: Database;
    job: NonNullable<ReturnType<typeof getCronJob>>;
    runId: string;
    startedAt: string;
}) {
    if (input.job.payload.kind !== 'systemEvent') {
        throw new Error('Cron payload is not a system event.');
    }
    createMessage(
        input.job.delivery.chatId,
        {
            author_id: createAgentParticipantId(input.job.agentId),
            content: input.job.payload.text,
            id: createCronMessageId(input.runId),
            metadata: {
                runtime: {
                    agentId: input.job.agentId,
                    cronJobId: input.job.id,
                    cronRunId: input.runId,
                    source: 'cron',
                },
            },
            nonce: `cron:${input.runId}`,
            role: 'assistant',
        },
        input.db
    );
    return finishRun({
        db: input.db,
        jobId: input.job.id,
        runId: input.runId,
        startedAt: input.startedAt,
        status: 'success',
    });
}

function finishRun(input: {
    db: Database;
    errorCode?: AgentRuntimeCronRun['executionErrorCode'];
    jobId: string;
    message?: string;
    runId: string;
    startedAt: string;
    status: AgentRuntimeCronRunStatus;
    turnId?: string;
}) {
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
            status: input.status,
            turnId: input.turnId,
        },
        input.db
    );
}

function publishCronRunStarted(cronJobId: string, runId: string) {
    publishRuntimeEvent({
        cronJobId,
        runId,
        timestamp: new Date().toISOString(),
        type: 'cron.runStarted',
    });
}

function publishCronRunFinished(cronJobId: string, runId: string) {
    publishRuntimeEvent({
        cronJobId,
        runId,
        timestamp: new Date().toISOString(),
        type: 'cron.runFinished',
    });
}

function readErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
