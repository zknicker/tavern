import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';

const directory = mkdtempSync(join(tmpdir(), 'tavern-agent-runtime-sync-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [{ ensureDatabaseSchema }, { databaseClient }, runtimeSync, agentProfileStorage] =
    await Promise.all([
        import('../db/bootstrap.ts'),
        import('../db/index.ts'),
        import('./agent-runtime-sync.ts'),
        import('../storage/agent-profiles.ts'),
    ]);

ensureDatabaseSchema();

test.beforeEach(() => {
    databaseClient.exec('delete from agent_profiles');
    databaseClient.exec('delete from agent_runtime_connections');
    databaseClient.exec('delete from agents');
    databaseClient.exec('delete from session_messages');
    databaseClient.exec('delete from session_runs');
});

test('syncAgentRuntimeSession projects only the requested session', async () => {
    const result = await runtimeSync.syncAgentRuntimeSession({
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

    assert.equal(result.synced, 1);
});

test('syncAgentRuntimeSessionMessagesWithRetry retries empty history', async () => {
    let calls = 0;
    const sessionKey = 'agent:main:tavern:channel:retry-chat';

    const result = await runtimeSync.syncAgentRuntimeSessionMessagesWithRetry({
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

    assert.equal(calls, 2);
    assert.equal(result.synced, 1);
    assert.equal(result.messages[0]?.content, 'Ready.');
});

test('syncAgentRuntimeSessionMessages reads accepted Tavern prompts by stable message id', async () => {
    const sessionKey = 'agent:main:tavern:channel:identity-chat';
    const prompt = 'same prompt';

    const result = await runtimeSync.syncAgentRuntimeSessionMessages({
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

    assert.equal(result.deleted, 0);
    assert.equal(result.synced, 2);
    assert.deepEqual(
        result.messages.map((message) => [message.id, message.senderType, message.content]),
        [
            ['msg_accepted', 'user', prompt],
            ['assistant-message', 'agent', 'Reply.'],
        ]
    );
});

test('syncAgentRuntimeAgents sends cleared workspace instructions', async () => {
    let savedInstructions: unknown = null;

    await agentProfileStorage.saveAgentProfile({
        agentId: 'planner',
        runtimeId: 'openclaw-local',
        userInstructions: '',
    });

    await runtimeSync.syncAgentWorkspaceInstructions({
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
        userInstructions: '',
        workspaceDir: '/tmp/tavern-planner',
    });
});

test('syncAgentRuntimeAgents refreshes workspace instruction names without a profile', async () => {
    let savedInstructions: unknown = null;

    await runtimeSync.syncAgentWorkspaceInstructions({
        agents: [
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'main',
                isAdmin: false,
                name: 'Blippy',
                primaryColor: null,
                workspaceFolder: '/tmp/tavern-main',
            },
        ],
        client: {
            saveWorkspaceInstructions: async (_agentId: string, input: unknown) => {
                savedInstructions = input;
                return {
                    agentId: 'main',
                    renderedAt: '2026-05-19T20:00:00.000Z',
                    sha256: 'workspace-instructions-sha',
                    updatedAt: '2026-05-19T20:00:00.000Z',
                };
            },
        } as unknown as TavernAgentRuntimeClient,
        runtimeId: 'openclaw-local',
    });

    assert.deepEqual(savedInstructions, {
        agentName: 'Blippy',
        workspaceDir: '/tmp/tavern-main',
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
