import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatRows } from '../src/chat/rows.ts';

test('buildChatRows normalizes agent names and renders projected tool calls', () => {
    const rows = buildChatRows({
        agentLookup: {
            byAlias: new Map(),
            byDiscordId: new Map(),
            byId: new Map([
                [
                    'tiny',
                    {
                        agentId: 'tiny',
                        displayName: 'Tiny',
                    },
                ],
            ]),
            byProviderAgentId: new Map(),
        },
        messages: [
            {
                agentId: 'tiny',
                message: {
                    actor: {
                        id: 'tiny',
                        kind: 'agent',
                    },
                    tavernAgentId: 'tiny',
                    content: 'Looking into it',
                    id: 'message-1',
                    metadata: {
                        model: 'claude-3.7-sonnet',
                        modelInfo: {
                            label: 'claude-3.7-sonnet',
                            model: 'claude-3.7-sonnet',
                            provider: 'claude',
                        },
                        provider: 'claude',
                    },
                    sender: 'assistant',
                    senderType: 'agent',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: 'agent:tiny:discord:channel:1',
                    timestamp: '2026-04-01T12:00:00.000Z',
                },
            },
            {
                agentId: 'tiny',
                message: {
                    actor: {
                        id: 'tiny',
                        kind: 'agent',
                    },
                    tavernAgentId: 'tiny',
                    content: '',
                    id: 'message-2',
                    metadata: {
                        parts: [
                            {
                                arguments: {
                                    path: 'README.md',
                                },
                                id: 'call-1',
                                name: 'read',
                                type: 'toolCall',
                            },
                        ],
                        toolCallId: 'call-1',
                        toolName: 'read',
                    },
                    sender: 'assistant',
                    senderType: 'agent',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: 'agent:tiny:discord:channel:1',
                    timestamp: '2026-04-01T12:01:00.000Z',
                },
            },
            {
                agentId: 'tiny',
                message: {
                    actor: null,
                    tavernAgentId: null,
                    content: '{"status":"ok","path":"README.md"}',
                    id: 'message-3',
                    metadata: {
                        toolCallId: 'call-1',
                        toolName: 'read',
                    },
                    sender: 'toolResult',
                    senderType: 'system',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: 'agent:tiny:discord:channel:1',
                    timestamp: '2026-04-01T12:01:02.000Z',
                },
            },
        ],
        toolCalls: [
            {
                arguments: {
                    path: 'README.md',
                },
                childSessionKey: null,
                finishedAt: '2026-04-01T12:01:02.000Z',
                id: 'tool-record-1',
                isError: false,
                messageId: 'message-2',
                result: {
                    path: 'README.md',
                    status: 'ok',
                },
                sessionKey: 'agent:tiny:discord:channel:1',
                startedAt: '2026-04-01T12:01:00.000Z',
                toolCallId: 'call-1',
                toolName: 'read',
            },
        ],
        workers: [
            {
                worker: {
                    agentId: 'tiny',
                    agentName: 'Tiny',
                    chatTitle: 'Tiny Chat',
                    childSessionKey: 'agent:tiny:subagent:child-1',
                    cleanupAfter: null,
                    createdAt: '2026-04-01T12:02:00.000Z',
                    description: 'Review README',
                    detail: 'Review README',
                    deliveryStatus: null,
                    endedAt: null,
                    error: null,
                    executionMode: 'detached_session',
                    id: 'worker-1',
                    kind: 'subagent',
                    lastEventAt: '2026-04-01T12:02:05.000Z',
                    notifyPolicy: null,
                    parentWorkerId: null,
                    progressSummary: null,
                    requesterSessionKey: 'agent:tiny:discord:channel:1',
                    runId: 'run-1',
                    sessionKey: 'agent:tiny:subagent:child-1',
                    source: 'tavern',
                    sourceFlowId: null,
                    sourceId: 'task-1',
                    startedAt: '2026-04-01T12:02:00.000Z',
                    status: 'running',
                    syncedAt: '2026-04-01T12:02:05.000Z',
                    terminalSummary: null,
                    title: '(Tiny) Spawned a subagent in Tiny Chat.',
                },
            },
        ],
    });

    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.kind, 'message');

    if (rows[0]?.kind !== 'message') {
        throw new Error('Expected first row to be a message');
    }

    assert.equal(rows[0].message.sender, 'Tiny');
    assert.deepEqual(rows[0].actor, { id: 'tiny', kind: 'agent' });
    assert.equal(rows[0].message.sourceSessionKey, 'agent:tiny:discord:channel:1');
    assert.equal(rows[0].connectsToNext, true);

    if (rows[1]?.kind !== 'tool') {
        throw new Error('Expected second row to be a tool');
    }

    assert.deepEqual(rows[1].actor, { id: 'tiny', kind: 'agent' });
    assert.deepEqual(rows[1].spawnedRelationships, []);
    assert.equal(rows[1].sessionKey, 'agent:tiny:discord:channel:1');
    assert.equal(rows[1].startedAt, '2026-04-01T12:01:00.000Z');
    assert.equal(rows[1].completedAt, '2026-04-01T12:01:02.000Z');
    assert.equal(rows[1].toolCall.name, 'read');
    assert.deepEqual(rows[1].toolCall.summaryParts, ['README.md']);
    assert.equal(rows[1].connectsToPrevious, true);

    if (rows[2]?.kind !== 'worker') {
        throw new Error('Expected third row to be a worker');
    }

    assert.equal(rows[2].worker.kind, 'subagent');
    assert.equal(rows[2].worker.status, 'running');
    assert.deepEqual(rows[2].actor, { id: 'tiny', kind: 'agent' });
});

