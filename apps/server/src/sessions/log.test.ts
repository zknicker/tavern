import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecentSessionLogPage, buildSessionLogPage } from './log.ts';

test('buildSessionLogPage groups tool calls with tool results', () => {
    const page = buildSessionLogPage({
        deliveries: [],
        limit: 10,
        messages: [
            {
                content: '',
                id: 'message-1',
                metadata: {
                    parts: [
                        {
                            arguments: {
                                path: '/tmp/file.txt',
                            },
                            id: 'call-1',
                            name: 'read',
                            type: 'toolCall',
                        },
                    ],
                },
                sender: 'assistant',
                senderType: 'agent',
                timestamp: '2026-03-21T12:00:01.000Z',
            },
            {
                content: 'file contents',
                id: 'message-2',
                metadata: {
                    toolCallId: 'call-1',
                    toolName: 'read',
                },
                sender: 'toolresult',
                senderType: 'system',
                timestamp: '2026-03-21T12:00:02.000Z',
            },
        ],
        offset: 0,
    });

    assert.equal(page.entries.length, 1);
    assert.equal(page.entries[0]?.kind, 'toolExecution');

    if (page.entries[0]?.kind !== 'toolExecution') {
        return;
    }

    assert.equal(page.entries[0].invocation?.id, 'message-1');
    assert.equal(page.entries[0].result?.id, 'message-2');
});

test('buildSessionLogPage groups mixed-case toolResult senders when metadata is present', () => {
    const page = buildSessionLogPage({
        deliveries: [],
        limit: 10,
        messages: [
            {
                content: '',
                id: 'message-1',
                metadata: {
                    parts: [
                        {
                            arguments: {
                                command: 'echo hello',
                            },
                            id: 'call-1',
                            name: 'exec',
                            type: 'toolCall',
                        },
                    ],
                },
                sender: 'assistant',
                senderType: 'agent',
                timestamp: '2026-03-21T12:00:01.000Z',
            },
            {
                content: '{"status":"error","tool":"exec","error":"denied"}',
                id: 'message-2',
                metadata: {
                    toolCallId: 'call-1',
                    toolName: 'exec',
                },
                sender: 'toolResult',
                senderType: 'system',
                timestamp: '2026-03-21T12:00:02.000Z',
            },
        ],
        offset: 0,
    });

    assert.equal(page.entries.length, 1);
    assert.equal(page.entries[0]?.kind, 'toolExecution');

    if (page.entries[0]?.kind !== 'toolExecution') {
        return;
    }

    assert.equal(page.entries[0].invocation?.id, 'message-1');
    assert.equal(page.entries[0].result?.id, 'message-2');
});

test('buildRecentSessionLogPage returns the latest 10 combined entries', () => {
    const page = buildRecentSessionLogPage({
        deliveries: [
            {
                childSessionKey: 'agent:main:discord:general',
                childSessionName: '#general',
                childSessionPlatform: 'discord',
                childSessionSource: '#general',
                childSessionTitle: '#general',
                childSessionType: 'chat',
                deliveredAt: '2026-03-21T12:00:05.500Z',
                id: 'delivery-new',
                messageText: 'new delivery',
                mode: 'announce',
                parentSessionKey: 'agent:main:cron:job-1',
                parentSessionName: 'job-1',
                parentSessionPlatform: null,
                parentSessionSource: 'Cron: job-1',
                parentSessionTitle: 'Cron: job-1',
                parentSessionType: 'cron',
                payload: null,
                sourceMessageId: 'message-12',
                status: 'delivered',
                targetMessageId: null,
            },
            {
                childSessionKey: 'agent:main:discord:general',
                childSessionName: '#general',
                childSessionPlatform: 'discord',
                childSessionSource: '#general',
                childSessionTitle: '#general',
                childSessionType: 'chat',
                deliveredAt: '2026-03-20T12:00:00.000Z',
                id: 'delivery-old',
                messageText: 'old delivery',
                mode: 'announce',
                parentSessionKey: 'agent:main:cron:job-2',
                parentSessionName: 'job-2',
                parentSessionPlatform: null,
                parentSessionSource: 'Cron: job-2',
                parentSessionTitle: 'Cron: job-2',
                parentSessionType: 'cron',
                payload: null,
                sourceMessageId: 'message-1',
                status: 'delivered',
                targetMessageId: null,
            },
        ],
        limit: 10,
        messages: Array.from({ length: 12 }, (_, index) => ({
            content: `message ${index + 1}`,
            id: `message-${index + 1}`,
            sender: 'assistant',
            senderType: 'agent' as const,
            timestamp: `2026-03-21T12:00:${String(index).padStart(2, '0')}.000Z`,
        })),
    });

    assert.equal(page.entries.length, 10);
    assert.equal(page.entries[0]?.id, 'message-4');
    assert.equal(page.entries.at(-1)?.id, 'message-12');
    assert.equal(
        page.entries.some((entry) => entry.id === 'delivery-old'),
        false
    );
    assert.equal(
        page.entries.some((entry) => entry.id === 'delivery-new'),
        true
    );
});

test('buildSessionLogPage weaves thinking, access, and artifact activity by timestamp', () => {
    const page = buildSessionLogPage({
        accessEvents: [
            {
                errorCode: 'visibility_restricted',
                errorMessage: 'Access denied',
                id: 'access-1',
                occurredAt: '2026-03-21T12:00:03.000Z',
                status: 'forbidden',
                targetSessionKey: 'agent:main:session:restricted',
                toolName: 'sessions_read',
            },
        ],
        artifacts: [
            {
                artifactType: 'transcript',
                createdAt: '2026-03-21T12:00:04.000Z',
                id: 'artifact-1',
                mimeType: null,
                path: '/tmp/transcript.md',
                payload: null,
            },
        ],
        deliveries: [],
        limit: 10,
        messages: [
            {
                content: 'Started reasoning',
                id: 'message-1',
                metadata: {
                    parts: [
                        {
                            text: 'Need to inspect the session.',
                            type: 'thinking',
                        },
                    ],
                },
                sender: 'assistant',
                senderType: 'agent',
                timestamp: '2026-03-21T12:00:01.000Z',
            },
        ],
        offset: 0,
        thinking: [
            {
                id: 'thinking-1',
                messageId: 'message-1',
                sender: 'assistant',
                text: 'Need to inspect the session.',
                timestamp: '2026-03-21T12:00:01.000Z',
            },
        ],
    });

    assert.deepEqual(
        page.entries.map((entry) => entry.kind),
        ['message', 'thinking', 'accessEvent', 'artifact']
    );
});
