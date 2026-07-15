import { readConfigValue } from '../config.ts';
import { log } from '../log.ts';
import { scheduleMemoryExtractionForTurn } from '../memory/extraction.ts';
import { isTaskDispatchRun } from '../tasks/dispatch-store.ts';
import { recoverTaskDispatchForTurn } from '../tasks/recovery.ts';
import { createAgentEngineExecutor } from './agent-engine-executor.ts';
import type { AgentExecutor, AgentExecutorInput } from './agent-executor.ts';
import { readAgentSession } from './agent-session-store.ts';
import {
    cancelAgentTurn,
    claimNextAgentTurnForSeat,
    completeAgentTurn,
    createAgentTurn,
    failAgentTurn,
    getAgentTurn,
} from './agent-turn-store.ts';
import { upsertResponse } from './chat-api/index.ts';
import { collectAgentEvaluationDispatches } from './evaluation-dispatch.ts';
import { registerTurnDelivery } from './turn-delivery.ts';
import { recordAgentTurnOutcomeNote } from './turn-outcome-notes.ts';

interface ActiveTurn {
    input: AgentExecutorInput;
    seatKey: string;
}

type SettledTurnStatus = 'cancelled' | 'completed' | 'failed';

const defaultAgentTurnTimeoutMs = 5 * 60 * 1000;
// Dispatched task turns do real multi-minute work; they get a longer watchdog
// than interactive chat turns, which the user can see and stop directly.
const defaultTaskTurnTimeoutMs = 30 * 60 * 1000;
const activeTurns = new Map<string, ActiveTurn>();
const activeSeatRuns = new Map<string, string>();
const queuedTurnInputs = new Map<string, AgentExecutorInput>();
const turnWaiters = new Map<
    string,
    Array<(result: { error?: string; status: SettledTurnStatus }) => void>
>();
let executor: AgentExecutor = createAgentEngineExecutor();

export function enqueueAgentTurn(
    input: AgentExecutorInput,
    options: { turnMetadata?: Record<string, unknown> } = {}
) {
    queuedTurnInputs.set(input.runId, input);
    createAgentTurn({
        agentId: input.agent.id,
        agentParticipantId: input.agentSession.agentParticipantId,
        agentSessionId: input.agentSession.id,
        chatId: input.chatId,
        id: input.runId,
        metadata: {
            trigger: 'message',
            ...options.turnMetadata,
        },
        responseId: input.responseId,
        triggerMessageId: input.requestMessageId,
    });

    void drainAgentSeat(input);
}

export async function stopAgentTurn(runId: string) {
    const turn = getAgentTurn(runId);
    if (!(turn && ['queued', 'running'].includes(turn.status))) {
        return false;
    }

    const active = activeTurns.get(runId);
    const cancelled = cancelAgentTurn({ id: runId });
    if (!cancelled) {
        return false;
    }
    if (active) {
        await Promise.resolve(executor.stop?.(runId)).catch(() => {});
    }

    queuedTurnInputs.delete(runId);
    upsertResponse(cancelled.chatId, {
        completed_at: cancelled.completedAt ?? new Date().toISOString(),
        id: cancelled.responseId,
        metadata: {
            runtime: {
                agentId: cancelled.agentId,
                agentSessionId: cancelled.agentSessionId,
                engine: 'agent-engine',
                messageId: cancelled.triggerMessageId,
                runId: cancelled.id,
                source: 'agent-engine',
            },
        },
        participant_id: cancelled.agentParticipantId,
        request_message_id: cancelled.triggerMessageId,
        status: 'cancelled',
        summary: 'Turn stopped.',
    });

    if (active) {
        clearActiveTurn(runId, active.seatKey);
        notifyTurnSettled(runId, { status: 'cancelled' });
        void drainAgentSeat(active.input);
    } else {
        notifyTurnSettled(runId, { status: 'cancelled' });
    }
    recoverTaskDispatchForTurn(runId, { status: 'cancelled' });
    recordTurnOutcome(cancelled, { status: 'cancelled' });

    return true;
}

