import fs from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

describe('LocalHermesClient session routing', () => {
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    let runtimeRoot: string;
    let server: WebSocketServer | null = null;

    beforeEach(async () => {
        runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-client-'));
        process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
        vi.resetModules();
        await initRuntimeTestDb();
    });

    afterEach(async () => {
        server?.close();
        server = null;
        await closeRuntimeTestDb();
        if (originalRuntimeRoot === undefined) {
            process.env.TAVERN_RUNTIME_ROOT = undefined;
        } else {
            process.env.TAVERN_RUNTIME_ROOT = originalRuntimeRoot;
        }
        vi.resetModules();
        await fs.rm(runtimeRoot, { force: true, recursive: true });
    });

    it('creates once then reuses the live Hermes session for the Tavern session key', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
        let createCount = 0;
        let resumeCount = 0;

        server = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                const params = request.params ?? {};
                requests.push({ method: request.method, params });

                if (request.method === 'session.create') {
                    createCount += 1;
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: 'live-created',
                                stored_session_id: 'stored-session',
                            },
                        })
                    );
                    return;
                }

                if (request.method === 'session.resume') {
                    resumeCount += 1;
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                resumed: params.session_id,
                                session_id: 'live-resumed',
                            },
                        })
                    );
                    return;
                }

                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method === 'prompt.submit') {
                    socket.send(
                        `${JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'event',
                            params: {
                                payload: { text: 'done' },
                                session_id: params.session_id,
                                type: 'message.complete',
                            },
                        })}\n`
                    );
                }
            });
        });

        await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });

        await drain(client.streamChat({ content: 'first', sessionKey: 'agent:main:tavern:cht_1' }));
        await drain(
            client.streamChat({ content: 'second', sessionKey: 'agent:main:tavern:cht_1' })
        );
        client.close();

        expect(createCount).toBe(1);
        expect(resumeCount).toBe(0);
        expect(requests).toEqual([
            { method: 'session.create', params: { title: 'agent:main:tavern:cht_1' } },
            {
                method: 'prompt.submit',
                params: { session_id: 'live-created', text: 'first' },
            },
            {
                method: 'prompt.submit',
                params: { session_id: 'live-created', text: 'second' },
            },
        ]);
    });

    it('serializes overlapping turns for one Tavern session key', async () => {
        const prompts: string[] = [];
        const firstPromptSubmitted = deferred<void>();
        const releaseFirstCompletion = deferred<void>();
        const secondPromptSubmitted = deferred<void>();

        server = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                const params = request.params ?? {};

                if (request.method === 'session.create') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: 'live-created',
                                stored_session_id: 'stored-session',
                            },
                        })
                    );
                    return;
                }

                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method !== 'prompt.submit') {
                    return;
                }

                const prompt = String(params.text);
                prompts.push(prompt);
                if (prompt === 'first') {
                    firstPromptSubmitted.resolve();
                    void releaseFirstCompletion.promise.then(() => {
                        socket.send(
                            `${JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'event',
                                params: {
                                    payload: { text: 'first done' },
                                    session_id: params.session_id,
                                    type: 'message.complete',
                                },
                            })}\n`
                        );
                    });
                    return;
                }

                secondPromptSubmitted.resolve();
                socket.send(
                    `${JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'event',
                        params: {
                            payload: { text: 'second done' },
                            session_id: params.session_id,
                            type: 'message.complete',
                        },
                    })}\n`
                );
            });
        });

        await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });

        const firstEvents = collect(
            client.streamChat({ content: 'first', sessionKey: 'agent:main:tavern:cht_1' })
        );
        await firstPromptSubmitted.promise;
        const secondEvents = collect(
            client.streamChat({ content: 'second', sessionKey: 'agent:main:tavern:cht_1' })
        );

        await expect(
            Promise.race([
                secondPromptSubmitted.promise.then(() => 'submitted'),
                delay(25).then(() => 'blocked'),
            ])
        ).resolves.toBe('blocked');

        releaseFirstCompletion.resolve();
        await expect(firstEvents).resolves.toMatchObject([
            { data: { content: 'first done' }, event: 'assistant.completed' },
        ]);
        await expect(secondPromptSubmitted.promise).resolves.toBeUndefined();
        await expect(secondEvents).resolves.toMatchObject([
            { data: { content: 'second done' }, event: 'assistant.completed' },
        ]);
        client.close();

        expect(prompts).toEqual(['first', 'second']);
    });

    it('cancels a queued turn before it submits to the live Hermes session', async () => {
        const prompts: string[] = [];
        const firstPromptSubmitted = deferred<void>();
        const releaseFirstCompletion = deferred<void>();
        const secondPromptSubmitted = deferred<void>();

        server = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                const params = request.params ?? {};

                if (request.method === 'session.create') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: 'live-created',
                                stored_session_id: 'stored-session',
                            },
                        })
                    );
                    return;
                }

                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method !== 'prompt.submit') {
                    return;
                }

                const prompt = String(params.text);
                prompts.push(prompt);
                if (prompt === 'first') {
                    firstPromptSubmitted.resolve();
                    void releaseFirstCompletion.promise.then(() => {
                        socket.send(
                            `${JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'event',
                                params: {
                                    payload: { text: 'first done' },
                                    session_id: params.session_id,
                                    type: 'message.complete',
                                },
                            })}\n`
                        );
                    });
                    return;
                }

                secondPromptSubmitted.resolve();
            });
        });

        await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });
        const controller = new AbortController();

        const firstEvents = collect(
            client.streamChat({ content: 'first', sessionKey: 'agent:main:tavern:cht_1' })
        );
        await firstPromptSubmitted.promise;
        const secondEvents = collect(
            client.streamChat({
                content: 'second',
                sessionKey: 'agent:main:tavern:cht_1',
                signal: controller.signal,
            })
        );
        controller.abort();

        await expect(secondEvents).rejects.toThrow('Hermes turn cancelled.');
        releaseFirstCompletion.resolve();
        await expect(firstEvents).resolves.toMatchObject([
            { data: { content: 'first done' }, event: 'assistant.completed' },
        ]);
        await expect(
            Promise.race([
                secondPromptSubmitted.promise.then(() => 'submitted'),
                delay(25).then(() => 'cancelled'),
            ])
        ).resolves.toBe('cancelled');
        client.close();

        expect(prompts).toEqual(['first']);
    });

    it('cancels a started turn before submitting when startup work finishes after abort', async () => {
        const requests: string[] = [];
        const modelRequestReceived = deferred<void>();
        const releaseModelRequest = deferred<void>();
        const promptSubmitted = deferred<void>();

        server = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                requests.push(request.method);

                if (request.method === 'session.create') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: 'live-created',
                                stored_session_id: 'stored-session',
                            },
                        })
                    );
                    return;
                }

                if (request.method === 'slash.exec') {
                    modelRequestReceived.resolve();
                    void releaseModelRequest.promise.then(() => {
                        socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                    });
                    return;
                }

                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method === 'prompt.submit') {
                    promptSubmitted.resolve();
                }
            });
        });

        await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });
        const controller = new AbortController();

        const events = collect(
            client.streamChat({
                content: 'cancel before submit',
                modelRef: 'openai/gpt-5',
                sessionKey: 'agent:main:tavern:cht_1',
                signal: controller.signal,
            })
        );
        await modelRequestReceived.promise;
        controller.abort();
        releaseModelRequest.resolve();

        await expect(events).rejects.toThrow('Hermes turn cancelled.');
        await expect(
            Promise.race([
                promptSubmitted.promise.then(() => 'submitted'),
                delay(25).then(() => 'cancelled'),
            ])
        ).resolves.toBe('cancelled');
        client.close();

        expect(requests).toEqual(['session.create', 'slash.exec']);
    });

    it('resumes the Hermes stored session when a new client loses the live id', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
        let createCount = 0;
        let resumeCount = 0;

        server = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                const params = request.params ?? {};
                requests.push({ method: request.method, params });

                if (request.method === 'session.create') {
                    createCount += 1;
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: 'live-created',
                                stored_session_id: 'stored-session',
                            },
                        })
                    );
                    return;
                }

                if (request.method === 'session.resume') {
                    resumeCount += 1;
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                resumed: params.session_id,
                                session_id: 'live-resumed',
                            },
                        })
                    );
                    return;
                }

                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method === 'prompt.submit') {
                    socket.send(
                        `${JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'event',
                            params: {
                                payload: { text: 'done' },
                                session_id: params.session_id,
                                type: 'message.complete',
                            },
                        })}\n`
                    );
                }
            });
        });

        await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const firstClient = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });
        await drain(
            firstClient.streamChat({ content: 'first', sessionKey: 'agent:main:tavern:cht_1' })
        );
        firstClient.close();

        const secondClient = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });
        await drain(
            secondClient.streamChat({ content: 'second', sessionKey: 'agent:main:tavern:cht_1' })
        );
        secondClient.close();

        expect(createCount).toBe(1);
        expect(resumeCount).toBe(1);
        expect(requests).toEqual([
            { method: 'session.create', params: { title: 'agent:main:tavern:cht_1' } },
            {
                method: 'prompt.submit',
                params: { session_id: 'live-created', text: 'first' },
            },
            { method: 'session.resume', params: { session_id: 'stored-session' } },
            {
                method: 'prompt.submit',
                params: { session_id: 'live-resumed', text: 'second' },
            },
        ]);
    });

    it('routes concurrent stream events by live Hermes session id on one gateway socket', async () => {
        server = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                const params = request.params ?? {};

                if (request.method === 'session.create') {
                    const title = String(params.title);
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: `live-${title}`,
                                stored_session_id: `stored-${title}`,
                            },
                        })
                    );
                    return;
                }

                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method === 'prompt.submit') {
                    socket.send(
                        `${JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'event',
                            params: {
                                payload: { text: `${params.session_id}:done` },
                                session_id: params.session_id,
                                type: 'message.complete',
                            },
                        })}\n`
                    );
                }
            });
        });

        await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });

        const [firstEvents, secondEvents] = await Promise.all([
            collect(client.streamChat({ content: 'first', sessionKey: 'session-1' })),
            collect(client.streamChat({ content: 'second', sessionKey: 'session-2' })),
        ]);
        client.close();

        expect(firstEvents).toMatchObject([
            { data: { content: 'live-session-1:done' }, event: 'assistant.completed' },
        ]);
        expect(secondEvents).toMatchObject([
            { data: { content: 'live-session-2:done' }, event: 'assistant.completed' },
        ]);
    });

    it('stages attachments and applies the session model before prompt.submit', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];

        server = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                const params = request.params ?? {};
                requests.push({ method: request.method, params });

                if (request.method === 'session.create') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: 'live-created',
                                stored_session_id: 'stored-session',
                            },
                        })
                    );
                    return;
                }

                if (request.method === 'image.attach_bytes') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: { path: '/workspace/cat.png' },
                        })
                    );
                    return;
                }

                if (request.method === 'file.attach') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: { ref_text: '@file:/workspace/notes.pdf' },
                        })
                    );
                    return;
                }

                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method === 'prompt.submit') {
                    socket.send(
                        `${JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'event',
                            params: {
                                payload: { text: 'done' },
                                session_id: params.session_id,
                                type: 'message.complete',
                            },
                        })}\n`
                    );
                }
            });
        });

        await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });

        await drain(
            client.streamChat({
                attachments: [
                    {
                        dataBase64: 'aW1hZ2U=',
                        filename: 'cat.png',
                        mediaType: 'image/png',
                        sizeBytes: 5,
                        type: 'inline',
                    },
                    {
                        dataBase64: 'cGRm',
                        filename: 'notes.pdf',
                        mediaType: 'application/pdf',
                        sizeBytes: 3,
                        type: 'inline',
                    },
                ],
                content: 'summarize this',
                modelRef: 'openai/gpt-5',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        client.close();

        expect(requests).toEqual([
            { method: 'session.create', params: { title: 'agent:main:tavern:cht_1' } },
            {
                method: 'slash.exec',
                params: {
                    command: 'model gpt-5 --provider openai',
                    session_id: 'live-created',
                },
            },
            {
                method: 'image.attach_bytes',
                params: {
                    content_base64: 'aW1hZ2U=',
                    filename: 'cat.png',
                    session_id: 'live-created',
                },
            },
            {
                method: 'file.attach',
                params: {
                    data_url: 'data:application/pdf;base64,cGRm',
                    name: 'notes.pdf',
                    session_id: 'live-created',
                },
            },
            {
                method: 'prompt.submit',
                params: {
                    session_id: 'live-created',
                    text: '@image:/workspace/cat.png\n@file:/workspace/notes.pdf\n\nsummarize this',
                },
            },
        ]);
    });

    it('maps composing, notice, subagent, and approval gateway events', async () => {
        server = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                const params = request.params ?? {};

                if (request.method === 'session.create') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: 'live-created',
                                stored_session_id: 'stored-session',
                            },
                        })
                    );
                    return;
                }

                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method === 'prompt.submit') {
                    for (const event of [
                        { payload: {}, type: 'message.start' },
                        {
                            payload: {
                                id: 'ntc_1',
                                key: 'credits',
                                kind: 'credits',
                                level: 'warning',
                                text: 'Credits low.',
                                ttl_ms: 60_000,
                            },
                            type: 'notification.show',
                        },
                        { payload: { key: 'credits' }, type: 'notification.clear' },
                        {
                            payload: {
                                depth: 1,
                                goal: 'Summarize the repo',
                                subagent_id: 'sub_1',
                                task_count: 2,
                                task_index: 0,
                            },
                            type: 'subagent.start',
                        },
                        {
                            payload: {
                                command: 'rm -rf build',
                                description: 'Dangerous delete',
                                pattern_key: 'rm -rf',
                                pattern_keys: ['rm -rf'],
                            },
                            type: 'approval.request',
                        },
                        { payload: { text: 'done' }, type: 'message.complete' },
                    ]) {
                        socket.send(
                            `${JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'event',
                                params: {
                                    ...event,
                                    session_id: params.session_id,
                                },
                            })}\n`
                        );
                    }
                }
            });
        });

        await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });

        const events = await collect(
            client.streamChat({ content: 'work', sessionKey: 'agent:main:tavern:cht_1' })
        );
        client.close();

        expect(events).toEqual([
            { data: {}, event: 'assistant.composing' },
            {
                data: {
                    id: 'ntc_1',
                    key: 'credits',
                    kind: 'credits',
                    level: 'warning',
                    source_event: 'notification.show',
                    text: 'Credits low.',
                    ttl_ms: 60_000,
                },
                event: 'notice.shown',
            },
            {
                data: { key: 'credits', source_event: 'notification.clear' },
                event: 'notice.cleared',
            },
            {
                data: {
                    depth: 1,
                    goal: 'Summarize the repo',
                    source_event: 'subagent.start',
                    subagent_id: 'sub_1',
                    task_count: 2,
                    task_index: 0,
                },
                event: 'worker.progress',
            },
            {
                data: {
                    command: 'rm -rf build',
                    description: 'Dangerous delete',
                    pattern_key: 'rm -rf',
                    pattern_keys: ['rm -rf'],
                    source_event: 'approval.request',
                },
                event: 'approval.requested',
            },
            {
                data: {
                    content: 'done',
                    message_id: null,
                    model: null,
                    reasoning: null,
                    status: null,
                    usage: null,
                },
                event: 'assistant.completed',
            },
        ]);
    });

    it('maps Hermes visible and reasoning gateway events into separate adapter stream events', async () => {
        server = new WebSocketServer({ host: '127.0.0.1', port: await getFreePort() });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                const params = request.params ?? {};

                if (request.method === 'session.create') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                session_id: 'live-created',
                                stored_session_id: 'stored-session',
                            },
                        })
                    );
                    return;
                }

                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
                if (request.method === 'prompt.submit') {
                    for (const event of [
                        {
                            payload: { text: 'checking context' },
                            type: 'message.delta',
                        },
                        {
                            payload: { kind: 'process', text: 'running checks' },
                            type: 'status.update',
                        },
                        {
                            payload: { text: 'first thought' },
                            type: 'reasoning.delta',
                        },
                        {
                            payload: { reasoning: 'fallback thought', text: 'done' },
                            type: 'message.complete',
                        },
                    ]) {
                        socket.send(
                            `${JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'event',
                                params: {
                                    ...event,
                                    session_id: params.session_id,
                                },
                            })}\n`
                        );
                    }
                }
            });
        });

        await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
        const address = server.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test WebSocket server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });

        const events = await collect(
            client.streamChat({ content: 'think', sessionKey: 'agent:main:tavern:cht_1' })
        );
        client.close();

        expect(events).toEqual([
            { data: { delta: 'checking context' }, event: 'assistant.delta' },
            {
                data: { delta: 'running checks', kind: 'process', source_event: 'status.update' },
                event: 'assistant.status',
            },
            { data: { delta: 'first thought' }, event: 'reasoning.delta' },
            {
                data: {
                    content: 'done',
                    message_id: null,
                    model: null,
                    reasoning: 'fallback thought',
                    status: null,
                    usage: null,
                },
                event: 'assistant.completed',
            },
        ]);
    });
});

