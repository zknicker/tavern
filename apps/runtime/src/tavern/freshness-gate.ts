import type { TavernChatMessage } from '@tavern/api';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import {
    getChat,
    latestMessageSequence,
    listRecentMessagesBetween,
    upsertResponseActivity,
} from './chat-api/index.ts';
import { formatPromptMessage, promptCursorSequence } from './harness-prompt.ts';
import { advanceSeenCursor, readSeenCursor } from './seen-ledger.ts';

// Freshness gate (specs/steering.md): a completed channel reply is held when
// peer messages the turn never saw landed while it worked. The held turn gets
// one continuation showing those rows plus its draft, and decides to deliver,
// revise, or decline — the mechanical dedupe that lets several agents
// evaluate one message without piling on answers. One hold per turn; DMs
// skip the gate because a 1:1 reply is never made redundant by a peer.

const maxHoldContextMessages = 12;

export interface FreshnessHold {
    prompt: string;
    unseen: TavernChatMessage[];
}

/**
 * Decides whether a drafted reply is stale against the seen ledger: any
 * peer rows in the trigger chat past the cursor (prompt catch-up advances
 * it; busy deliveries are hints and do not). Showing the held rows
 * advances the cursor — the hold envelope makes them model-visible
 * (specs/sessions.md).
 */
export function resolveFreshnessHold(
    input: AgentExecutorInput,
    draft: string
): FreshnessHold | null {
    const chat = getChat(input.chatId);
    if (chat?.kind !== 'channel') {
        return null;
    }

    const seenHorizon = Math.max(
        promptCursorSequence(input),
        readSeenCursor(input.agentSession.id, input.chatId)
    );
    const latest = latestMessageSequence(input.chatId);
    if (latest <= seenHorizon) {
        return null;
    }

    const unseen = listRecentMessagesBetween(input.chatId, {
        afterSequence: seenHorizon,
        beforeSequence: latest + 1,
        limit: maxHoldContextMessages,
    }).filter((message) => isPeerMessage(input, message));
    if (unseen.length === 0) {
        return null;
    }

    const shownThrough = unseen.at(-1)?.sequence;
    if (shownThrough) {
        advanceSeenCursor({
            chatId: input.chatId,
            seq: shownThrough,
            sessionId: input.agentSession.id,
        });
    }
    return { prompt: holdPrompt(unseen, draft), unseen };
}

export function recordFreshnessHoldNotice(input: AgentExecutorInput, hold: FreshnessHold) {
    const now = new Date().toISOString();
    const count = hold.unseen.length;
    const text = `Reply held for freshness review: ${count} new ${count === 1 ? 'message' : 'messages'} landed during the turn.`;
    upsertResponseActivity(input.chatId, input.responseId, {
        completed_at: now,
        detail: text,
        id: `act_${input.runId}_freshness_hold`.replace(/[^A-Za-z0-9_-]/g, '_'),
        kind: 'custom',
        metadata: {
            runtime: {
                agentId: input.agent.id,
                engine: 'agent-engine',
                messageId: input.requestMessageId,
                notice: {
                    detail: text,
                    id: 'runtime_notice_freshness_hold',
                    kind: 'status',
                    sessionId: input.agentSession.id,
                    text,
                    title: 'Reply held for freshness review',
                },
                runId: input.runId,
                source: 'agent-engine',
                unseenSequences: hold.unseen.map((message) => message.sequence),
            },
        },
        started_at: now,
        status: 'completed',
        title: 'Reply held for freshness review',
    });
}

function isPeerMessage(input: AgentExecutorInput, message: TavernChatMessage) {
    if (message.deleted_at || (message.role !== 'assistant' && message.role !== 'user')) {
        return false;
    }
    return message.author.id !== input.agentParticipantId && message.author.id !== input.agent.id;
}

function holdPrompt(unseen: TavernChatMessage[], draft: string) {
    const timezone = resolveHomeTimezone();
    return [
        '[Tavern: your reply was held for freshness — these messages landed while you worked:',
        ...unseen.map((message) => formatPromptMessage(message, timezone)),
        'Your held reply:',
        '"""',
        draft,
        '"""',
        'Reply now with the final message to deliver: repeat the held reply to send it unchanged, revise it, or reply exactly NO_REPLY if it is now redundant.]',
    ].join('\n');
}
