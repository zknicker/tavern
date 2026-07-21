import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import {
    applyLogSnapshot,
    completeTimelineTurn,
    emptyTimelineState,
    startTimelineTurn,
} from './chat-timeline-state.ts';

type ChatLogRow = NonNullable<ChatLogOutput>['rows'][number];

const turn = {
    agentId: 'claw',
    chatId: 'chat-1',
    runId: 'run-1',
    sessionKey: 'session-1',
    startedAt: '2026-04-21T16:08:42.000Z',
};

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
    const live = startTimelineTurn(loaded, turn);

    const next = applyLogSnapshot(live, {
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
    const live = startTimelineTurn(loaded, turn);

    const next = applyLogSnapshot(live, {
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
    const live = startTimelineTurn(loaded, turn);

    const next = applyLogSnapshot(live, {
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

test('applyLogSnapshot never resurrects a run the client saw settle', () => {
    const live = startTimelineTurn(emptyTimelineState(), turn);
    const settled = completeTimelineTurn(live, {
        completedAt: '2026-04-21T16:08:50.000Z',
        // A silent turn: the reply is removed outright at completion.
        hasReply: false,
        turn,
    });
    expect(settled.activeReplies).toEqual([]);

    // A stale snapshot served while the run was still in flight lands after
    // the live completion event.
    const next = applyLogSnapshot(settled, {
        activeReplies: [
            {
                agentId: turn.agentId,
                isThinking: true,
                runId: turn.runId,
                sessionKey: turn.sessionKey,
                startedAt: turn.startedAt,
                text: '',
            },
        ],
        limit: 3,
        nextBeforeSequence: null,
        rows: [],
        totalMessages: 0,
    });

    expect(next.activeReplies).toEqual([]);
});

test('a log refetch cannot strip the quiet-evaluation stamp from a live reply', () => {
    const live = startTimelineTurn(emptyTimelineState(), { ...turn, trigger: 'evaluation' });

    // Snapshot reply for the same run without the stamp (e.g. an older
    // server): the merge keeps the live stamp, so the row stays quiet.
    const next = applyLogSnapshot(live, {
        activeReplies: [
            {
                agentId: turn.agentId,
                isThinking: true,
                runId: turn.runId,
                sessionKey: turn.sessionKey,
                startedAt: turn.startedAt,
                text: '',
            },
        ],
        limit: 3,
        nextBeforeSequence: null,
        rows: [],
        totalMessages: 0,
    });

    expect(next.activeReplies[0]?.trigger).toBe('evaluation');
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
