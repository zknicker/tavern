import { afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { saveTavernChatRecord } from '../src/chat/records.ts';
import { sendTavernChatMessage } from '../src/chat/send.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { syncAgentsForRuntime } from '../src/storage/agents.ts';

ensureDatabaseSchema();

const planningChatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const planningSessionKey = `agent:agent:planner:tavern:channel:${planningChatId}`;

afterEach(() => {
    mock.restore();
    databaseClient.exec('DELETE FROM session_messages; DELETE FROM chats; DELETE FROM agents;');
});

test('sendTavernChatMessage posts to Runtime', async () => {
    await seedPlanningProjection();
    const calls: unknown[] = [];
    const historyCalls: unknown[] = [];
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
    assert.deepEqual(historyCalls, []);
    assert.match(sentMessageId ?? '', /^tavern-message:/u);
});

async function seedPlanningProjection() {
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
