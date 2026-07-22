import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from '../../db/connection';
import { ensureRuntimeSchema } from '../../db/schema';
import {
    anchorShortId,
    clearChat,
    createChat,
    createDelivery,
    createMessage,
    ensureThreadChat,
    getChat,
    getChatTimelinePage,
    listChats,
    listChatsForAgentParticipant,
    markRead,
    membershipChat,
    resolveMessageId,
    setThreadFollow,
    threadChatIdForAnchor,
    threadSummaries,
} from './index';

let tempRoot = '';

beforeEach(() => {
    tempRoot = mkdtempSync(path.join(tmpdir(), 'tavern-threads-'));
    ensureRuntimeSchema(initDb(path.join(tempRoot, 'runtime.sqlite')));
});

afterEach(() => {
    closeDb();
    rmSync(tempRoot, { force: true, recursive: true });
});

describe('thread chats', () => {
    it('creates one deterministic child chat and follows the anchor author', () => {
        seedParent();
        seedMessage('cht_parent', 'msg_anchor_12345678', 'usr_tavern');

        const first = ensureThreadChat({
            anchorMessageId: 'msg_anchor_12345678',
            parentChatId: 'cht_parent',
        });
        const replay = ensureThreadChat({
            anchorMessageId: 'msg_anchor_12345678',
            parentChatId: 'cht_parent',
        });

        expect(threadChatIdForAnchor('msg_anchor_12345678')).toBe('cht_thr_anchor_12345678');
        expect(anchorShortId('msg_0123456789abcdef0123456789abcdef')).toBe('01234567');
        // Non-canonical ids (dev seeds and UUID strings) have no short form;
        // the exact full id stays so resolution cannot go ambiguous.
        expect(anchorShortId('msg_anchor_12345678')).toBe('msg_anchor_12345678');
        expect(anchorShortId('msg_01234567-89ab-cdef-0123-456789abcdef')).toBe(
            'msg_01234567-89ab-cdef-0123-456789abcdef'
        );
        expect(replay).toEqual(first);
        expect(first).toMatchObject({
            anchor_message_id: 'msg_anchor_12345678',
            id: 'cht_thr_anchor_12345678',
            kind: 'thread',
            parent_chat_id: 'cht_parent',
            participants: [],
            title: null,
        });
        expect(threadSummaries('cht_parent', 'usr_tavern')).toEqual([
            expect.objectContaining({ followed: true, thread_chat_id: first.id }),
        ]);

        createMessage('cht_parent', {
            author_id: 'sys_notice',
            content: 'system anchor',
            id: 'msg_system_anchor',
            role: 'system',
        });
        ensureThreadChat({
            anchorMessageId: 'msg_system_anchor',
            parentChatId: 'cht_parent',
        });
        expect(threadSummaries('cht_parent', 'sys_notice')[1]?.followed).toBe(false);
    });

    it('emits anchor references accepted by message resolution', () => {
        seedParent();
        const canonicalId = 'msg_0123456789abcdef0123456789abcdef';
        const uuidId = 'msg_01234567-89ab-cdef-0123-456789abcdef';
        seedMessage('cht_parent', canonicalId, 'usr_tavern');
        seedMessage('cht_parent', uuidId, 'usr_tavern');

        expect(resolveMessageId(anchorShortId(canonicalId), { chatId: 'cht_parent' })?.id).toBe(
            canonicalId
        );
        expect(resolveMessageId(anchorShortId(uuidId), { chatId: 'cht_parent' })?.id).toBe(uuidId);
    });

    it('rejects missing, deleted, foreign, and nested anchors', () => {
        seedParent();
        seedMessage('cht_parent', 'msg_anchor', 'usr_tavern');
        createChat({ id: 'cht_other', title: 'Other' });
        seedMessage('cht_other', 'msg_foreign', 'usr_tavern');

        expect(() =>
            ensureThreadChat({ anchorMessageId: 'msg_missing', parentChatId: 'cht_parent' })
        ).toThrow('not in the parent chat');
        expect(() =>
            ensureThreadChat({ anchorMessageId: 'msg_foreign', parentChatId: 'cht_parent' })
        ).toThrow('not in the parent chat');

        getDb()
            .prepare("UPDATE chat_messages SET deleted_at = 'deleted' WHERE id = 'msg_anchor'")
            .run();
        expect(() =>
            ensureThreadChat({ anchorMessageId: 'msg_anchor', parentChatId: 'cht_parent' })
        ).toThrow('not in the parent chat');

        createMessage('cht_parent', {
            author_id: 'agt_one',
            content: 'still streaming',
            id: 'msg_streaming_anchor',
            metadata: { runtime: { streaming: true } },
            role: 'assistant',
        });
        expect(() =>
            ensureThreadChat({
                anchorMessageId: 'msg_streaming_anchor',
                parentChatId: 'cht_parent',
            })
        ).toThrow('still streaming');

        seedMessage('cht_parent', 'msg_nested_root', 'usr_tavern');
        const thread = ensureThreadChat({
            anchorMessageId: 'msg_nested_root',
            parentChatId: 'cht_parent',
        });
        seedMessage(thread.id, 'msg_nested_anchor', 'usr_tavern');
        expect(() =>
            ensureThreadChat({ anchorMessageId: 'msg_nested_anchor', parentChatId: thread.id })
        ).toThrow('nesting');
    });

    it('toggles follows, re-follows posters, and preserves unfollows across mentions', () => {
        seedParent();
        seedMessage('cht_parent', 'msg_anchor', 'usr_tavern');
        const thread = ensureThreadChat({
            anchorMessageId: 'msg_anchor',
            parentChatId: 'cht_parent',
        });

        expect(
            setThreadFollow({
                follow: false,
                participantId: 'usr_tavern',
                threadChatId: thread.id,
            })
        ).toEqual({ followed: false });
        seedMessage(thread.id, 'msg_reply', 'usr_tavern');
        expect(threadSummaries('cht_parent', 'usr_tavern')[0]?.followed).toBe(true);

        setThreadFollow({ follow: false, participantId: 'usr_tavern', threadChatId: thread.id });
        createMessage(thread.id, {
            author_id: 'usr_reader',
            content: 'Loop in [@You](user://usr_tavern).',
            id: 'msg_user_mention',
            role: 'user',
        });
        expect(threadSummaries('cht_parent', 'usr_tavern')[0]?.followed).toBe(false);

        createMessage(thread.id, {
            author_id: 'usr_tavern',
            content: 'Also for [@Reader](user://usr_reader).',
            id: 'msg_reader_mention',
            role: 'user',
        });
        expect(
            getDb()
                .prepare(
                    `SELECT 1 FROM thread_follows
                     WHERE thread_chat_id = ? AND participant_id = 'usr_reader' AND followed = 1`
                )
                .get(thread.id)
        ).toBeTruthy();

        setThreadFollow({ follow: false, participantId: 'agt_one', threadChatId: thread.id });
        createMessage(thread.id, {
            author_id: 'usr_tavern',
            content: 'Please review [@One](agent://one).',
            id: 'msg_mention',
            role: 'user',
        });
        expect(threadSummaries('cht_parent', 'agt_one')[0]?.followed).toBe(false);
        createDelivery(thread.id, {
            agent_id: 'agt_one',
            id: 'del_thread_mention',
            message: {
                author_id: 'agt_one',
                content: 'Adding [@Two](agent://two).',
                id: 'msg_delivery_mention',
                role: 'assistant',
            },
        });
        expect(threadSummaries('cht_parent', 'agt_two')[0]?.followed).toBe(true);
        createMessage(thread.id, {
            author_id: 'sys_thread_notice',
            content: 'A participant unfollowed this thread.',
            id: 'msg_thread_notice',
            role: 'system',
        });
        expect(
            getDb()
                .prepare(
                    `SELECT 1 FROM thread_follows
                     WHERE thread_chat_id = ? AND participant_id = 'sys_thread_notice'`
                )
                .get(thread.id)
        ).toBeNull();
        expect(
            setThreadFollow({ follow: false, participantId: 'agt_one', threadChatId: thread.id })
        ).toEqual({ followed: false });
        expect(() =>
            setThreadFollow({
                follow: true,
                participantId: 'usr_tavern',
                threadChatId: 'cht_parent',
            })
        ).toThrow('not a thread');
        expect(() =>
            setThreadFollow({
                follow: 'false' as unknown as boolean,
                participantId: 'usr_tavern',
                threadChatId: thread.id,
            })
        ).toThrow('boolean');
        expect(() =>
            setThreadFollow({ follow: true, participantId: '', threadChatId: thread.id })
        ).toThrow('usr_ or agt_');
    });

    it('applies follow effects only when a streaming post becomes durable', () => {
        seedParent();
        seedMessage('cht_parent', 'msg_anchor', 'usr_tavern');
        const thread = ensureThreadChat({
            anchorMessageId: 'msg_anchor',
            parentChatId: 'cht_parent',
        });
        setThreadFollow({ follow: false, participantId: 'agt_one', threadChatId: thread.id });

        createMessage(thread.id, {
            author_id: 'agt_one',
            content: 'Draft for [@Two](agent://two).',
            id: 'msg_streaming_reply',
            metadata: { runtime: { streaming: true } },
            role: 'assistant',
        });

        expect(threadSummaries('cht_parent', 'agt_one')[0]?.followed).toBe(false);
        expect(threadSummaries('cht_parent', 'agt_two')[0]?.followed).toBe(false);

        createDelivery(thread.id, {
            agent_id: 'agt_one',
            id: 'del_streaming_reply',
            message: {
                author_id: 'agt_one',
                content: 'Final for [@Reader](user://usr_reader).',
                id: 'msg_streaming_reply',
                role: 'assistant',
            },
        });

        expect(threadSummaries('cht_parent', 'agt_one')[0]?.followed).toBe(true);
        expect(threadSummaries('cht_parent', 'agt_two')[0]?.followed).toBe(false);
        expect(threadSummaries('cht_parent', 'usr_reader')[0]?.followed).toBe(true);
    });

    it('rejects writes into a thread whose conversation was cleared', () => {
        seedParent();
        seedMessage('cht_parent', 'msg_anchor', 'usr_tavern');
        const thread = ensureThreadChat({
            anchorMessageId: 'msg_anchor',
            parentChatId: 'cht_parent',
        });
        seedMessage(thread.id, 'msg_reply', 'usr_tavern');

        clearChat('cht_parent');

        expect(() => seedMessage(thread.id, 'msg_late_reply', 'usr_tavern')).toThrow('cleared');
        expect(() =>
            createDelivery(thread.id, {
                agent_id: 'agt_one',
                id: 'del_late',
                message: {
                    author_id: 'agt_one',
                    content: 'late',
                    id: 'msg_late_delivery',
                    role: 'assistant',
                },
            })
        ).toThrow('cleared');
        expect(getChat('cht_parent', getDb(), 'usr_reader')?.unread_count).toBe(0);
    });

    it('derives membership from the parent chat', () => {
        seedParent();
        seedMessage('cht_parent', 'msg_anchor', 'usr_tavern');
        const thread = ensureThreadChat({
            anchorMessageId: 'msg_anchor',
            parentChatId: 'cht_parent',
        });

        const parent = getChat('cht_parent');
        const threadChat = getChat(thread.id);
        if (!(parent && threadChat)) {
            throw new Error('Seeded chats must exist.');
        }
        expect(membershipChat(threadChat)?.id).toBe('cht_parent');
        expect(membershipChat(parent)?.id).toBe('cht_parent');
        // A fresh thread has no participants of its own; the parent's agent
        // seats are the membership authority.
        expect(threadChat.participants).toEqual([]);
        expect(membershipChat(threadChat)?.participants.map((seat) => seat.id)).toContain(
            'agt_one'
        );

        // Agent thread enumeration follows parent seats + follows: posting in
        // the thread alone (incidental child row) is not enough once
        // unfollowed, while a followed thread lists without any post.
        expect(listChatsForAgentParticipant('agt_one').map((c) => c.id)).toEqual(['cht_parent']);
        setThreadFollow({ follow: true, participantId: 'agt_one', threadChatId: thread.id });
        expect(listChatsForAgentParticipant('agt_one').map((c) => c.id)).toEqual([
            'cht_parent',
            thread.id,
        ]);
        seedMessage(thread.id, 'msg_agent_post', 'agt_one');
        setThreadFollow({ follow: false, participantId: 'agt_one', threadChatId: thread.id });
        expect(listChatsForAgentParticipant('agt_one').map((c) => c.id)).toEqual(['cht_parent']);
    });

    it('summarizes replies and rolls only followed unread replies into the parent', () => {
        seedParent();
        seedMessage('cht_parent', 'msg_anchor', 'usr_tavern');
        markRead('cht_parent', { reader_id: 'usr_reader' });
        const thread = ensureThreadChat({
            anchorMessageId: 'msg_anchor',
            parentChatId: 'cht_parent',
        });
        setThreadFollow({ follow: true, participantId: 'usr_reader', threadChatId: thread.id });
        const first = seedMessage(thread.id, 'msg_reply_1', 'agt_one');
        const second = seedMessage(thread.id, 'msg_reply_2', 'agt_one');

        expect(listChats({ readerId: 'usr_reader' }).chats.map((chat) => chat.id)).toEqual([
            'cht_parent',
        ]);
        expect(threadSummaries('cht_parent', 'usr_reader')).toEqual([
            {
                anchor_message_id: 'msg_anchor',
                followed: true,
                latest_reply_at: second.message.created_at,
                reply_count: 2,
                thread_chat_id: thread.id,
                unread_count: 2,
            },
        ]);
        expect(getChatTimelinePage('cht_parent', { readerId: 'usr_reader' }).threads).toEqual(
            threadSummaries('cht_parent', 'usr_reader')
        );
        expect(getChat('cht_parent', getDb(), 'usr_reader')?.unread_count).toBe(2);

        setThreadFollow({ follow: false, participantId: 'usr_reader', threadChatId: thread.id });
        expect(getChat('cht_parent', getDb(), 'usr_reader')?.unread_count).toBe(0);
        setThreadFollow({ follow: true, participantId: 'usr_reader', threadChatId: thread.id });
        expect(getChat('cht_parent', getDb(), 'usr_reader')?.unread_count).toBe(2);

        markRead(thread.id, {
            last_read_sequence: second.message.sequence,
            reader_id: 'usr_reader',
        });
        expect(threadSummaries('cht_parent', 'usr_reader')[0]?.unread_count).toBe(0);
        expect(getChat('cht_parent', getDb(), 'usr_reader')?.unread_count).toBe(0);
        expect(first.message.sequence).toBe(1);
    });
});

function seedParent() {
    createChat({
        id: 'cht_parent',
        participants: [
            { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
            { id: 'usr_reader', kind: 'user', label: 'Reader', metadata: {} },
            { id: 'agt_one', kind: 'agent', label: 'One', metadata: { agentId: 'one' } },
            { id: 'agt_two', kind: 'agent', label: 'Two', metadata: { agentId: 'two' } },
        ],
        title: 'general',
    });
}

function seedMessage(chatId: string, id: string, authorId: string) {
    return createMessage(chatId, {
        author_id: authorId,
        content: id,
        id,
        role: authorId.startsWith('agt_') ? 'assistant' : 'user',
    });
}
