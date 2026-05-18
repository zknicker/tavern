import { afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { saveTavernChatRecord } from '../src/chat/records.ts';
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
        'DELETE FROM session_messages; DELETE FROM chats; DELETE FROM agents; DELETE FROM agent_runtime_connections;'
    );
});

test('sendTavernChatMessage posts to Runtime', async () => {
    await seedPlanningProjection();
    const calls: unknown[] = [];
    const tavernApiCalls: Array<{ body: unknown; method: string; path: string }> = [];
    const historyCalls: unknown[] = [];
    globalThis.fetch = (async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const body = request.method === 'GET' ? null : await request.json();
        tavernApiCalls.push({ body, method: request.method, path: url.pathname });

        if (url.pathname === '/api/chats') {
            return Response.json({
                created_at: '2026-04-06T12:10:00.000Z',
                id: planningChatId,
                last_message_sequence: 0,
                metadata: { runtime: { runtimeId: 'runtime-1' } },
                title: null,
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
                created_at: '2026-04-06T12:10:00.000Z',
                deleted_at: null,
                delivery_id: null,
                id: body.id,
                metadata: body.metadata,
                nonce: body.nonce,
                parent_message_id: null,
                parts: body.parts,
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
            body: {
                id: planningChatId,
                metadata: {
                    runtime: {
                        runtimeId: 'runtime-1',
                    },
                },
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
                        source: 'openclaw',
                    },
                },
                nonce: sentMessageId,
                parts: [
                    {
                        content: 'Plan the next launch.',
                        kind: 'text',
                    },
                ],
                role: 'user',
            },
            method: 'POST',
            path: `/api/chats/${planningChatId}/messages`,
        },
    ]);
    assert.deepEqual(historyCalls, []);
    assert.match(sentMessageId ?? '', /^msg_/u);
});

async function seedPlanningProjection() {
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
    await saveTavernChatRecord({
        chat: {
            bindingId: null,
            bindings: [{ agentId: 'agent:planner' }],
            id: planningChatId,
            inboundMode: 'active',
            metadata: {
                tavern: { displayName: 'Planning' },
                sessionKeys: [planningSessionKey],
            },
            parentTarget: null,
            participants: [{ agentId: 'agent:planner', type: 'agent' }],
            platform: 'tavern',
            platformMetadata: {
                chatId: planningChatId,
                conversationId: null,
                observedLabels: ['Planning'],
                provider: 'tavern',
                sourceRecords: [],
            },
            requiresTrigger: false,
            scope: null,
            target: `chat:${planningChatId}`,
            trigger: null,
        },
        runtimeId: 'runtime-1',
    });
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
    await seedPlanningProjection();

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
