import fs from 'node:fs/promises';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

describe('LocalHermesClient session routing', () => {
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    const originalModelRouteEnv = captureModelRouteEnv();
    let runtimeRoot: string;
    let httpServer: HttpServer | null = null;
    let server: WebSocketServer | null = null;

    const expectedHermesWorkspace = () => path.join(runtimeRoot, 'hermes', 'workspace');

    beforeEach(async () => {
        runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-client-'));
        process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
        clearModelRouteEnv();
        process.env.CODEX_HOME = path.join(runtimeRoot, 'empty-codex-home');
        vi.resetModules();
        await initRuntimeTestDb();
    });

    afterEach(async () => {
        server?.close();
        server = null;
        await closeHttpServer(httpServer);
        httpServer = null;
        await closeRuntimeTestDb();
        if (originalRuntimeRoot === undefined) {
            process.env.TAVERN_RUNTIME_ROOT = undefined;
        } else {
            process.env.TAVERN_RUNTIME_ROOT = originalRuntimeRoot;
        }
        restoreModelRouteEnv(originalModelRouteEnv);
        vi.resetModules();
        await fs.rm(runtimeRoot, { force: true, recursive: true });
    });

    it('creates once then reuses the live Hermes session for the Tavern session key', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
        let createCount = 0;
        let resumeCount = 0;

        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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

        await drain(
            client.streamChat({
                content: 'first',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        await drain(
            client.streamChat({
                content: 'second',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        client.close();

        expect(createCount).toBe(1);
        expect(resumeCount).toBe(0);
        expect(requests).toEqual([
            {
                method: 'session.create',
                params: {
                    cwd: expectedHermesWorkspace(),
                    title: 'agent:main:tavern:cht_1',
                },
            },
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

    it('maps gateway tool.completed events and error flags into runtime tool lifecycle events', async () => {
        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
                            result: { session_id: 'live-created' },
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
                                payload: {
                                    args: { path: 'sales-summary.json' },
                                    tool: 'read_file',
                                },
                                session_id: params.session_id,
                                type: 'tool.started',
                            },
                        })}\n`
                    );
                    socket.send(
                        `${JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'event',
                            params: {
                                payload: {
                                    error: true,
                                    result_text: '{"error":"File not found"}',
                                    tool: 'read_file',
                                },
                                session_id: params.session_id,
                                type: 'tool.completed',
                            },
                        })}\n`
                    );
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

        const events = await collect(
            client.streamChat({ content: 'read file', sessionKey: 'session-1' })
        );
        client.close();

        expect(events).toMatchObject([
            {
                data: {
                    arguments: { path: 'sales-summary.json' },
                    tool_name: 'read_file',
                },
                event: 'tool.started',
            },
            {
                data: {
                    error: true,
                    result: '{"error":"File not found"}',
                    tool_name: 'read_file',
                },
                event: 'tool.failed',
            },
            {
                data: { content: 'done' },
                event: 'assistant.completed',
            },
        ]);
    });

    it('drops the live cache on reset so the next turn creates a fresh engine session', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
        let createCount = 0;

        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
                                session_id: `live-${createCount}`,
                                stored_session_id: `stored-${createCount}`,
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
        const { getHermesSessionMapping } = await import('./session-map');
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });

        await drain(
            client.streamChat({
                content: 'first',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        await client.resetSession('agent:main:tavern:cht_1');
        expect(await getHermesSessionMapping('agent:main:tavern:cht_1')).toBeNull();
        await drain(
            client.streamChat({
                content: 'second',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        client.close();

        expect(requests).toEqual([
            {
                method: 'session.create',
                params: {
                    cwd: expectedHermesWorkspace(),
                    title: 'agent:main:tavern:cht_1',
                },
            },
            {
                method: 'prompt.submit',
                params: { session_id: 'live-1', text: 'first' },
            },
            { method: 'session.close', params: { session_id: 'live-1' } },
            {
                method: 'session.create',
                params: {
                    cwd: expectedHermesWorkspace(),
                    title: 'agent:main:tavern:cht_1',
                },
            },
            {
                method: 'prompt.submit',
                params: { session_id: 'live-2', text: 'second' },
            },
        ]);
        expect(await getHermesSessionMapping('agent:main:tavern:cht_1')).toMatchObject({
            hermesSessionKey: 'stored-2',
        });
    });

    it('reports binding status without opening or resuming a gateway session', async () => {
        const httpPaths: string[] = [];
        httpServer = createHttpServer((request, response) => {
            const url = new URL(request.url ?? '/', 'http://127.0.0.1');
            httpPaths.push(url.pathname);
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(
                JSON.stringify({
                    id: 'stored-session',
                    model: 'gpt-5.5',
                })
            );
        });
        await listenHttpServer(httpServer);
        const address = httpServer.address();
        if (!(address && typeof address === 'object')) {
            throw new Error('Test HTTP server did not bind a port.');
        }

        const { LocalHermesClient } = await import('./local-client');
        const { saveHermesSessionMapping } = await import('./session-map');
        await saveHermesSessionMapping({
            hermesSessionKey: 'stored-session',
            tavernSessionKey: 'agent:main:tavern:cht_1',
        });
        const client = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });

        await expect(
            client.getSessionBindingStatus('agent:main:tavern:cht_1')
        ).resolves.toMatchObject({
            liveSessionId: null,
            model: {
                model: 'gpt-5.5',
                provider: 'unknown',
            },
            state: 'bound',
            storedSessionId: 'stored-session',
        });
        client.close();

        expect(httpPaths).toEqual(['/api/sessions/stored-session']);
    });

    it('reports live binding status with the live gateway model and provider', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];

        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
                                session_id: 'live-session',
                                stored_session_id: 'stored-session',
                            },
                        })
                    );
                    return;
                }

                if (request.method === 'model.options') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                current_model: 'gpt-5.5',
                                current_provider: 'openai-codex',
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

        await drain(
            client.streamChat({
                content: 'prime live session',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );

        await expect(
            client.getSessionBindingStatus('agent:main:tavern:cht_1')
        ).resolves.toMatchObject({
            liveSessionId: 'live-session',
            model: {
                model: 'gpt-5.5',
                provider: 'openai-codex',
            },
            state: 'live',
            storedSessionId: 'stored-session',
        });
        client.close();

        expect(requests.map((request) => request.method)).toEqual([
            'session.create',
            'prompt.submit',
            'model.options',
        ]);
    });

    it('serializes overlapping turns for one Tavern session key', async () => {
        const prompts: string[] = [];
        const firstPromptSubmitted = deferred<void>();
        const releaseFirstCompletion = deferred<void>();
        const secondPromptSubmitted = deferred<void>();

        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
            client.streamChat({
                content: 'first',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        await firstPromptSubmitted.promise;
        const secondEvents = collect(
            client.streamChat({
                content: 'second',
                sessionKey: 'agent:main:tavern:cht_1',
            })
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

        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
            client.streamChat({
                content: 'first',
                sessionKey: 'agent:main:tavern:cht_1',
            })
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

        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                    params?: Record<string, unknown>;
                };
                const params = request.params ?? {};
                requests.push(request.method);

                if (request.method === 'session.resume') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                resumed: params.session_id,
                                session_id: 'live-created',
                            },
                        })
                    );
                    return;
                }

                if (request.method === 'config.set') {
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
        const { saveHermesSessionMapping } = await import('./session-map');
        await saveHermesSessionMapping({
            hermesSessionKey: 'stored-session',
            tavernSessionKey: 'agent:main:tavern:cht_1',
        });

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

        expect(requests).toEqual(['session.resume', 'config.set']);
    });

    it('resumes the Hermes stored session when a new client loses the live id', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
        let createCount = 0;
        let resumeCount = 0;

        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
            firstClient.streamChat({
                content: 'first',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        firstClient.close();

        const secondClient = new LocalHermesClient({
            baseUrl: `http://127.0.0.1:${address.port}`,
            token: null,
        });
        await drain(
            secondClient.streamChat({
                content: 'second',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        secondClient.close();

        expect(createCount).toBe(1);
        expect(resumeCount).toBe(1);
        expect(requests).toEqual([
            {
                method: 'session.create',
                params: {
                    cwd: expectedHermesWorkspace(),
                    title: 'agent:main:tavern:cht_1',
                },
            },
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
        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
            {
                data: { content: 'live-session-1:done' },
                event: 'assistant.completed',
            },
        ]);
        expect(secondEvents).toMatchObject([
            {
                data: { content: 'live-session-2:done' },
                event: 'assistant.completed',
            },
        ]);
    });

    it('stages images and materializes file attachments before prompt.submit', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];

        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
                        dataBase64: 'eyJjbGllbnQiOnRydWV9',
                        filename: 'client_secret.json',
                        mediaType: 'application/json',
                        sizeBytes: 15,
                        type: 'inline',
                    },
                ],
                content: 'summarize this',
                modelRef: 'openai/gpt-5',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        client.close();

        expect(requests.map((request) => request.method)).toEqual([
            'session.create',
            'image.attach_bytes',
            'prompt.submit',
        ]);
        expect(requests.slice(0, 2)).toEqual([
            {
                method: 'session.create',
                params: {
                    cwd: expectedHermesWorkspace(),
                    title: 'agent:main:tavern:cht_1',
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
        ]);
        const promptSubmit = requests.at(-1);
        expect(promptSubmit?.params.session_id).toBe('live-created');
        const promptText = String(promptSubmit?.params.text);
        expect(promptText).toMatch(
            /^@image:\/workspace\/cat\.png\n@file:.*client_secret\.json\n\nsummarize this$/u
        );
        const filePath = /^@image:[^\n]+\n@file:(?<path>[^\n]+)\n\n/u.exec(promptText)?.groups
            ?.path;
        expect(filePath).toBeTruthy();
        expect(await fs.readFile(String(filePath), 'utf8')).toBe('{"client":true}');
    });

    it('maps composing, notice, subagent, and approval gateway events', async () => {
        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
                        {
                            payload: {
                                choices: ['Los Angeles', 'San Francisco'],
                                question: 'Which part of California?',
                                request_id: 'clarify_1',
                            },
                            type: 'clarify.request',
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
            client.streamChat({
                content: 'work',
                sessionKey: 'agent:main:tavern:cht_1',
            })
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
                    choices: ['Los Angeles', 'San Francisco'],
                    question: 'Which part of California?',
                    request_id: 'clarify_1',
                    source_event: 'clarify.request',
                },
                event: 'clarification.requested',
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
        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
                            payload: { text: '\n\n' },
                            type: 'message.delta',
                        },
                        {
                            payload: { kind: 'process', text: 'running checks' },
                            type: 'status.update',
                        },
                        {
                            payload: { text: '( •_•)>⌐■-■ synthesizing...' },
                            type: 'thinking.delta',
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
            client.streamChat({
                content: 'think',
                sessionKey: 'agent:main:tavern:cht_1',
            })
        );
        client.close();

        expect(events).toEqual([
            { data: { delta: 'checking context' }, event: 'assistant.delta' },
            { data: { delta: '\n\n' }, event: 'assistant.delta' },
            {
                data: {
                    delta: 'running checks',
                    kind: 'process',
                    source_event: 'status.update',
                },
                event: 'assistant.status',
            },
            {
                data: {},
                event: 'thinking.status',
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

    it('maps the categorized commands.catalog into the command list', async () => {
        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
        server.on('connection', (socket) => {
            socket.on('message', (message) => {
                const request = JSON.parse(message.toString()) as {
                    id: string;
                    method: string;
                };
                if (request.method === 'commands.catalog') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                canon: { '/model': '/model' },
                                categories: [
                                    {
                                        name: 'Session',
                                        pairs: [
                                            ['/model', 'Switch the session model'],
                                            ['/compact', 'Compress older history'],
                                        ],
                                    },
                                    {
                                        name: 'TUI',
                                        pairs: [['not-a-command', 'malformed entry']],
                                    },
                                ],
                                pairs: [],
                                skill_count: 3,
                                sub: {},
                                warning: '',
                            },
                        })
                    );
                    return;
                }
                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
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
        const list = await client.listCommands();
        client.close();

        expect(list).toEqual({
            commands: [
                {
                    category: 'Session',
                    description: 'Switch the session model',
                    name: '/model',
                },
                {
                    category: 'Session',
                    description: 'Compress older history',
                    name: '/compact',
                },
            ],
        });
    });

    it('runs model commands through config.set and falls back to command.dispatch when directed', async () => {
        const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
        server = new WebSocketServer({
            host: '127.0.0.1',
            port: await getFreePort(),
        });
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
                                session_id: 'live-cmd',
                                stored_session_id: 'stored-cmd',
                            },
                        })
                    );
                    return;
                }
                if (request.method === 'config.set') {
                    const value =
                        params.value === 'z-ai/glm-5.2 --provider nous'
                            ? 'z-ai/glm-5.2'
                            : params.value;
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: { key: 'model', value },
                        })
                    );
                    return;
                }
                if (request.method === 'slash.exec') {
                    const command = String(params.command ?? '');
                    if (command.startsWith('/retry')) {
                        socket.send(
                            JSON.stringify({
                                error: {
                                    code: 4018,
                                    message:
                                        'pending-input command: use command.dispatch for /retry',
                                },
                                id: request.id,
                                jsonrpc: '2.0',
                            })
                        );
                        return;
                    }
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: {
                                output: '\u001b[1;32mModel set to tavern-e2e-tools\u001b[0m',
                            },
                        })
                    );
                    return;
                }
                if (request.method === 'command.dispatch') {
                    socket.send(
                        JSON.stringify({
                            id: request.id,
                            jsonrpc: '2.0',
                            result: { output: 'queued retry', type: 'pending' },
                        })
                    );
                    return;
                }
                socket.send(JSON.stringify({ id: request.id, jsonrpc: '2.0', result: {} }));
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

        const direct = await client.runCommand(
            'agent:main:tavern:cht_1',
            '/model anthropic/claude-haiku-4-5-20251001'
        );
        const nestedModel = await client.runCommand(
            'agent:main:tavern:cht_1',
            '/model nous/z-ai/glm-5.2'
        );
        const nativeProviderFlag = await client.runCommand(
            'agent:main:tavern:cht_1',
            '/model z-ai/glm-5.2 --provider nous'
        );
        const dispatched = await client.runCommand('agent:main:tavern:cht_1', '/retry now');
        client.close();

        expect(direct).toEqual({
            output: 'Model switched: anthropic/claude-haiku-4-5-20251001',
            status: 'completed',
        });
        expect(nestedModel).toEqual({
            output: 'Model switched: nous/z-ai/glm-5.2',
            status: 'completed',
        });
        expect(nativeProviderFlag).toEqual({
            output: 'Model switched: nous/z-ai/glm-5.2',
            status: 'completed',
        });
        expect(dispatched).toEqual({ output: 'queued retry', status: 'completed' });
        expect(requests.map((entry) => entry.method)).toEqual([
            'session.create',
            'config.set',
            'config.set',
            'config.set',
            'slash.exec',
            'command.dispatch',
        ]);
        expect(requests[1]?.params).toMatchObject({
            key: 'model',
            session_id: 'live-cmd',
            value: 'claude-haiku-4-5-20251001 --provider anthropic',
        });
        expect(requests[2]?.params).toMatchObject({
            key: 'model',
            session_id: 'live-cmd',
            value: 'z-ai/glm-5.2 --provider nous',
        });
        expect(requests[3]?.params).toMatchObject({
            key: 'model',
            session_id: 'live-cmd',
            value: 'z-ai/glm-5.2 --provider nous',
        });
        expect(requests.at(-1)?.params).toMatchObject({
            arg: 'now',
            name: 'retry',
            session_id: 'live-cmd',
        });
    });
});