test('buildChatRows renders a standalone tool call row without swallowing adjacent text', () => {
    const rows = buildChatRows({
        agentLookup: {
            byAlias: new Map(),
            byDiscordId: new Map(),
            byId: new Map([
                [
                    'tiny',
                    {
                        agentId: 'tiny',
                        displayName: 'Tiny',
                    },
                ],
            ]),
            byProviderAgentId: new Map(),
        },
        messages: [
            {
                agentId: 'tiny',
                message: {
                    actor: { id: 'tiny', kind: 'agent' },
                    tavernAgentId: 'tiny',
                    content: 'I am going to inspect the file.',
                    id: 'message-1',
                    sender: 'assistant',
                    senderType: 'agent',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: 'agent:tiny:discord:channel:1',
                    timestamp: '2026-04-01T12:00:00.000Z',
                },
            },
            {
                agentId: 'tiny',
                message: {
                    actor: { id: 'tiny', kind: 'agent' },
                    tavernAgentId: 'tiny',
                    content: '',
                    id: 'message-2',
                    metadata: {
                        parts: [
                            {
                                arguments: {
                                    path: 'README.md',
                                },
                                id: 'call-2',
                                name: 'read',
                                type: 'toolCall',
                            },
                        ],
                        toolCallId: 'call-2',
                        toolName: 'read',
                    },
                    sender: 'assistant',
                    senderType: 'agent',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: 'agent:tiny:discord:channel:1',
                    timestamp: '2026-04-01T12:00:01.000Z',
                },
            },
            {
                agentId: 'tiny',
                message: {
                    actor: { id: 'tiny', kind: 'agent' },
                    tavernAgentId: 'tiny',
                    content: 'The file has the expected sections.',
                    id: 'message-3',
                    sender: 'assistant',
                    senderType: 'agent',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: 'agent:tiny:discord:channel:1',
                    timestamp: '2026-04-01T12:00:02.000Z',
                },
            },
        ],
        toolCalls: [
            {
                arguments: {
                    path: 'README.md',
                },
                childSessionKey: null,
                finishedAt: '2026-04-01T12:00:03.000Z',
                id: 'tool-record-2',
                isError: false,
                messageId: 'message-2',
                result: {
                    path: 'README.md',
                    status: 'ok',
                },
                sessionKey: 'agent:tiny:discord:channel:1',
                startedAt: '2026-04-01T12:00:01.000Z',
                toolCallId: 'call-2',
                toolName: 'read',
            },
        ],
        workers: [],
    });

    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.kind, 'message');
    assert.equal(rows[1]?.kind, 'tool');
    assert.equal(rows[2]?.kind, 'message');
    if (rows[1]?.kind !== 'tool') {
        throw new Error('Expected second row to be a tool');
    }
    assert.equal(rows[1].completedAt, '2026-04-01T12:00:03.000Z');
});

