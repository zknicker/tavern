import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initDb } from '../../db/connection';
import { ensureRuntimeSchema } from '../../db/schema';
import {
    claimTask,
    createChat,
    createMessage,
    ensureLabels,
    ensureThreadChat,
    getMessage,
    listMessages,
    listTasks,
    promoteMessageToTask,
    recordTaskReceipt,
    setMessageReaction,
    TaskRuleError,
    unclaimTask,
    updateTaskFields,
    updateTaskStatus,
} from './index';

let tempRoot = '';

beforeEach(() => {
    tempRoot = mkdtempSync(path.join(tmpdir(), 'tavern-tasks-'));
    ensureRuntimeSchema(initDb(path.join(tempRoot, 'runtime.sqlite')));
    createChat({
        id: 'cht_general',
        participants: [
            { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
            { id: 'agt_one', kind: 'agent', label: 'One', metadata: { agentId: 'agt_one' } },
            { id: 'agt_two', kind: 'agent', label: 'Two', metadata: { agentId: 'agt_two' } },
        ],
        title: 'general',
    });
});

afterEach(() => {
    closeDb();
    rmSync(tempRoot, { force: true, recursive: true });
});

describe('task-messages', () => {
    it('promotes a message, numbers per chat, and enriches message reads', () => {
        seedMessage('msg_aaaaaaaa11111111aaaaaaaa11111111', 'usr_tavern');
        seedMessage('msg_bbbbbbbb22222222bbbbbbbb22222222', 'usr_tavern');

        const first = promoteMessageToTask({
            actorId: 'usr_tavern',
            messageId: 'msg_aaaaaaaa11111111aaaaaaaa11111111',
            origin: 'composed',
        });
        const second = promoteMessageToTask({
            actorId: 'usr_tavern',
            messageId: 'msg_bbbbbbbb22222222bbbbbbbb22222222',
            origin: 'converted',
        });

        expect(first).toMatchObject({ assignee: null, number: 1, status: 'todo' });
        expect(second.number).toBe(2);
        expect(getMessage('msg_aaaaaaaa11111111aaaaaaaa11111111')?.task).toMatchObject({
            number: 1,
            origin: 'composed',
            priority: 'none',
            status: 'todo',
        });
        expect(() =>
            promoteMessageToTask({
                actorId: 'usr_tavern',
                messageId: 'msg_aaaaaaaa11111111aaaaaaaa11111111',
                origin: 'converted',
            })
        ).toThrow(TaskRuleError);
    });

    it('rejects system messages and thread messages', () => {
        createMessage('cht_general', {
            author_id: 'sys_notice',
            content: 'notice',
            id: 'msg_cccccccc33333333cccccccc33333333',
            role: 'system',
        });
        expect(() =>
            promoteMessageToTask({
                actorId: 'usr_tavern',
                messageId: 'msg_cccccccc33333333cccccccc33333333',
                origin: 'converted',
            })
        ).toThrow('System messages');

        seedMessage('msg_dddddddd44444444dddddddd44444444', 'usr_tavern');
        ensureThreadChat({
            anchorMessageId: 'msg_dddddddd44444444dddddddd44444444',
            parentChatId: 'cht_general',
        });
        createMessage('cht_thr_dddddddd44444444dddddddd44444444', {
            author_id: 'usr_tavern',
            content: 'thread reply',
            id: 'msg_eeeeeeee55555555eeeeeeee55555555',
            role: 'user',
        });
        expect(() =>
            promoteMessageToTask({
                actorId: 'usr_tavern',
                messageId: 'msg_eeeeeeee55555555eeeeeeee55555555',
                origin: 'converted',
            })
        ).toThrow('top-level');
    });

    it('claims as the concurrency lock: converts, locks, and blocks rivals', () => {
        seedMessage('msg_11111111aaaaaaaa11111111aaaaaaaa', 'usr_tavern');

        const claimed = claimTask({
            actorId: 'agt_one',
            chatId: 'cht_general',
            messageId: 'msg_11111111aaaaaaaa11111111aaaaaaaa',
        });
        expect(claimed).toMatchObject({
            assignee: { handle: null, id: 'agt_one' },
            number: 1,
            origin: 'converted',
            status: 'in_progress',
        });
        expect(claimed.claimed_at).toBeTruthy();

        // The rival claim fails while the lock is held.
        expect(() => claimTask({ actorId: 'agt_two', chatId: 'cht_general', number: 1 })).toThrow(
            'already claimed'
        );

        // A conversion receipt landed as a quiet system message.
        const receipts = listMessages('cht_general').messages.filter(
            (message) => message.role === 'system'
        );
        expect(receipts).toHaveLength(1);
        expect(receipts[0]?.content).toContain('converted a message to task #1');

        // Unclaim releases the lock; the rival can now claim it.
        unclaimTask({ actorId: 'agt_one', chatId: 'cht_general', number: 1 });
        const reclaimed = claimTask({ actorId: 'agt_two', chatId: 'cht_general', number: 1 });
        expect(reclaimed.assignee?.id).toBe('agt_two');
        // Status survived the unclaim/reclaim cycle (assignee independent of status).
        expect(reclaimed.status).toBe('in_progress');
    });

    it('reserved assignment stays todo until the assignee claims', () => {
        seedMessage('msg_22222222bbbbbbbb22222222bbbbbbbb', 'usr_tavern');
        const reserved = promoteMessageToTask({
            actorId: 'usr_tavern',
            assigneeId: 'agt_one',
            messageId: 'msg_22222222bbbbbbbb22222222bbbbbbbb',
            origin: 'composed',
        });
        expect(reserved).toMatchObject({ status: 'todo' });
        expect(reserved.assignee?.id).toBe('agt_one');
        expect(reserved.claimed_at).toBeNull();

        const claimed = claimTask({ actorId: 'agt_one', chatId: 'cht_general', number: 1 });
        expect(claimed.status).toBe('in_progress');
        expect(claimed.claimed_at).toBeTruthy();
    });

    it('blocks claims on done tasks and allows reopening closed ones', () => {
        seedMessage('msg_33333333cccccccc33333333cccccccc', 'usr_tavern');
        promoteMessageToTask({
            actorId: 'usr_tavern',
            messageId: 'msg_33333333cccccccc33333333cccccccc',
            origin: 'composed',
        });
        updateTaskStatus({ chatId: 'cht_general', number: 1, status: 'done' });
        expect(() => claimTask({ actorId: 'agt_one', chatId: 'cht_general', number: 1 })).toThrow(
            'done'
        );

        // closed is reversible (D8).
        updateTaskStatus({ chatId: 'cht_general', number: 1, status: 'closed' });
        const reopened = updateTaskStatus({ chatId: 'cht_general', number: 1, status: 'todo' });
        expect(reopened.status).toBe('todo');
    });

    it('lens fields: priority and labels ride the task and filter the list', () => {
        seedMessage('msg_44444444dddddddd44444444dddddddd', 'usr_tavern');
        promoteMessageToTask({
            actorId: 'usr_tavern',
            messageId: 'msg_44444444dddddddd44444444dddddddd',
            origin: 'composed',
        });
        const labelIds = ensureLabels(['Bug', 'merch']);
        const updated = updateTaskFields({
            labelIds,
            messageId: 'msg_44444444dddddddd44444444dddddddd',
            priority: 'high',
        });
        expect(updated.priority).toBe('high');
        expect(updated.labels.map((label) => label.name)).toEqual(['Bug', 'merch']);

        const all = listTasks();
        expect(all).toHaveLength(1);
        expect(all[0]).toMatchObject({
            chatId: 'cht_general',
            chatKind: 'channel',
            chatTitle: 'general',
        });
        expect(listTasks({ status: 'in_progress' })).toHaveLength(0);
        expect(listTasks({ assigneeId: 'agt_one' })).toHaveLength(0);
    });

    it('writes creation receipts with Raft copy shapes', () => {
        seedMessage('msg_55555555eeeeeeee55555555eeeeeeee', 'usr_tavern');
        const task = promoteMessageToTask({
            actorId: 'usr_tavern',
            messageId: 'msg_55555555eeeeeeee55555555eeeeeeee',
            origin: 'composed',
        });
        recordTaskReceipt({
            actorId: 'usr_tavern',
            chatId: 'cht_general',
            kind: 'created',
            tasks: [
                {
                    number: task.number,
                    title: 'Ship the thing with a very long title over forty chars',
                },
            ],
        });
        const receipt = listMessages('cht_general').messages.at(-1);
        expect(receipt?.role).toBe('system');
        expect(receipt?.content).toBe('📋 1 new task created: #1 "Ship the thing with a very…"');
    });
});

describe('message reactions', () => {
    it('toggles reactions and groups them by emoji on message reads', () => {
        seedMessage('msg_66666666ffffffff66666666ffffffff', 'usr_tavern');

        setMessageReaction({
            actorId: 'agt_one',
            emoji: '👍',
            messageId: 'msg_66666666ffffffff66666666ffffffff',
        });
        setMessageReaction({
            actorId: 'usr_tavern',
            emoji: '👍',
            messageId: 'msg_66666666ffffffff66666666ffffffff',
        });
        setMessageReaction({
            actorId: 'agt_one',
            emoji: '🎉',
            messageId: 'msg_66666666ffffffff66666666ffffffff',
        });
        // Re-adding is idempotent.
        setMessageReaction({
            actorId: 'agt_one',
            emoji: '👍',
            messageId: 'msg_66666666ffffffff66666666ffffffff',
        });

        const message = getMessage('msg_66666666ffffffff66666666ffffffff');
        expect(message?.reactions).toEqual([
            expect.objectContaining({ emoji: '👍' }),
            expect.objectContaining({ emoji: '🎉' }),
        ]);
        expect(message?.reactions?.[0]?.actors.map((actor) => actor.id)).toEqual([
            'agt_one',
            'usr_tavern',
        ]);

        setMessageReaction({
            actorId: 'agt_one',
            emoji: '👍',
            messageId: 'msg_66666666ffffffff66666666ffffffff',
            remove: true,
        });
        const after = getMessage('msg_66666666ffffffff66666666ffffffff');
        expect(after?.reactions?.find((row) => row.emoji === '👍')?.actors).toHaveLength(1);
    });
});

function seedMessage(id: string, authorId: string) {
    return createMessage('cht_general', {
        author_id: authorId,
        content: `body of ${id}`,
        id,
        role: authorId.startsWith('agt_') ? 'assistant' : 'user',
    });
}
