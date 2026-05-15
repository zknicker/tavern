import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as agentRuntimeClient from '../src/agent-runtime/configured-client.ts';
import { getChatLogPage } from '../src/chat/log.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { syncChatsForRuntime } from '../src/storage/chats.ts';
import { syncSessionMessagesForRuntime } from '../src/storage/session-messages.ts';
import { syncSessionToolCallsForRuntime } from '../src/storage/session-tool-call-sync.ts';
import { syncSessionsForRuntime } from '../src/storage/sessions.ts';

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
    databaseClient.exec('DELETE FROM chats;');
    databaseClient.exec('DELETE FROM session_messages;');
    databaseClient.exec('DELETE FROM session_runs;');
    databaseClient.exec('DELETE FROM session_tool_calls;');
});

test('chat log resolves projected chats without live runtime reads', async () => {
    spyOn(agentRuntimeClient, 'createConfiguredAgentRuntimeClient').mockImplementation(() => {
        throw new Error('projected chat log should not query the runtime');
    });
    await syncChatsForRuntime({
        chats: [
            {
                bindingId: null,
                bindings: [{ agentId: 'main' }],
                id: 'openclaw:agent:main:discord:channel:1090835947375054891',
                inboundMode: 'active',
                metadata: {},
                name: 'Discord channel 1090835947375054891',
                parentTarget: null,
                platform: 'discord',
                platformMetadata: {},
                requiresTrigger: false,
                scope: 'channel',
                target: 'channel:1090835947375054891',
                trigger: null,
                workspaceFolder: 'main',
            },
        ],
        runtimeId: 'runtime-1',
    });

    const page = await getChatLogPage({
        id: 'openclaw:agent:main:discord:channel:1090835947375054891',
        limit: 8,
    });

    assert.deepEqual(page, {
        limit: 8,
        offset: 0,
        rows: [],
        total: 0,
    });
});

