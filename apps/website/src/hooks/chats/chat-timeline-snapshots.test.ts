import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { applyLogSnapshot, emptyTimelineState } from './chat-timeline-state.ts';

type ChatLogRow = NonNullable<ChatLogOutput>['rows'][number];

test('applyLogSnapshot retains loaded history when the live window slides forward', () => {
    const loaded = applyLogSnapshot(emptyTimelineState(), {
        limit: 3,
        nextBeforeSequence: null,
        rows: [
            agentMessage('old-1', '16:08:10'),
            agentMessage('old-2', '16:08:20'),
            agentMessage('recent-1', '16:08:30'),
        ],
        totalMessages: 3,
    });

    const next = applyLogSnapshot(loaded, {
        limit: 3,
        nextBeforeSequence: 2,
        rows: [agentMessage('recent-1', '16:08:30'), userMessage('user-2', '16:08:50')],
        totalMessages: 4,
    });

    expect(next.timeline.map((row) => row.id)).toEqual(['old-1', 'old-2', 'recent-1', 'user-2']);
    // Retained rows are durable and already counted by the snapshot total.
    expect(next.totalMessages).toBe(4);
});

test('applyLogSnapshot retains slid-out rows regardless of timestamp order', () => {
    // The server slices by its own row order, so a slid window can drop a
    // row whose timestamp sorts later than the window's first row (for
    // example a back-dated activity upserted after newer rows).
    const loaded = applyLogSnapshot(emptyTimelineState(), {
        limit: 3,
        nextBeforeSequence: null,
        rows: [
            agentMessage('old-1', '16:08:10'),
            agentMessage('late-stamped', '16:08:40'),
            agentMessage('recent-1', '16:08:30'),
        ],
        totalMessages: 3,
    });

    const next = applyLogSnapshot(loaded, {
        limit: 3,
        nextBeforeSequence: 2,
        rows: [agentMessage('recent-1', '16:08:30'), userMessage('user-2', '16:08:50')],
        totalMessages: 4,
    });

    expect(next.timeline.map((row) => row.id)).toEqual([
        'old-1',
        'recent-1',
        'late-stamped',
        'user-2',
    ]);
    expect(next.totalMessages).toBe(4);
});

test('applyLogSnapshot retains loaded history through the completion refetch', () => {
    const loaded = applyLogSnapshot(emptyTimelineState(), {
        limit: 3,
        nextBeforeSequence: null,
        rows: [
            agentMessage('old-1', '16:08:10'),
            agentMessage('old-2', '16:08:20'),
            agentMessage('recent-1', '16:08:30'),
        ],
        totalMessages: 3,
    });

    const next = applyLogSnapshot(loaded, {
        limit: 3,
        nextBeforeSequence: 2,
        rows: [agentMessage('recent-1', '16:08:30'), agentMessage('reply-1', '16:08:55')],
        totalMessages: 4,
    });

    expect(next.activeReplies).toEqual([]);
    expect(next.timeline.map((row) => row.id)).toEqual(['old-1', 'old-2', 'recent-1', 'reply-1']);
    expect(next.totalMessages).toBe(4);
});

test('applyLogSnapshot defers to a full-coverage window for deletions', () => {
    const loaded = applyLogSnapshot(emptyTimelineState(), {
        limit: 3,
        nextBeforeSequence: null,
        rows: [
            agentMessage('old-2', '16:08:20'),
            agentMessage('deleted-1', '16:08:25'),
            agentMessage('recent-1', '16:08:30'),
        ],
        totalMessages: 3,
    });

    const next = applyLogSnapshot(loaded, {
        limit: 3,
        nextBeforeSequence: null,
        rows: [agentMessage('old-2', '16:08:20'), agentMessage('recent-1', '16:08:30')],
        totalMessages: 2,
    });

    expect(next.timeline.map((row) => row.id)).toEqual(['old-2', 'recent-1']);
    expect(next.totalMessages).toBe(2);
});

