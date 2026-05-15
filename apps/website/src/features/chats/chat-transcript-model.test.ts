import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { buildTranscriptEntries } from './chat-transcript-model.ts';

type ChatRow = NonNullable<ChatLogOutput>['rows'][number];

test('buildTranscriptEntries keeps agent tool calls inside the agent turn', () => {
    const rows: ChatRow[] = [
        userMessage('user-1', 'Use the tool', false, false),
        toolRow('tool-1', true, true),
        agentMessage('agent-1', 'Done.', true, false),
    ];

    const entries = buildTranscriptEntries({
        activeReply: null,
        rows,
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ kind: 'turn', participant: 'user' });
    expect(entries[1]).toMatchObject({ kind: 'turn', participant: 'agent' });

    if (entries[1]?.kind !== 'turn') {
        throw new Error('Expected agent turn entry.');
    }

    expect(
        entries[1].items.map((item) => (item.kind === 'row' ? item.row.kind : item.kind))
    ).toEqual(['tool', 'message']);
});

test('buildTranscriptEntries keeps thinking rows inside the agent turn', () => {
    const rows: ChatRow[] = [
        toolRow('tool-1', false, false),
        thinkingRow('thinking-1'),
        agentMessage('agent-1', 'Done.', false, false),
    ];

    const entries = buildTranscriptEntries({
        activeReply: null,
        rows,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'turn', participant: 'agent' });

    if (entries[0]?.kind !== 'turn') {
        throw new Error('Expected agent turn entry.');
    }

    expect(
        entries[0].items.map((item) =>
            item.kind === 'row' && item.row.kind === 'system'
                ? `${item.row.kind}:${item.row.systemKind}`
                : item.kind === 'row'
                  ? item.row.kind
                  : item.kind
        )
    ).toEqual(['tool', 'system:thinking', 'message']);
});

test('buildTranscriptEntries appends active reply and progress to one agent turn', () => {
    const entries = buildTranscriptEntries({
        activeReply: {
            agentId: 'agent-1',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-11T16:00:00.000Z',
            text: 'Working...',
        },
        activeReplySteps: [
            {
                id: 'step-1',
                kind: 'tool',
                label: 'Running tool',
                status: 'active',
            },
        ],
        rows: [],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'turn', participant: 'agent' });

    if (entries[0]?.kind !== 'turn') {
        throw new Error('Expected agent turn entry.');
    }

    expect(entries[0].items.map((item) => item.kind)).toEqual(['activeReply', 'activeProgress']);
});

test('buildTranscriptEntries shows thinking status without a generic activity block', () => {
    const entries = buildTranscriptEntries({
        activeReply: {
            agentId: 'agent-1',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-11T16:00:00.000Z',
            text: '',
        },
        rows: [],
    });

    expect(entries).toHaveLength(1);

    if (entries[0]?.kind !== 'turn') {
        throw new Error('Expected agent turn entry.');
    }

    expect(entries[0].items.map((item) => item.kind)).toEqual(['activeStatus']);
    expect(entries[0].items[0]).toMatchObject({
        kind: 'activeStatus',
        status: 'thinking',
    });
});

test('buildTranscriptEntries shows typing status without a generic activity block', () => {
    const entries = buildTranscriptEntries({
        activeReply: {
            agentId: 'agent-1',
            isThinking: false,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-11T16:00:00.000Z',
            text: '',
        },
        rows: [],
    });

    expect(entries).toHaveLength(1);

    if (entries[0]?.kind !== 'turn') {
        throw new Error('Expected agent turn entry.');
    }

    expect(entries[0].items.map((item) => item.kind)).toEqual(['activeStatus']);
    expect(entries[0].items[0]).toMatchObject({
        kind: 'activeStatus',
        status: 'typing',
    });
});

function userMessage(
    id: string,
    content: string,
    connectsToPrevious: boolean,
    connectsToNext: boolean
): ChatRow {
    return {
        actor: null,
        connectsToNext,
        connectsToPrevious,
        id,
        isFirstInGroup: !connectsToPrevious,
        kind: 'message',
        message: {
            actor: null,
            content,
            id,
            sender: 'You',
            senderType: 'user',
            sourceSessionId: null,
            sourceSessionKey: 'session-1',
            timestamp: '2026-05-11T16:00:00.000Z',
        },
    };
}

function agentMessage(
    id: string,
    content: string,
    connectsToPrevious: boolean,
    connectsToNext: boolean
): ChatRow {
    return {
        actor: { id: 'agent-1', kind: 'agent' },
        connectsToNext,
        connectsToPrevious,
        id,
        isFirstInGroup: !connectsToPrevious,
        kind: 'message',
        message: {
            tavernAgentId: 'agent-1',
            content,
            id,
            sender: 'Agent',
            senderType: 'agent',
            sourceSessionId: null,
            sourceSessionKey: 'session-1',
            timestamp: '2026-05-11T16:00:02.000Z',
        },
    };
}

function toolRow(id: string, connectsToPrevious: boolean, connectsToNext: boolean): ChatRow {
    return {
        actor: { id: 'agent-1', kind: 'agent' },
        completedAt: null,
        connectsToNext,
        connectsToPrevious,
        id,
        isFirstInGroup: !connectsToPrevious,
        kind: 'tool',
        sessionKey: 'session-1',
        spawnedRelationships: [],
        startedAt: '2026-05-11T16:00:01.000Z',
        toolCall: {
            callId: 'call-1',
            facts: [],
            label: 'command -v gog',
            name: 'exec',
            status: 'running',
            summaryParts: ['command -v gog'],
        },
    };
}

function thinkingRow(id: string): ChatRow {
    return {
        id,
        kind: 'system',
        systemKind: 'thinking',
        thinking: {
            id,
            messageId: 'message-thinking',
            sender: 'Agent',
            text: 'Need to inspect the files before replying.',
            timestamp: '2026-05-11T16:00:01.500Z',
        },
        timestamp: '2026-05-11T16:00:01.500Z',
    };
}