// Busy delivery reaches the current executor through the registry so the
// message fan-out module never imports the runner (specs/steering.md).
registerTurnDelivery((runId, text) => executor.deliverUserMessage?.(runId, text) ?? false);

export function waitForAgentTurnSettlement(runId: string): Promise<{
    error?: string;
    status: SettledTurnStatus;
}> {
    const existing = getAgentTurn(runId);
    if (existing && isSettledTurnStatus(existing.status)) {
        return Promise.resolve({
            error:
                typeof existing.metadata.error === 'string' ? existing.metadata.error : undefined,
            status: existing.status,
        });
    }

    return new Promise((resolve) => {
        const waiters = turnWaiters.get(runId) ?? [];
        waiters.push(resolve);
        turnWaiters.set(runId, waiters);
    });
}

export function resetAgentExecutorForTesting(nextExecutor?: AgentExecutor) {
    executor = nextExecutor ?? createAgentEngineExecutor();
    activeTurns.clear();
    activeSeatRuns.clear();
    queuedTurnInputs.clear();
}

export function setAgentExecutorForTesting(nextExecutor: AgentExecutor) {
    const previous = executor;
    executor = nextExecutor;
    return () => {
        executor = previous;
        activeTurns.clear();
        activeSeatRuns.clear();
        queuedTurnInputs.clear();
    };
}

async function drainAgentSeat(input: AgentExecutorInput) {
    const seatKey = agentSeatKey(input);
    if (activeSeatRuns.has(seatKey)) {
        return;
    }

    const turn = claimNextAgentTurnForSeat({
        agentParticipantId: input.agentSession.agentParticipantId,
        agentSessionId: input.agentSession.id,
        chatId: input.chatId,
    });
    if (!turn) {
        return;
    }

    const turnInput = withCurrentAgentSessionState(queuedTurnInputs.get(turn.id) ?? input);
    activeSeatRuns.set(seatKey, turn.id);
    activeTurns.set(turn.id, { input: turnInput, seatKey });

    try {
        const result = await executeAgentTurnWithTimeout(turnInput);
        const current = getAgentTurn(turn.id);
        if (current?.status === 'running') {
            const completedTurn = completeAgentTurn({
                activityIds: result.activityIds,
                id: turn.id,
                outputMessageIds: result.outputMessageIds,
            });
            notifyTurnSettled(turn.id, { status: 'completed' });
            recoverTaskDispatchForTurn(turn.id, { status: 'completed' });
            recordTurnOutcome(completedTurn, { status: 'completed' });
            try {
                scheduleMemoryExtractionForTurn(completedTurn);
            } catch {
                // Memory extraction is a best-effort background side effect.
            }
            try {
                // Every message this turn delivered dispatches evaluation
                // turns on the other agent seats. See specs/addressing.md.
                for (const dispatch of collectAgentEvaluationDispatches(completedTurn)) {
                    enqueueAgentTurn(dispatch.input, { turnMetadata: dispatch.turnMetadata });
                }
            } catch (error) {
                log.warn('Agent evaluation dispatch failed', { err: error, runId: turn.id });
            }
        }
    } catch (error) {
        const current = getAgentTurn(turn.id);
        if (current?.status === 'running') {
            const errorMessage = formatTurnError(error);
            const failedTurn = failAgentTurn({
                error: errorMessage,
                id: turn.id,
            });
            notifyTurnSettled(turn.id, { error: errorMessage, status: 'failed' });
            recoverTaskDispatchForTurn(turn.id, { error: errorMessage, status: 'failed' });
            recordTurnOutcome(failedTurn, { error: errorMessage, status: 'failed' });
            upsertResponse(turnInput.chatId, {
                id: turnInput.responseId,
                metadata: {
                    runtime: {
                        agentId: turnInput.agent.id,
                        agentSessionId: turnInput.agentSession.id,
                        engine: 'agent-engine',
                        messageId: turnInput.requestMessageId,
                        runId: turnInput.runId,
                        source: 'agent-engine',
                    },
                },
                participant_id: turnInput.agentSession.agentParticipantId,
                request_message_id: turnInput.requestMessageId,
                status: 'failed',
                summary: errorMessage,
            });
        }
    } finally {
        queuedTurnInputs.delete(turn.id);
        clearActiveTurn(turn.id, seatKey);
        void drainAgentSeat(turnInput);
    }
}

