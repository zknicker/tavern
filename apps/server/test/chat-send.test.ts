import { afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { sendTavernChatMessage } from '../src/chat/send.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { saveAgentRuntimeConnection } from '../src/storage/agent-runtime-connections.ts';
import { syncAgentsForRuntime } from '../src/storage/agents.ts';

ensureDatabaseSchema();

const planningChatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const planningSessionKey = `agent:agent:planner:tavern:channel:${planningChatId}`;
const originalFetch = globalThis.fetch;

afterEach(() => {
    mock.restore();
    globalThis.fetch = originalFetch;
    databaseClient.exec(
        'DELETE FROM session_messages; DELETE FROM agents; DELETE FROM agent_runtime_connections;'
    );
});

test('sendTavernChatMessage posts to Runtime', async () => {
    await seedPlanningChat();
    const calls: unknown[] = [];
    const tavernApiCalls: Array<{ body: unknown; method: string; path: string }> = [];
    const historyCalls: unknown[] = [];
    globalThis.fetch = (async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const body = request.method === 'GET' ? null : await request.json();
        tavernApiCalls.push({ body, method: request.method, path: url.pathname });

        if (url.pathname === '/api/chats' && request.method === 'GET') {
            return Response.json({
                chats: [runtimeTavernChat()],
                next_cursor: null,
            });
        }

        if (url.pathname === '/hermes/chats') {
            return Response.json({ chats: [] });
        }

        if (url.pathname === '/api/chats' && request.method === 'POST') {
            return Response.json({
                created_at: '2026-04-06T12:10:00.000Z',
                id: planningChatId,
                last_message_sequence: 0,
                metadata: body.metadata,
                title: body.title,
                updated_at: '2026-04-06T12:10:00.000Z',
            });
        }

        return Response.json({
            cursor: '1',
            idempotent: false,
            message: {
                author: {
                    id: 'usr_tavern',
                    kind: 'user',
                    label: null,
                    metadata: {},
                },
                chat_id: planningChatId,
                attachment: null,
                content: body.content,
                created_at: '2026-04-06T12:10:00.000Z',
                deleted_at: null,
                delivery_id: null,
                id: body.id,
                metadata: body.metadata,
                nonce: body.nonce,
                parent_message_id: null,
                role: 'user',
                sequence: 1,
                thread_root_id: null,
            },
        });
    }) as typeof fetch;
    const agentRuntimeClient = {
        listChats: async () => ({
            chats: [
                {
                    bindingId: null,
                    bindings: [{ agentId: 'agent:planner' }],
                    id: planningChatId,
                    inboundMode: 'active',
                    metadata: {
                        sessionKeys: [planningSessionKey],
                    },
                    name: 'Planning',
                    parentTarget: null,
                    platform: 'tavern',
                    requiresTrigger: false,
                    scope: null,
                    target: `chat:${planningChatId}`,
                    trigger: null,
                    workspaceFolder: 'planning',
                },
            ],
        }),
        listSessionMessages: async (sessionKey: string, options: unknown) => {
            historyCalls.push({ options, sessionKey });
            return {
                messages: [
                    {
                        agentId: null,
                        chatId: planningChatId,
                        content: 'Plan the next launch.',
                        id: 'message-user-1',
                        metadata: {},
                        participant: null,
                        sender: 'user-1',
                        senderName: 'User',
                        senderType: 'user' as const,
                        sessionKey: planningSessionKey,
                        timestamp: '2026-04-06T12:10:00.000Z',
                    },
                ],
            };
        },
        getCapability: async () => ({
            checkedAt: '2026-04-06T12:10:00.000Z',
            displayName: 'gateway',
            healthy: true,
            id: 'gateway',
            lastHealthyAt: '2026-04-06T12:10:00.000Z',
            metadata: {},
            nextCheckAt: null,
            reason: null,
            state: 'healthy' as const,
            technicalMessage: null,
            updatedAt: '2026-04-06T12:10:00.000Z',
        }),
        listSessions: async () => ({
            sessions: [
                {
                    agentId: 'agent:planner',
                    chatId: planningChatId,
                    key: planningSessionKey,
                    lastActivityAt: '2026-04-06T12:10:00.000Z',
                    messageCount: 1,
                    parentSessionKey: null,
                    platform: 'tavern',
                    sessionId: 'session-1',
                    sessionRole: 'main' as const,
                    startedAt: '2026-04-06T12:10:00.000Z',
                    title: 'Planning',
                },
            ],
        }),
        postMessage: async (chatId: string, input: unknown) => {
            calls.push({ chatId, input });
            return {
                acceptedAt: '2026-04-06T12:10:00.000Z',
                runId: 'run-1',
                sessionKey: planningSessionKey,
                status: 'accepted' as const,
            };
        },
        upsertAgent: async () => {
            throw new Error('not used');
        },
    };

    const result = await sendTavernChatMessage(
        {
            agentId: 'agent:planner',
            chatId: planningChatId,
            content: 'Plan the next launch.',
        },
        agentRuntimeClient as never
    );

    const sentMessageId =
        calls[0] && typeof calls[0] === 'object'
            ? (calls[0] as { input: { message: { id: string } } }).input.message.id
            : null;

    assert.deepEqual(result, {
        acceptedAt: '2026-04-06T12:10:00.000Z',
        chatId: planningChatId,
        clientMessageId: sentMessageId,
        runId: 'run-1',
        sessionKey: planningSessionKey,
        status: 'accepted',
    });
    assert.deepEqual(calls, [
        {
            chatId: planningChatId,
            input: {
                agent: {
                    agentId: 'agent:planner',
                },
                message: {
                    content: 'Plan the next launch.',
                    id: sentMessageId,
                    nonce: sentMessageId,
                },
                target: {
                    externalId: planningChatId,
                    sessionKey: planningSessionKey,
                    target: `chat:${planningChatId}`,
                    type: 'tavern',
                },
            },
        },
    ]);
    assert.deepEqual(tavernApiCalls, [
        {
            body: null,
            method: 'GET',
            path: '/hermes/chats',
        },
        {
            body: null,
            method: 'GET',
            path: '/api/chats',
        },
        {
            body: {
                id: planningChatId,
                metadata: {
                    runtime: {
                        source: 'tavern',
                    },
                    sessionKeys: [planningSessionKey],
                    tavern: {
                        agentIds: ['agent:planner'],
                        archived: false,
                        displayName: 'Planning',
                        displayNameSource: 'generated',
                        groupSystemPrompt: null,
                        tabAppearance: {
                            color: null,
                        },
                    },
                },
                title: 'Planning',
            },
            method: 'POST',
            path: '/api/chats',
        },
        {
            body: {
                author_id: 'usr_tavern',
                id: sentMessageId,
                metadata: {
                    runtime: {
                        agentId: 'agent:planner',
                        runtimeId: 'runtime-1',
                        sessionKey: planningSessionKey,
                        source: 'hermes',
                    },
                },
                content: 'Plan the next launch.',
                nonce: sentMessageId,
                role: 'user',
            },
            method: 'POST',
            path: `/api/chats/${planningChatId}/messages`,
        },
    ]);
    assert.deepEqual(historyCalls, []);
    assert.match(sentMessageId ?? '', /^msg_/u);
});

