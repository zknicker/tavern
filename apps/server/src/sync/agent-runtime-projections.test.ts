import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const directory = mkdtempSync(join(tmpdir(), 'tavern-agent-runtime-sync-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [
    { ensureDatabaseSchema },
    { databaseClient },
    projections,
    sessionStorage,
    messageStorage,
    activeTurnSessions,
    chatStorage,
    chatRuntime,
    acceptedMessageProjection,
    chatLog,
    activeTurnProgress,
] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('../db/index.ts'),
    import('./agent-runtime-projections.ts'),
    import('../storage/sessions.ts'),
    import('../storage/session-messages.ts'),
    import('../agent-runtime/active-turn-sessions.ts'),
    import('../storage/chats.ts'),
    import('../agent-runtime/chats.ts'),
    import('../chat/accepted-message-projection.ts'),
    import('../chat/log.ts'),
    import('../chat/active-turn-progress.ts'),
]);

ensureDatabaseSchema();

test.beforeEach(() => {
    databaseClient.exec('delete from agent_runtime_capability_status');
    databaseClient.exec('delete from session_messages');
    databaseClient.exec('delete from session_runs');
    databaseClient.exec('delete from chats');
    databaseClient.exec('delete from chat_active_turn_steps');
});

test('active turn progress statuses hydrate persisted tool steps', async () => {
    await activeTurnProgress.projectActiveTurnProgress({
        step: {
            detail: 'Searching docs',
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        timestamp: '2026-05-16T12:00:03.000Z',
        turn: {
            agentId: 'main',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'agent:main:tavern:channel:chat-1',
            startedAt: '2026-05-16T12:00:00.000Z',
        },
        type: 'turn.progress',
    });

    assert.deepEqual(await activeTurnProgress.listActiveTurnProgressStatuses(), [
        {
            activeReply: {
                agentId: 'main',
                isThinking: true,
                runId: 'run-1',
                sessionKey: 'agent:main:tavern:channel:chat-1',
                startedAt: '2026-05-16T12:00:00.000Z',
                text: '',
            },
            activeReplyProgressStartedAt: '2026-05-16T12:00:03.000Z',
            activeReplySteps: [
                {
                    detail: 'Searching docs',
                    id: 'tool:web',
                    kind: 'tool',
                    label: 'Using web search',
                    status: 'active',
                },
            ],
            chatId: 'chat-1',
        },
    ]);

    await activeTurnProgress.clearActiveTurnProgress({
        runId: 'run-1',
        sessionKey: 'agent:main:tavern:channel:chat-1',
    });

    assert.deepEqual(await activeTurnProgress.listActiveTurnProgressStatuses(), []);
});

test('syncAgentRuntimeSession projects only the requested session', async () => {
    const result = await projections.syncAgentRuntimeSession({
        client: {
            async listSessions() {
                return {
                    sessions: [
                        createSession({
                            chatId: 'first-chat',
                            key: 'agent:main:tavern:channel:first-chat',
                            lastActivityAt: '2026-05-13T12:00:00.000Z',
                        }),
                        createSession({
                            chatId: 'second-chat',
                            key: 'agent:main:tavern:channel:second-chat',
                            lastActivityAt: '2026-05-13T12:01:00.000Z',
                        }),
                    ],
                };
            },
        },
        runtimeId: 'openclaw-local',
        sessionKey: 'agent:main:tavern:channel:second-chat',
        syncedAt: '2026-05-13T12:02:00.000Z',
    });

    const sessions = await sessionStorage.listSessionProjections({ includeInactive: true });

    assert.equal(result.synced, 1);
    assert.deepEqual(
        sessions.map((session) => [session.sessionKey, session.updatedAt]),
        [['agent:main:tavern:channel:second-chat', '2026-05-13T12:01:00.000Z']]
    );
});

test('syncAgentRuntimeSessionMessagesWithRetry retries empty history', async () => {
    let calls = 0;
    const sessionKey = 'agent:main:tavern:channel:retry-chat';

    const result = await projections.syncAgentRuntimeSessionMessagesWithRetry({
        client: {
            async listSessionMessages() {
                calls += 1;
                return {
                    messages:
                        calls === 1
                            ? []
                            : [
                                  {
                                      agentId: 'main',
                                      chatId: 'retry-chat',
                                      content: 'Ready.',
                                      id: 'message-1',
                                      metadata: null,
                                      sender: 'main',
                                      senderName: 'Mr Agent',
                                      senderType: 'agent',
                                      sessionKey,
                                      timestamp: '2026-05-13T12:03:00.000Z',
                                  },
                              ],
                };
            },
        },
        retryDelaysMs: [1],
        runtimeId: 'openclaw-local',
        sessionKey,
    });

    const messages = await messageStorage.listSessionMessagesForSessionKeys([sessionKey]);

    assert.equal(calls, 2);
    assert.equal(result.synced, 1);
    assert.deepEqual(
        messages.map((message) => [message.sessionKey, message.role, message.contentText]),
        [[sessionKey, 'agent', 'Ready.']]
    );
});

test('projectAcceptedChatMessage makes accepted user messages visible before session sync', async () => {
    const chat = chatRuntime.buildTavernChatRecord({
        agentIds: ['main'],
        displayName: 'Recover me',
        id: 'chat-accepted',
    });

    await chatStorage.upsertChatForRuntime({
        chat,
        runtimeId: 'openclaw-local',
        syncedAt: '2026-05-16T12:00:00.000Z',
    });
    await acceptedMessageProjection.projectAcceptedChatMessage({
        event: {
            agentId: 'main',
            chatId: 'chat-accepted',
            message: {
                id: 'message-accepted',
                senderId: 'tavern:user',
                senderName: 'Tavern',
                sequence: 1,
                text: 'hello',
                timestamp: '2026-05-16T12:00:01.000Z',
            },
            runId: 'run-accepted',
            sessionKey: 'agent:main:tavern:channel:chat-accepted',
            timestamp: '2026-05-16T12:00:02.000Z',
            type: 'chat.messageAccepted',
        },
        runtimeId: 'openclaw-local',
    });

    const page = await chatLog.getChatLogPage({
        id: 'chat-accepted',
        limit: 20,
    });

    assert.deepEqual(
        page.rows.map((row) =>
            row.kind === 'message'
                ? [row.message.id, row.message.senderType, row.message.content]
                : []
        ),
        [['message-accepted', 'user', 'hello']]
    );
});

test('syncAgentRuntimeSessionMessages skips later generic copies of accepted Tavern prompts', async () => {
    const sessionKey = 'agent:main:tavern:channel:dedupe-chat';
    const prompt = 'same prompt';

    await acceptedMessageProjection.projectAcceptedChatMessage({
        event: {
            agentId: 'main',
            chatId: 'dedupe-chat',
            message: {
                id: 'accepted-message',
                senderId: 'tavern:user',
                senderName: 'Tavern',
                sequence: 1,
                text: prompt,
                timestamp: '2026-05-13T12:04:00.000Z',
            },
            runId: 'run-accepted',
            sessionKey,
            timestamp: '2026-05-13T12:04:00.100Z',
            type: 'chat.messageAccepted',
        },
        runtimeId: 'openclaw-local',
    });

    const result = await projections.syncAgentRuntimeSessionMessages({
        client: {
            async listSessionMessages() {
                return {
                    messages: [
                        createMessage({
                            chatId: 'dedupe-chat',
                            content: prompt,
                            id: 'openclaw-copy',
                            sender: 'user',
                            senderName: 'user',
                            senderType: 'user',
                            sessionKey,
                            timestamp: '2026-05-13T12:04:08.000Z',
                        }),
                        createMessage({
                            agentId: 'main',
                            chatId: `openclaw:${sessionKey}`,
                            content: 'Reply.',
                            id: 'assistant-message',
                            sender: 'assistant',
                            senderName: 'agent',
                            senderType: 'agent',
                            sessionKey,
                            timestamp: '2026-05-13T12:04:08.100Z',
                        }),
                    ],
                };
            },
        },
        runtimeId: 'openclaw-local',
        sessionKey,
    });

    const messages = await messageStorage.listSessionMessagesForSessionKeys([sessionKey]);

    assert.equal(result.deleted, 0);
    assert.equal(result.synced, 1);
    assert.deepEqual(
        messages.map((message) => [message.externalMessageId, message.role, message.contentText]),
        [
            ['accepted-message', 'user', prompt],
            ['assistant-message', 'agent', 'Reply.'],
        ]
    );
});

test('syncAgentRuntimeSessionMessages preserves accepted prompts inside replace windows', async () => {
    const sessionKey = 'agent:main:tavern:channel:window-chat';
    const prompt = 'please run three tools';

    await acceptedMessageProjection.projectAcceptedChatMessage({
        event: {
            agentId: 'main',
            chatId: 'window-chat',
            message: {
                id: 'accepted-window-message',
                senderId: 'tavern:user',
                senderName: 'Tavern',
                sequence: 1,
                text: prompt,
                timestamp: '2026-05-13T12:04:00.000Z',
            },
            runId: 'run-window',
            sessionKey,
            timestamp: '2026-05-13T12:04:00.100Z',
            type: 'chat.messageAccepted',
        },
        runtimeId: 'openclaw-local',
    });

    const result = await projections.syncAgentRuntimeSessionMessages({
        client: {
            async listSessionMessages() {
                return {
                    messages: [
                        createMessage({
                            agentId: 'main',
                            chatId: `openclaw:${sessionKey}`,
                            content: 'Working.',
                            id: 'assistant-before',
                            sender: 'assistant',
                            senderName: 'agent',
                            senderType: 'agent',
                            sessionKey,
                            timestamp: '2026-05-13T12:03:59.000Z',
                        }),
                        createMessage({
                            chatId: 'window-chat',
                            content: prompt,
                            id: 'openclaw-window-copy',
                            sender: 'user',
                            senderName: 'user',
                            senderType: 'user',
                            sessionKey,
                            timestamp: '2026-05-13T12:04:08.000Z',
                        }),
                        createMessage({
                            agentId: 'main',
                            chatId: `openclaw:${sessionKey}`,
                            content: 'Reply.',
                            id: 'assistant-after',
                            sender: 'assistant',
                            senderName: 'agent',
                            senderType: 'agent',
                            sessionKey,
                            timestamp: '2026-05-13T12:04:08.100Z',
                        }),
                    ],
                };
            },
        },
        runtimeId: 'openclaw-local',
        sessionKey,
    });

    const messages = await messageStorage.listSessionMessagesForSessionKeys([sessionKey]);

    assert.equal(result.deleted, 0);
    assert.equal(result.synced, 2);
    assert.deepEqual(
        messages.map((message) => [message.externalMessageId, message.role, message.contentText]),
        [
            ['assistant-before', 'agent', 'Working.'],
            ['accepted-window-message', 'user', prompt],
            ['assistant-after', 'agent', 'Reply.'],
        ]
    );
});

test('shouldSyncRuntimeSessionDetails skips fresh and active session histories', async () => {
    const sessionKey = 'agent:main:tavern:channel:fresh-chat';
    const session = createSession({
        chatId: 'fresh-chat',
        key: sessionKey,
        lastActivityAt: '2026-05-13T12:05:00.000Z',
    });

    assert.equal(await projections.shouldSyncRuntimeSessionDetails({ session }), true);

    await messageStorage.syncSessionMessagesForRuntime({
        messagesBySessionKey: new Map([
            [
                sessionKey,
                [
                    createMessage({
                        agentId: 'main',
                        chatId: 'fresh-chat',
                        content: 'Ready.',
                        id: 'fresh-message',
                        sender: 'assistant',
                        senderName: 'agent',
                        senderType: 'agent',
                        sessionKey,
                        timestamp: '2026-05-13T12:04:59.000Z',
                    }),
                ],
            ],
        ]),
        runtimeId: 'openclaw-local',
        syncedAt: '2026-05-13T12:06:00.000Z',
    });

    assert.equal(await projections.shouldSyncRuntimeSessionDetails({ session }), false);
    assert.equal(
        await projections.shouldSyncRuntimeSessionDetails({
            session: {
                ...session,
                lastActivityAt: '2026-05-13T12:07:00.000Z',
            },
        }),
        true
    );

    activeTurnSessions.markTurnSessionActive(sessionKey);
    try {
        assert.equal(
            await projections.shouldSyncRuntimeSessionDetails({
                session: {
                    ...session,
                    lastActivityAt: '2026-05-13T12:07:00.000Z',
                },
            }),
            false
        );
    } finally {
        activeTurnSessions.clearTurnSessionActive(sessionKey);
    }
});

function createSession(input: { chatId: string; key: string; lastActivityAt: string }) {
    return {
        agentId: 'main',
        chatId: input.chatId,
        key: input.key,
        lastActivityAt: input.lastActivityAt,
        messageCount: 1,
        parentSessionKey: null,
        platform: 'tavern',
        sessionId: input.key,
        sessionRole: 'main' as const,
        startedAt: '2026-05-13T11:59:00.000Z',
        title: input.chatId,
    };
}

function createMessage(input: {
    agentId?: null | string;
    chatId: string;
    content: string;
    id: string;
    sender: string;
    senderName: string;
    senderType: 'agent' | 'system' | 'user';
    sessionKey: string;
    timestamp: string;
}) {
    return {
        agentId: input.agentId ?? null,
        chatId: input.chatId,
        content: input.content,
        id: input.id,
        metadata: null,
        sender: input.sender,
        senderName: input.senderName,
        senderType: input.senderType,
        sessionKey: input.sessionKey,
        timestamp: input.timestamp,
    };
}
