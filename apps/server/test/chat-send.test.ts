import { afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { sendTavernChatMessage } from '../src/chat/send.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { saveAgentRuntimeConnection } from '../src/storage/agent-runtime-connections.ts';
import { syncAgentsForRuntime } from '../src/storage/agents.ts';

ensureDatabaseSchema();

const planningChatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const originalFetch = globalThis.fetch;

afterEach(() => {
    mock.restore();
    globalThis.fetch = originalFetch;
    databaseClient.exec(
        'DELETE FROM session_messages; DELETE FROM agents; DELETE FROM agent_runtime_connections;'
    );
});

test('sendTavernChatMessage writes human-only channel messages without invoking an agent', async () => {
    await seedPlanningChat();
    const calls: unknown[] = [];
    const tavernApiCalls: Array<{ body: unknown; method: string; path: string }> = [];
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

        if (url.pathname === '/agent/chats') {
            return Response.json({ chats: [] });
        }

        if (url.pathname === '/api/chats' && request.method === 'POST') {
            return Response.json({
                created_at: '2026-04-06T12:10:00.000Z',
                id: planningChatId,
                kind: body.kind ?? 'channel',
                last_message_sequence: 0,
                metadata: body.metadata,
                participants: body.participants ?? [],
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
                attachments: [],
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
    const agentRuntimeClient = runtimeClient({ calls });

    const result = await sendTavernChatMessage(
        {
            agentId: 'agent:planner',
            chatId: planningChatId,
            content: 'Plan the next launch.',
        },
        agentRuntimeClient as never
    );

    assert.deepEqual(result, {
        acceptedAt: '2026-04-06T12:10:00.000Z',
        chatId: planningChatId,
        clientMessageId: result.clientMessageId,
        status: 'accepted',
        turns: [],
    });
    assert.deepEqual(calls, []);
    assert.match(result.clientMessageId, /^msg_/u);
    assert.equal(
        tavernApiCalls.some((call) => call.path === `/api/chats/${planningChatId}/messages`),
        true
    );
});

test('sendTavernChatMessage posts one turn for a mentioned channel agent', async () => {
    await seedPlanningChat();
    const calls: unknown[] = [];
    globalThis.fetch = runtimeTavernApiFetch();
    const agentRuntimeClient = runtimeClient({ calls });

    const result = await sendTavernChatMessage(
        {
            chatId: planningChatId,
            content: '@Planner Plan the next launch.',
            metadata: mentionMetadata({
                end: 8,
                id: 'agent:planner',
                label: 'Planner',
                start: 0,
                text: '@Planner',
            }),
        },
        agentRuntimeClient as never
    );

    assert.deepEqual(result.turns, [
        {
            agentId: 'agent:planner',
            runId: 'run-agent_planner',
        },
    ]);
    assert.deepEqual(calls, [
        {
            chatId: planningChatId,
            input: {
                agent: {
                    agentId: 'agent:planner',
                },
                message: {
                    content: '@Planner Plan the next launch.',
                    id: result.clientMessageId,
                    metadata: mentionMetadata({
                        end: 8,
                        id: 'agent:planner',
                        label: 'Planner',
                        start: 0,
                        text: '@Planner',
                    }),
                    nonce: result.clientMessageId,
                },
                target: {
                    externalId: planningChatId,
                    target: `channel:${planningChatId}`,
                    type: 'tavern',
                },
            },
        },
    ]);
});

test('sendTavernChatMessage posts one turn for an explicitly addressed channel agent', async () => {
    await seedPlanningChat();
    const calls: unknown[] = [];
    globalThis.fetch = runtimeTavernApiFetch();
    const agentRuntimeClient = runtimeClient({ calls });

    const metadata = {
        tavern: {
            addressedAgentIds: ['agent:planner'],
        },
    };

    const result = await sendTavernChatMessage(
        {
            chatId: planningChatId,
            content: 'Plan the next launch.',
            metadata,
        },
        agentRuntimeClient as never
    );

    assert.deepEqual(result.turns, [
        {
            agentId: 'agent:planner',
            runId: 'run-agent_planner',
        },
    ]);
    assert.deepEqual(calls, [
        {
            chatId: planningChatId,
            input: {
                agent: {
                    agentId: 'agent:planner',
                },
                message: {
                    content: 'Plan the next launch.',
                    id: result.clientMessageId,
                    metadata,
                    nonce: result.clientMessageId,
                },
                target: {
                    externalId: planningChatId,
                    target: `channel:${planningChatId}`,
                    type: 'tavern',
                },
            },
        },
    ]);
});

test('sendTavernChatMessage implicitly addresses generated one-agent Tavern chats', async () => {
    await seedPlanningChat();
    const calls: unknown[] = [];
    globalThis.fetch = runtimeTavernApiFetch({
        chat: runtimeTavernChat({ displayNameSource: 'generated' }),
    });
    const agentRuntimeClient = runtimeClient({ calls });

    const result = await sendTavernChatMessage(
        {
            chatId: planningChatId,
            content: 'Follow up on the plan.',
        },
        agentRuntimeClient as never
    );

    assert.deepEqual(result.turns, [
        {
            agentId: 'agent:planner',
            runId: 'run-agent_planner',
        },
    ]);
    assert.equal(calls.length, 1);
});

test('sendTavernChatMessage posts independent turns for multiple mentioned agents', async () => {
    await seedPlanningChat({
        agents: [
            { id: 'agent:planner', name: 'Planner' },
            { id: 'agent:critic', name: 'Critic' },
        ],
    });
    const calls: unknown[] = [];
    globalThis.fetch = runtimeTavernApiFetch({
        chat: runtimeTavernChat({
            agents: [
                { id: 'agent:planner', name: 'Planner' },
                { id: 'agent:critic', name: 'Critic' },
            ],
        }),
    });
    const agentRuntimeClient = runtimeClient({ calls });

    const metadata = {
        tavern: {
            mentions: [
                {
                    end: 8,
                    id: 'agent:planner',
                    kind: 'agent',
                    label: 'Planner',
                    projection: 'agent-reference',
                    start: 0,
                    text: '@Planner',
                },
                {
                    end: 16,
                    id: 'agent:critic',
                    kind: 'agent',
                    label: 'Critic',
                    projection: 'agent-reference',
                    start: 9,
                    text: '@Critic',
                },
            ],
        },
    } as const;

    const result = await sendTavernChatMessage(
        {
            chatId: planningChatId,
            content: '@Planner @Critic Plan the next launch.',
            metadata,
        },
        agentRuntimeClient as never
    );

    assert.deepEqual(
        result.turns.map((turn) => turn.agentId),
        ['agent:planner', 'agent:critic']
    );
    assert.deepEqual(
        calls.map(
            (call) => (call as { input: { agent: { agentId: string } } }).input.agent.agentId
        ),
        ['agent:planner', 'agent:critic']
    );
});

test('sendTavernChatMessage implicitly addresses one-to-one agent DMs', async () => {
    await seedPlanningChat();
    const calls: unknown[] = [];
    globalThis.fetch = runtimeTavernApiFetch({
        chat: runtimeTavernChat({ kind: 'dm' }),
    });
    const agentRuntimeClient = runtimeClient({ calls });

    const result = await sendTavernChatMessage(
        {
            chatId: planningChatId,
            content: 'Plan the next launch.',
        },
        agentRuntimeClient as never
    );

    assert.deepEqual(result.turns, [
        {
            agentId: 'agent:planner',
            runId: 'run-agent_planner',
        },
    ]);
    assert.equal(calls.length, 1);
});

function runtimeClient({ calls }: { calls: unknown[] }) {
    return {
        listChats: async () => ({
            chats: [
                {
                    bindingId: null,
                    bindings: [{ agentId: 'agent:planner' }],
                    id: planningChatId,
                    inboundMode: 'active',
                    metadata: {},
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
        listSessionMessages: async () => {
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
                        sessionKey: 'asb_planning_1',
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
                    key: 'asb_planning_1',
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
            const agentId =
                input && typeof input === 'object'
                    ? ((input as { agent?: { agentId?: string } }).agent?.agentId ?? 'unknown')
                    : 'unknown';
            const suffix = agentId.replace(/[^A-Za-z0-9_-]/g, '_');
            return {
                acceptedAt: '2026-04-06T12:10:00.000Z',
                runId: `run-${suffix}`,
                status: 'accepted' as const,
            };
        },
        upsertAgent: async () => {
            throw new Error('not used');
        },
    };
}

async function seedPlanningChat(input?: { agents?: Array<{ id: string; name: string }> }) {
    const agents = input?.agents ?? [{ id: 'agent:planner', name: 'Planner' }];
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
        agents: agents.map((agent) => ({
            enabledSkillIds: [],
            id: agent.id,
            isAdmin: false,
            name: agent.name,
            primaryColor: null,
            workspaceFolder: agent.id,
        })),
        runtimeId: 'runtime-1',
    });
}

function runtimeTavernApiFetch(input?: { chat?: ReturnType<typeof runtimeTavernChat> }) {
    const chat = input?.chat ?? runtimeTavernChat();
    return (async (requestInput, init) => {
        const request = new Request(requestInput, init);
        const url = new URL(request.url);
        const body = request.method === 'GET' ? null : await request.json();

        if (url.pathname === '/api/chats' && request.method === 'GET') {
            return Response.json({
                chats: [chat],
                next_cursor: null,
            });
        }

        if (url.pathname === '/agent/chats') {
            return Response.json({ chats: [] });
        }

        if (url.pathname === '/api/chats' && request.method === 'POST') {
            return Response.json({
                ...chat,
                id: body.id,
                metadata: body.metadata,
                title: body.title,
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
                attachments: [],
                chat_id: planningChatId,
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
}

function runtimeTavernChat(input?: {
    agents?: Array<{ id: string; name: string }>;
    displayNameSource?: 'explicit' | 'generated';
    kind?: 'channel' | 'dm';
}) {
    const agents = input?.agents ?? [{ id: 'agent:planner', name: 'Planner' }];
    const kind = input?.kind ?? 'channel';
    return {
        created_at: '2026-04-06T12:01:00.000Z',
        id: planningChatId,
        kind,
        last_message_sequence: 0,
        metadata: {
            runtime: {
                source: 'tavern',
            },
            tavern: {
                agentIds: agents.map((agent) => agent.id),
                archived: false,
                displayName: 'Planning',
                displayNameSource: input?.displayNameSource ?? 'explicit',
            },
        },
        participants: [
            {
                id: 'usr_tavern',
                kind: 'user',
                label: 'You',
                metadata: {},
            },
            ...agents.map((agent) => ({
                id: agent.id,
                kind: 'agent' as const,
                label: agent.name,
                metadata: { agentId: agent.id },
            })),
        ],
        title: 'Planning',
        updated_at: '2026-04-06T12:01:00.000Z',
    };
}

function mentionMetadata(input: {
    end: number;
    id: string;
    label: string;
    start: number;
    text: string;
}) {
    return {
        tavern: {
            mentions: [
                {
                    end: input.end,
                    id: input.id,
                    kind: 'agent' as const,
                    label: input.label,
                    projection: 'agent-reference' as const,
                    start: input.start,
                    text: input.text,
                },
            ],
        },
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
