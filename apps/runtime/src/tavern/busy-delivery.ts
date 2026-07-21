import type { TavernChatEvent, TavernChatMessage } from '@tavern/api';
import { log } from '../log.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import { type AgentTurn, findRunningAgentTurnForAgent } from './agent-turn-store.ts';
import { getChat, subscribeToTavernApiEvents, upsertResponseActivity } from './chat-api/index.ts';
import { formatPromptMessage } from './harness-prompt.ts';
import { deliverToActiveTurn } from './turn-delivery.ts';

// Busy delivery (specs/steering.md): when a durable message lands in a chat,
// every running turn in that chat gets a compact notice through its engine
// session so the agent can incorporate it before finishing. Delivery is an
// optimization — the seat's context cursor guarantees the message reaches
// the next prompt regardless — so every failure path here is silent.

const maxTrackedRuns = 512;

// Per-chat sequences delivered into each running turn, for repeat-notice
// dedupe. Keyed by (runId, chatId) because one running turn receives busy
// deliveries from every chat the agent sits in and sequences are per-chat
// counters. Deliveries never advance the seen ledger: engines apply
// injected input at their own boundary — sometimes only on the next turn —
// so an accepted delivery is not provably visible to the current reply.
// The freshness gate and send hold stay the provable paths.
const deliveredSequences = new Map<string, Set<number>>();

function deliveryKey(runId: string, chatId: string) {
    return `${runId}\u0000${chatId}`;
}

export function installBusyDelivery() {
    return subscribeToTavernApiEvents((event) => {
        const message = messageFromEvent(event);
        if (!message) {
            return;
        }
        deliverToBusySeats(event.chat_id, message).catch((error) => {
            log.warn('Busy delivery failed', { err: error, messageId: message.id });
        });
    });
}

export async function deliverToBusySeats(chatId: string, message: TavernChatMessage) {
    if (message.deleted_at || (message.role !== 'assistant' && message.role !== 'user')) {
        return [];
    }

    const delivered: string[] = [];
    for (const agentId of chatAgentIds(chatId)) {
        const turn = findRunningAgentTurnForAgent(agentId);
        if (
            !turn ||
            isTurnAuthor(turn, message) ||
            hasDelivered(turn.id, chatId, message.sequence)
        ) {
            continue;
        }
        const accepted = await deliverToActiveTurn(
            turn.id,
            busyDeliveryNotice(message, chatId, turn.chatId)
        );
        if (!accepted) {
            continue;
        }
        trackDelivered(turn.id, chatId, message.sequence);
        recordBusyDeliveryEvidence(turn, message);
        delivered.push(turn.id);
    }
    return delivered;
}

export function resetBusyDeliveryForTesting() {
    deliveredSequences.clear();
}

function busyDeliveryNotice(message: TavernChatMessage, chatId: string, turnChatId: string) {
    const line = formatPromptMessage(message, resolveHomeTimezone());
    const where =
        chatId === turnChatId
            ? 'new message in this chat while your turn runs:'
            : `new message in "${getChat(chatId)?.title ?? chatId}" (chatId: ${chatId}) while your turn runs:`;
    return [
        `[Grotto: ${where}`,
        line,
        'Read it now and account for it before you finish — do not answer as if you had not seen it. Your reply still answers the original message.]',
    ].join('\n');
}

function chatAgentIds(chatId: string) {
    const ids = new Set<string>();
    for (const participant of getChat(chatId)?.participants ?? []) {
        if (participant.kind !== 'agent') {
            continue;
        }
        const agentId = (participant.metadata as Record<string, unknown>).agentId;
        ids.add(typeof agentId === 'string' && agentId.length > 0 ? agentId : participant.id);
    }
    return ids;
}

function isTurnAuthor(turn: AgentTurn, message: TavernChatMessage) {
    return message.author.id === turn.agentParticipantId || message.author.id === turn.agentId;
}

function hasDelivered(runId: string, chatId: string, sequence: number) {
    return deliveredSequences.get(deliveryKey(runId, chatId))?.has(sequence) === true;
}

function trackDelivered(runId: string, chatId: string, sequence: number) {
    const key = deliveryKey(runId, chatId);
    const sequences = deliveredSequences.get(key) ?? new Set<number>();
    sequences.add(sequence);
    deliveredSequences.set(key, sequences);
    if (deliveredSequences.size <= maxTrackedRuns) {
        return;
    }
    const oldest = deliveredSequences.keys().next().value;
    if (oldest !== undefined) {
        deliveredSequences.delete(oldest);
    }
}

function messageFromEvent(event: TavernChatEvent): TavernChatMessage | null {
    if (event.type === 'message.created') {
        return event.message;
    }
    if (event.type === 'message.delivered') {
        return event.delivery.message;
    }
    return null;
}

function recordBusyDeliveryEvidence(turn: AgentTurn, message: TavernChatMessage) {
    const now = new Date().toISOString();
    const label = message.author.label ?? message.author.id;
    const text = `New message from ${label} was delivered into the running turn.`;
    upsertResponseActivity(turn.chatId, turn.responseId, {
        completed_at: now,
        detail: text,
        id: `act_${turn.id}_busy_delivery_${message.sequence}`.replace(/[^A-Za-z0-9_-]/g, '_'),
        kind: 'custom',
        metadata: {
            runtime: {
                agentId: turn.agentId,
                engine: 'agent-engine',
                messageId: message.id,
                notice: {
                    detail: text,
                    id: 'runtime_notice_busy_delivery',
                    kind: 'status',
                    sessionId: turn.agentSessionId,
                    text,
                    title: 'Delivered mid-turn',
                },
                runId: turn.id,
                sequence: message.sequence,
                source: 'agent-engine',
            },
        },
        started_at: now,
        status: 'completed',
        title: 'Delivered mid-turn',
    });
}
