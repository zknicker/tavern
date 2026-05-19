import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';

const directory = mkdtempSync(join(tmpdir(), 'tavern-agent-runtime-sync-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [
    { ensureDatabaseSchema },
    { databaseClient },
    projections,
    agentProfileStorage,
    sessionStorage,
    messageStorage,
    activeTurnSessions,
] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('../db/index.ts'),
    import('./agent-runtime-projections.ts'),
    import('../storage/agent-profiles.ts'),
    import('../storage/sessions.ts'),
    import('../storage/session-messages.ts'),
    import('../agent-runtime/active-turn-sessions.ts'),
]);

ensureDatabaseSchema();

test.beforeEach(() => {
    databaseClient.exec('delete from agent_runtime_capability_status');
    databaseClient.exec('delete from agent_profiles');
    databaseClient.exec('delete from agent_runtime_connections');
    databaseClient.exec('delete from agents');
    databaseClient.exec('delete from session_messages');
    databaseClient.exec('delete from session_runs');
    databaseClient.exec('delete from chats');
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

test('syncAgentRuntimeSessionMessages upserts accepted Tavern prompts by stable message id', async () => {
    const sessionKey = 'agent:main:tavern:channel:identity-chat';
    const prompt = 'same prompt';

    const result = await projections.syncAgentRuntimeSessionMessages({
        client: {
            async listSessionMessages() {
                return {
                    messages: [
                        createMessage({
                            chatId: 'identity-chat',
                            content: prompt,
                            id: 'msg_accepted',
                            metadata: {
                                tavern: {
                                    acceptedMessageId: 'msg_accepted',
                                    acceptedRunId: 'run-accepted',
                                    nonce: 'msg_accepted',
                                    sequence: 1,
                                },
                            },
                            sender: 'tavern:user',
                            senderName: 'Tavern',
                            senderType: 'user',
                            sessionKey,
                            timestamp: '2026-05-13T12:04:00.000Z',
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
    assert.equal(result.synced, 2);
    assert.deepEqual(
        messages.map((message) => [message.externalMessageId, message.role, message.contentText]),
        [
            ['msg_accepted', 'user', prompt],
            ['assistant-message', 'agent', 'Reply.'],
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

test('syncAgentRuntimeAgents sends cleared workspace instructions', async () => {
    let savedInstructions: unknown = null;

    await agentProfileStorage.saveAgentProfile({
        agentId: 'planner',
        runtimeId: 'openclaw-local',
        soul: '',
    });

    await projections.syncAgentWorkspaceInstructions({
        agents: [
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'planner',
                isAdmin: false,
                name: 'Planner',
                primaryColor: null,
                workspaceFolder: '/tmp/tavern-planner',
            },
        ],
        client: {
            saveWorkspaceInstructions: async (_agentId: string, input: unknown) => {
                savedInstructions = input;
                return {
                    agentId: 'planner',
                    renderedAt: '2026-05-19T20:00:00.000Z',
                    sha256: 'workspace-instructions-sha',
                    updatedAt: '2026-05-19T20:00:00.000Z',
                };
            },
        } as unknown as TavernAgentRuntimeClient,
        runtimeId: 'openclaw-local',
    });

    assert.deepEqual(savedInstructions, {
        agentName: 'Planner',
        soul: '',
        workspaceDir: '/tmp/tavern-planner',
    });
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
    metadata?: Record<string, unknown> | null;
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
        metadata: input.metadata ?? null,
        sender: input.sender,
        senderName: input.senderName,
        senderType: input.senderType,
        sessionKey: input.sessionKey,
        timestamp: input.timestamp,
    };
}
