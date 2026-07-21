import type { TavernChat, TavernThreadSummary } from '@tavern/api';
import {
    parseAgentReferenceTarget,
    parseTavernRichReferences,
    parseUserReferenceTarget,
} from '@tavern/api/rich-references';
import { getDb } from '../../db/connection';
import type { Database } from '../../db/sqlite';
import { namedParams } from '../../db/sqlite';
import { getChat, getChatOrThrow } from './chats';
import { createAgentParticipantId } from './ids';
import { getMessage, isTransientStreamingPost } from './messages';

export function threadChatIdForAnchor(anchorMessageId: string) {
    return `cht_thr_${stripMessagePrefix(anchorMessageId)}`;
}

export function anchorShortId(anchorMessageId: string) {
    return stripMessagePrefix(anchorMessageId).slice(0, 8);
}

export function ensureThreadChat(
    input: { anchorMessageId: string; parentChatId: string },
    db: Database = getDb()
): TavernChat {
    const parent = getChat(input.parentChatId, db);
    if (!parent) {
        throw new Error(`Parent chat ${input.parentChatId} does not exist.`);
    }
    if (parent.kind === 'thread') {
        throw new Error('Thread nesting is not allowed.');
    }

    const anchor = db
        .prepare(
            `SELECT chat_messages.chat_id, chat_messages.deleted_at, chat_messages.author_id,
                    chat_participants.kind AS author_kind
             FROM chat_messages
             JOIN chat_participants
               ON chat_participants.chat_id = chat_messages.chat_id
              AND chat_participants.id = chat_messages.author_id
             WHERE chat_messages.id = $anchorMessageId`
        )
        .get(namedParams({ anchorMessageId: input.anchorMessageId })) as AnchorRow | null;
    if (!(anchor && !anchor.deleted_at && anchor.chat_id === input.parentChatId)) {
        throw new Error(`Anchor message ${input.anchorMessageId} is not in the parent chat.`);
    }
    const anchorMessage = getMessage(input.anchorMessageId, db);
    if (anchorMessage && isTransientStreamingPost(anchorMessage)) {
        throw new Error(
            `Anchor message ${input.anchorMessageId} is still streaming; thread it once it settles.`
        );
    }

    const threadChatId = threadChatIdForAnchor(input.anchorMessageId);
    const existing = getChat(threadChatId, db);
    if (existing) {
        if (
            existing.kind !== 'thread' ||
            existing.parent_chat_id !== input.parentChatId ||
            existing.anchor_message_id !== input.anchorMessageId
        ) {
            throw new Error(`Chat id ${threadChatId} is already used by another chat.`);
        }
        return existing;
    }

    const transaction = db.transaction(() => {
        const now = new Date().toISOString();
        db.prepare(
            `INSERT INTO chats
             (id, kind, title, parent_chat_id, anchor_message_id, pinned, metadata_json,
              created_at, updated_at)
             VALUES ($id, 'thread', NULL, $parentChatId, $anchorMessageId, 0, '{}', $now, $now)`
        ).run(
            namedParams({
                anchorMessageId: input.anchorMessageId,
                id: threadChatId,
                now,
                parentChatId: input.parentChatId,
            })
        );
        if (anchor.author_kind !== 'system' && !anchor.author_id.startsWith('sys_')) {
            followParticipant(threadChatId, anchor.author_id, db);
        }
    });
    transaction();
    return getChatOrThrow(threadChatId, db);
}

export function setThreadFollow(
    input: { follow: boolean; participantId: string; threadChatId: string },
    db: Database = getDb()
) {
    if (typeof input.follow !== 'boolean') {
        throw new Error('Thread follow must be a boolean.');
    }
    if (!(typeof input.participantId === 'string' && /^(usr_|agt_)/u.test(input.participantId))) {
        throw new Error('Thread follow participant must be a usr_ or agt_ id.');
    }
    assertThreadChat(input.threadChatId, db);
    // Same split as assertThreadWritable: agent follows require a parent
    // seat; human ids stay server-enforced (single-operator participant rows).
    if (input.follow && input.participantId.startsWith('agt_')) {
        const parentChatId = getChat(input.threadChatId, db)?.parent_chat_id;
        const seat = parentChatId
            ? db
                  .prepare(
                      `SELECT 1 FROM chat_participants
                       WHERE chat_id = $parentChatId AND id = $participantId AND kind = 'agent'`
                  )
                  .get(namedParams({ parentChatId, participantId: input.participantId }))
            : null;
        if (!seat) {
            throw new Error(
                `Agent ${input.participantId} holds no seat in the thread's parent chat.`
            );
        }
    }
    if (input.follow) {
        followParticipant(input.threadChatId, input.participantId, db);
    } else {
        db.prepare(
            `DELETE FROM thread_follows
             WHERE thread_chat_id = $threadChatId AND participant_id = $participantId`
        ).run(namedParams(input));
    }
    return { followed: input.follow };
}

export function autoFollowOnPost(
    input: { authorId: string; chatId: string },
    db: Database = getDb()
) {
    const chat = getChat(input.chatId, db);
    if (chat?.kind === 'thread') {
        followParticipant(input.chatId, input.authorId, db);
    }
}

export function autoFollowMentions(
    input: { chatId: string; content: string },
    db: Database = getDb()
) {
    const thread = getChat(input.chatId, db);
    if (!(thread?.kind === 'thread' && thread.parent_chat_id)) {
        return;
    }

    const participantIds = mentionedParticipantIds(input.content);
    for (const participantId of participantIds) {
        const participant = db
            .prepare(
                `SELECT 1 FROM chat_participants
                 WHERE chat_id = $parentChatId AND id = $participantId
                   AND kind IN ('agent', 'user')`
            )
            .get(namedParams({ parentChatId: thread.parent_chat_id, participantId }));
        if (participant) {
            followParticipant(input.chatId, participantId, db);
        }
    }
}

