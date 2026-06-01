import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { buildTranscriptEntries } from './chat-transcript-model.ts';

type ChatRow = NonNullable<ChatLogOutput>['rows'][number];
type ToolChatRow = Extract<ChatRow, { kind: 'tool' }>;

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

test('buildTranscriptEntries keeps runtime notices as standalone system entries', () => {
    const rows: ChatRow[] = [
        toolRow('tool-1', false, false),
        runtimeNoticeRow('notice-1'),
        agentMessage('agent-1', 'Done.', false, false),
    ];

    const entries = buildTranscriptEntries({
        activeReply: null,
        rows,
    });

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ kind: 'turn', participant: 'agent' });
    expect(entries[1]).toMatchObject({ id: 'notice-1', kind: 'system' });
    expect(entries[2]).toMatchObject({ kind: 'turn', participant: 'agent' });
});

test('buildTranscriptEntries renders active reply text after durable activity', () => {
    const entries = buildTranscriptEntries({
        activeReply: {
            agentId: 'agent-1',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-11T16:00:00.000Z',
            text: 'Working...',
        },
        rows: [toolRow('tool-1', false, false)],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'turn', participant: 'agent' });

    if (entries[0]?.kind !== 'turn') {
        throw new Error('Expected agent turn entry.');
    }

    expect(
        entries[0].items.map((item) => (item.kind === 'row' ? item.row.kind : item.kind))
    ).toEqual(['tool', 'activeReply']);
});

test('buildTranscriptEntries keeps prior completed tool activity grouped during a later active turn', () => {
    const rows: ChatRow[] = [
        userMessage('user-1', 'Use the tool', false, false),
        toolRow('tool-1', false, false, null),
        toolRow('tool-2', false, false, null),
        toolRow('tool-3', false, false, null),
        toolRow('tool-4', false, false, null),
        toolRow('tool-5', false, false, null),
        agentMessage('agent-1', 'Done.', false, false),
        userMessage('user-2', 'Do it again', false, false),
    ];

    const entries = buildTranscriptEntries({
        activeReply: {
            agentId: 'agent-1',
            isThinking: true,
            runId: 'run-2',
            sessionKey: 'session-1',
            startedAt: '2026-05-11T16:01:00.000Z',
            text: '',
        },
        rows,
    });

    const completedAgentTurn = entries.find(
        (entry) =>
            entry.kind === 'turn' &&
            entry.participant === 'agent' &&
            entry.items.some((item) => item.kind === 'row' && item.row.id === 'tool-1')
    );

    expect(completedAgentTurn).toBeDefined();

    if (completedAgentTurn?.kind !== 'turn') {
        throw new Error('Expected completed agent turn entry.');
    }

    expect(
        completedAgentTurn.items.map((item) => (item.kind === 'row' ? item.row.kind : item.kind))
    ).toEqual(['tool', 'tool', 'tool', 'tool', 'tool', 'message']);
    expect(entries.filter((entry) => entry.kind === 'system')).toHaveLength(0);
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

test('buildTranscriptEntries hides active thinking status after tool activity starts', () => {
    const entries = buildTranscriptEntries({
        activeReply: {
            agentId: 'agent-1',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-11T16:00:00.000Z',
            text: '',
        },
        rows: [toolRow('tool-1', false, false)],
    });

    expect(entries).toHaveLength(1);

    if (entries[0]?.kind !== 'turn') {
        throw new Error('Expected agent turn entry.');
    }

    expect(
        entries[0].items.map((item) => (item.kind === 'row' ? item.row.kind : item.kind))
    ).toEqual(['tool']);
});

test('buildTranscriptEntries keeps active thinking status after assistant narration', () => {
    const entries = buildTranscriptEntries({
        activeReply: {
            agentId: 'agent-1',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-11T16:00:00.000Z',
            text: '',
        },
        rows: [toolRow('tool-1', false, true), narrationRow('narration-1', true, false)],
    });

    expect(entries).toHaveLength(1);

    if (entries[0]?.kind !== 'turn') {
        throw new Error('Expected agent turn entry.');
    }

    expect(
        entries[0].items.map((item) =>
            item.kind === 'row' ? `${item.row.kind}:${getRowKindLabel(item.row)}` : item.kind
        )
    ).toEqual(['tool:exec', 'tool:message', 'activeStatus']);
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

function toolRow(
    id: string,
    connectsToPrevious: boolean,
    connectsToNext: boolean,
    actor: ToolChatRow['actor'] = { id: 'agent-1', kind: 'agent' }
): ChatRow {
    return {
        actor,
        completedAt: '2026-05-11T16:00:05.000Z',
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

function narrationRow(id: string, connectsToPrevious: boolean, connectsToNext: boolean): ChatRow {
    const row = toolRow(id, connectsToPrevious, connectsToNext) as ToolChatRow;

    return {
        ...row,
        completedAt: null,
        startedAt: '2026-05-11T16:00:06.000Z',
        toolCall: {
            callId: null,
            facts: [],
            label: 'I found the first file.',
            name: 'message',
            status: 'running',
            summaryParts: ['I found the first file.'],
        },
    };
}

function getRowKindLabel(row: ChatRow) {
    return row.kind === 'tool' ? row.toolCall.name : row.kind;
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

function runtimeNoticeRow(id: string): ChatRow {
    return {
        id,
        kind: 'system',
        runtimeNotice: {
            detail: 'd348a369-223c-42a7-8220-67c7340810c2',
            kind: 'new_session',
            sessionId: 'd348a369-223c-42a7-8220-67c7340810c2',
            text: 'New session: d348a369-223c-42a7-8220-67c7340810c2',
            title: 'Started new session',
        },
        systemKind: 'runtimeNotice',
        timestamp: '2026-05-11T16:00:01.500Z',
    };
}
