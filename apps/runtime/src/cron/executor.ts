import type { AgentRuntimeCronRun, AgentRuntimeCronRunTrigger } from '@tavern/api';
import { agentRuntimeCronRunSchema } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { log } from '../log.ts';
import { createAgentParticipantId } from '../tavern/chat-api/ids.ts';
import { createMessage } from '../tavern/chat-api/index.ts';
import { publishRuntimeEvent } from '../tavern/runtime-events.ts';
import { runCronAgentTurn } from './agent-turn-cron.ts';
import { createCronMessageId } from './ids.ts';
import { finishCronRun, readErrorMessage } from './run-lifecycle.ts';
import { runScriptCron } from './script-cron.ts';
import { validateCronDelivery } from './service.ts';
import {
    createCronRun,
    deleteCronJob,
    getCronJob,
    getCronRunOrThrow,
    markCronJobRunning,
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
            finalRun = await runCronPayload({ db, job, runId: run.id, startedAt });
        } else {
            finalRun = finishCronRun({
                db,
                jobId: job.id,
                message: `Cron job "${job.id}" is disabled.`,
                runId: run.id,
                startedAt,
                status: 'skipped',
            });
        }
    } catch (error) {
        finalRun = finishCronRun({
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

async function runCronPayload(input: {
    db: Database;
    job: NonNullable<ReturnType<typeof getCronJob>>;
    runId: string;
    startedAt: string;
}): Promise<AgentRuntimeCronRun> {
    const { db, job, runId, startedAt } = input;
    switch (job.payload.kind) {
        case 'agentTurn':
            return await runCronAgentTurn({
                db,
                job,
                message: job.payload.message,
                runId,
                startedAt,
            });
        case 'script':
            return await runScriptCron({ db, job, runId, startedAt });
        case 'systemEvent':
            return runSystemEventCron({ db, job, runId, startedAt });
        default:
            job.payload satisfies never;
            throw new Error('Unknown cron payload kind.');
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
    return finishCronRun({
        db: input.db,
        jobId: input.job.id,
        runId: input.runId,
        startedAt: input.startedAt,
        status: 'success',
    });
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