/**
 * A cleared parent retires its threads: once the anchor message is deleted
 * the thread accepts no further writes, so it can never feed the parent's
 * unread rollup from behind a vanished pill.
 */
export function assertThreadWritable(chatId: string, authorId: string, db: Database = getDb()) {
    const chat = getChat(chatId, db);
    if (chat?.kind !== 'thread' || !chat.anchor_message_id) {
        return;
    }
    const anchor = getMessage(chat.anchor_message_id, db);
    if (!anchor || anchor.deleted_at) {
        throw new Error(`Thread ${chatId} was cleared with its conversation.`);
    }
    // Agent authors must hold a parent seat (membership derives from the
    // parent). Human seats stay server-enforced: single-operator chats only
    // carry the usr_tavern row, not every authenticated member id.
    if (chat.parent_chat_id && authorId.startsWith('agt_')) {
        const seat = db
            .prepare(
                `SELECT 1 FROM chat_participants
                 WHERE chat_id = $parentChatId AND id = $authorId AND kind = 'agent'`
            )
            .get(namedParams({ authorId, parentChatId: chat.parent_chat_id }));
        if (!seat) {
            throw new Error(`Agent ${authorId} holds no seat in thread ${chatId}'s parent chat.`);
        }
    }
}

/**
 * Membership/access authority for a chat: threads never own membership, so
 * participant checks resolve against the parent chat.
 */
export function membershipChat(chat: TavernChat, db: Database = getDb()): TavernChat | null {
    if (chat.kind !== 'thread') {
        return chat;
    }
    return chat.parent_chat_id ? getChat(chat.parent_chat_id, db) : null;
}

export function threadSummaries(
    parentChatId: string,
    readerId: string,
    db: Database = getDb(),
    anchorMessageIds?: readonly string[]
): TavernThreadSummary[] {
    if (anchorMessageIds && anchorMessageIds.length === 0) {
        return [];
    }
    const anchorParams = Object.fromEntries(
        (anchorMessageIds ?? []).map((id, index) => [`anchor${String(index)}`, id])
    );
    const anchorFilter = anchorMessageIds
        ? ` AND thread_chats.anchor_message_id IN (${Object.keys(anchorParams)
              .map((key) => `$${key}`)
              .join(', ')})`
        : '';
    const rows = db
        .prepare(
            `SELECT thread_chats.id AS thread_chat_id,
                    thread_chats.anchor_message_id,
                    COUNT(thread_messages.id) AS reply_count,
                    MAX(thread_messages.created_at) AS latest_reply_at,
                    COALESCE(SUM(
                        CASE WHEN thread_messages.id IS NOT NULL
                                  AND thread_messages.author_id != $readerId
                                  AND thread_messages.sequence > COALESCE(thread_reads.last_read_sequence, 0)
                             THEN 1 ELSE 0 END
                    ), 0) AS unread_count,
                    EXISTS(
                        SELECT 1 FROM thread_follows
                        WHERE thread_follows.thread_chat_id = thread_chats.id
                          AND thread_follows.participant_id = $readerId
                    ) AS followed
             FROM chats AS thread_chats
             LEFT JOIN chat_messages AS thread_messages
               ON thread_messages.chat_id = thread_chats.id
              AND thread_messages.deleted_at IS NULL
             LEFT JOIN chat_reads AS thread_reads
               ON thread_reads.chat_id = thread_chats.id
              AND thread_reads.reader_id = $readerId
             WHERE thread_chats.kind = 'thread'
               AND thread_chats.parent_chat_id = $parentChatId${anchorFilter}
             GROUP BY thread_chats.id, thread_chats.anchor_message_id
             ORDER BY thread_chats.id ASC`
        )
        .all(namedParams({ ...anchorParams, parentChatId, readerId })) as ThreadSummaryRow[];

    return rows.map((row) => ({
        anchor_message_id: row.anchor_message_id,
        followed: row.followed === 1,
        latest_reply_at: row.latest_reply_at,
        reply_count: row.reply_count,
        thread_chat_id: row.thread_chat_id,
        unread_count: row.unread_count,
    }));
}

function assertThreadChat(threadChatId: string, db: Database) {
    const chat = getChat(threadChatId, db);
    if (chat?.kind !== 'thread') {
        throw new Error(`Chat ${threadChatId} is not a thread.`);
    }
}

function followParticipant(threadChatId: string, participantId: string, db: Database) {
    db.prepare(
        `INSERT OR IGNORE INTO thread_follows (thread_chat_id, participant_id, created_at)
         VALUES ($threadChatId, $participantId, $createdAt)`
    ).run(namedParams({ createdAt: new Date().toISOString(), participantId, threadChatId }));
}

function mentionedParticipantIds(content: string) {
    const ids = parseTavernRichReferences(content).flatMap((reference) => {
        if (reference.kind === 'agent') {
            const agentId = parseAgentReferenceTarget(reference.id);
            return agentId ? [createAgentParticipantId(agentId)] : [];
        }
        if (reference.kind === 'user') {
            const userId = parseUserReferenceTarget(reference.id);
            return userId ? [userId] : [];
        }
        return [];
    });
    return [...new Set(ids)];
}

function stripMessagePrefix(messageId: string) {
    return messageId.startsWith('msg_') ? messageId.slice(4) : messageId;
}

interface ThreadSummaryRow {
    anchor_message_id: string;
    followed: number;
    latest_reply_at: string | null;
    reply_count: number;
    thread_chat_id: string;
    unread_count: number;
}

interface AnchorRow {
    author_id: string;
    author_kind: string;
    chat_id: string;
    deleted_at: string | null;
}
