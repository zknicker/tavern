import { expect, test } from 'bun:test';
import {
    appendTimelineMessage,
    getLoggedTimelineMessageIds,
    mergeTimelineMessages,
} from './chat-timeline-messages.ts';

test('appendTimelineMessage appends a user message row', () => {
    const current = {
        limit: 20,
        offset: 0,
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
        total: 1,
    };

    const next = appendTimelineMessage(current, {
        content: 'love to hear it',
        id: 'timeline:1',
        sessionKey: 'session-1',
        timestamp: '2026-04-20T18:15:00.000Z',
    });

    expect(next?.total).toBe(2);
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

test('appendTimelineMessage trims to the current page limit', () => {
    const current = {
        limit: 2,
        offset: 0,
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
        total: 2,
    };

    const next = appendTimelineMessage(current, {
        content: 'another one',
        id: 'timeline:2',
        timestamp: '2026-04-20T18:15:00.000Z',
    });

    expect(next?.offset).toBe(1);
    expect(next?.total).toBe(3);
    expect(next?.rows.map((row) => row.id)).toEqual(['message-2', 'timeline:2']);
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
        offset: 0,
        total: 1,
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

test('getLoggedTimelineMessageIds matches the logged user row and ignores older duplicates', () => {
    const logged = {
        limit: 20,
        offset: 0,
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
                    id: 'message-2',
                    sender: 'You',
                    senderType: 'user' as const,
                    sourceSessionId: null,
                    sourceSessionKey: 'session-2',
                    timestamp: '2026-04-20T18:15:01.000Z',
                },
            },
        ],
        total: 2,
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

test('getLoggedTimelineMessageIds matches a completed turn when the runtime timestamp is earlier', () => {
    const logged = {
        limit: 20,
        offset: 0,
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
                    id: 'message-1',
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
        total: 2,
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

test('getLoggedTimelineMessageIds matches a long-running turn when the runtime timestamp lands late', () => {
    const logged = {
        limit: 20,
        offset: 0,
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
        total: 1,
    };

    const confirmedIds = getLoggedTimelineMessageIds(logged, [
        {
            content: 'run five slow tools',
            id: 'timeline:slow-tools',
            sessionKey: 'session-1',
            timestamp: '2026-04-20T18:15:00.000Z',
        },
    ]);

    expect(confirmedIds).toEqual(['timeline:slow-tools']);
});

test('getLoggedTimelineMessageIds matches logged session keys', () => {
    const logged = {
        limit: 20,
        offset: 0,
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
        total: 1,
    };

    const confirmedIds = getLoggedTimelineMessageIds(logged, [
        {
            content: 'follow up',
            id: 'timeline:follow-up',
            sessionKey: 'agent:main:tavern:channel:a1596d48-3a6a-4343-9f5c-dd20ce0fe475',
            timestamp: '2026-04-20T18:15:00.000Z',
        },
    ]);

    expect(confirmedIds).toEqual(['timeline:follow-up']);
});