// Queued inputs are captured at enqueue time, often while the seat's prior
// turn is still running. The engine-session binding they carry (runtime
// session id, resume state, prompt cursor) goes stale the moment that turn
// settles — serialized seats exist to chain turn context, so the claimed
// turn re-reads its session row before executing.
function withCurrentAgentSessionState(input: AgentExecutorInput): AgentExecutorInput {
    const agentSession = readAgentSession(input.agentSession.id);
    return agentSession ? { ...input, agentSession } : input;
}

// Outcome notes are a best-effort signal back to the seat that dispatched
// this turn by mention; a write failure must not fail the settle path.
function recordTurnOutcome(
    turn: Parameters<typeof recordAgentTurnOutcomeNote>[0],
    result: Parameters<typeof recordAgentTurnOutcomeNote>[1]
) {
    try {
        recordAgentTurnOutcomeNote(turn, result);
    } catch (error) {
        log.warn('Turn outcome note was not recorded', { err: error, runId: turn.id });
    }
}

function notifyTurnSettled(
    runId: string,
    result: { error?: string; status: SettledTurnStatus }
): void {
    const waiters = turnWaiters.get(runId);
    if (!waiters) {
        return;
    }
    turnWaiters.delete(runId);
    for (const resolve of waiters) {
        resolve(result);
    }
}

function isSettledTurnStatus(status: string): status is SettledTurnStatus {
    return status === 'cancelled' || status === 'completed' || status === 'failed';
}

function clearActiveTurn(runId: string, seatKey: string) {
    activeTurns.delete(runId);
    if (activeSeatRuns.get(seatKey) === runId) {
        activeSeatRuns.delete(seatKey);
    }
}

function agentSeatKey(input: { agentSession: { id: string } }) {
    return input.agentSession.id;
}

function executeAgentTurnWithTimeout(input: AgentExecutorInput) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutMs = resolveAgentTurnTimeoutMs(input.runId);
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            void Promise.resolve(executor.stop?.(input.runId)).catch(() => {});
            reject(new Error(`Agent turn timed out after ${formatDuration(timeoutMs)}.`));
        }, timeoutMs);
        timer.unref?.();
    });

    return Promise.race([executor.execute(input), timeout]).finally(() => {
        if (timer) {
            clearTimeout(timer);
        }
    });
}

function resolveAgentTurnTimeoutMs(runId: string) {
    if (isTaskDispatchRun(runId)) {
        const configuredTask = Number(readConfigValue('TAVERN_TASK_TURN_TIMEOUT_MS'));
        return Number.isFinite(configuredTask) && configuredTask > 0
            ? configuredTask
            : defaultTaskTurnTimeoutMs;
    }
    const configured = Number(readConfigValue('TAVERN_AGENT_TURN_TIMEOUT_MS'));
    return Number.isFinite(configured) && configured > 0 ? configured : defaultAgentTurnTimeoutMs;
}

function formatDuration(ms: number) {
    if (ms % 60_000 === 0) {
        return `${ms / 60_000}m`;
    }
    if (ms % 1000 === 0) {
        return `${ms / 1000}s`;
    }
    return `${ms}ms`;
}

function formatTurnError(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
        return String(error);
    }
    if (error === null || error === undefined) {
        return 'Agent turn failed.';
    }
    try {
        return JSON.stringify(error);
    } catch {
        return 'Agent turn failed with an unserializable error.';
    }
}