describe('LocalHermesClient adapter-owned state', () => {
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    const originalModelRouteEnv = captureModelRouteEnv();
    let runtimeRoot: string;
    let httpServer: ReturnType<typeof Bun.serve> | null = null;

    const expectedHermesWorkspace = () => path.join(runtimeRoot, 'hermes', 'workspace');

    beforeEach(async () => {
        runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-state-'));
        process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
        clearModelRouteEnv();
        process.env.CODEX_HOME = path.join(runtimeRoot, 'empty-codex-home');
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
        restoreModelRouteEnv(originalModelRouteEnv);
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
                if (request.method === 'GET' && url.pathname === '/api/model/auxiliary') {
                    return Response.json({
                        main: { model: 'gpt-5.5', provider: 'openai-codex' },
                        tasks: [],
                    });
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
        await client.updateAgentThinkingDefault('agt_hermes', {
            thinkingDefault: 'medium',
        });
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

    it('reads the selected model for display from Hermes model APIs', async () => {
        const setBodies: unknown[] = [];
        httpServer = Bun.serve({
            fetch: async (request) => {
                const url = new URL(request.url);
                if (request.method === 'POST' && url.pathname === '/api/model/set') {
                    setBodies.push(await request.json());
                    return Response.json({
                        base_url: 'https://api.anthropic.com',
                        ok: true,
                    });
                }
                if (request.method === 'GET' && url.pathname === '/api/model/auxiliary') {
                    return Response.json({
                        main: { model: 'claude-opus-4-8', provider: 'anthropic' },
                        tasks: [],
                    });
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

        await client.updateAgentModel('agt_hermes', {
            model: {
                model: 'claude-opus-4-8',
                provider: 'anthropic',
            },
        });

        const agents = await client.listAgents();

        expect(setBodies).toEqual([
            {
                model: 'claude-opus-4-8',
                provider: 'anthropic',
                scope: 'main',
            },
        ]);
        expect(agents.agents[0]?.hermesModelName).toMatchObject({
            model: 'claude-opus-4-8',
            provider: 'anthropic',
        });
    });

    it('applies a Tavern default model without marking it as a saved agent setting', async () => {
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

        await client.applyDefaultAgentModel({
            model: {
                model: 'gpt-5.4-mini',
                provider: 'openai-codex',
            },
        });

        const agents = await client.listAgents();
        const { HERMES_HOME } = await import('../config');

        expect(agents.agents[0]?.hermesModelName).toBeUndefined();
        await expect(
            fs.readFile(path.join(HERMES_HOME, 'tavern-adapter-state.json'), 'utf8')
        ).rejects.toThrow();
    });

    it('migrates legacy adapter agent settings into the configured settings envelope', async () => {
        const { HERMES_HOME } = await import('../config');
        await fs.mkdir(HERMES_HOME, { recursive: true });
        await fs.writeFile(
            path.join(HERMES_HOME, 'tavern-adapter-state.json'),
            JSON.stringify({
                agent: {
                    name: 'Legacy name',
                },
            })
        );

        const { LocalHermesClient } = await import('./local-client');
        const client = new LocalHermesClient({
            baseUrl: 'http://127.0.0.1:1',
            token: null,
        });

        await expect(client.listAgents()).resolves.toMatchObject({
            agents: [{ name: 'Legacy name' }],
        });
        await client.updateAgentName('agt_hermes', { name: 'Configured name' });

        const state = JSON.parse(
            await fs.readFile(path.join(HERMES_HOME, 'tavern-adapter-state.json'), 'utf8')
        );
        expect(state).toMatchObject({
            agentConfigured: {
                name: 'Configured name',
            },
        });
        expect(state.agent).toBeUndefined();
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

        const updated = await client.updateSkillEnabled('browser', {
            enabled: false,
        });

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

        const updated = await client.updateToolsetEnabled('web', {
            enabled: false,
        });

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
                            {
                                ended_at: 1_780_000_120,
                                id: 'cron_hermes_job_1_1780000060',
                                last_active: 1_780_000_120,
                                last_error: 'Provider timeout',
                                last_status: 'failed',
                                preview: 'cron failed',
                                started_at: 1_780_000_060,
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
        expect(runs.runs).toHaveLength(2);
        expect(runs.runs[0]).toMatchObject({
            jobId,
            sessionId: 'cron_hermes_job_1_1780000000',
            status: 'success',
            summary: 'cron completed',
        });
        expect(runs.runs[1]).toMatchObject({
            executionErrorCode: 'execution_failed',
            executionErrorMessage: 'Provider timeout',
            jobId,
            sessionId: 'cron_hermes_job_1_1780000060',
            status: 'error',
            summary: 'cron failed',
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
                    workdir: expectedHermesWorkspace(),
                },
                method: 'POST',
                pathname: '/api/cron/jobs',
            },
            { method: 'POST', pathname: '/api/cron/jobs/hermes_job_1/pause' },
            {
                body: {
                    updates: {
                        name: 'Paused daily check',
                        workdir: expectedHermesWorkspace(),
                    },
                },
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

async function listenHttpServer(server: HttpServer) {
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });
}

async function closeHttpServer(server: HttpServer | null) {
    if (!server) {
        return;
    }
    await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
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

const modelRouteEnvKeys = [
    'CODEX_HOME',
    'CODEX_MODEL',
    'OPENAI_API_KEY',
    'OPENROUTER_API_KEY',
    'TAVERN_HERMES_API_KEY',
    'TAVERN_HERMES_BASE_URL',
    'TAVERN_HERMES_MODEL',
    'TAVERN_HERMES_PROVIDER',
] as const;

function captureModelRouteEnv() {
    return Object.fromEntries(modelRouteEnvKeys.map((key) => [key, process.env[key]] as const));
}

function clearModelRouteEnv() {
    for (const key of modelRouteEnvKeys) {
        process.env[key] = '';
    }
}

function restoreModelRouteEnv(values: ReturnType<typeof captureModelRouteEnv>) {
    for (const key of modelRouteEnvKeys) {
        const value = values[key];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
}
