import { resolveAgentModelSelection } from '../models/selection-service.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import type { AgentTurn } from './agent-turn-store.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createRunId } from './chat-api/ids.ts';
import {
    getChat,
    getMessage,
    listDeliveriesForTurn,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api/index.ts';
import { ensureFreshAgentSession } from './session-freshness.ts';

// Default-evaluate addressing (specs/addressing.md): every message a
// completed turn delivered into a chat — the final reply in its own chat and
// any cross-chat posts — dispatches an evaluation turn to every other agent
// seat of that chat. Mentions set expectation in the prompt, never routing.
// Two guards bound every chain regardless of which chats it crosses: a hop
// cap (depth) and a per-origin budget (total dispatched evaluation turns
// from one founding trigger message).
const maxChainHops = 4;
// Tuned for small channels: any agent reply in an N-agent chat spends N-1
// budget at once, so chatter exhausts chains in a few rounds by design.
const evaluationChainBudget = 16;
const maxTrackedChains = 256;

export interface AgentEvaluationDispatch {
    input: AgentExecutorInput;
    turnMetadata: Record<string, unknown>;
}

const chainSpend = new Map<string, number>();

/**
 * Reads the completed turn's cross-chat posts and delivered final reply, and
 * prepares one evaluation dispatch per other agent seat of the chat each
 * message landed in — writing running responses for dispatched turns and
 * suppression notices past the chain limits. The caller enqueues the
 * returned inputs; this module never runs turns itself.
 */
export function collectAgentEvaluationDispatches(turn: AgentTurn): AgentEvaluationDispatch[] {
    const candidates = dispatchCandidates(turn);
    if (candidates.length === 0) {
        return [];
    }

    const hops = readHops(turn.metadata);
    const origin = readChainOrigin(turn);
    const dispatches: AgentEvaluationDispatch[] = [];
    const seenSeats = new Set<string>();
    for (const candidate of candidates) {
        for (const agentId of readChatAgentIds(candidate.chatId)) {
            const seatKey = `${candidate.chatId}:${agentId}`;
            if (agentId === turn.agentId || seenSeats.has(seatKey)) {
                continue;
            }
            seenSeats.add(seatKey);
            if (hops >= maxChainHops) {
                recordSuppressionNotice(turn, agentId, 'chain depth limit reached');
                continue;
            }
            if ((chainSpend.get(origin) ?? 0) >= evaluationChainBudget) {
                recordSuppressionNotice(turn, agentId, 'chain budget exhausted');
                continue;
            }
            const dispatch = prepareDispatch({
                agentId,
                chatId: candidate.chatId,
                content: candidate.content,
                dispatchedBy: { agentId: turn.agentId, chatId: turn.chatId, runId: turn.id },
                hops,
                origin,
                triggerMessageId: candidate.messageId,
            });
            if (!dispatch) {
                continue;
            }
            spendChainBudget(origin);
            dispatches.push(dispatch);
        }
    }
    return dispatches;
}

// Messages this turn placed into chats, in the order they landed: cross-chat
// posts first (they happened mid-turn), then the final reply in the turn's
// own chat.
function dispatchCandidates(turn: AgentTurn) {
    const candidates: Array<{ chatId: string; content: string; messageId: string }> = [];
    for (const delivery of listDeliveriesForTurn(turn.id)) {
        if (delivery.chatId === turn.chatId) {
            continue;
        }
        const message = getMessage(delivery.messageId);
        if (message?.role === 'assistant' && message.content && !message.deleted_at) {
            candidates.push({
                chatId: delivery.chatId,
                content: message.content,
                messageId: message.id,
            });
        }
    }
    const finalMessageId = turn.outputMessageIds.at(-1);
    if (finalMessageId) {
        const message = getMessage(finalMessageId);
        if (message?.role === 'assistant' && message.content && !message.deleted_at) {
            candidates.push({
                chatId: turn.chatId,
                content: message.content,
                messageId: finalMessageId,
            });
        }
    }
    return candidates;
}

export function resetEvaluationChainsForTesting() {
    chainSpend.clear();
}

function prepareDispatch(input: {
    agentId: string;
    chatId: string;
    content: string;
    dispatchedBy: { agentId: string; chatId: string; runId: string };
    hops: number;
    origin: string;
    triggerMessageId: string;
}): AgentEvaluationDispatch | null {
    const storedAgent = getStoredAgent(input.agentId);
    if (!storedAgent) {
        return null;
    }

    const acceptedAt = new Date().toISOString();
    ensureFreshAgentSession({ agentId: input.agentId });
    const agentSession = ensureCurrentAgentSession({
        agentId: input.agentId,
        now: acceptedAt,
    });
    const runId = createRunId(input.triggerMessageId, input.agentId);
    const responseId = `rsp_${runId.replace(/[^A-Za-z0-9_-]/g, '_')}`;

    upsertResponse(input.chatId, {
        id: responseId,
        metadata: {
            runtime: {
                agentId: input.agentId,
                agentSessionId: agentSession.id,
                engine: 'agent-engine',
                messageId: input.triggerMessageId,
                runId,
                source: 'agent-engine',
                startedAt: acceptedAt,
                // Peer-evaluation turns render quietly until they stream
                // reply text (specs/addressing.md).
                trigger: 'evaluation',
            },
        },
        participant_id: createAgentParticipantId(input.agentId),
        request_message_id: input.triggerMessageId,
        status: 'running',
    });

    return {
        input: {
            agent: {
                ...storedAgent,
                modelName:
                    agentSession.effectiveModel ??
                    resolveAgentModelSelection({ agentId: input.agentId }),
            },
            agentParticipantId: createAgentParticipantId(input.agentId),
            agentSession,
            attachments: [],
            chatId: input.chatId,
            content: input.content,
            requestMessageId: input.triggerMessageId,
            responseId,
            runId,
        },
        turnMetadata: {
            chainHops: input.hops + 1,
            chainOriginMessageId: input.origin,
            // The dispatching agent's seat; its next prompt receives a
            // compact outcome note when this evaluation turn settles.
            dispatchedBy: input.dispatchedBy,
            trigger: 'evaluation',
        },
    };
}

function readChatAgentIds(chatId: string) {
    const chat = getChat(chatId);
    const ids = new Set<string>();
    for (const participant of chat?.participants ?? []) {
        if (participant.kind !== 'agent') {
            continue;
        }
        const agentId = participant.metadata.agentId;
        ids.add(typeof agentId === 'string' && agentId.length > 0 ? agentId : participant.id);
    }
    return ids;
}

function readHops(metadata: Record<string, unknown>) {
    const hops = metadata.chainHops;
    return typeof hops === 'number' && Number.isFinite(hops) && hops > 0 ? Math.floor(hops) : 0;
}

function readChainOrigin(turn: AgentTurn) {
    const origin = turn.metadata.chainOriginMessageId;
    return typeof origin === 'string' && origin.length > 0 ? origin : turn.triggerMessageId;
}

function spendChainBudget(origin: string) {
    chainSpend.set(origin, (chainSpend.get(origin) ?? 0) + 1);
    if (chainSpend.size <= maxTrackedChains) {
        return;
    }
    const oldest = chainSpend.keys().next().value;
    if (oldest !== undefined) {
        chainSpend.delete(oldest);
    }
}

function recordSuppressionNotice(turn: AgentTurn, agentId: string, reason: string) {
    const targetName = getStoredAgent(agentId)?.name ?? agentId;
    const now = new Date().toISOString();
    const text = `Evaluation by ${targetName} was not dispatched: ${reason}.`;
    upsertResponseActivity(turn.chatId, turn.responseId, {
        completed_at: now,
        detail: text,
        id: suppressionActivityId(turn.id, agentId),
        kind: 'custom',
        metadata: {
            runtime: {
                agentId: turn.agentId,
                engine: 'agent-engine',
                messageId: turn.triggerMessageId,
                notice: {
                    detail: text,
                    id: 'runtime_notice_evaluation_suppressed',
                    kind: 'status',
                    sessionId: turn.agentSessionId,
                    text,
                    title: 'Evaluation not dispatched',
                },
                runId: turn.id,
                source: 'agent-engine',
            },
        },
        started_at: now,
        status: 'completed',
        title: 'Evaluation not dispatched',
    });
}

function suppressionActivityId(runId: string, agentId: string) {
    return `act_${runId}_evaluation_suppressed_${agentId}`.replace(/[^A-Za-z0-9_-]/g, '_');
}
