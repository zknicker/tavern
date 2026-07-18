import { expect, test } from 'bun:test';
import {
    appendTimelineMessage,
    getLoggedTimelineMessageIds,
    mergeTimelineMessages,
} from './chat-timeline-messages.ts';

test('appendTimelineMessage appends a user message row', () => {
    const current = {
        limit: 20,
        nextBeforeSequence: null,
        rows: [
            {
                actor: { id: 'agent-1', kind: 'agent' as const },
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    tavernAgentId: 'agent-1',
                    actor: { id: 'agent-1', kind: 'agent' as const },
                    content: 'Previous reply',
                    id: 'message-1',
                    sender: 'Claw',
                    senderType: 'agent' as const,
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-20T18:14:00.000Z',
                },
            },
        ],
        totalMessages: 1,
    };

    const next = appendTimelineMessage(current, {
        content: 'love to hear it',
        id: 'timeline:1',
        sessionKey: 'session-1',
        timestamp: '2026-04-20T18:15:00.000Z',
    });

    expect(next?.totalMessages).toBe(2);
    expect(next?.rows.at(-1)).toMatchObject({
        id: 'timeline:1',
        kind: 'message',
        message: {
            content: 'love to hear it',
            sender: 'You',
            senderType: 'user',
        },
    });
});

test('appendTimelineMessage stamps the current Tavern user on optimistic rows', () => {
    const next = appendTimelineMessage(
        {
            limit: 20,
            nextBeforeSequence: null,
            rows: [],
            totalMessages: 0,
        },
        {
            content: 'hello',
            id: 'timeline:current-user',
            timestamp: '2026-04-20T18:15:00.000Z',
        },
        'usr_current'
    );

    expect(next?.rows[0]).toMatchObject({
        actor: { id: 'usr_current', kind: 'participant' },
        message: { actor: { id: 'usr_current', kind: 'participant' } },
    });
});

test('appendTimelineMessage keeps loaded rows visible past the page limit', () => {
    const current = {
        limit: 2,
        nextBeforeSequence: null,
        rows: [
            {
                actor: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    content: 'hello',
                    id: 'message-1',
                    sender: 'You',
                    senderType: 'user' as const,
                    sourceSessionId: null,
                    sourceSessionKey: '',
                    timestamp: '2026-04-20T18:14:00.000Z',
                },
            },
            {
                actor: { id: 'agent-1', kind: 'agent' as const },
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-2',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    tavernAgentId: 'agent-1',
                    actor: { id: 'agent-1', kind: 'agent' as const },
                    content: 'hey',
                    id: 'message-2',
                    sender: 'Claw',
                    senderType: 'agent' as const,
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-20T18:14:30.000Z',
                },
            },
        ],
        totalMessages: 2,
    };

    const next = appendTimelineMessage(current, {
        content: 'another one',
        id: 'timeline:2',
        timestamp: '2026-04-20T18:15:00.000Z',
    });

    expect(next?.nextBeforeSequence).toBeNull();
    expect(next?.totalMessages).toBe(3);
    expect(next?.rows.map((row) => row.id)).toEqual(['message-1', 'message-2', 'timeline:2']);
});

test('mergeTimelineMessages can render a local row before the log has loaded', () => {
    const next = mergeTimelineMessages({
        limit: 20,
        logged: undefined,
        messages: [
            {
                content: 'love to hear it',
                id: 'timeline:1',
                timestamp: '2026-04-20T18:15:00.000Z',
            },
        ],
    });

    expect(next).toMatchObject({
        limit: 20,
        nextBeforeSequence: null,
        totalMessages: 1,
    });
    expect(next?.rows).toHaveLength(1);
    expect(next?.rows[0]).toMatchObject({
        id: 'timeline:1',
        kind: 'message',
        message: {
            content: 'love to hear it',
            sender: 'You',
            senderType: 'user',
        },
    });
});

test('mergeTimelineMessages keeps a local user row before already visible live activity', () => {
    const next = mergeTimelineMessages({
        limit: 20,
        logged: {
            limit: 20,
            nextBeforeSequence: null,
            rows: [
                {
                    actor: { id: 'agent-1', kind: 'agent' as const },
                    completedAt: null,
                    connectsToNext: false,
                    connectsToPrevious: false,
                    id: 'act_run-1_assistant-preamble',
                    isFirstInGroup: true,
                    kind: 'tool' as const,
                    sessionKey: 'session-1',
                    spawnedRelationships: [],
                    startedAt: '2026-04-20T18:15:05.000Z',
                    toolCall: {
                        callId: null,
                        facts: [],
                        label: 'Assistant reply',
                        name: 'message',
                        status: null,
                        summaryParts: ['I will inspect this first.'],
                    },
                },
            ],
            totalMessages: 1,
        },
        messages: [
            {
                content: 'Please investigate.',
                id: 'timeline:1',
                sessionKey: 'session-1',
                timestamp: '2026-04-20T18:15:00.000Z',
            },
        ],
    });

    expect(next?.rows.map((row) => row.id)).toEqual(['timeline:1', 'act_run-1_assistant-preamble']);
    expect(
        next?.rows.map((row) => (row.kind === 'system' ? null : row.connectsToPrevious))
    ).toEqual([false, true]);
    expect(next?.rows.map((row) => (row.kind === 'system' ? null : row.connectsToNext))).toEqual([
        true,
        false,
    ]);
});

