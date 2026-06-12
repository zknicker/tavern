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
    const cache: InfiniteData<ChatLogPage> = {
        pageParams: [0, 2],
        pages: [
            chatLogPage(0, ['message-1', 'message-2']),
            chatLogPage(2, ['message-3', 'message-4']),
        ],
    };

    const next = patchInfiniteChatLogWithProgress(cache, (current) =>
        patchChatLogWithProgress(current, {
            step: {
                id: 'tool:web',
                kind: 'tool',
                label: 'Using web search',
                status: 'active',
            },
            timestamp: '2026-04-27T17:20:08.408Z',
            turn,
        })
    );

    expect(next?.pages.at(-1)?.rows.map((row) => row.id)).toEqual([
        'message-3',
        'message-4',
        'act_run-1_tool_web',
    ]);
    expect(next?.pages.at(-1)?.limit).toBe(3);
    expect(next?.pages.at(-1)?.total).toBe(5);
});

test('single-page live progress keeps loaded history instead of trimming', () => {
    const cache: InfiniteData<ChatLogPage> = {
        pageParams: [2],
        pages: [chatLogPage(2, ['message-3', 'message-4'])],
    };

    const next = patchInfiniteChatLogWithProgress(cache, (current) =>
        patchChatLogWithProgress(current, {
            step: {
                id: 'tool:web',
                kind: 'tool',
                label: 'Using web search',
                status: 'active',
            },
            timestamp: '2026-04-27T17:20:08.408Z',
            turn,
        })
    );

    expect(next?.pages.at(-1)?.rows.map((row) => row.id)).toEqual([
        'message-3',
        'message-4',
        'act_run-1_tool_web',
    ]);
    expect(next?.pages.at(-1)?.limit).toBe(3);
    expect(next?.pages.at(-1)?.offset).toBe(2);
    expect(next?.pages.at(-1)?.total).toBe(5);
});

function chatLogPage(offset: number, ids: string[]): ChatLogPage {
    return {
        activeReply: null,
        limit: 2,
        offset,
        rows: ids.map(messageRow),
        total: 4,
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
