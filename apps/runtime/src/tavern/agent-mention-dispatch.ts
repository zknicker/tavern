import { parseAgentReferenceTarget, parseTavernRichReferences } from '@tavern/api';
import { resolveAgentModelSelection } from '../models/selection-service.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import type { AgentTurn } from './agent-turn-store.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId, createRunId } from './chat-api/ids.ts';
import { getChat, getMessage, upsertResponse, upsertResponseActivity } from './chat-api/index.ts';
import { ensureFreshAgentSession } from './session-freshness.ts';

// See specs/agent-mentions.md. An agent's delivered final reply can mention
// other agent participants; each mention dispatches a turn on that seat.
// Two guards bound every chain: a hop cap (depth) and a per-origin budget
// (total dispatched mention turns from one founding trigger message).
const maxMentionHops = 4;
const mentionChainBudget = 8;
const maxTrackedChains = 256;

export interface AgentMentionDispatch {
    input: AgentExecutorInput;
    turnMetadata: Record<string, unknown>;
}

const chainSpend = new Map<string, number>();

/**
 * Reads the completed turn's delivered final reply and prepares one dispatch
 * per mentioned co-resident agent, writing running responses for dispatched
 * turns and suppression notices for mentions past the chain limits. The
 * caller enqueues the returned inputs; this module never runs turns itself.
 */
export function collectAgentMentionDispatches(turn: AgentTurn): AgentMentionDispatch[] {
    const finalMessageId = turn.outputMessageIds.at(-1);
    if (!finalMessageId) {
        return [];
    }
    const message = getMessage(finalMessageId);
    if (!message || message.role !== 'assistant' || !message.content) {
        return [];
    }

    const mentionedAgentIds = readMentionedAgentIds(message.content).filter(
        (agentId) => agentId !== turn.agentId
    );
    if (mentionedAgentIds.length === 0) {
        return [];
    }

    const chatAgentIds = readChatAgentIds(turn.chatId);
    const targets = mentionedAgentIds.filter((agentId) => chatAgentIds.has(agentId));
    if (targets.length === 0) {
        return [];
    }

    const hops = readHops(turn.metadata);
    const origin = readChainOrigin(turn);
    if (hops >= maxMentionHops) {
        for (const agentId of targets) {
            recordSuppressionNotice(turn, agentId, 'chain depth limit reached');
        }
        return [];
    }

    const dispatches: AgentMentionDispatch[] = [];
    for (const agentId of targets) {
        if ((chainSpend.get(origin) ?? 0) >= mentionChainBudget) {
            recordSuppressionNotice(turn, agentId, 'chain budget exhausted');
            continue;
        }
        const dispatch = prepareDispatch({
            agentId,
            chatId: turn.chatId,
            content: message.content,
            hops,
            origin,
            triggerMessageId: finalMessageId,
        });
        if (!dispatch) {
            continue;
        }
        spendChainBudget(origin);
        dispatches.push(dispatch);
    }
    return dispatches;
}

export function resetAgentMentionChainsForTesting() {
    chainSpend.clear();
}

function prepareDispatch(input: {
    agentId: string;
    chatId: string;
    content: string;
    hops: number;
    origin: string;
    triggerMessageId: string;
}): AgentMentionDispatch | null {
    const storedAgent = getStoredAgent(input.agentId);
    if (!storedAgent) {
        return null;
    }

    const acceptedAt = new Date().toISOString();
    ensureFreshAgentSession({ agentId: input.agentId, chatId: input.chatId });
    const agentSession = ensureCurrentAgentSession({
        agentParticipantId: input.agentId,
        chatId: input.chatId,
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
            agentSession,
            attachments: [],
            chatId: input.chatId,
            content: input.content,
            requestMessageId: input.triggerMessageId,
            responseId,
            runId,
        },
        turnMetadata: {
            chainOriginMessageId: input.origin,
            mentionHops: input.hops + 1,
            trigger: 'agent-mention',
        },
    };
}

function readMentionedAgentIds(content: string) {
    const ids: string[] = [];
    for (const reference of parseTavernRichReferences(content)) {
        if (reference.kind !== 'agent') {
            continue;
        }
        const agentId = parseAgentReferenceTarget(reference.id);
        if (agentId && !ids.includes(agentId)) {
            ids.push(agentId);
        }
    }
    return ids;
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
    const hops = metadata.mentionHops;
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
    const text = `Mention of ${targetName} was not dispatched: ${reason}.`;
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
                    id: 'runtime_notice_mention_suppressed',
                    kind: 'status',
                    sessionId: turn.agentSessionId,
                    text,
                    title: 'Mention not dispatched',
                },
                runId: turn.id,
                source: 'agent-engine',
            },
        },
        started_at: now,
        status: 'completed',
        title: 'Mention not dispatched',
    });
}

function suppressionActivityId(runId: string, agentId: string) {
    return `act_${runId}_mention_suppressed_${agentId}`.replace(/[^A-Za-z0-9_-]/g, '_');
}
