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

        if (url.pathname === '/api/activity') {
            return Response.json({
                activities: [
                    {
                        agent_id: 'agt_main',
                        chat_id: 'cht_1',
                        metadata: {
                            runtime: {
                                agentId: 'main',
                                runId: 'run_1',
                                sessionKey: 'session_1',
                            },
                        },
                        run_id: 'run_1',
                        status: 'completed',
                        steps: [
                            activityStep({
                                detail: 'I will run the slow QA command before the final reply.',
                                id: 'assistant-reply:1',
                                kind: 'message',
                                label: 'Assistant reply',
                            }),
                            activityStep({
                                detail: 'I should show this reasoning summary in Tavern.',
                                id: 'reasoning:1',
                                kind: 'thinking',
                                label: 'Reasoning',
                            }),
                            activityStep({
                                detail: 'FINAL-OK',
                                id: 'assistant-reply:2',
                                kind: 'message',
                                label: 'Assistant reply',
                            }),
                        ],
                        summary: 'I will run the slow QA command before the final reply.',
                        updated_at: '2026-05-18T12:00:03.000Z',
                    },
                ],
            });
        }

        throw new Error(`Unexpected Tavern API request: ${url.pathname}`);
    }) as typeof fetch;

    const rows = await listRuntimeChatRows('cht_1');

    expect(requests).toEqual(['GET /api/chats/cht_1/messages', 'GET /api/activity']);
    expect(rows?.map((row) => row.id)).toEqual([
        'msg_user',
        'activity:run_1:assistant-reply:1',
        'activity:run_1:reasoning:1',
        'msg_final',
    ]);
    expect(rows?.find((row) => row.id === 'activity:run_1:assistant-reply:2')).toBeUndefined();
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

function activityStep(input: {
    detail: string;
    id: string;
    kind: 'message' | 'thinking';
    label: string;
}) {
    return {
        completed_at: '2026-05-18T12:00:03.000Z',
        id: input.id,
        kind: input.kind,
        label: input.label,
        metadata: {
            detail: input.detail,
        },
        started_at: '2026-05-18T12:00:02.000Z',
        status: 'completed',
    };
}
