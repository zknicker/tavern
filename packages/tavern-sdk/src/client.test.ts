import { describe, expect, it } from 'bun:test';
import type { TavernCreateMessageRequest } from '@tavern/api';
import { createTavernClient } from './client';

describe('Tavern SDK client', () => {
    it('posts chat messages through the OpenAPI path', async () => {
        const requests: Request[] = [];
        const client = createTavernClient({
            baseUrl: 'http://runtime.test/',
            fetch: (async (input, init) => {
                const request = new Request(input, init);
                requests.push(request);

                return Response.json({
                    cursor: '7',
                    idempotent: false,
                    message: {
                        author: {
                            id: 'usr_1',
                            kind: 'user',
                            label: 'User',
                            metadata: {},
                        },
                        chat_id: 'cht_1',
                        created_at: '2026-05-17T00:00:00.000Z',
                        deleted_at: null,
                        delivery_id: null,
                        id: 'msg_1',
                        metadata: {},
                        nonce: 'nonce_1',
                        parent_message_id: null,
                        parts: [
                            {
                                content: 'hello',
                                id: 'part_1',
                                kind: 'text',
                                metadata: {},
                            },
                        ],
                        role: 'user',
                        sequence: 1,
                        thread_root_id: null,
                    },
                });
            }) as typeof fetch,
        });
        const body: TavernCreateMessageRequest = {
            author_id: 'usr_1',
            id: 'msg_1',
            nonce: 'nonce_1',
            parts: [
                {
                    content: 'hello',
                    kind: 'text',
                },
            ],
            role: 'user',
        };

        const receipt = await client.chat.createMessage('cht_1', body);

        expect(receipt.message.id).toBe('msg_1');
        expect(receipt.idempotent).toBe(false);
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('POST');
        expect(requests[0].url).toBe('http://runtime.test/api/chats/cht_1/messages');
        expect(await requests[0].json()).toEqual(body);
    });

    it('opens realtime sockets with cursor recovery', () => {
        const urls: string[] = [];
        class FakeWebSocket extends EventTarget {
            constructor(url: string | URL) {
                super();
                urls.push(String(url));
            }
        }
        const client = createTavernClient({
            baseUrl: 'https://runtime.test',
            WebSocket: FakeWebSocket as typeof WebSocket,
        });

        const socket = client.realtime.connect({ afterCursor: '12' });

        expect(socket).toBeInstanceOf(FakeWebSocket);
        expect(urls).toEqual(['wss://runtime.test/api/events/ws?after_cursor=12']);
    });

    it('passes realtime recipient filters through event replay and sockets', async () => {
        const requests: Request[] = [];
        const urls: string[] = [];
        class FakeWebSocket extends EventTarget {
            constructor(url: string | URL) {
                super();
                urls.push(String(url));
            }
        }
        const client = createTavernClient({
            baseUrl: 'https://runtime.test',
            fetch: (async (input, init) => {
                const request = new Request(input, init);
                requests.push(request);

                return Response.json({
                    events: [],
                    next_cursor: null,
                });
            }) as typeof fetch,
            WebSocket: FakeWebSocket as typeof WebSocket,
        });

        await client.realtime.events({
            afterCursor: '12',
            limit: 25,
            recipientId: 'usr_1',
        });
        client.realtime.connect({ afterCursor: '12', recipientId: 'usr_1' });

        expect(requests).toHaveLength(1);
        expect(requests[0].url).toBe(
            'https://runtime.test/api/events?after_cursor=12&limit=25&recipient_id=usr_1'
        );
        expect(urls).toEqual([
            'wss://runtime.test/api/events/ws?after_cursor=12&recipient_id=usr_1',
        ]);
    });

    it('lists chat activity through the OpenAPI path', async () => {
        const requests: Request[] = [];
        const client = createTavernClient({
            baseUrl: 'http://runtime.test/',
            fetch: (async (input, init) => {
                const request = new Request(input, init);
                requests.push(request);

                return Response.json({
                    activities: [],
                });
            }) as typeof fetch,
        });

        const response = await client.chat.activity();

        expect(response.activities).toEqual([]);
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('GET');
        expect(requests[0].url).toBe('http://runtime.test/api/activity');
    });
});