test('applyLogSnapshot carries an updated thread summary on unchanged row ids', () => {
    const withThread = (replyCount: number): ChatLogRow => ({
        ...(agentMessage('anchor-1', '16:08:10') as Extract<ChatLogRow, { kind: 'message' }>),
        thread: {
            anchorMessageId: 'anchor-1',
            followed: true,
            latestReplyAt: '2026-04-21T16:09:00.000Z',
            replyCount,
            threadChatId: 'cht_thr_anchor_1',
            unreadCount: 0,
        },
    });
    const loaded = applyLogSnapshot(emptyTimelineState(), {
        limit: 3,
        nextBeforeSequence: null,
        rows: [withThread(1)],
        totalMessages: 1,
    });

    const next = applyLogSnapshot(loaded, {
        limit: 3,
        nextBeforeSequence: null,
        rows: [withThread(2)],
        totalMessages: 1,
    });

    const row = next.timeline[0];
    expect(row?.kind === 'message' ? row.thread?.replyCount : null).toBe(2);
});

test('applyLogSnapshot carries updated reactions on unchanged row ids', () => {
    const withReactions = (
        reactions: Extract<ChatLogRow, { kind: 'message' }>['message']['reactions']
    ): ChatLogRow => {
        const base = agentMessage('anchor-1', '16:08:10') as Extract<
            ChatLogRow,
            { kind: 'message' }
        >;
        return { ...base, message: { ...base.message, reactions } };
    };
    const loaded = applyLogSnapshot(emptyTimelineState(), {
        limit: 3,
        nextBeforeSequence: null,
        rows: [withReactions([])],
        totalMessages: 1,
    });

    const next = applyLogSnapshot(loaded, {
        limit: 3,
        nextBeforeSequence: null,
        rows: [withReactions([{ actors: [{ handle: 'zach', id: 'usr_tavern' }], emoji: '👍' }])],
        totalMessages: 1,
    });

    const row = next.timeline[0];
    expect(row?.kind === 'message' ? row.message.reactions : null).toEqual([
        { actors: [{ handle: 'zach', id: 'usr_tavern' }], emoji: '👍' },
    ]);
});

test('applyLogSnapshot carries an updated task on unchanged row ids', () => {
    const withTask = (status: 'in_progress' | 'todo', updatedAt: string): ChatLogRow => {
        const base = agentMessage('anchor-1', '16:08:10') as Extract<
            ChatLogRow,
            { kind: 'message' }
        >;
        return {
            ...base,
            message: {
                ...base.message,
                task: {
                    assignee: null,
                    claimed_at: null,
                    created_at: '2026-04-21T16:08:10.000Z',
                    labels: [],
                    number: 7,
                    origin: 'composed',
                    priority: 'none',
                    status,
                    updated_at: updatedAt,
                },
            },
        };
    };
    const loaded = applyLogSnapshot(emptyTimelineState(), {
        limit: 3,
        nextBeforeSequence: null,
        rows: [withTask('todo', '2026-04-21T16:08:10.000Z')],
        totalMessages: 1,
    });

    const next = applyLogSnapshot(loaded, {
        limit: 3,
        nextBeforeSequence: null,
        rows: [withTask('in_progress', '2026-04-21T16:09:00.000Z')],
        totalMessages: 1,
    });

    const row = next.timeline[0];
    expect(row?.kind === 'message' ? row.message.task?.status : null).toBe('in_progress');
});

function agentMessage(id: string, time: string): ChatLogRow {
    return messageRow(id, time, 'agent');
}

function userMessage(id: string, time: string): ChatLogRow {
    return messageRow(id, time, 'user');
}

function messageRow(id: string, time: string, senderType: 'agent' | 'user'): ChatLogRow {
    return {
        actor: senderType === 'agent' ? { id: 'claw', kind: 'agent' } : null,
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            content: id,
            id,
            sender: senderType === 'agent' ? 'Claw' : 'You',
            senderType,
            sourceSessionId: null,
            sourceSessionKey: 'session-1',
            tavernAgentId: senderType === 'agent' ? 'claw' : undefined,
            timestamp: `2026-04-21T${time}.000Z`,
        },
    };
}
