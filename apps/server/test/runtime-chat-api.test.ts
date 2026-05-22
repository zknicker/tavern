import { afterEach, expect, mock, test } from 'bun:test';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { saveAgentRuntimeConnection } from '../src/storage/agent-runtime-connections.ts';

const originalFetch = globalThis.fetch;

mock.module('../src/agents/catalog.ts', () => ({
    listAgents: mock(async () => [
        {
            avatar: null,
            emoji: null,
            enabledSkillIds: [],
            id: 'main',
            name: 'Main',
            primaryColor: null,
            runtimeId: 'tavern-openclaw-managed',
            updatedAt: '2026-05-18T12:00:00.000Z',
        },
    ]),
}));

ensureDatabaseSchema();

const { listRuntimeChatRows } = await import('../src/chat/runtime-chat-api.ts');
const { getChatToolActivity } = await import('../src/chat/tool.ts');

afterEach(() => {
    globalThis.fetch = originalFetch;
    databaseClient.exec('DELETE FROM agent_runtime_connections;');
});

test('listRuntimeChatRows maps Tavern API messages and keeps preamble/reasoning activity', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-05-18T12:00:00.000Z',
        lastError: null,
        name: 'Runtime',
    });

    const requests: string[] = [];
    globalThis.fetch = (async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        requests.push(`${request.method} ${url.pathname}`);

        if (url.pathname === '/api/chats/cht_1/messages') {
            return Response.json({
                messages: [
                    chatMessage({
                        authorId: 'usr_owner',
                        authorKind: 'user',
                        authorLabel: 'You',
                        content: 'Do the work.',
                        id: 'msg_user',
                        role: 'user',
                        sequence: 1,
                    }),
                    chatMessage({
                        authorId: 'agt_main',
                        authorKind: 'agent',
                        authorLabel: null,
                        content: 'FINAL-OK',
                        id: 'msg_final',
                        role: 'assistant',
                        sequence: 2,
                    }),
                ],
            });
        }

        if (url.pathname === '/api/chats/cht_1/responses') {
            return Response.json({
                activity: [
                    responseActivity({
                        detail: 'I will run the slow QA command before the final reply.',
                        id: 'act_assistant_reply_1',
                        kind: 'message',
                        responseId: 'rsp_run_1',
                        title: 'Assistant reply',
                    }),
                    responseActivity({
                        detail: 'I should show this reasoning summary in Tavern.',
                        id: 'act_reasoning_1',
                        kind: 'reasoning',
                        responseId: 'rsp_run_1',
                        title: 'Reasoning',
                    }),
                    responseActivity({
                        detail: 'FINAL-OK',
                        id: 'act_assistant_reply_2',
                        kind: 'message',
                        responseId: 'rsp_run_1',
                        title: 'Assistant reply',
                    }),
                ],
                artifacts: [],
                next_sequence: null,
                responses: [
                    {
                        chat_id: 'cht_1',
                        completed_at: '2026-05-18T12:00:03.000Z',
                        created_at: '2026-05-18T12:00:01.500Z',
                        id: 'rsp_run_1',
                        metadata: {
                            runtime: {
                                agentId: 'main',
                                runId: 'run_1',
                                sessionKey: 'session_1',
                            },
                        },
                        participant_id: 'agt_main',
                        request_message_id: 'msg_user',
                        response_message_id: 'msg_final',
                        status: 'completed',
                        summary: 'I will run the slow QA command before the final reply.',
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const rows = await listRuntimeChatRows('cht_1');

    expect(requests).toEqual(['GET /api/chats/cht_1/messages', 'GET /api/chats/cht_1/responses']);
    expect(rows?.map((row) => row.id)).toEqual([
        'msg_user',
        'act_assistant_reply_1',
        'act_reasoning_1',
        'msg_final',
    ]);
    expect(rows?.find((row) => row.id === 'act_assistant_reply_2')).toBeUndefined();
    expect(rows?.find((row) => row.id === 'msg_final')).toMatchObject({
        actor: { id: 'main', kind: 'agent' },
        message: {
            content: 'FINAL-OK',
            sender: 'Main',
            sourceSessionKey: 'session_1',
            tavernAgentId: 'main',
        },
    });
});

test('listRuntimeChatRows maps Tavern API artifacts into chat timeline rows', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-05-18T12:00:00.000Z',
        lastError: null,
        name: 'Runtime',
    });

    globalThis.fetch = (async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);

        if (url.pathname === '/api/chats/cht_1/messages') {
            return Response.json({ messages: [] });
        }

        if (url.pathname === '/api/chats/cht_1/responses') {
            return Response.json({
                activity: [],
                artifacts: [
                    {
                        activity_id: 'act_tool_1',
                        chat_id: 'cht_1',
                        content_ref: 'file:///tmp/report.md',
                        content_text: '# Report',
                        created_at: '2026-05-18T12:00:03.000Z',
                        id: 'art_report_1',
                        kind: 'document',
                        message_id: null,
                        metadata: { runtime: { source: 'openclaw' } },
                        mime_type: 'text/markdown',
                        response_id: 'rsp_run_1',
                        title: 'Report',
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
                next_sequence: null,
                responses: [
                    {
                        chat_id: 'cht_1',
                        completed_at: '2026-05-18T12:00:03.000Z',
                        created_at: '2026-05-18T12:00:01.500Z',
                        id: 'rsp_run_1',
                        metadata: {},
                        participant_id: 'agt_main',
                        request_message_id: null,
                        response_message_id: null,
                        status: 'completed',
                        summary: null,
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const rows = await listRuntimeChatRows('cht_1');

    expect(rows).toEqual([
        {
            artifact: {
                artifactType: 'document',
                createdAt: '2026-05-18T12:00:03.000Z',
                id: 'art_report_1',
                mimeType: 'text/markdown',
                path: 'file:///tmp/report.md',
                payload: {
                    contentRef: 'file:///tmp/report.md',
                    contentText: '# Report',
                    metadata: { runtime: { source: 'openclaw' } },
                    title: 'Report',
                },
            },
            id: 'art_report_1',
            kind: 'system',
            systemKind: 'artifact',
            timestamp: '2026-05-18T12:00:03.000Z',
        },
    ]);
});

test('listRuntimeChatRows preserves durable activity titles for tool rows', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-05-18T12:00:00.000Z',
        lastError: null,
        name: 'Runtime',
    });

    globalThis.fetch = (async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);

        if (url.pathname === '/api/chats/cht_1/messages') {
            return Response.json({ messages: [] });
        }

        if (url.pathname === '/api/chats/cht_1/responses') {
            return Response.json({
                activity: [
                    responseActivity({
                        detail: '',
                        id: 'act_tool_call_1',
                        kind: 'tool_call',
                        metadata: {
                            runtime: {
                                agentId: 'main',
                                runId: 'run_1',
                                sessionKey: 'session_1',
                            },
                            tool: {
                                arguments: null,
                                name: null,
                                result: null,
                            },
                        },
                        responseId: 'rsp_run_1',
                        title: 'read from QA_KICKOFF_TASK.md',
                    }),
                ],
                artifacts: [],
                next_sequence: null,
                responses: [
                    {
                        chat_id: 'cht_1',
                        completed_at: '2026-05-18T12:00:03.000Z',
                        created_at: '2026-05-18T12:00:01.500Z',
                        id: 'rsp_run_1',
                        metadata: {
                            runtime: {
                                agentId: 'main',
                                runId: 'run_1',
                                sessionKey: 'session_1',
                            },
                        },
                        participant_id: 'agt_main',
                        request_message_id: null,
                        response_message_id: null,
                        status: 'completed',
                        summary: null,
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const rows = await listRuntimeChatRows('cht_1');

    expect(rows).toMatchObject([
        {
            id: 'act_tool_call_1',
            kind: 'tool',
            toolCall: {
                label: 'read from QA_KICKOFF_TASK.md',
                name: 'tool',
                summaryParts: ['read from QA_KICKOFF_TASK.md'],
            },
        },
    ]);
});

test('getChatToolActivity resolves durable response activity into tool details', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-05-18T12:00:00.000Z',
        lastError: null,
        name: 'Runtime',
    });

    globalThis.fetch = (async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);

        if (url.pathname === '/api/chats/cht_1/activity/act_call_123') {
            return Response.json({
                ...responseActivity({
                    detail: 'done',
                    id: 'act_call_123',
                    kind: 'tool_call',
                    metadata: {
                        runtime: {
                            toolCallId: 'call_123',
                            toolName: 'computer-use.list_apps',
                        },
                        tool: {
                            arguments: { app: 'Messages' },
                            name: 'computer-use.list_apps',
                            result: { count: 1, status: 'completed' },
                        },
                    },
                    responseId: 'rsp_run_1',
                    title: 'computer use.list apps',
                }),
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const detail = await getChatToolActivity({
        activityId: 'act_call_123',
        chatId: 'cht_1',
    });

    expect(detail).toMatchObject({
        arguments: { app: 'Messages' },
        completedAt: '2026-05-18T12:00:03.000Z',
        result: { count: 1, status: 'completed' },
        startedAt: '2026-05-18T12:00:02.000Z',
        toolCall: {
            callId: 'call_123',
            name: 'computer-use.list_apps',
            status: 'completed',
        },
    });
});


function chatMessage(input: {
    authorId: string;
    authorKind: 'agent' | 'system' | 'user';
    authorLabel: string | null;
    content: string;
    id: string;
    role: 'assistant' | 'system' | 'user';
    sequence: number;
}) {
    return {
        author: {
            id: input.authorId,
            kind: input.authorKind,
            label: input.authorLabel,
            metadata: {},
        },
        chat_id: 'cht_1',
        created_at: `2026-05-18T12:00:0${input.sequence}.000Z`,
        deleted_at: null,
        delivery_id: input.role === 'assistant' ? 'del_1' : null,
        id: input.id,
        metadata: {
            runtime: {
                agentId: 'main',
                runId: 'run_1',
                sessionKey: 'session_1',
            },
        },
        nonce: null,
        parent_message_id: null,
        parts: [
            {
                content: input.content,
                id: `${input.id}:part`,
                kind: 'text',
                metadata: {},
            },
        ],
        role: input.role,
        sequence: input.sequence,
        thread_root_id: null,
    };
}

function responseActivity(input: {
    detail: string;
    id: string;
    kind: 'message' | 'reasoning' | 'tool_call';
    metadata?: Record<string, unknown>;
    responseId: string;
    title: string;
}) {
    return {
        artifact_ids: [],
        chat_id: 'cht_1',
        completed_at: '2026-05-18T12:00:03.000Z',
        detail: input.detail,
        id: input.id,
        kind: input.kind,
        metadata: input.metadata ?? {},
        response_id: input.responseId,
        sequence: input.id.endsWith('_1') ? 1 : input.id.includes('reasoning') ? 2 : 3,
        started_at: '2026-05-18T12:00:02.000Z',
        status: 'completed',
        summary: null,
        title: input.title,
        updated_at: '2026-05-18T12:00:03.000Z',
    };
}