describe('LocalHermesClient adapter-owned state', () => {
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    let runtimeRoot: string;
    let httpServer: ReturnType<typeof Bun.serve> | null = null;

    beforeEach(async () => {
        runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-state-'));
        process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
        vi.resetModules();
        await initRuntimeTestDb();
    });

    afterEach(async () => {
        httpServer?.stop(true);
        httpServer = null;
        await closeRuntimeTestDb();
        if (originalRuntimeRoot === undefined) {
            process.env.TAVERN_RUNTIME_ROOT = undefined;
        } else {
            process.env.TAVERN_RUNTIME_ROOT = originalRuntimeRoot;
        }
        vi.resetModules();
        await fs.rm(runtimeRoot, { force: true, recursive: true });
    });

    it('surfaces selected model, name, and thinking default in synced agent data', async () => {
        httpServer = Bun.serve({
            fetch: async (request) => {
                const url = new URL(request.url);
                if (request.method === 'POST' && url.pathname === '/api/model/set') {
                    return Response.json({ ok: true });
                }
                return new Response('not found', { status: 404 });
            },
            port: 0,
        });

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${httpServer.port}`,
            token: null,
        });

        await client.updateAgentName('agt_hermes', { name: 'Tavern Hermes' });
        await client.updateAgentThinkingDefault('agt_hermes', { thinkingDefault: 'medium' });
        await client.updateAgentModel('agt_hermes', {
            model: {
                model: 'gpt-5.5',
                provider: 'openai-codex',
            },
        });

        const agents = await client.listAgents();

        expect(agents.agents[0]).toMatchObject({
            hermesModelName: {
                model: 'gpt-5.5',
                provider: 'openai-codex',
            },
            name: 'Tavern Hermes',
            thinkingDefault: 'medium',
        });
    });

    it('persists avatar and emoji appearance into adapter state', async () => {
        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: 'http://127.0.0.1:1',
            token: null,
        });

        const snapshot = await client.updateAgentAppearance('agt_hermes', {
            avatar: 'HM',
            emoji: '🦉',
        });

        expect(snapshot).toMatchObject({
            config: { agent: { avatar: 'HM', emoji: '🦉' } },
            hash: 'agent-appearance:HM:🦉',
            valid: true,
        });
        await expect(client.listAgents()).resolves.toMatchObject({
            agents: [{ avatar: 'HM', emoji: '🦉' }],
        });
        await expect(client.getAgentConfig('agt_hermes')).resolves.toMatchObject({
            avatar: 'HM',
            emoji: '🦉',
        });

        await client.updateAgentAppearance('agt_hermes', { avatar: null });

        await expect(client.getAgentConfig('agt_hermes')).resolves.toMatchObject({
            avatar: null,
            emoji: '🦉',
        });
    });

    it('keeps raw Hermes config invalid so server fixups do not call raw mutation', async () => {
        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: 'http://127.0.0.1:1',
            token: null,
        });

        await expect(client.getHermesConfig()).resolves.toMatchObject({
            raw: null,
            valid: false,
        });
    });

    it('persists supported Hermes markdown files to their runtime locations', async () => {
        const { HERMES_HOME, HERMES_WORKSPACE } = await import('../config');
        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: 'http://127.0.0.1:1',
            token: null,
        });

        await client.saveAgentFile('agt_hermes', 'NOTES.md', {
            content: '# Notes\n\nProject rules.',
        });
        await client.saveAgentFile('agt_hermes', 'SOUL.md', {
            content: '# Soul\n\nSpeak plainly.',
        });

        await expect(fs.readFile(path.join(HERMES_WORKSPACE, 'NOTES.md'), 'utf8')).resolves.toBe(
            '# Notes\n\nProject rules.'
        );
        await expect(fs.readFile(path.join(HERMES_HOME, 'SOUL.md'), 'utf8')).resolves.toBe(
            '# Soul\n\nSpeak plainly.'
        );
        await expect(client.listAgentFiles('agt_hermes')).resolves.toMatchObject({
            files: [
                { mediaType: 'text/markdown', path: 'NOTES.md' },
                { mediaType: 'text/markdown', path: 'SOUL.md' },
            ],
        });
        // AGENTS.md is generated, not an editable agent file.
        await expect(client.getAgentFile('agt_hermes', 'AGENTS.md')).rejects.toThrow(
            'Hermes agent file "AGENTS.md"'
        );
        await expect(client.getAgentFile('agt_hermes', 'TOOLS.md')).rejects.toThrow(
            'Hermes agent file "TOOLS.md"'
        );
    });

    it('toggles Hermes skills by runtime skill name', async () => {
        const requests: Array<{ body: unknown; method: string; pathname: string }> = [];
        httpServer = Bun.serve({
            fetch: async (request) => {
                const url = new URL(request.url);
                if (request.method === 'GET' && url.pathname === '/api/skills') {
                    return Response.json([
                        {
                            description: 'Reads pages.',
                            enabled: true,
                            name: 'browser',
                        },
                    ]);
                }
                if (request.method === 'PUT' && url.pathname === '/api/skills/toggle') {
                    requests.push({
                        body: await request.json(),
                        method: request.method,
                        pathname: url.pathname,
                    });
                    return Response.json({ enabled: false, name: 'browser', ok: true });
                }
                return new Response('not found', { status: 404 });
            },
            port: 0,
        });

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${httpServer.port}`,
            token: null,
        });

        const updated = await client.updateSkillEnabled('browser', { enabled: false });

        expect(requests).toEqual([
            {
                body: { enabled: false, name: 'browser' },
                method: 'PUT',
                pathname: '/api/skills/toggle',
            },
        ]);
        expect(updated).toMatchObject({
            disabled: true,
            id: 'browser',
            userInvocable: false,
        });
    });

    it('toggles Hermes toolsets by runtime toolset name', async () => {
        const requests: Array<{ body: unknown; method: string; pathname: string }> = [];
        let enabled = true;
        httpServer = Bun.serve({
            fetch: async (request) => {
                const url = new URL(request.url);
                if (request.method === 'GET' && url.pathname === '/api/tools/toolsets') {
                    return Response.json([
                        {
                            configured: true,
                            description: 'Web tools.',
                            enabled,
                            label: 'Web',
                            name: 'web',
                            tools: ['search.web'],
                        },
                    ]);
                }
                if (request.method === 'PUT' && url.pathname === '/api/tools/toolsets/web') {
                    const body = (await request.json()) as { enabled: boolean };
                    enabled = body.enabled;
                    requests.push({
                        body,
                        method: request.method,
                        pathname: url.pathname,
                    });
                    return Response.json({ ok: true });
                }
                return new Response('not found', { status: 404 });
            },
            port: 0,
        });

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${httpServer.port}`,
            token: null,
        });

        const updated = await client.updateToolsetEnabled('web', { enabled: false });

        expect(requests).toEqual([
            {
                body: { enabled: false },
                method: 'PUT',
                pathname: '/api/tools/toolsets/web',
            },
        ]);
        expect(updated).toMatchObject({
            enabled: false,
            id: 'web',
            name: 'web',
            tools: ['search.web'],
        });
    });

    it('uses Hermes Cron API for create, update, list, run, and delete', async () => {
        const requests: Array<{ body: unknown; method: string; pathname: string }> = [];
        let jobDeleted = false;
        let job = {
            created_at: '2026-06-08T10:00:00.000Z',
            deliver: 'tavern:cht_cron',
            enabled: true,
            id: 'hermes_job_1',
            name: 'Daily check',
            next_run_at: '2026-06-08T10:01:00.000Z',
            prompt: 'check in',
            schedule: { kind: 'interval', minutes: 1 },
            state: 'scheduled',
        };

        httpServer = Bun.serve({
            fetch: async (request) => {
                const url = new URL(request.url);
                const body =
                    request.method === 'GET' ? null : await request.json().catch(() => null);
                requests.push({ body, method: request.method, pathname: url.pathname });

                if (request.method === 'POST' && url.pathname === '/api/cron/jobs') {
                    job = { ...job, ...(body as Record<string, unknown>) };
                    return Response.json(job);
                }
                if (request.method === 'PUT' && url.pathname === '/api/cron/jobs/hermes_job_1') {
                    const updates = ((body as { updates?: Record<string, unknown> })?.updates ??
                        {}) as Record<string, unknown> | undefined;
                    job = { ...job, ...(updates ?? {}) };
                    return Response.json(job);
                }
                if (
                    request.method === 'POST' &&
                    url.pathname === '/api/cron/jobs/hermes_job_1/pause'
                ) {
                    job = { ...job, enabled: false, state: 'paused' };
                    return Response.json(job);
                }
                if (
                    request.method === 'POST' &&
                    url.pathname === '/api/cron/jobs/hermes_job_1/trigger'
                ) {
                    return Response.json({ ok: true });
                }
                if (request.method === 'GET' && url.pathname === '/api/cron/jobs/hermes_job_1') {
                    return Response.json(job);
                }
                if (request.method === 'GET' && url.pathname === '/api/cron/jobs') {
                    return Response.json(jobDeleted ? [] : [job]);
                }
                if (
                    request.method === 'GET' &&
                    url.pathname === '/api/cron/jobs/hermes_job_1/runs'
                ) {
                    return Response.json({
                        runs: [
                            {
                                ended_at: 1_780_000_060,
                                id: 'cron_hermes_job_1_1780000000',
                                last_active: 1_780_000_060,
                                preview: 'cron completed',
                                started_at: 1_780_000_000,
                            },
                        ],
                    });
                }
                if (request.method === 'DELETE' && url.pathname === '/api/cron/jobs/hermes_job_1') {
                    jobDeleted = true;
                    return Response.json({ ok: true });
                }
                return new Response('not found', { status: 404 });
            },
            port: 0,
        });

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${httpServer.port}`,
            token: null,
        });

        const created = await client.createCronJob({
            agentId: 'agt_hermes',
            delivery: { chatId: 'cht_cron' },
            enabled: false,
            id: 'cron_1',
            name: 'Daily check',
            payload: { kind: 'agentTurn', message: 'check in' },
            schedule: { everyMs: 60_000, kind: 'every' },
            wakeMode: 'now',
        });
        const jobId = created.id;
        await client.updateCronJob(jobId, {
            enabled: false,
            name: 'Paused daily check',
        });
        const listed = await client.listCronJobs();
        const run = await client.runCronJob(jobId);
        const runs = await client.listCronRuns(jobId);
        const deletedResult = await client.deleteCronJob(jobId);

        expect(created).toMatchObject({
            delivery: { chatId: 'cht_cron' },
            id: 'hermes_job_1',
            name: 'Daily check',
        });
        expect(listed.jobs).toHaveLength(1);
        expect(listed.jobs[0]).toMatchObject({
            enabled: false,
            id: 'hermes_job_1',
            name: 'Paused daily check',
        });
        expect(run).toMatchObject({
            jobId,
            status: 'running',
            trigger: 'manual',
        });
        expect(runs.runs).toHaveLength(1);
        expect(runs.runs[0]).toMatchObject({
            jobId,
            sessionId: 'cron_hermes_job_1_1780000000',
            status: 'success',
            summary: 'cron completed',
        });
        expect(deletedResult).toEqual({ archived: true, id: jobId });
        await expect(client.listCronJobs()).resolves.toMatchObject({ jobs: [] });
        expect(requests.slice(0, 3)).toMatchObject([
            {
                body: {
                    deliver: 'tavern:cht_cron',
                    name: 'Daily check',
                    prompt: 'check in',
                    schedule: 'every 1m',
                },
                method: 'POST',
                pathname: '/api/cron/jobs',
            },
            { method: 'POST', pathname: '/api/cron/jobs/hermes_job_1/pause' },
            {
                body: { updates: { name: 'Paused daily check' } },
                method: 'PUT',
                pathname: '/api/cron/jobs/hermes_job_1',
            },
        ]);
    });
});

async function drain(generator: AsyncGenerator<unknown>) {
    await collect(generator);
}

async function collect<T>(generator: AsyncGenerator<T>) {
    const events: T[] = [];
    for await (const _event of generator) {
        events.push(_event);
    }
    return events;
}

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, reject, resolve };
}

async function delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreePort() {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
    if (!(address && typeof address === 'object')) {
        throw new Error('Could not allocate a test port.');
    }
    return address.port;
}

async function initRuntimeTestDb() {
    const [{ initTestDb }, { ensureRuntimeSchema }] = await Promise.all([
        import('../db/connection'),
        import('../db/schema'),
    ]);
    ensureRuntimeSchema(initTestDb());
}

async function closeRuntimeTestDb() {
    const { closeDb } = await import('../db/connection');
    closeDb();
}
