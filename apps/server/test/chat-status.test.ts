import { afterEach, test } from 'bun:test';
import assert from 'node:assert/strict';
import { listChatStatuses } from '../src/chat/status.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { saveAgentRuntimeConnection } from '../src/storage/agent-runtime-connections.ts';

ensureDatabaseSchema();

const originalFetch = globalThis.fetch;
const chatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const sessionKey = `agent:agent:planner:tavern:channel:${chatId}`;

afterEach(() => {
    globalThis.fetch = originalFetch;
    databaseClient.exec('DELETE FROM agent_runtime_connections;');
});

test('listChatStatuses returns an empty list when no Runtime API is configured', async () => {
    assert.deepEqual(await listChatStatuses(), {
        chats: [],
    });
});

test('listChatStatuses maps Runtime chat activity into active reply status', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-04-20T18:14:00.000Z',
        lastError: null,
        name: 'Runtime',
    });
    globalThis.fetch = (async () =>
        Response.json({
            activities: [
                {
                    agent_id: 'agent:planner',
                    chat_id: chatId,
                    metadata: {
                        runtime: {
                            sessionKey,
                            startedAt: '2026-04-20T18:14:00.000Z',
                        },
                    },
                    run_id: 'run-1',
                    status: 'running',
                    steps: [
                        {
                            completed_at: null,
                            id: 'tool:sleep',
                            kind: 'tool',
                            label: 'Using sleep',
                            metadata: {
                                detail: 'sleep 4',
                            },
                            started_at: '2026-04-20T18:14:01.000Z',
                            status: 'running',
                        },
                    ],
                    summary: 'Working',
                    updated_at: '2026-04-20T18:14:01.000Z',
                },
            ],
        })) as typeof fetch;

    assert.deepEqual(await listChatStatuses(), {
        chats: [
            {
                activeReply: {
                    agentId: 'agent:planner',
                    isThinking: true,
                    runId: 'run-1',
                    sessionKey,
                    startedAt: '2026-04-20T18:14:00.000Z',
                    text: 'Working',
                },
                activeReplyProgressStartedAt: '2026-04-20T18:14:01.000Z',
                activeReplySteps: [
                    {
                        detail: 'sleep 4',
                        id: 'tool:sleep',
                        kind: 'tool',
                        label: 'Using sleep',
                        status: 'active',
                    },
                ],
                chatId,
            },
        ],
    });
});

test('listChatStatuses exposes running activity as progress before tool steps arrive', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-04-20T18:14:00.000Z',
        lastError: null,
        name: 'Runtime',
    });
    globalThis.fetch = (async () =>
        Response.json({
            activities: [
                {
                    agent_id: 'agent:planner',
                    chat_id: chatId,
                    metadata: {
                        runtime: {
                            sessionKey,
                            startedAt: '2026-04-20T18:14:00.000Z',
                        },
                    },
                    run_id: 'run-1',
                    status: 'running',
                    steps: [],
                    summary: null,
                    updated_at: '2026-04-20T18:14:01.000Z',
                },
            ],
        })) as typeof fetch;

    assert.deepEqual(await listChatStatuses(), {
        chats: [
            {
                activeReply: {
                    agentId: 'agent:planner',
                    isThinking: true,
                    runId: 'run-1',
                    sessionKey,
                    startedAt: '2026-04-20T18:14:00.000Z',
                    text: '',
                },
                activeReplyProgressStartedAt: '2026-04-20T18:14:00.000Z',
                activeReplySteps: [
                    {
                        detail: null,
                        id: 'planning',
                        kind: 'plan',
                        label: 'Planning',
                        status: 'active',
                    },
                ],
                chatId,
            },
        ],
    });
});
