import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { patchChatLogWithProgress } from './chat-log-cache.ts';

const turn = {
    agentId: 'main',
    chatId: 'chat-1',
    runId: 'run-1',
    sessionKey: 'agent:main:tavern:channel:chat-1',
    startedAt: '2026-05-22T19:00:00.000Z',
};

function emptyLog(): ChatLogOutput {
    return {
        limit: 100,
        offset: 0,
        rows: [],
        total: 0,
    };
}

test('progress patch inserts a durable activity row with the persisted activity id', () => {
    const log = patchChatLogWithProgress(emptyLog(), {
        step: {
            detail: 'I will run a timed shell check before the final reply.',
            id: 'preamble-1',
            kind: 'message',
            label: 'Assistant reply',
            status: 'active',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });

    expect(log?.rows).toHaveLength(1);
    expect(log?.rows[0]).toMatchObject({
        completedAt: null,
        id: 'act_preamble-1',
        kind: 'tool',
        sessionKey: turn.sessionKey,
        startedAt: '2026-05-22T19:00:01.000Z',
        toolCall: {
            name: 'message',
            summaryParts: ['I will run a timed shell check before the final reply.'],
        },
    });
});

test('progress patch updates an existing activity row without replacing its start time', () => {
    const running = patchChatLogWithProgress(emptyLog(), {
        step: {
            id: 'tool-call-1',
            kind: 'tool',
            label: "Used sleep 5; printf 'done\\n'",
            status: 'active',
            toolCallId: 'tool-call-1',
            toolName: 'bash',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });
    const completed = patchChatLogWithProgress(running, {
        step: {
            detail: 'completed 5.0s',
            id: 'tool-call-1',
            kind: 'tool',
            label: 'Used /bin/zsh -lc "sleep 5; printf \'done\\n\'"',
            status: 'completed',
            toolCallId: 'tool-call-1',
            toolName: 'bash',
        },
        timestamp: '2026-05-22T19:00:06.000Z',
        turn,
    });

    expect(completed?.total).toBe(1);
    expect(completed?.rows[0]).toMatchObject({
        completedAt: '2026-05-22T19:00:06.000Z',
        id: 'act_tool-call-1',
        startedAt: '2026-05-22T19:00:01.000Z',
        toolCall: {
            facts: [
                {
                    label: 'Command',
                    value: '/bin/zsh -lc "sleep 5; printf \'done\\n\'"',
                },
            ],
            name: 'bash',
            summaryParts: ['/bin/zsh -lc "sleep 5; printf \'done\\n\'"'],
        },
    });
});
