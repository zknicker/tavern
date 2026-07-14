import type { AgentRuntimeCron, AgentRuntimeCronRun } from '@tavern/api';
import type { Database } from '../db/sqlite.ts';
import { waitForAgentTurnSettlement } from '../tavern/agent-turn-runner.ts';
import { sendTavernChannelMessage } from '../tavern/channel-relay.ts';
import { createCronMessageId } from './ids.ts';
import { finishCronRun } from './run-lifecycle.ts';
import { updateCronRun } from './store.ts';

/**
 * Delivers a message into the job's chat as the automation and waits for the
 * dispatched agent turn to settle. Used by agent-mode payloads and by script
 * runs whose stdout escalated into an alert.
 */
export async function runCronAgentTurn(input: {
    db: Database;
    job: AgentRuntimeCron;
    message: string;
    runId: string;
    script?: { exitCode: number | null; stderr: string | null };
    startedAt: string;
}): Promise<AgentRuntimeCronRun> {
    const messageId = createCronMessageId(input.runId);
    const accepted = await sendTavernChannelMessage(input.job.delivery.chatId, {
        agent: { agentId: input.job.agentId },
        message: {
            content: input.message,
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
        return finishCronRun({
            db: input.db,
            jobId: input.job.id,
            runId: input.runId,
            scriptExitCode: input.script?.exitCode,
            scriptStderr: input.script?.stderr,
            startedAt: input.startedAt,
            status: 'success',
            turnId: accepted.runId,
        });
    }
    return finishCronRun({
        db: input.db,
        errorCode: 'execution_failed',
        jobId: input.job.id,
        message: settled.error ?? `Agent turn ${accepted.runId} ended with ${settled.status}.`,
        runId: input.runId,
        scriptExitCode: input.script?.exitCode,
        scriptStderr: input.script?.stderr,
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
