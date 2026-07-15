import { afterEach, expect, mock, test } from 'bun:test';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { saveAgentRuntimeConnection } from '../src/storage/agent-runtime-connections.ts';

const originalFetch = globalThis.fetch;

mock.module('../src/agents/catalog.ts', () => ({
    listAgents: mock(async () => [
        {
            enabledSkillIds: [],
            id: 'main',
            name: 'Main',
            primaryColor: null,
            runtimeId: 'tavern-agent-engine',
            updatedAt: '2026-05-18T12:00:00.000Z',
        },
    ]),
}));

ensureDatabaseSchema();

const { getRuntimeChatTimelinePage } = await import('../src/chat/runtime-chat-api.ts');
const { getChatLogPage } = await import('../src/chat/log.ts');
const { getChatToolActivity } = await import('../src/chat/tool.ts');

afterEach(() => {
    globalThis.fetch = originalFetch;
    databaseClient.exec('DELETE FROM agent_runtime_connections;');
});

test('listRuntimeChatRows maps Tavern API messages and keeps execution activity off the timeline', async () => {
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [
                    chatMessage({
                        attachments: [
                            {
                                filename: 'notes.txt',
                                mediaType: 'text/plain',
                                path: '/tmp/notes.txt',
                                sizeBytes: 14,
                                type: 'file',
                            },
                        ],
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
                next_before_sequence: null,
                total_messages: 0,
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

    const rows = (await getRuntimeChatTimelinePage('cht_1'))?.rows ?? null;

    expect(requests).toEqual(['GET /api/chats/cht_1/timeline']);
    // Narration and reasoning are execution evidence (specs/chat-timeline.md);
    // only conversation units ride the timeline.
    expect(rows?.map((row) => row.id)).toEqual(['msg_user', 'msg_final']);
    expect(rows?.find((row) => row.id === 'msg_final')).toMatchObject({
        actor: { id: 'main', kind: 'agent' },
        message: {
            content: 'FINAL-OK',
            sender: 'Main',
            sourceSessionKey: 'session_1',
            tavernAgentId: 'main',
        },
    });
    expect(rows?.find((row) => row.id === 'msg_user')).toMatchObject({
        message: {
            attachments: [
                {
                    filename: 'notes.txt',
                    mediaType: 'text/plain',
                    path: '/tmp/notes.txt',
                    sizeBytes: 14,
                    type: 'file',
                },
            ],
        },
    });
});

test('listRuntimeChatTimeline accepts custom provider message metadata', async () => {
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [
                    chatMessage({
                        authorId: 'usr_owner',
                        authorKind: 'user',
                        authorLabel: 'You',
                        content: 'Reply exactly QA_CUSTOM_PROVIDER_OK.',
                        id: 'msg_user',
                        role: 'user',
                        sequence: 1,
                    }),
                    chatMessage({
                        authorId: 'agt_main',
                        authorKind: 'agent',
                        authorLabel: null,
                        content: 'QA_CUSTOM_PROVIDER_OK',
                        id: 'msg_final',
                        metadata: {
                            agentModel: 'tavern-e2e-fake',
                            agentProvider: 'custom',
                            model: 'tavern-e2e-fake',
                            provider: 'custom',
                            runtime: {
                                agentId: 'main',
                                runId: 'run_1',
                                sessionKey: 'session_1',
                            },
                            usage: { input: 16, output: 8, total: 24 },
                        },
                        role: 'assistant',
                        sequence: 2,
                    }),
                ],
                activity: [],
                artifacts: [],
                next_before_sequence: null,
                total_messages: 0,
                responses: [],
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const timeline = await getRuntimeChatTimelinePage('cht_1');

    expect(timeline?.rows.find((row) => row.id === 'msg_final')).toMatchObject({
        kind: 'message',
        message: {
            content: 'QA_CUSTOM_PROVIDER_OK',
            metadata: {
                agentProvider: 'custom',
                provider: 'custom',
            },
        },
    });
});

test('getChatLogPage preserves completed openai-codex provider metadata', async () => {
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [
                    chatMessage({
                        authorId: 'usr_owner',
                        authorKind: 'user',
                        authorLabel: 'You',
                        content: 'Hello',
                        id: 'msg_user',
                        role: 'user',
                        sequence: 1,
                    }),
                    chatMessage({
                        authorId: 'agt_main',
                        authorKind: 'agent',
                        authorLabel: null,
                        content: 'Hi.',
                        id: 'msg_final',
                        metadata: {
                            agentModel: 'gpt-5.5-codex',
                            agentProvider: 'openai-codex',
                            model: 'gpt-5.5-codex',
                            provider: 'openai-codex',
                            runtime: {
                                agentId: 'main',
                                runId: 'run_1',
                                sessionKey: 'session_1',
                            },
                        },
                        role: 'assistant',
                        sequence: 2,
                    }),
                ],
                activity: [],
                artifacts: [],
                next_before_sequence: null,
                total_messages: 0,
                responses: [],
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const page = await getChatLogPage({ id: 'cht_1', limit: 100 });

    expect(page.rows.find((row) => row.id === 'msg_final')).toMatchObject({
        kind: 'message',
        message: {
            metadata: {
                agentProvider: 'openai-codex',
                provider: 'openai-codex',
            },
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [],
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
                        metadata: { runtime: { source: 'agent-engine' } },
                        mime_type: 'text/markdown',
                        response_id: 'rsp_run_1',
                        title: 'Report',
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
                next_before_sequence: null,
                total_messages: 0,
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

    const rows = (await getRuntimeChatTimelinePage('cht_1'))?.rows ?? null;

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
                    metadata: { runtime: { source: 'agent-engine' } },
                    title: 'Report',
                },
            },
            id: 'art_report_1',
            kind: 'system',
            responseId: 'rsp_run_1',
            systemKind: 'artifact',
            timestamp: '2026-05-18T12:00:03.000Z',
        },
    ]);
});

test('listRuntimeChatRows keeps response artifacts while filtering their producing activity', async () => {
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [
                    chatMessage({
                        authorId: 'usr_owner',
                        authorKind: 'user',
                        authorLabel: 'You',
                        content: 'Write the report.',
                        id: 'msg_user',
                        role: 'user',
                        sequence: 1,
                    }),
                ],
                activity: [
                    responseActivity({
                        detail: 'Generated report.md',
                        id: 'act_tool_1',
                        kind: 'tool_call',
                        responseId: 'rsp_run_1',
                        startedAt: '2026-05-18T12:00:02.000Z',
                        title: 'Ran a command',
                    }),
                ],
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
                        metadata: {},
                        mime_type: 'text/markdown',
                        response_id: 'rsp_run_1',
                        title: 'Report',
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
                next_before_sequence: null,
                total_messages: 0,
                responses: [
                    {
                        chat_id: 'cht_1',
                        completed_at: '2026-05-18T12:00:04.000Z',
                        created_at: '2026-05-18T12:00:01.500Z',
                        id: 'rsp_run_1',
                        metadata: {},
                        participant_id: 'agt_main',
                        request_message_id: 'msg_user',
                        response_message_id: null,
                        status: 'completed',
                        summary: null,
                        updated_at: '2026-05-18T12:00:04.000Z',
                    },
                ],
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const rows = (await getRuntimeChatTimelinePage('cht_1'))?.rows ?? [];

    expect(rows.map((row) => row.id)).toEqual(['msg_user', 'art_report_1']);
});

test('listRuntimeChatRows maps runtime notice activity into system rows', async () => {
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [],
                activity: [
                    responseActivity({
                        detail: 'd348a369-223c-42a7-8220-67c7340810c2',
                        id: 'act_notice_1',
                        kind: 'custom',
                        metadata: {
                            runtime: {
                                notice: {
                                    detail: 'd348a369-223c-42a7-8220-67c7340810c2',
                                    kind: 'new_session',
                                    sessionId: 'd348a369-223c-42a7-8220-67c7340810c2',
                                    text: 'New session: d348a369-223c-42a7-8220-67c7340810c2',
                                    title: 'Started new session',
                                },
                            },
                        },
                        responseId: 'rsp_run_1',
                        title: 'Started new session',
                    }),
                ],
                artifacts: [],
                next_before_sequence: null,
                total_messages: 0,
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

    const rows = (await getRuntimeChatTimelinePage('cht_1'))?.rows ?? null;

    expect(rows).toEqual([
        {
            id: 'act_notice_1',
            kind: 'system',
            responseId: 'rsp_run_1',
            runtimeNotice: {
                agentId: null,
                compactionCount: null,
                detail: 'd348a369-223c-42a7-8220-67c7340810c2',
                kind: 'new_session',
                sessionId: 'd348a369-223c-42a7-8220-67c7340810c2',
                text: 'New session: d348a369-223c-42a7-8220-67c7340810c2',
                title: 'Started new session',
            },
            systemKind: 'runtimeNotice',
            timestamp: '2026-05-18T12:00:02.000Z',
        },
    ]);
});

test('listRuntimeChatRows keeps status notices off the timeline', async () => {
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [],
                activity: [
                    responseActivity({
                        detail: 'New message from You was delivered into the running turn.',
                        id: 'act_busy_1',
                        kind: 'custom',
                        metadata: {
                            runtime: {
                                notice: {
                                    detail: 'delivered',
                                    kind: 'status',
                                    text: 'Delivered mid-turn',
                                    title: 'Delivered mid-turn',
                                },
                            },
                        },
                        responseId: 'rsp_run_1',
                        title: 'Delivered mid-turn',
                    }),
                ],
                artifacts: [],
                next_before_sequence: null,
                total_messages: 0,
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

    const rows = (await getRuntimeChatTimelinePage('cht_1'))?.rows ?? null;

    // Busy-delivery/hold/wait-idle notices are turn evidence for the
    // drawer, not conversation rows (specs/chat-timeline.md).
    expect(rows).toEqual([]);
});

test('listRuntimeChatRows keeps tool evidence off the timeline', async () => {
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [],
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
                next_before_sequence: null,
                total_messages: 0,
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

    const rows = (await getRuntimeChatTimelinePage('cht_1'))?.rows ?? null;

    // Tool rows are turn evidence served by chat.turn.evidence; the durable
    // title mapping is covered by the activityToChatRows unit suite.
    expect(rows).toEqual([]);
});

test('listRuntimeChatRows keeps running narration activity off the timeline', async () => {
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [],
                activity: [
                    responseActivity({
                        detail: 'I will run a timed shell check before the final reply.',
                        id: 'act_assistant_reply_1',
                        kind: 'message',
                        responseId: 'rsp_run_1',
                        status: 'running',
                        title: 'Assistant reply',
                    }),
                ],
                artifacts: [],
                next_before_sequence: null,
                total_messages: 0,
                responses: [
                    {
                        chat_id: 'cht_1',
                        completed_at: null,
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
                        status: 'running',
                        summary: null,
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const rows = (await getRuntimeChatTimelinePage('cht_1'))?.rows ?? null;

    expect(rows).toEqual([]);
});

test('listRuntimeChatRows keeps only the request message while a turn narrates', async () => {
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [
                    chatMessage({
                        authorId: 'usr_owner',
                        authorKind: 'user',
                        authorLabel: 'You',
                        content: 'Investigate the ordering.',
                        id: 'msg_user',
                        role: 'user',
                        sequence: 2,
                    }),
                ],
                activity: [
                    responseActivity({
                        detail: 'I will inspect the projector first.',
                        id: 'act_assistant_reply_1',
                        kind: 'message',
                        responseId: 'rsp_run_1',
                        status: 'running',
                        title: 'Assistant reply',
                    }),
                ],
                artifacts: [],
                next_before_sequence: null,
                total_messages: 0,
                responses: [
                    {
                        chat_id: 'cht_1',
                        completed_at: null,
                        created_at: '2026-05-18T12:00:01.000Z',
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
                        response_message_id: null,
                        status: 'running',
                        summary: null,
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const rows = (await getRuntimeChatTimelinePage('cht_1'))?.rows ?? null;

    expect(rows?.map((row) => row.id)).toEqual(['msg_user']);
});

test('listRuntimeChatTimeline exposes running responses as active replies after reload', async () => {
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

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                messages: [
                    chatMessage({
                        authorId: 'usr_owner',
                        authorKind: 'user',
                        authorLabel: 'You',
                        content: 'Wait for it.',
                        id: 'msg_user',
                        role: 'user',
                        sequence: 1,
                    }),
                ],
                activity: [],
                artifacts: [],
                next_before_sequence: null,
                total_messages: 0,
                responses: [
                    {
                        chat_id: 'cht_1',
                        completed_at: null,
                        created_at: '2026-05-18T12:00:01.000Z',
                        id: 'rsp_run_1',
                        metadata: {
                            runtime: {
                                agentId: 'main',
                                runId: 'run_1',
                                sessionKey: 'session_1',
                                startedAt: '2026-05-18T12:00:01.500Z',
                            },
                        },
                        participant_id: 'agt_main',
                        request_message_id: 'msg_user',
                        response_message_id: null,
                        status: 'running',
                        summary: null,
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const timeline = await getRuntimeChatTimelinePage('cht_1');

    expect(timeline?.rows.map((row) => row.id)).toEqual(['msg_user']);
    expect(timeline?.activeReplies).toEqual([
        {
            agentId: 'main',
            isThinking: true,
            runId: 'run_1',
            sessionKey: 'session_1',
            startedAt: '2026-05-18T12:00:01.500Z',
            text: '',
        },
    ]);
});

test('older timeline pages forward the cursor and never carry live turn state', async () => {
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
        requests.push(`${url.pathname}${url.search}`);

        if (url.pathname === '/api/chats/cht_1/timeline') {
            return Response.json({
                activity: [],
                artifacts: [],
                messages: [],
                next_before_sequence: 3,
                responses: [
                    {
                        chat_id: 'cht_1',
                        completed_at: null,
                        created_at: '2026-05-18T12:00:01.000Z',
                        id: 'rsp_run_1',
                        metadata: {},
                        participant_id: 'agt_main',
                        request_message_id: null,
                        response_message_id: null,
                        status: 'running',
                        summary: null,
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
                total_messages: 12,
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const page = await getRuntimeChatTimelinePage('cht_1', { beforeSequence: 9, limit: 50 });

    expect(requests).toEqual(['/api/chats/cht_1/timeline?before_sequence=9&limit=50']);
    expect(page?.activeReplies).toEqual([]);
    expect(page?.failedTurns).toEqual([]);
    expect(page?.nextBeforeSequence).toBe(3);
    expect(page?.totalMessages).toBe(12);
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
    attachments?: Record<string, unknown>[];
    authorId: string;
    authorKind: 'agent' | 'system' | 'user';
    authorLabel: string | null;
    content: string;
    id: string;
    metadata?: Record<string, unknown>;
    role: 'assistant' | 'system' | 'user';
    sequence: number;
}) {
    return {
        attachments: input.attachments ?? [],
        author: {
            id: input.authorId,
            kind: input.authorKind,
            label: input.authorLabel,
            metadata: {},
        },
        chat_id: 'cht_1',
        content: input.content,
        created_at: `2026-05-18T12:00:0${input.sequence}.000Z`,
        deleted_at: null,
        delivery_id: input.role === 'assistant' ? 'del_1' : null,
        id: input.id,
        metadata: input.metadata ?? {
            runtime: {
                agentId: 'main',
                runId: 'run_1',
                sessionKey: 'session_1',
            },
        },
        nonce: null,
        parent_message_id: null,
        role: input.role,
        sequence: input.sequence,
        thread_root_id: null,
    };
}

function responseActivity(input: {
    detail: string;
    id: string;
    kind: 'custom' | 'message' | 'reasoning' | 'tool_call';
    metadata?: Record<string, unknown>;
    responseId: string;
    sequence?: number;
    startedAt?: string;
    status?: 'completed' | 'running';
    title: string;
}) {
    return {
        artifact_ids: [],
        chat_id: 'cht_1',
        completed_at: input.status === 'running' ? null : '2026-05-18T12:00:03.000Z',
        detail: input.detail,
        id: input.id,
        kind: input.kind,
        metadata: input.metadata ?? {},
        response_id: input.responseId,
        sequence:
            input.sequence ??
            (input.id.endsWith('_1') ? 1 : input.id.includes('reasoning') ? 2 : 3),
        started_at: input.startedAt ?? '2026-05-18T12:00:02.000Z',
        status: input.status ?? 'completed',
        summary: null,
        title: input.title,
        updated_at: '2026-05-18T12:00:03.000Z',
    };
}
