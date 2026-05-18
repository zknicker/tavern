import { describe, expect, it, mock } from 'bun:test';
import { createTavernPluginApi, deriveTavernApiBaseUrl } from './tavern-api.js';

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
                return jsonResponse({
                    cursor: '1',
                    id: 'del_1',
                    idempotent: false,
                    message: {
                        id: 'msg_reply',
                    },
                });
            }),
        });

        await tavern.createDelivery({
            agentId: 'main',
            chatId: 'cht_1',
            deliveryId: 'del_1',
            messageId: 'msg_reply',
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
                        parts: [
                            {
                                content: 'done',
                                kind: 'text',
                            },
                        ],
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
        ]);
    });

    it('writes turn activity through the Tavern SDK OpenAPI path', async () => {
        const requests = [];
        const tavern = createTavernPluginApi({
            baseUrl: 'http://runtime.test',
            fetch: mock(async (url, init) => {
                requests.push({
                    body: JSON.parse(String(init.body)),
                    method: init.method,
                    url: String(url),
                });
                return jsonResponse({
                    agent_id: 'agt_main',
                    chat_id: 'cht_1',
                    metadata: {},
                    run_id: 'run_1',
                    status: 'running',
                    steps: [],
                    summary: null,
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
            }
        );

        expect(requests).toEqual([
            {
                body: {
                    agent_id: 'agt_main',
                    metadata: {
                        runtime: {
                            agentId: 'main',
                            messageId: 'msg_1',
                            sessionKey: 'agent:main:tavern:channel:cht_1',
                            source: 'openclaw',
                            startedAt: '2026-05-18T12:00:00.000Z',
                        },
                    },
                    run_id: 'run_1',
                    status: 'running',
                    steps: [],
                    summary: 'Working',
                },
                method: 'POST',
                url: 'http://runtime.test/api/chats/cht_1/activity',
            },
        ]);
    });

    it('derives the API base URL from the inbound relay URL', () => {
        expect(deriveTavernApiBaseUrl('ws://127.0.0.1:4310/chat')).toBe('http://127.0.0.1:4310');
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
