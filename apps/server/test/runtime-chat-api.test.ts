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
const { markTavernChatRead } = await import('../src/chat/read.ts');
const { listRuntimeChatRecords } = await import('../src/chat/runtime-chats.ts');
const { setTavernThreadFollow } = await import('../src/chat/thread-follow.ts');
const { getChatToolActivity } = await import('../src/chat/tool.ts');
const { subscribeToTavernEvent, tavernEventNames } = await import(
    '../src/api/invalidation-events.ts'
);

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
                threads: [],
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

test('chat log attaches per-reader thread summaries to anchor message rows', async () => {
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

        return Response.json({
            activity: [],
            artifacts: [],
            messages: [
                chatMessage({
                    authorId: 'usr_owner',
                    authorKind: 'user',
                    authorLabel: 'You',
                    content: 'Anchor',
                    id: 'msg_anchor_1',
                    role: 'user',
                    sequence: 1,
                }),
                chatMessage({
                    authorId: 'usr_owner',
                    authorKind: 'user',
                    authorLabel: 'You',
                    content: 'No thread',
                    id: 'msg_plain',
                    role: 'user',
                    sequence: 2,
                }),
            ],
            next_before_sequence: null,
            responses: [],
            threads: [
                {
                    anchor_message_id: 'msg_anchor_1',
                    followed: true,
                    latest_reply_at: '2026-05-18T12:01:00.000Z',
                    reply_count: 2,
                    thread_chat_id: 'cht_thr_anchor_1',
                    unread_count: 1,
                },
            ],
            total_messages: 2,
        });
    }) as typeof fetch;

    const page = await getChatLogPage({ id: 'cht_1', limit: 100 });

    expect(requests).toEqual(['/api/chats/cht_1/timeline?limit=100&reader_id=usr_tavern']);
    expect(page.rows.find((row) => row.id === 'msg_anchor_1')).toMatchObject({
        thread: {
            anchorMessageId: 'msg_anchor_1',
            followed: true,
            latestReplyAt: '2026-05-18T12:01:00.000Z',
            replyCount: 2,
            threadChatId: 'cht_thr_anchor_1',
            unreadCount: 1,
        },
    });
    expect(page.rows.find((row) => row.id === 'msg_plain')).not.toHaveProperty('thread');
});

test('setTavernThreadFollow returns follow state and invalidates the parent chat', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-05-18T12:00:00.000Z',
        lastError: null,
        name: 'Runtime',
    });

    const requests: Array<{ body: unknown; method: string; path: string; search: string }> = [];
    globalThis.fetch = (async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const body = request.method === 'GET' ? null : await request.json();
        requests.push({ body, method: request.method, path: url.pathname, search: url.search });

        if (request.method === 'GET') {
            return Response.json({
                active_turn_participant_ids: [],
                anchor_message_id: 'msg_anchor_1',
                created_at: '2026-05-18T12:00:00.000Z',
                id: 'cht_thr_anchor_1',
                kind: 'thread',
                last_activity_at: null,
                last_message_sequence: 0,
                metadata: {},
                parent_chat_id: 'cht_1',
                participants: [],
                title: null,
                unread_count: 0,
                updated_at: '2026-05-18T12:00:00.000Z',
            });
        }

        return Response.json({ followed: true });
    }) as typeof fetch;

    const chatInvalidation = nextInvalidation(tavernEventNames.chatUpdated);
    const logInvalidation = nextInvalidation(tavernEventNames.chatLogUpdated);
    const result = await setTavernThreadFollow({
        follow: true,
        threadChatId: 'cht_thr_anchor_1',
    });

    expect(result).toEqual({ followed: true, threadChatId: 'cht_thr_anchor_1' });
    expect(requests).toEqual([
        {
            body: null,
            method: 'GET',
            path: '/api/chats/cht_thr_anchor_1',
            search: '?reader_id=usr_tavern',
        },
        {
            body: { follow: true, participant_id: 'usr_tavern' },
            method: 'PUT',
            path: '/api/chats/cht_thr_anchor_1/follow',
            search: '',
        },
    ]);
    expect(await chatInvalidation).toMatchObject({ chatId: 'cht_1' });
    expect(await logInvalidation).toMatchObject({ chatId: 'cht_1' });
});

