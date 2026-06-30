import { createAgentEngineExecutor } from './agent-engine-executor.ts';
import type { AgentExecutor, AgentExecutorInput } from './agent-executor';
import {
    cancelAgentTurn,
    claimNextAgentTurnForSeat,
    completeAgentTurn,
    createAgentTurn,
    failAgentTurn,
    getAgentTurn,
} from './agent-turn-store';
import { upsertResponse } from './chat-api/index';

interface ActiveTurn {
    input: AgentExecutorInput;
    seatKey: string;
}

const activeTurns = new Map<string, ActiveTurn>();
const activeSeatRuns = new Map<string, string>();
const queuedTurnInputs = new Map<string, AgentExecutorInput>();
let executor: AgentExecutor = createAgentEngineExecutor();

export function enqueueAgentTurn(input: AgentExecutorInput) {
    queuedTurnInputs.set(input.runId, input);
    createAgentTurn({
        agentId: input.agent.id,
        agentParticipantId: input.agentSession.agentParticipantId,
        agentSessionId: input.agentSession.id,
        chatId: input.chatId,
        id: input.runId,
        metadata: {
            trigger: 'message',
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
    if (active) {
        await executor.stop?.(runId);
    }

    const cancelled = cancelAgentTurn({ id: runId });
    if (!cancelled) {
        return false;
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
        void drainAgentSeat(active.input);
    }

    return true;
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

    const turnInput = queuedTurnInputs.get(turn.id) ?? input;
    activeSeatRuns.set(seatKey, turn.id);
    activeTurns.set(turn.id, { input: turnInput, seatKey });

    try {
        const result = await executor.execute(turnInput);
        const current = getAgentTurn(turn.id);
        if (current?.status === 'running') {
            completeAgentTurn({
                activityIds: result.activityIds,
                id: turn.id,
                outputMessageIds: result.outputMessageIds,
            });
        }
    } catch (error) {
        const current = getAgentTurn(turn.id);
        if (current?.status === 'running') {
            const errorMessage = formatTurnError(error);
            failAgentTurn({
                error: errorMessage,
                id: turn.id,
            });
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

function clearActiveTurn(runId: string, seatKey: string) {
    activeTurns.delete(runId);
    if (activeSeatRuns.get(seatKey) === runId) {
        activeSeatRuns.delete(seatKey);
    }
}

function agentSeatKey(input: { agentSession: { id: string } }) {
    return input.agentSession.id;
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