test('getLoggedTimelineMessageIds confirms local user rows by stable id only', () => {
    const logged = {
        limit: 20,
        nextBeforeSequence: null,
        rows: [
            {
                actor: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    content: 'love to hear it',
                    id: 'message-1',
                    sender: 'You',
                    senderType: 'user' as const,
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-20T18:10:00.000Z',
                },
            },
            {
                actor: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-2',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    content: 'love to hear it',
                    id: 'timeline:1',
                    sender: 'You',
                    senderType: 'user' as const,
                    sourceSessionId: null,
                    sourceSessionKey: 'session-2',
                    timestamp: '2026-04-20T18:15:01.000Z',
                },
            },
        ],
        totalMessages: 2,
    };

    const confirmedIds = getLoggedTimelineMessageIds(logged, [
        {
            content: 'love to hear it',
            id: 'timeline:1',
            sessionKey: 'session-2',
            timestamp: '2026-04-20T18:15:00.000Z',
        },
    ]);

    expect(confirmedIds).toEqual(['timeline:1']);
});

test('getLoggedTimelineMessageIds does not confirm same-content user rows with different ids', () => {
    const logged = {
        limit: 20,
        nextBeforeSequence: null,
        rows: [
            {
                actor: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'different-message-id',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    content: 'love to hear it',
                    id: 'different-message-id',
                    sender: 'You',
                    senderType: 'user' as const,
                    sourceSessionId: null,
                    sourceSessionKey: 'session-2',
                    timestamp: '2026-04-20T18:15:01.000Z',
                },
            },
        ],
        totalMessages: 1,
    };

    const confirmedIds = getLoggedTimelineMessageIds(logged, [
        {
            content: 'love to hear it',
            id: 'timeline:1',
            sessionKey: 'session-2',
            timestamp: '2026-04-20T18:15:00.000Z',
        },
    ]);

    expect(confirmedIds).toEqual([]);
});

test('getLoggedTimelineMessageIds confirms completed turns by stable id when timestamps differ', () => {
    const logged = {
        limit: 20,
        nextBeforeSequence: null,
        rows: [
            {
                actor: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    content: 'yo',
                    id: 'timeline:yo',
                    sender: 'You',
                    senderType: 'user' as const,
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-20T18:15:00.000Z',
                },
            },
            {
                actor: { id: 'agent-1', kind: 'agent' as const },
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-2',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    tavernAgentId: 'agent-1',
                    actor: { id: 'agent-1', kind: 'agent' as const },
                    content: 'yo',
                    id: 'message-2',
                    sender: 'Claw',
                    senderType: 'agent' as const,
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-20T18:15:08.000Z',
                },
            },
        ],
        totalMessages: 2,
    };

    const confirmedIds = getLoggedTimelineMessageIds(logged, [
        {
            content: 'yo',
            id: 'timeline:yo',
            sessionKey: 'session-1',
            timestamp: '2026-04-20T18:15:12.000Z',
        },
    ]);

    expect(confirmedIds).toEqual(['timeline:yo']);
});

test('getLoggedTimelineMessageIds does not confirm long-running turns by content and timestamp', () => {
    const logged = {
        limit: 20,
        nextBeforeSequence: null,
        rows: [
            {
                actor: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    content: 'run five slow tools',
                    id: 'message-1',
                    sender: 'You',
                    senderType: 'user' as const,
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-20T18:15:42.000Z',
                },
            },
        ],
        totalMessages: 1,
    };

    const confirmedIds = getLoggedTimelineMessageIds(logged, [
        {
            content: 'run five slow tools',
            id: 'timeline:slow-tools',
            sessionKey: 'session-1',
            timestamp: '2026-04-20T18:15:00.000Z',
        },
    ]);

    expect(confirmedIds).toEqual([]);
});

test('getLoggedTimelineMessageIds does not confirm local rows by session key alone', () => {
    const logged = {
        limit: 20,
        nextBeforeSequence: null,
        rows: [
            {
                actor: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    content: 'follow up',
                    id: 'message-1',
                    sender: 'You',
                    senderType: 'user' as const,
                    sourceSessionId: null,
                    sourceSessionKey:
                        'agent:main:tavern:channel:a1596d48-3a6a-4343-9f5c-dd20ce0fe475',
                    timestamp: '2026-04-20T18:15:01.000Z',
                },
            },
        ],
        totalMessages: 1,
    };

    const confirmedIds = getLoggedTimelineMessageIds(logged, [
        {
            content: 'follow up',
            id: 'timeline:follow-up',
            sessionKey: 'agent:main:tavern:channel:a1596d48-3a6a-4343-9f5c-dd20ce0fe475',
            timestamp: '2026-04-20T18:15:00.000Z',
        },
    ]);

    expect(confirmedIds).toEqual([]);
});