test('thread chats stay out of server lists but resolve transiently for mark read', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-05-18T12:00:00.000Z',
        lastError: null,
        name: 'Runtime',
    });

    const parentChat = tavernChatFixture({ id: 'cht_1', kind: 'channel' });
    const threadChat = tavernChatFixture({
        anchorMessageId: 'msg_anchor_1',
        id: 'cht_thr_anchor_1',
        kind: 'thread',
        parentChatId: 'cht_1',
    });
    const requests: Array<{ body: unknown; method: string; path: string }> = [];
    globalThis.fetch = (async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const body = request.method === 'GET' ? null : await request.json();
        requests.push({ body, method: request.method, path: url.pathname });

        if (url.pathname === '/api/chats') {
            return Response.json({ chats: [parentChat, threadChat], next_cursor: null });
        }
        if (url.pathname === '/agent/chats') {
            return Response.json({ chats: [] });
        }
        if (url.pathname === '/api/chats/cht_thr_anchor_1/read') {
            return Response.json({
                chat_id: 'cht_thr_anchor_1',
                last_read_sequence: 4,
                read_at: '2026-05-18T12:00:00.000Z',
                reader_id: 'usr_tavern',
            });
        }
        if (url.pathname === '/api/chats/cht_thr_anchor_1') {
            return Response.json(threadChat);
        }
        if (url.pathname === '/api/chats/cht_1') {
            return Response.json(parentChat);
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const listed = await listRuntimeChatRecords();
    const receipt = await markTavernChatRead({ chatId: 'cht_thr_anchor_1' });

    expect(listed.map((record) => record.chat.id)).toEqual(['cht_1']);
    expect(receipt).toEqual({ chatId: 'cht_thr_anchor_1', lastReadSequence: 4 });
    expect(requests).toContainEqual({
        body: { reader_id: 'usr_tavern' },
        method: 'POST',
        path: '/api/chats/cht_thr_anchor_1/read',
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
                threads: [],
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
                threads: [],
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
                threads: [],
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
                threads: [],
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
                threads: [],
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
                threads: [],
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

test('listRuntimeChatTimeline keeps the request message while a response is still running', async () => {
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
                threads: [],
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
                threads: [],
                total_messages: 12,
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const page = await getRuntimeChatTimelinePage('cht_1', { beforeSequence: 9, limit: 50 });

    expect(requests).toEqual(['/api/chats/cht_1/timeline?before_sequence=9&limit=50']);
    expect(page?.rows).toEqual([]);
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
        role: input.role,
        sequence: input.sequence,
    };
}

function tavernChatFixture(input: {
    anchorMessageId?: string;
    id: string;
    kind: 'channel' | 'thread';
    parentChatId?: string;
}) {
    return {
        active_turn_participant_ids: [],
        anchor_message_id: input.anchorMessageId ?? null,
        created_at: '2026-05-18T12:00:00.000Z',
        id: input.id,
        kind: input.kind,
        last_activity_at: null,
        last_message_sequence: 0,
        metadata: {
            tavern: {
                agentIds: ['main'],
                archived: false,
                displayName: 'Planning',
                displayNameSource: 'explicit',
            },
        },
        parent_chat_id: input.parentChatId ?? null,
        participants: [
            { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
            { id: 'main', kind: 'agent', label: 'Main', metadata: {} },
        ],
        title: input.kind === 'thread' ? null : 'Planning',
        unread_count: 0,
        updated_at: '2026-05-18T12:00:00.000Z',
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

async function nextInvalidation(
    eventName: (typeof tavernEventNames)[keyof typeof tavernEventNames]
) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        for await (const event of subscribeToTavernEvent(eventName, controller.signal)) {
            return event;
        }
    } finally {
        clearTimeout(timeout);
    }

    throw new Error(`Timed out waiting for ${eventName} invalidation.`);
}