async function seedPlanningChat() {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-04-06T12:10:00.000Z',
        lastError: null,
        name: 'Runtime',
    });
    await syncAgentsForRuntime({
        agents: [
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'agent:planner',
                isAdmin: false,
                name: 'Planner',
                primaryColor: null,
                workspaceFolder: 'planning',
            },
        ],
        runtimeId: 'runtime-1',
    });
}

function runtimeTavernChat() {
    return {
        created_at: '2026-04-06T12:01:00.000Z',
        id: planningChatId,
        last_message_sequence: 0,
        metadata: {
            runtime: {
                source: 'tavern',
            },
            sessionKeys: [planningSessionKey],
            tavern: {
                agentIds: ['agent:planner'],
                archived: false,
                displayName: 'Planning',
            },
        },
        title: 'Planning',
        updated_at: '2026-04-06T12:01:00.000Z',
    };
}

test('sendTavernChatMessage rejects chats that are missing from Runtime', async () => {
    await assert.rejects(
        sendTavernChatMessage(
            {
                agentId: 'agent:planner',
                chatId: planningChatId,
                content: 'Plan the next launch.',
            },
            {
                listChats: async () => ({ chats: [] }),
                listSessionMessages: async () => ({ messages: [] }),
                listSessions: async () => ({ sessions: [] }),
                postMessage: async () => {
                    throw new Error('not used');
                },
                upsertAgent: async () => {
                    throw new Error('not used');
                },
            } as never
        ),
        /No Tavern chat named "220f46ed-2d7c-41dd-9d7e-d02691f1afc3" exists\./u
    );
});

test('sendTavernChatMessage rejects non-Tavern runtime metadata on user sends', async () => {
    await seedPlanningChat();

    await assert.rejects(
        sendTavernChatMessage(
            {
                agentId: 'agent:planner',
                chatId: planningChatId,
                content: 'Plan the next launch.',
                metadata: {
                    toolCallId: 'tool-call-1',
                } as never,
            },
            {
                postMessage: async () => {
                    throw new Error('not used');
                },
            } as never
        ),
        /unrecognized key|toolCallId/u
    );
});
