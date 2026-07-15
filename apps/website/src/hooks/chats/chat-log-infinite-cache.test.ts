import { expect, test } from 'bun:test';
import type { InfiniteData } from '@tanstack/react-query';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { patchChatLogWithProgress } from './chat-log-cache.ts';
import { patchInfiniteChatLogWithProgress } from './chat-log-infinite-cache.ts';

type ChatLogPage = NonNullable<ChatLogOutput>;

const turn = {
    agentId: 'agent-1',
    chatId: 'chat-1',
    runId: 'run-1',
    sessionKey: 'session-1',
    startedAt: '2026-04-27T17:20:07.408Z',
};

test('live progress preserves the loaded newest-page boundary row', () => {
    // Pages are ordered newest-first; older history chains behind the newest
    // window.
    const cache: InfiniteData<ChatLogPage> = {
        pageParams: [undefined, { beforeSequence: 3 }],
        pages: [
            chatLogPage(3, ['message-3', 'message-4']),
            chatLogPage(null, ['message-1', 'message-2']),
        ],
    };

    const next = patchInfiniteChatLogWithProgress(cache, (current) =>
        patchChatLogWithProgress(current, {
            step: {
                detail: 'Quarterly revenue',
                id: 'widget:chart',
                kind: 'widget',
                label: 'Rendered a chart',
                status: 'active',
            },
            timestamp: '2026-04-27T17:20:08.408Z',
            turn,
        })
    );

    expect(next?.pages[0]?.rows.map((row) => row.id)).toEqual([
        'message-3',
        'message-4',
        'act_run-1_widget_chart',
    ]);
    expect(next?.pages[0]?.limit).toBe(2);
    expect(next?.pages[0]?.totalMessages).toBe(4);
    expect(next?.pages[1]?.rows.map((row) => row.id)).toEqual(['message-1', 'message-2']);
});

test('single-page live progress keeps loaded history instead of trimming', () => {
    const cache: InfiniteData<ChatLogPage> = {
        pageParams: [undefined],
        pages: [chatLogPage(3, ['message-3', 'message-4'])],
    };

    const next = patchInfiniteChatLogWithProgress(cache, (current) =>
        patchChatLogWithProgress(current, {
            step: {
                detail: 'Quarterly revenue',
                id: 'widget:chart',
                kind: 'widget',
                label: 'Rendered a chart',
                status: 'active',
            },
            timestamp: '2026-04-27T17:20:08.408Z',
            turn,
        })
    );

    expect(next?.pages.at(-1)?.rows.map((row) => row.id)).toEqual([
        'message-3',
        'message-4',
        'act_run-1_widget_chart',
    ]);
    expect(next?.pages.at(-1)?.limit).toBe(2);
    expect(next?.pages.at(-1)?.nextBeforeSequence).toBe(3);
    expect(next?.pages.at(-1)?.totalMessages).toBe(4);
});

function chatLogPage(nextBeforeSequence: number | null, ids: string[]): ChatLogPage {
    return {
        activeReplies: [],
        failedTurns: [],
        limit: 2,
        nextBeforeSequence,
        rows: ids.map(messageRow),
        settledRunIds: [],
        totalMessages: 4,
    };
}

function messageRow(id: string): ChatLogPage['rows'][number] {
    return {
        actor: { id: 'agent-1', kind: 'agent' },
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            actor: { id: 'agent-1', kind: 'agent' },
            content: id,
            id,
            sender: 'Claw',
            senderType: 'agent',
            sourceSessionId: null,
            sourceSessionKey: 'session-1',
            tavernAgentId: 'agent-1',
            timestamp: `2026-04-27T17:20:0${id.at(-1)}.000Z`,
        },
    };
}
