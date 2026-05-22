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
    globalThis.fetch = mockChatStatusFetch({
        activity: [
            responseActivity({
                detail: 'sleep 4',
                id: 'act_sleep',
                kind: 'tool_call',
                responseId: 'rsp_run_1',
                title: 'Using sleep',
            }),
        ],
        responses: [
            response({
                id: 'rsp_run_1',
                status: 'running',
                summary: 'Working',
            }),
        ],
    }) as typeof fetch;

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
                        id: 'act_sleep',
                        kind: 'tool',
                        label: 'Using sleep',
                        status: 'active',
                        toolCallId: null,
                        toolName: null,
                    },
                ],
                chatId,
            },
        ],
    });
});

test('listChatStatuses preserves approval and artifact activity kinds', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-04-20T18:14:00.000Z',
        lastError: null,
        name: 'Runtime',
    });
    globalThis.fetch = mockChatStatusFetch({
        activity: [
            responseActivity({
                detail: 'Approve file edit',
                id: 'act_approval',
                kind: 'approval',
                responseId: 'rsp_run_1',
                title: 'Review command',
            }),
            responseActivity({
                detail: 'modified docs/api/chat.md',
                id: 'act_patch',
                kind: 'artifact',
                responseId: 'rsp_run_1',
                title: 'Patch',
            }),
        ],
        responses: [
            response({
                id: 'rsp_run_1',
                status: 'running',
                summary: 'Working',
            }),
        ],
    }) as typeof fetch;

    const result = await listChatStatuses();

    assert.deepEqual(result.chats[0]?.activeReplySteps, [
        {
            detail: 'Approve file edit',
            id: 'act_approval',
            kind: 'approval',
            label: 'Review command',
            status: 'active',
            toolCallId: null,
            toolName: null,
        },
        {
            detail: 'modified docs/api/chat.md',
            id: 'act_patch',
            kind: 'artifact',
            label: 'Patch',
            status: 'active',
            toolCallId: null,
            toolName: null,
        },
    ]);
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
    globalThis.fetch = mockChatStatusFetch({
        activity: [],
        responses: [
            response({
                id: 'rsp_run_1',
                status: 'running',
                summary: null,
            }),
        ],
    }) as typeof fetch;

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

function mockChatStatusFetch(input: { activity: unknown[]; responses: unknown[] }) {
    return async (requestInfo: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(requestInfo, init);
        const url = new URL(request.url);

        if (url.pathname === '/api/chats') {
            return Response.json({
                chats: [{ id: chatId }],
                next_cursor: null,
            });
        }

        if (url.pathname === `/api/chats/${chatId}/responses`) {
            return Response.json({
                activity: input.activity,
                artifacts: [],
                next_sequence: null,
                responses: input.responses,
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    };
}

function response(input: { id: string; status: string; summary: string | null }) {
    return {
        chat_id: chatId,
        completed_at: null,
        created_at: '2026-04-20T18:14:00.000Z',
        id: input.id,
        metadata: {
            runtime: {
                agentId: 'agent:planner',
                runId: 'run-1',
                sessionKey,
                startedAt: '2026-04-20T18:14:00.000Z',
            },
        },
        participant_id: 'agent:planner',
        request_message_id: null,
        response_message_id: null,
        status: input.status,
        summary: input.summary,
        updated_at: '2026-04-20T18:14:01.000Z',
    };
}

function responseActivity(input: {
    detail: string | null;
    id: string;
    kind: string;
    responseId: string;
    title: string;
}) {
    return {
        artifact_ids: [],
        chat_id: chatId,
        completed_at: null,
        detail: input.detail,
        id: input.id,
        kind: input.kind,
        metadata: {},
        response_id: input.responseId,
        sequence: 1,
        started_at: '2026-04-20T18:14:01.000Z',
        status: 'running',
        summary: null,
        title: input.title,
        updated_at: '2026-04-20T18:14:01.000Z',
    };
}
