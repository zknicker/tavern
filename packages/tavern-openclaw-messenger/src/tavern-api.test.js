import { describe, expect, it, mock } from 'bun:test';
import {
    activityStepFromProgressStep,
    createTavernPluginApi,
    deriveTavernApiBaseUrl,
} from './tavern-api.js';

describe('Tavern API adapter', () => {
    it('writes final assistant deliveries through the Tavern SDK OpenAPI path', async () => {
        const requests = [];
        const tavern = createTavernPluginApi({
            baseUrl: 'http://runtime.test',
            fetch: mock(async (url, init) => {
                requests.push({
                    body: JSON.parse(String(init.body)),
                    method: init.method,
                    url: String(url),
                });
                if (String(url).endsWith('/deliveries')) {
                    return jsonResponse({
                        cursor: '1',
                        id: 'del_1',
                        idempotent: false,
                        message: {
                            id: 'msg_reply',
                        },
                    });
                }
                return jsonResponse({
                    chat_id: 'cht_1',
                    completed_at: '2026-05-18T12:00:00.000Z',
                    created_at: '2026-05-18T12:00:00.000Z',
                    id: 'rsp_run_1',
                    metadata: {},
                    participant_id: 'agt_main',
                    request_message_id: 'msg_user',
                    response_message_id: 'msg_reply',
                    status: 'completed',
                    summary: null,
                    updated_at: '2026-05-18T12:00:00.000Z',
                });
            }),
        });

        await tavern.createDelivery({
            agentId: 'main',
            chatId: 'cht_1',
            deliveryId: 'del_1',
            messageId: 'msg_reply',
            requestMessageId: 'msg_user',
            runId: 'run_1',
            sessionKey: 'agent:main:tavern:channel:cht_1',
            text: 'done',
        });

        expect(requests).toEqual([
            {
                body: {
                    agent_id: 'agt_main',
                    id: 'del_1',
                    message: {
                        author_id: 'agt_main',
                        content: 'done',
                        id: 'msg_reply',
                        metadata: {
                            runtime: {
                                agentId: 'main',
                                deliveryId: 'del_1',
                                runId: 'run_1',
                                sessionKey: 'agent:main:tavern:channel:cht_1',
                                source: 'openclaw',
                            },
                        },
                        role: 'assistant',
                    },
                    metadata: {
                        runtime: {
                            agentId: 'main',
                            deliveryId: 'del_1',
                            runId: 'run_1',
                            sessionKey: 'agent:main:tavern:channel:cht_1',
                            source: 'openclaw',
                        },
                    },
                    turn_id: 'run_1',
                },
                method: 'POST',
                url: 'http://runtime.test/api/chats/cht_1/deliveries',
            },
            {
                body: {
                    completed_at: expect.any(String),
                    id: 'rsp_run_1',
                    metadata: {
                        runtime: {
                            agentId: 'main',
                            deliveryId: 'del_1',
                            runId: 'run_1',
                            sessionKey: 'agent:main:tavern:channel:cht_1',
                            source: 'openclaw',
                        },
                    },
                    participant_id: 'agt_main',
                    request_message_id: 'msg_user',
                    response_message_id: 'msg_reply',
                    status: 'completed',
                    summary: null,
                },
                method: 'POST',
                url: 'http://runtime.test/api/chats/cht_1/responses',
            },
        ]);
    });

    it('writes response activity through the Tavern SDK OpenAPI path', async () => {
        const requests = [];
        const tavern = createTavernPluginApi({
            baseUrl: 'http://runtime.test',
            fetch: mock(async (url, init) => {
                requests.push({
                    body: JSON.parse(String(init.body)),
                    method: init.method,
                    url: String(url),
                });
                if (String(url).endsWith('/responses')) {
                    return jsonResponse({
                        chat_id: 'cht_1',
                        completed_at: null,
                        created_at: '2026-05-18T12:00:00.000Z',
                        id: 'rsp_run_1',
                        metadata: {},
                        participant_id: 'agt_main',
                        request_message_id: 'msg_1',
                        response_message_id: null,
                        status: 'running',
                        summary: 'Working',
                        updated_at: '2026-05-18T12:00:00.000Z',
                    });
                }
                return jsonResponse({
                    artifact_ids: [],
                    chat_id: 'cht_1',
                    completed_at: null,
                    detail: null,
                    id: 'act_run_1_tool_1',
                    kind: 'tool_call',
                    metadata: {},
                    response_id: 'rsp_run_1',
                    sequence: 1,
                    started_at: '2026-05-18T12:00:00.000Z',
                    status: 'running',
                    summary: null,
                    title: 'computer use.list apps',
                    updated_at: '2026-05-18T12:00:00.000Z',
                });
            }),
        });

        await tavern.updateTurnActivity(
            {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                runId: 'run_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
                startedAt: '2026-05-18T12:00:00.000Z',
            },
            {
                status: 'running',
                summary: 'Working',
                step: {
                    completed_at: null,
                    detail: null,
                    id: 'act_tool_1',
                    kind: 'tool_call',
                    metadata: {},
                    started_at: '2026-05-18T12:00:00.000Z',
                    status: 'running',
                    title: 'computer use.list apps',
                },
            }
        );

        expect(requests).toEqual([
            {
                body: {
                    id: 'rsp_run_1',
                    metadata: {
                        runtime: {
                            agentId: 'main',
                            messageId: 'msg_1',
                            runId: 'run_1',
                            sessionKey: 'agent:main:tavern:channel:cht_1',
                            source: 'openclaw',
                            startedAt: '2026-05-18T12:00:00.000Z',
                        },
                    },
                    participant_id: 'agt_main',
                    request_message_id: 'msg_1',
                    status: 'running',
                    summary: 'Working',
                },
                method: 'POST',
                url: 'http://runtime.test/api/chats/cht_1/responses',
            },
            {
                body: {
                    completed_at: null,
                    detail: null,
                    id: 'act_run_1_tool_1',
                    kind: 'tool_call',
                    metadata: {
                        runtime: {
                            agentId: 'main',
                            messageId: 'msg_1',
                            runId: 'run_1',
                            sessionKey: 'agent:main:tavern:channel:cht_1',
                            source: 'openclaw',
                            startedAt: '2026-05-18T12:00:00.000Z',
                        },
                    },
                    started_at: '2026-05-18T12:00:00.000Z',
                    status: 'running',
                    title: 'computer use.list apps',
                },
                method: 'POST',
                url: 'http://runtime.test/api/chats/cht_1/responses/rsp_run_1/activity',
            },
        ]);
    });

    it('derives the API base URL from the inbound relay URL', () => {
        expect(deriveTavernApiBaseUrl('ws://127.0.0.1:4310/chat')).toBe('http://127.0.0.1:4310');
    });

    it('scopes activity ids to the Tavern turn', async () => {
        const activityIds = [];
        const tavern = createTavernPluginApi({
            baseUrl: 'http://runtime.test',
            fetch: mock(async (url, init) => {
                const body = JSON.parse(String(init.body));
                if (String(url).endsWith('/activity')) {
                    activityIds.push(body.id);
                    return jsonResponse({
                        artifact_ids: [],
                        chat_id: 'cht_1',
                        completed_at: null,
                        detail: null,
                        id: body.id,
                        kind: body.kind,
                        metadata: body.metadata,
                        response_id: String(url).split('/responses/')[1].split('/activity')[0],
                        sequence: 1,
                        started_at: body.started_at,
                        status: body.status,
                        summary: null,
                        title: body.title,
                        updated_at: '2026-05-18T12:00:00.000Z',
                    });
                }
                return jsonResponse({
                    chat_id: 'cht_1',
                    completed_at: null,
                    created_at: '2026-05-18T12:00:00.000Z',
                    id: body.id,
                    metadata: body.metadata,
                    participant_id: 'agt_main',
                    request_message_id: body.request_message_id,
                    response_message_id: null,
                    status: body.status,
                    summary: body.summary,
                    updated_at: '2026-05-18T12:00:00.000Z',
                });
            }),
        });
        const step = {
            detail: 'I will run a timed shell check.',
            id: 'act_raw-assistant-2',
            kind: 'message',
            metadata: {},
            started_at: '2026-05-18T12:00:00.000Z',
            status: 'running',
            title: 'Assistant reply',
        };

        await tavern.updateTurnActivity(
            {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                runId: 'run_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
                startedAt: '2026-05-18T12:00:00.000Z',
            },
            { step }
        );
        await tavern.updateTurnActivity(
            {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_2',
                runId: 'run_2',
                sessionKey: 'agent:main:tavern:channel:cht_1',
                startedAt: '2026-05-18T12:00:01.000Z',
            },
            { step }
        );

        expect(activityIds).toEqual(['act_run_1_raw-assistant-2', 'act_run_2_raw-assistant-2']);
    });

    it('preserves tool ids in activity step metadata', () => {
        expect(
            activityStepFromProgressStep(
                {
                    detail: 'Timed out.',
                    id: 'call_123',
                    kind: 'tool',
                    label: 'computer use.list apps',
                    status: 'failed',
                    toolCallId: 'call_123',
                    toolName: 'computer-use.list_apps',
                },
                '2026-05-18T12:00:00.000Z'
            )
        ).toMatchObject({
            detail: 'Timed out.',
            id: 'act_call_123',
            kind: 'tool_call',
            metadata: {
                detail: 'Timed out.',
                runtime: {
                    toolCallId: 'call_123',
                    toolName: 'computer-use.list_apps',
                },
                toolCallId: 'call_123',
                toolName: 'computer-use.list_apps',
            },
            title: 'computer use.list apps',
        });
    });

    it('preserves non-tool activity kinds', () => {
        expect(
            activityStepFromProgressStep(
                {
                    detail: 'Approve file edit.',
                    id: 'approval_1',
                    kind: 'approval',
                    label: 'Review command',
                    status: 'active',
                },
                '2026-05-18T12:00:00.000Z'
            )
        ).toMatchObject({
            id: 'act_approval_1',
            kind: 'approval',
            status: 'running',
            title: 'Review command',
        });
        expect(
            activityStepFromProgressStep(
                {
                    detail: 'modified docs/api/chat.md',
                    id: 'patch_1',
                    kind: 'artifact',
                    label: 'Patch',
                    status: 'completed',
                },
                '2026-05-18T12:00:00.000Z'
            )
        ).toMatchObject({
            id: 'act_patch_1',
            kind: 'artifact',
            status: 'completed',
            title: 'Patch',
        });
    });
});

function jsonResponse(body) {
    return new Response(JSON.stringify(body), {
        headers: {
            'content-type': 'application/json',
        },
        status: 200,
    });
}