test('chat log preserves projected message metadata for tool rows', async () => {
    spyOn(agentRuntimeClient, 'createConfiguredAgentRuntimeClient').mockImplementation(() => {
        throw new Error('projected chat log should not query the runtime');
    });
    await syncChatsForRuntime({
        chats: [
            {
                bindingId: null,
                bindings: [{ agentId: 'main' }],
                id: 'openclaw:agent:main:discord:channel:1090835947375054891',
                inboundMode: 'active',
                metadata: {},
                name: 'Discord channel 1090835947375054891',
                parentTarget: null,
                platform: 'discord',
                platformMetadata: {},
                requiresTrigger: false,
                scope: 'channel',
                target: 'channel:1090835947375054891',
                trigger: null,
                workspaceFolder: 'main',
            },
        ],
        runtimeId: 'runtime-1',
    });
    databaseClient
        .prepare(
            `INSERT INTO session_runs (
                id, session_key, session_id, agent_id, runtime, mode, status, label, updated_at, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            'agent:main:discord:channel:1090835947375054891',
            'agent:main:discord:channel:1090835947375054891',
            'discord-channel-session-1',
            'main',
            'runtime-1',
            'main',
            'idle',
            'Discord channel',
            '2026-05-02T03:29:16.321Z',
            JSON.stringify({
                runtimeSession: {
                    agentId: 'main',
                    chatId: 'openclaw:agent:main:discord:channel:1090835947375054891',
                    key: 'agent:main:discord:channel:1090835947375054891',
                    lastActivityAt: '2026-05-02T03:29:16.321Z',
                    messageCount: 1,
                    parentSessionKey: null,
                    platform: 'discord',
                    sessionId: 'discord-channel-session-1',
                    sessionRole: 'main',
                    startedAt: null,
                    title: 'Discord channel',
                },
            })
        );
    databaseClient
        .prepare(
            `INSERT INTO session_messages (
                id, session_key, seq, role, sender_label, actor_kind, actor_id, content_text,
                raw_json, synced_at, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            'message-tool-call',
            'agent:main:discord:channel:1090835947375054891',
            0,
            'agent',
            'assistant',
            'agent',
            'main',
            '',
            JSON.stringify({
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
            }),
            '2026-05-02T03:29:16.321Z',
            '2026-05-02T03:29:16.321Z'
        );
    databaseClient
        .prepare(
            `INSERT INTO session_tool_calls (
                id, session_key, message_id, tool_call_id, tool_name, arguments_json, result_json,
                is_error, started_at, finished_at, updated_at, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            'agent:main:discord:channel:1090835947375054891:tool:call-1',
            'agent:main:discord:channel:1090835947375054891',
            'message-tool-call',
            'call-1',
            'read',
            JSON.stringify({ path: 'README.md' }),
            JSON.stringify({ path: 'README.md', status: 'ok' }),
            0,
            '2026-05-02T03:29:16.321Z',
            '2026-05-02T03:29:18.321Z',
            '2026-05-02T03:29:18.321Z',
            JSON.stringify({ id: 'call-1', name: 'read', type: 'toolCall' })
        );

    const page = await getChatLogPage({
        id: 'openclaw:agent:main:discord:channel:1090835947375054891',
        limit: 8,
    });

    assert.equal(page.rows[0]?.kind, 'tool');
    if (page.rows[0]?.kind !== 'tool') {
        throw new Error('Expected projected metadata to render a tool row.');
    }
    assert.equal(page.rows[0].toolCall.name, 'read');
    assert.equal(page.rows[0].completedAt, '2026-05-02T03:29:18.321Z');
});

test('chat log maps projected file reference attachments', async () => {
    spyOn(agentRuntimeClient, 'createConfiguredAgentRuntimeClient').mockImplementation(() => {
        throw new Error('projected chat log should not query the runtime');
    });
    await syncChatsForRuntime({
        chats: [
            {
                bindingId: null,
                bindings: [{ agentId: 'main' }],
                id: 'openclaw:agent:main',
                inboundMode: 'active',
                metadata: {},
                name: 'Main',
                parentTarget: null,
                platform: 'openclaw',
                platformMetadata: {},
                requiresTrigger: false,
                scope: null,
                target: null,
                trigger: null,
                workspaceFolder: 'main',
            },
        ],
        runtimeId: 'runtime-1',
    });
    databaseClient
        .prepare(
            `INSERT INTO session_runs (
                id, session_key, session_id, agent_id, runtime, mode, status, label, updated_at, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            'agent:main',
            'agent:main',
            'main-session-1',
            'main',
            'runtime-1',
            'main',
            'idle',
            'Main',
            '2026-05-02T03:29:16.321Z',
            JSON.stringify({
                runtimeSession: {
                    agentId: 'main',
                    chatId: 'openclaw:agent:main',
                    key: 'agent:main',
                    lastActivityAt: '2026-05-02T03:29:16.321Z',
                    messageCount: 1,
                    parentSessionKey: null,
                    platform: 'openclaw',
                    sessionId: 'main-session-1',
                    sessionRole: 'main',
                    startedAt: null,
                    title: 'Main',
                },
            })
        );
    databaseClient
        .prepare(
            `INSERT INTO session_messages (
                id, session_key, seq, role, sender_label, content_text, raw_json, synced_at,
                timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            'message-with-file-reference',
            'agent:main',
            0,
            'user',
            'Zach',
            'see attached',
            JSON.stringify({
                metadata: {
                    api: null,
                    parts: null,
                    stopReason: null,
                },
                attachments: [
                    {
                        filename: 'debug.log',
                        path: '/tmp/debug.log',
                    },
                ],
            }),
            '2026-05-02T03:29:16.321Z',
            '2026-05-02T03:29:16.321Z'
        );

    const page = await getChatLogPage({
        id: 'openclaw:agent:main',
        limit: 8,
    });

    assert.equal(page.rows[0]?.kind, 'message');
    if (page.rows[0]?.kind !== 'message') {
        throw new Error('Expected projected message row.');
    }
    assert.deepEqual(page.rows[0].message.metadata, {});
    assert.deepEqual(page.rows[0].message.attachments, [
        {
            filename: 'debug.log',
            mediaType: null,
            path: '/tmp/debug.log',
            sizeBytes: null,
            type: 'file',
            uri: null,
        },
    ]);
});

test('chat log interleaves projected sessions from multiple agents in the same chat', async () => {
    spyOn(agentRuntimeClient, 'createConfiguredAgentRuntimeClient').mockImplementation(() => {
        throw new Error('projected chat log should not query the runtime');
    });
    await syncChatsForRuntime({
        chats: [
            {
                bindingId: null,
                bindings: [{ agentId: 'blippy' }, { agentId: 'tiny' }],
                id: 'discord:channel:1090835947375054891',
                inboundMode: 'active',
                metadata: {},
                name: 'discord:1090835947375054888#general',
                parentTarget: null,
                platform: 'discord',
                platformMetadata: {},
                requiresTrigger: false,
                scope: 'channel',
                target: 'channel:1090835947375054891',
                trigger: null,
                workspaceFolder: 'discord-channel-1090835947375054891',
            },
        ],
        runtimeId: 'runtime-1',
    });
    insertProjectedSession({
        agentId: 'blippy',
        chatId: 'discord:channel:1090835947375054891',
        id: 'agent:blippy:discord:channel:1090835947375054891',
        runtimeSessionKey: 'agent:blippy:discord:channel:1090835947375054891',
        title: 'General',
    });
    insertProjectedSession({
        agentId: 'tiny',
        chatId: 'discord:channel:1090835947375054891',
        id: 'agent:tiny:discord:channel:1090835947375054891',
        runtimeSessionKey: 'agent:tiny:discord:channel:1090835947375054891',
        title: 'General',
    });
    insertProjectedMessage({
        content: 'Blippy checking in.',
        id: 'message-blippy',
        role: 'agent',
        senderLabel: 'Blippy',
        sessionKey: 'agent:blippy:discord:channel:1090835947375054891',
        timestamp: '2026-05-02T03:29:16.321Z',
    });
    insertProjectedMessage({
        content: 'Tiny checking in.',
        id: 'message-tiny',
        role: 'agent',
        senderLabel: 'Tiny',
        sessionKey: 'agent:tiny:discord:channel:1090835947375054891',
        timestamp: '2026-05-02T03:30:16.321Z',
    });

    const page = await getChatLogPage({
        id: 'discord:channel:1090835947375054891',
        limit: 8,
    });

    assert.deepEqual(
        page.rows.map((row) => (row.kind === 'message' ? row.message.content : null)),
        ['Blippy checking in.', 'Tiny checking in.']
    );
});

function insertProjectedSession(input: {
    agentId: string;
    chatId: string;
    id: string;
    runtimeSessionKey: string;
    title: string;
}) {
    databaseClient
        .prepare(
            `INSERT INTO session_runs (
                id, session_key, session_id, agent_id, runtime, mode, status, label, updated_at, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            input.id,
            input.id,
            `${input.runtimeSessionKey}:session`,
            input.agentId,
            'runtime-1',
            'main',
            'idle',
            input.title,
            '2026-05-02T03:29:16.321Z',
            JSON.stringify({
                runtimeSession: {
                    agentId: input.agentId,
                    chatId: input.chatId,
                    key: input.runtimeSessionKey,
                    lastActivityAt: '2026-05-02T03:29:16.321Z',
                    messageCount: 1,
                    parentSessionKey: null,
                    platform: 'discord',
                    sessionId: `${input.runtimeSessionKey}:session`,
                    sessionRole: 'main',
                    startedAt: '2026-05-02T03:29:16.321Z',
                    title: input.title,
                },
            })
        );
}

function insertProjectedMessage(input: {
    content: string;
    id: string;
    role: 'agent' | 'system' | 'user';
    senderLabel: string;
    sessionKey: string;
    timestamp: string;
}) {
    databaseClient
        .prepare(
            `INSERT INTO session_messages (
                id, session_key, seq, role, sender_label, content_text, raw_json, synced_at,
                timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            input.id,
            input.sessionKey,
            0,
            input.role,
            input.senderLabel,
            input.content,
            JSON.stringify({ metadata: {} }),
            input.timestamp,
            input.timestamp
        );
}

test('chat log renders projected main session rows from a synced runtime graph', async () => {
    spyOn(agentRuntimeClient, 'createConfiguredAgentRuntimeClient').mockReturnValue({
        getSessionGraph: async () => ({
            artifacts: [
                {
                    artifactType: 'system-prompt',
                    createdAt: '2026-04-15T21:27:15.953Z',
                    id: 'artifact-prompt',
                    messageId: 'chat-support::support:system-prompt',
                    mimeType: 'text/markdown',
                    path: '/tmp/session-prompts/session-root.md',
                    payload: null,
                    runId: null,
                    sessionKey: 'chat-support::support',
                    toolCallId: null,
                },
            ],
            links: [
                {
                    childSessionKey: 'chat-support::support::worker:research',
                    createdAt: '2026-04-15T21:28:00.000Z',
                    id: 'link-worker',
                    linkType: 'worker',
                    parentSessionKey: 'chat-support::support',
                    sourceToolCallId: 'tool-call-1',
                },
            ],
            messages: [
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content: 'You are Support.\n## Soul\nBe precise and calm.',
                    id: 'chat-support::support:system-prompt',
                    metadata: null,
                    sender: 'system-prompt',
                    senderName: 'System Prompt',
                    senderType: 'system',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:27:15.953Z',
                },
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content: 'Find the incident summary.',
                    id: 'message-user',
                    metadata: null,
                    sender: 'user',
                    senderName: 'User',
                    senderType: 'user',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:27:20.000Z',
                },
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    content: '',
                    id: 'message-tool-call',
                    metadata: {
                        parts: [
                            {
                                arguments: {
                                    prompt: 'Research the incident timeline.',
                                },
                                id: 'tool-call-1',
                                name: 'Agent',
                                type: 'toolCall',
                            },
                            {
                                text: 'Need a focused worker for this.',
                                type: 'thinking',
                            },
                        ],
                        toolCallId: 'tool-call-1',
                        toolName: 'Agent',
                    },
                    sender: 'support',
                    senderName: 'Support',
                    senderType: 'agent',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:27:30.000Z',
                },
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content:
                        '{"childSessionKey":"chat-support::support::worker:research","status":"completed"}',
                    id: 'message-tool-result',
                    metadata: {
                        toolCallId: 'tool-call-1',
                        toolName: 'Agent',
                    },
                    sender: 'tool',
                    senderName: 'ToolResult',
                    senderType: 'system',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:28:00.000Z',
                },
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    content: 'The worker finished the timeline summary.',
                    id: 'message-final',
                    metadata: null,
                    sender: 'support',
                    senderName: 'Support',
                    senderType: 'agent',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:28:10.000Z',
                },
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content: 'Research the incident timeline.',
                    id: 'worker-user',
                    metadata: null,
                    sender: 'user',
                    senderName: 'User',
                    senderType: 'user',
                    sessionKey: 'chat-support::support::worker:research',
                    timestamp: '2026-04-15T21:28:01.000Z',
                },
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    content: 'Timeline assembled.',
                    id: 'worker-final',
                    metadata: null,
                    sender: 'support',
                    senderName: 'Support',
                    senderType: 'agent',
                    sessionKey: 'chat-support::support::worker:research',
                    timestamp: '2026-04-15T21:28:05.000Z',
                },
            ],
            rootSessionKey: 'chat-support::support',
            sessions: [
                {
                    agentId: 'support',
                    platform: 'tavern',
                    chatId: 'chat-support',
                    key: 'chat-support::support',
                    lastActivityAt: '2026-04-15T21:28:10.000Z',
                    messageCount: 5,
                    parentSessionKey: null,
                    sessionId: 'session-root',
                    sessionRole: 'main',
                    startedAt: '2026-04-15T21:27:15.953Z',
                    title: 'Support Chat',
                },
                {
                    agentId: 'support',
                    platform: 'tavern',
                    chatId: 'chat-support',
                    key: 'chat-support::support::worker:research',
                    lastActivityAt: '2026-04-15T21:28:05.000Z',
                    messageCount: 2,
                    parentSessionKey: 'chat-support::support',
                    sessionId: 'session-worker',
                    sessionRole: 'worker',
                    startedAt: '2026-04-15T21:28:01.000Z',
                    title: 'Research worker',
                },
            ],
            toolCalls: [
                {
                    arguments: {
                        prompt: 'Research the incident timeline.',
                    },
                    childSessionKey: 'chat-support::support::worker:research',
                    finishedAt: '2026-04-15T21:28:00.000Z',
                    id: 'tool-record-1',
                    isError: false,
                    messageId: 'message-tool-call',
                    result: {
                        childSessionKey: 'chat-support::support::worker:research',
                        status: 'completed',
                    },
                    sessionKey: 'chat-support::support',
                    startedAt: '2026-04-15T21:27:30.000Z',
                    toolCallId: 'tool-call-1',
                    toolName: 'Agent',
                },
            ],
        }),
        listAgents: async () => ({
            agents: [
                {
                    avatar: null,
                    enabledSkillIds: [],
                    emoji: null,
                    id: 'support',
                    isAdmin: false,
                    name: 'Support',
                    primaryColor: null,
                    workspaceFolder: 'support',
                },
            ],
        }),
        listChats: async () => ({
            chats: [
                {
                    bindingId: null,
                    bindings: [{ agentId: 'support' }],
                    id: 'chat-support',
                    inboundMode: 'active',
                    metadata: {},
                    name: 'Support Chat',
                    parentTarget: null,
                    platform: 'tavern',
                    platformMetadata: {},
                    requiresTrigger: false,
                    scope: null,
                    target: 'support',
                    trigger: null,
                    workspaceFolder: 'support-chat',
                },
            ],
        }),
        listSessions: async () => ({
            sessions: [
                {
                    agentId: 'support',
                    platform: 'tavern',
                    chatId: 'chat-support',
                    key: 'chat-support::support',
                    lastActivityAt: '2026-04-15T21:28:10.000Z',
                    messageCount: 5,
                    parentSessionKey: null,
                    sessionId: 'session-root',
                    sessionRole: 'main',
                    startedAt: '2026-04-15T21:27:15.953Z',
                    title: 'Support Chat',
                },
                {
                    agentId: 'support',
                    platform: 'tavern',
                    chatId: 'chat-support',
                    key: 'chat-support::support::worker:research',
                    lastActivityAt: '2026-04-15T21:28:05.000Z',
                    messageCount: 2,
                    parentSessionKey: 'chat-support::support',
                    sessionId: 'session-worker',
                    sessionRole: 'worker',
                    startedAt: '2026-04-15T21:28:01.000Z',
                    title: 'Research worker',
                },
            ],
        }),
        listSessionMessages: async () => {
            throw new Error('chat log should build from session graphs');
        },
    });

    const runtime = agentRuntimeClient.createConfiguredAgentRuntimeClient();
    const [chats, sessions, graph] = await Promise.all([
        runtime.listChats(),
        runtime.listSessions(),
        runtime.getSessionGraph('chat-support::support'),
    ]);
    await syncChatsForRuntime({ chats: chats.chats, runtimeId: 'runtime-1' });
    await syncSessionsForRuntime({ runtimeId: 'runtime-1', sessions: sessions.sessions });
    await syncSessionMessagesForRuntime({
        messagesBySessionKey: new Map(
            graph.sessions.map((session) => [
                session.key,
                graph.messages.filter((message) => message.sessionKey === session.key),
            ])
        ),
        runtimeId: 'runtime-1',
    });
    await syncSessionToolCallsForRuntime({
        runtimeId: 'runtime-1',
        runtimeSessionKeys: graph.sessions.map((session) => session.key),
        syncedAt: '2026-04-15T21:28:10.000Z',
        toolCalls: graph.toolCalls,
    });

    const page = await getChatLogPage({
        id: 'chat-support',
        limit: 20,
    });

    assert(page);
    assert.equal(page.total, 3);
    assert.deepEqual(
        page.rows.map((row) =>
            row.kind === 'system' ? `${row.kind}:${row.systemKind}` : row.kind
        ),
        ['message', 'tool', 'message']
    );

    const toolRow = page.rows.find((row) => row.kind === 'tool');
    assert(toolRow && toolRow.kind === 'tool');
    assert.equal(toolRow.startedAt, '2026-04-15T21:27:30.000Z');
    assert.equal(toolRow.completedAt, '2026-04-15T21:28:00.000Z');

    assert(!page.rows.some((row) => row.kind === 'message' && row.id === 'worker-user'));
    assert(!page.rows.some((row) => row.kind === 'system' && row.systemKind === 'artifact'));
});
