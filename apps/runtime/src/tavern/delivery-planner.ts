import type { TavernChatEvent, TavernChatMessage } from '@tavern/api';
import { log } from '../log.ts';
import {
    attentionParentChatId,
    isChannelMuted,
    isThreadFollowed,
    messageMentionsAgent,
} from './agent-attention.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { getChat, membershipChat, subscribeToTavernApiEvents } from './chat-api/index.ts';
import { advanceDeliveredCursor, recordInboxPierce } from './inbox-cursors.ts';

// Delivery planner (I1): a durable message lands → it is queued per
// attention rules — ordinary delivery covers joined channels, followed
// threads, and DMs; a channel mute suppresses the channel and its threads;
// personal @mentions pierce mutes/unfollows as single messages that do not
// re-follow. Muted targets never advance `delivered`. The planner then wakes
// idle agents (drain turns) and hands busy agents to the content-free notice
// pipeline. This replaces per-message evaluation dispatch.

export interface InboxWakeSink {
    /** Called after planning when the target agent has pending inbox rows. */
    wakeAgent(agentId: string): void;
}

let wakeSink: InboxWakeSink | null = null;

export function registerInboxWakeSink(sink: InboxWakeSink | null) {
    wakeSink = sink;
}

export function installInboxDelivery() {
    return subscribeToTavernApiEvents((event) => {
        const message = messageFromEvent(event);
        if (!message) {
            return;
        }
        try {
            planMessageDelivery(event.chat_id, message);
        } catch (error) {
            log.warn('Inbox delivery planning failed', { err: error, messageId: message.id });
        }
    });
}

export function planMessageDelivery(chatId: string, message: TavernChatMessage) {
    if (message.deleted_at) {
        return;
    }
    if (message.role !== 'assistant' && message.role !== 'user' && message.role !== 'system') {
        return;
    }
    const chat = getChat(chatId);
    if (!chat || chat.kind === 'task') {
        return;
    }
    const seatChat = membershipChat(chat) ?? chat;
    const woken = new Set<string>();
    for (const participant of seatChat.participants) {
        if (participant.kind !== 'agent') {
            continue;
        }
        const metadataAgentId = participant.metadata.agentId;
        const agentId =
            typeof metadataAgentId === 'string' && metadataAgentId.length > 0
                ? metadataAgentId
                : participant.id;
        const agent = getStoredAgent(agentId);
        if (!agent || isMessageAuthor(message, agentId)) {
            continue;
        }
        const participantId = createAgentParticipantId(agentId);
        const session = ensureCurrentAgentSession({ agentId });
        const muted = isChannelMuted({ agentId, chatId: attentionParentChatId(chat) });
        const ordinary =
            chat.kind === 'thread'
                ? !muted && isThreadFollowed({ participantId, threadChatId: chat.id })
                : chat.kind === 'dm' || !muted;

        if (ordinary) {
            advanceDeliveredCursor({
                chatId: chat.id,
                seq: message.sequence,
                sessionId: session.id,
            });
        } else if (messageMentionsAgent(message, agent)) {
            // Personal mentions pierce as single messages; the muted target's
            // delivered cursor stays frozen and nothing re-follows (I1).
            recordInboxPierce({
                chatId: chat.id,
                messageId: message.id,
                sessionId: session.id,
            });
        } else {
            continue;
        }
        if (!woken.has(agentId)) {
            woken.add(agentId);
            wakeSink?.wakeAgent(agentId);
        }
    }
}

function isMessageAuthor(message: TavernChatMessage, agentId: string) {
    return message.author.id === agentId || message.author.id === createAgentParticipantId(agentId);
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