test('buildChatRows synthesizes tool rows from message parts when tool projection lags', () => {
    const rows = buildChatRows({
        agentLookup: {
            byAlias: new Map(),
            byDiscordId: new Map(),
            byId: new Map([
                [
                    'tiny',
                    {
                        agentId: 'tiny',
                        displayName: 'Tiny',
                    },
                ],
            ]),
            byProviderAgentId: new Map(),
        },
        messages: [
            {
                agentId: 'tiny',
                message: {
                    actor: { id: 'tiny', kind: 'agent' },
                    tavernAgentId: 'tiny',
                    content: '',
                    id: 'message-tool-call',
                    metadata: {
                        parts: [
                            {
                                arguments: {
                                    path: 'QA_KICKOFF_TASK.md',
                                },
                                id: 'call-read',
                                name: 'read',
                                type: 'toolCall',
                            },
                        ],
                        toolCallId: 'call-read',
                        toolName: 'read',
                    },
                    sender: 'assistant',
                    senderType: 'agent',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: 'agent:tiny:tavern:channel:1',
                    timestamp: '2026-04-01T12:00:01.000Z',
                },
            },
            {
                agentId: null,
                message: {
                    actor: null,
                    tavernAgentId: null,
                    content: '# QA kickoff task',
                    id: 'message-tool-result',
                    metadata: {
                        toolCallId: 'call-read',
                        toolName: 'read',
                    },
                    sender: 'toolResult',
                    senderType: 'system',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: 'agent:tiny:tavern:channel:1',
                    timestamp: '2026-04-01T12:00:02.000Z',
                },
            },
        ],
        toolCalls: [],
        workers: [],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.kind, 'tool');

    if (rows[0]?.kind !== 'tool') {
        throw new Error('Expected synthesized tool row');
    }

    assert.equal(rows[0].toolCall.name, 'read');
    assert.equal(rows[0].toolCall.callId, 'call-read');
    assert.deepEqual(rows[0].toolCall.summaryParts, ['QA_KICKOFF_TASK.md']);
    assert.deepEqual(rows[0].actor, { id: 'tiny', kind: 'agent' });
});

test('buildChatRows skips non-tool system messages', () => {
    const rows = buildChatRows({
        agentLookup: {
            byAlias: new Map(),
            byDiscordId: new Map(),
            byId: new Map(),
        },
        messages: [
            {
                agentId: null,
                message: {
                    actor: null,
                    tavernAgentId: null,
                    content: 'OpenClaw runtime status',
                    id: 'system-status',
                    sender: 'system',
                    senderType: 'system',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: 'agent:tiny:tavern:channel:1',
                    timestamp: '2026-04-01T12:00:00.000Z',
                },
            },
            {
                agentId: null,
                message: {
                    actor: null,
                    tavernAgentId: null,
                    content: 'hello',
                    id: 'message-user',
                    sender: 'user',
                    senderType: 'user',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: 'agent:tiny:tavern:channel:1',
                    timestamp: '2026-04-01T12:00:01.000Z',
                },
            },
        ],
        toolCalls: [],
        workers: [],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, 'message-user');
});
