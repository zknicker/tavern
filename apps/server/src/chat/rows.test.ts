import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChatRows } from './rows.ts';

const sessionKey = 'agent:main:tavern:channel:chat-1';
const agentLookup = {
    byAlias: new Map(),
    byDiscordId: new Map(),
    byId: new Map([['main', { agentId: 'main', displayName: 'main' }]]),
};

test('agent tool activity is displayed after the user turn it belongs to', () => {
    const rows = buildChatRows({
        agentLookup,
        messages: [
            {
                agentId: null,
                message: {
                    actor: null,
                    attachments: undefined,
                    content: 'Run a tool.',
                    id: 'user-1',
                    metadata: {},
                    sender: 'user',
                    senderType: 'user',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: sessionKey,
                    tavernAgentId: null,
                    timestamp: '2026-05-15T21:48:35.284Z',
                },
            },
            {
                agentId: 'main',
                message: {
                    actor: { id: 'main', kind: 'agent' },
                    attachments: undefined,
                    content: 'Done.',
                    id: 'agent-1',
                    metadata: {},
                    sender: 'agent',
                    senderType: 'agent',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: sessionKey,
                    tavernAgentId: 'main',
                    timestamp: '2026-05-15T21:48:35.284Z',
                },
            },
        ],
        toolCalls: [
            {
                arguments: { command: "sleep 1; printf 'done\\n'" },
                childSessionKey: null,
                finishedAt: '2026-05-15T21:48:30.858Z',
                id: `${sessionKey}:tool:exec-1`,
                isError: false,
                messageId: 'agent-1',
                result: 'done\n',
                sessionKey,
                startedAt: '2026-05-15T21:48:29.893Z',
                toolCallId: 'exec-1',
                toolName: 'bash',
            },
        ],
        workers: [],
    });

    assert.deepEqual(
        rows.map((row) => row.id),
        ['user-1', `tool:${sessionKey}:tool:exec-1`, 'agent-1']
    );
});

test('unattributed session tool activity before a user is displayed with the following agent turn', () => {
    const rows = buildChatRows({
        agentLookup,
        messages: [
            {
                agentId: 'main',
                message: {
                    actor: { id: 'main', kind: 'agent' },
                    attachments: undefined,
                    content: 'Done once.',
                    id: 'agent-previous',
                    metadata: {},
                    sender: 'agent',
                    senderType: 'agent',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: sessionKey,
                    tavernAgentId: 'main',
                    timestamp: '2026-05-15T21:48:00.000Z',
                },
            },
            {
                agentId: null,
                message: {
                    actor: null,
                    attachments: undefined,
                    content: 'Again please.',
                    id: 'user-2',
                    metadata: {},
                    sender: 'user',
                    senderType: 'user',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: sessionKey,
                    tavernAgentId: null,
                    timestamp: '2026-05-15T21:49:00.000Z',
                },
            },
            {
                agentId: 'main',
                message: {
                    actor: { id: 'main', kind: 'agent' },
                    attachments: undefined,
                    content: 'Done twice.',
                    id: 'agent-2',
                    metadata: {},
                    sender: 'agent',
                    senderType: 'agent',
                    sourceSessionId: 'session-1',
                    sourceSessionKey: sessionKey,
                    tavernAgentId: 'main',
                    timestamp: '2026-05-15T21:49:25.000Z',
                },
            },
        ],
        toolCalls: [
            {
                arguments: { command: "sleep 4; printf 'done\\n'" },
                childSessionKey: null,
                finishedAt: '2026-05-15T21:49:20.000Z',
                id: `${sessionKey}:tool:exec-unattributed`,
                isError: false,
                messageId: null,
                result: 'done\n',
                sessionKey,
                startedAt: '2026-05-15T21:48:55.000Z',
                toolCallId: 'exec-unattributed',
                toolName: 'bash',
            },
        ],
        workers: [],
    });

    assert.deepEqual(
        rows.map((row) => row.id),
        ['agent-previous', 'user-2', `tool:${sessionKey}:tool:exec-unattributed`, 'agent-2']
    );
});
