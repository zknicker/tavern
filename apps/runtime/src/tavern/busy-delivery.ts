import type { TavernChatEvent, TavernChatMessage } from '@tavern/api';
import { log } from '../log.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import { type AgentTurn, listRunningAgentTurnsForChat } from './agent-turn-store.ts';
import { subscribeToTavernApiEvents, upsertResponseActivity } from './chat-api/index.ts';
import { formatPromptMessage } from './harness-prompt.ts';
import { deliverToActiveTurn } from './turn-delivery.ts';

// Busy delivery (specs/steering.md): when a durable message lands in a chat,
// every running turn in that chat gets a compact notice through its engine
// session so the agent can incorporate it before finishing. Delivery is an
// optimization — the seat's context cursor guarantees the message reaches
// the next prompt regardless — so every failure path here is silent.

const maxTrackedRuns = 512;

// Sequences delivered into each running turn: dedupes repeat notices and
// feeds the freshness gate's seen horizon at turn end.
const deliveredSequences = new Map<string, Set<number>>();

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
    for (const turn of listRunningAgentTurnsForChat(chatId)) {
        if (isTurnAuthor(turn, message) || hasDelivered(turn.id, message.sequence)) {
            continue;
        }
        const accepted = await deliverToActiveTurn(turn.id, busyDeliveryNotice(message));
        if (!accepted) {
            continue;
        }
        trackDelivered(turn.id, message.sequence);
        recordBusyDeliveryEvidence(turn, message);
        delivered.push(turn.id);
    }
    return delivered;
}

/** Consumed by the freshness gate: sequences this run saw mid-turn. */
export function takeDeliveredSequences(runId: string) {
    const sequences = deliveredSequences.get(runId);
    deliveredSequences.delete(runId);
    return sequences ? [...sequences] : [];
}

export function resetBusyDeliveryForTesting() {
    deliveredSequences.clear();
}

function busyDeliveryNotice(message: TavernChatMessage) {
    const line = formatPromptMessage(message, resolveHomeTimezone());
    return [
        '[Tavern: new message in this chat while your turn runs:',
        line,
        'Incorporate what matters before finishing; your reply still answers the original message.]',
    ].join('\n');
}

function isTurnAuthor(turn: AgentTurn, message: TavernChatMessage) {
    return message.author.id === turn.agentParticipantId || message.author.id === turn.agentId;
}

function hasDelivered(runId: string, sequence: number) {
    return deliveredSequences.get(runId)?.has(sequence) === true;
}

function trackDelivered(runId: string, sequence: number) {
    const sequences = deliveredSequences.get(runId) ?? new Set<number>();
    sequences.add(sequence);
    deliveredSequences.set(runId, sequences);
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
