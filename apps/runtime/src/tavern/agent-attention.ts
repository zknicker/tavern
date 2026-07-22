import type { TavernChat, TavernChatMessage } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { countFormalMentions } from './agent-messages.ts';

// Attention state (I1): channel mutes are agent-owned; thread attention is
// the follow record (chat-api/threads.ts). Humans steer agent attention by
// asking in chat — there are no human-side mute controls for agents (I4).

export function muteChannel(
    input: { agentId: string; chatId: string; now?: string },
    db: Database = getDb()
) {
    db.prepare(
        `INSERT OR IGNORE INTO agent_channel_mutes (agent_id, chat_id, created_at)
         VALUES ($agentId, $chatId, $now)`
    ).run(
        namedParams({
            agentId: input.agentId,
            chatId: input.chatId,
            now: input.now ?? new Date().toISOString(),
        })
    );
}

export function unmuteChannel(input: { agentId: string; chatId: string }, db: Database = getDb()) {
    db.prepare(
        'DELETE FROM agent_channel_mutes WHERE agent_id = $agentId AND chat_id = $chatId'
    ).run(namedParams({ agentId: input.agentId, chatId: input.chatId }));
}

export function isChannelMuted(input: { agentId: string; chatId: string }, db: Database = getDb()) {
    const row = db
        .prepare(
            `SELECT 1 AS present FROM agent_channel_mutes
             WHERE agent_id = $agentId AND chat_id = $chatId LIMIT 1`
        )
        .get(namedParams({ agentId: input.agentId, chatId: input.chatId })) as {
        present: number;
    } | null;
    return Boolean(row);
}

export function listMutedChannelIds(agentId: string, db: Database = getDb()) {
    const rows = db
        .prepare('SELECT chat_id FROM agent_channel_mutes WHERE agent_id = $agentId')
        .all(namedParams({ agentId })) as Array<{ chat_id: string }>;
    return rows.map((row) => row.chat_id);
}

export function isThreadFollowed(
    input: { participantId: string; threadChatId: string },
    db: Database = getDb()
) {
    const row = db
        .prepare(
            `SELECT followed FROM thread_follows
             WHERE thread_chat_id = $threadChatId AND participant_id = $participantId
             LIMIT 1`
        )
        .get(
            namedParams({
                participantId: input.participantId,
                threadChatId: input.threadChatId,
            })
        ) as { followed: number } | null;
    return row?.followed === 1;
}

export function listFollowedThreadIds(participantId: string, db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT thread_chat_id FROM thread_follows
             WHERE participant_id = $participantId AND followed = 1`
        )
        .all(namedParams({ participantId })) as Array<{ thread_chat_id: string }>;
    return rows.map((row) => row.thread_chat_id);
}

/**
 * Whether a message personally @mentions the agent. CLI-authored messages
 * carry plain `@handle` tokens (D2: names are the handles); app-authored
 * messages may carry rich agent references. Both count as personal.
 */
export function messageMentionsAgent(
    message: TavernChatMessage,
    agent: { id: string; name: string }
) {
    return countFormalMentions([message], { agentId: agent.id, handle: agent.name }) > 0;
}

/** The chat whose membership governs delivery: threads defer to the parent. */
export function attentionParentChatId(chat: TavernChat) {
    return chat.kind === 'thread' && chat.parent_chat_id ? chat.parent_chat_id : chat.id;
}
