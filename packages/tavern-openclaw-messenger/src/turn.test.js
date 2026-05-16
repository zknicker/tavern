import { describe, expect, it, mock } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    createRuntime,
    waitForBroadcast,
    waitForDispatch,
    waitForMockCallCount,
} from './turn-test-support.js';

const runPrepared = mock(async (params) => {
    return { dispatchResult: await params.runDispatch() };
});
const transcriptUpdates = [];
const appendSessionTranscriptMessage = mock(async ({ message, now, sessionId, transcriptPath }) => {
    await mkdir(join(transcriptPath, '..'), { recursive: true });
    const header = {
        cwd: '/tmp',
        id: sessionId ?? 'session-1',
        timestamp: new Date(now).toISOString(),
        type: 'session',
        version: 3,
    };
    await writeFile(transcriptPath, `${JSON.stringify(header)}\n`, {
        flag: 'wx',
    }).catch((error) => {
        if (error?.code !== 'EEXIST') {
            throw error;
        }
    });
    const messageId = `transcript-${transcriptUpdates.length + 1}`;
    const record = {
        id: messageId,
        message,
        parentId: null,
        timestamp: new Date(now).toISOString(),
        type: 'message',
    };

    await writeFile(transcriptPath, `${JSON.stringify(record)}\n`, { flag: 'a' });

    return { messageId };
});
const emitSessionTranscriptUpdate = mock((update) => {
    transcriptUpdates.push(update);
});
let nextDispatchResult = { counts: { final: 1 }, queuedFinal: false };
const dispatchReplyWithBufferedBlockDispatcher = mock(
    async ({ dispatcherOptions, replyOptions }) => {
        await replyOptions?.onReasoningStream?.({ text: 'reasoning' });
        replyOptions?.onToolStart?.({
            name: 'web_search',
            phase: 'started',
            toolCallId: 'tool-call-1',
        });
        await replyOptions?.onPartialReply?.({
            delta: 'reply',
            text: 'reply',
        });
        await dispatcherOptions.deliver({ text: 'reply' });
        replyOptions?.onToolResult?.({
            name: 'web_search',
            text: 'Found sources',
            toolCallId: 'tool-call-1',
        });
        await replyOptions?.onReasoningEnd?.();
        return nextDispatchResult;
    }
);

mock.module('openclaw/plugin-sdk/reply-payload', () => ({
    getReplyPayloadMetadata: (payload) => payload?.__replyMetadata,
    setReplyPayloadMetadata: (payload, metadata) => ({
        ...payload,
        __replyMetadata: metadata,
    }),
}));

mock.module('openclaw/plugin-sdk/agent-harness-runtime', () => ({
    appendSessionTranscriptMessage,
    emitSessionTranscriptUpdate,
}));

mock.module('openclaw/plugin-sdk/channel-core', () => ({
    buildChannelOutboundSessionRoute: (params) => {
        const sessionKey = `agent:${params.agentId}:${params.channel}:${params.peer.kind}:${params.peer.id}`;

        return {
            baseSessionKey: sessionKey,
            chatType: params.chatType,
            from: params.from,
            peer: params.peer,
            sessionKey,
            to: params.to,
        };
    },
    createChatChannelPlugin: (plugin) => plugin,
}));

mock.module('openclaw/plugin-sdk/channel-plugin-common', () => ({
    getChatChannelMeta: () => ({}),
}));

const { handleTavernInboundMessage } = await import('./turn.js');

async function dispatchInboundTavernMessage({ context, params, respond, runtime }) {
    try {
        await handleTavernInboundMessage({
            context,
            runtime,
            sendAccepted: (accepted) => respond(true, accepted),
            event: {
                accountId: 'default',
                agentId: params.agent.agentId,
                conversation: {
                    id: params.chatId,
                    kind: 'channel',
                    label: params.chatId,
                },
                kind: 'inbound-message',
                message: {
                    attachments: [],
                    id: params.message.id,
                    metadata: params.message.metadata,
                    senderId: params.sender?.id,
                    senderName: params.sender?.name,
                    text: params.message.content ?? params.message.text,
                    timestamp: params.message.sentAt,
                },
                requestId: params.message.id,
                sessionKey: params.sessionKey,
                turnId: params.turnId,
            },
        });
    } catch (error) {
        respond(false, undefined, {
            code: 'invalid_request',
            message: error instanceof Error ? error.message : String(error),
        });
    }
}

describe('Tavern Messenger turn handling', () => {
    it('dispatches Tavern turns as OpenClaw channel chats', async () => {
        runPrepared.mockClear();
        dispatchReplyWithBufferedBlockDispatcher.mockClear();
        nextDispatchResult = { counts: { final: 1 }, queuedFinal: false };

        const response = {};
        const broadcast = mock(() => undefined);
        const runtime = createRuntime({ dispatchReplyWithBufferedBlockDispatcher, runPrepared });

        await dispatchInboundTavernMessage({
            context: { broadcast },
            params: {
                agent: {
                    agentId: 'blippy',
                },
                chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                message: {
                    content: 'hello',
                    id: 'message-1',
                    metadata: {
                        tavern: {
                            toolMentions: [
                                {
                                    end: 10,
                                    id: 'chrome',
                                    kind: 'skill',
                                    label: 'Chrome',
                                    start: 4,
                                    text: 'Chrome',
                                },
                            ],
                        },
                    },
                    sentAt: '2026-05-04T12:00:00.000Z',
                },
                sender: {
                    id: 'zach',
                    name: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            respond: (ok, payload, error) => {
                response.ok = ok;
                response.payload = payload;
                response.error = error;
            },
            runtime,
        });

        await waitForDispatch(runPrepared);
        await waitForBroadcast(broadcast, 'plugin.tavern.turn.completed');

        expect(response).toMatchObject({
            ok: true,
            payload: {
                sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                status: 'accepted',
            },
        });
        expect(runPrepared).toHaveBeenCalledTimes(1);
        expect(runPrepared.mock.calls[0][0]).toMatchObject({
            accountId: 'default',
            channel: 'tavern',
            messageId: 'message-1',
            routeSessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        });
        expect(runPrepared.mock.calls[0][0].ctxPayload).toMatchObject({
            TavernMessageMetadata: {
                tavern: {
                    toolMentions: [
                        {
                            end: 10,
                            id: 'chrome',
                            kind: 'skill',
                            label: 'Chrome',
                            start: 4,
                            text: 'Chrome',
                        },
                    ],
                },
            },
            ChatType: 'channel',
            From: 'chat:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            Provider: 'tavern',
            SessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            To: 'chat:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        });
        expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledTimes(1);
        expect(
            dispatchReplyWithBufferedBlockDispatcher.mock.calls[0][0].replyOptions
        ).toMatchObject({
            bootstrapContextMode: 'lightweight',
            runId: 'tavern-run:message-1',
            suppressDefaultToolProgressMessages: true,
        });

        const progressBroadcasts = broadcast.mock.calls.filter(
            ([eventName]) => eventName === 'plugin.tavern.turn.progress'
        );
        expect(progressBroadcasts).toHaveLength(0);
    });

    it('persists the accepted inbound message before waiting for the final reply', async () => {
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;

        let releaseDispatch = () => undefined;
        const response = {};
        const broadcast = mock(() => undefined);
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-accepted-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const sessionKey = 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
        const blockingDispatch = mock(async () => {
            await new Promise((resolve) => {
                releaseDispatch = resolve;
            });
            return { counts: { final: 1 }, queuedFinal: false };
        });
        const recordInboundSession = mock(async ({ sessionKey: key, storePath: path }) => {
            await writeFile(
                path,
                `${JSON.stringify({
                    [key]: {
                        sessionId: 'session-1',
                    },
                })}\n`
            );
        });
        const preparedRun = mock(async (params) => {
            await params.recordInboundSession({
                ctx: params.ctxPayload,
                onRecordError: params.record?.onRecordError,
                sessionKey: params.routeSessionKey,
                storePath: params.storePath,
                trackSessionMetaTask: params.record?.trackSessionMetaTask,
            });
            return { dispatchResult: await params.runDispatch() };
        });

        try {
            await dispatchInboundTavernMessage({
                context: { broadcast },
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'hello before final',
                        id: 'message-1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey,
                },
                respond: (ok, payload, error) => {
                    response.ok = ok;
                    response.payload = payload;
                    response.error = error;
                },
                runtime: createRuntime({
                    dispatchReplyWithBufferedBlockDispatcher: blockingDispatch,
                    recordInboundSession,
                    runPrepared: preparedRun,
                    storePath,
                }),
            });

            await waitForMockCallCount(appendSessionTranscriptMessage, 1);
            await waitForMockCallCount(emitSessionTranscriptUpdate, 1);

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });
            expect(appendSessionTranscriptMessage.mock.calls[0][0].message).toMatchObject({
                content: [{ text: 'hello before final', type: 'text' }],
                messageId: 'message-1',
                role: 'user',
                sessionKey,
            });
            expect(transcriptUpdates[0]).toMatchObject({
                sessionKey,
            });

            await waitForMockCallCount(blockingDispatch, 1);
            releaseDispatch();
            await waitForBroadcast(broadcast, 'plugin.tavern.turn.completed');
        } finally {
            releaseDispatch();
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('broadcasts turn failure when OpenClaw finishes without a final reply', async () => {
        runPrepared.mockClear();
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;
        nextDispatchResult = { counts: { final: 0 }, queuedFinal: false };
        const silentDispatch = mock(async () => nextDispatchResult);

        const response = {};
        const broadcast = mock(() => undefined);
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const transcriptPath = join(tempDir, 'session.jsonl');
        await writeFile(
            storePath,
            `${JSON.stringify({
                'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3': {
                    sessionFile: transcriptPath,
                    sessionId: 'session-1',
                },
            })}\n`
        );

        try {
            await dispatchInboundTavernMessage({
                context: { broadcast },
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'use web search',
                        id: 'message-1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                },
                respond: (ok, payload, error) => {
                    response.ok = ok;
                    response.payload = payload;
                    response.error = error;
                },
                runtime: createRuntime({
                    dispatchReplyWithBufferedBlockDispatcher: silentDispatch,
                    runPrepared,
                    storePath,
                }),
            });

            await waitForBroadcast(broadcast, 'plugin.tavern.turn.failed');
            await waitForMockCallCount(appendSessionTranscriptMessage, 2);
            await waitForMockCallCount(emitSessionTranscriptUpdate, 2);

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });
            expect(
                broadcast.mock.calls.find(
                    ([eventName]) => eventName === 'plugin.tavern.turn.failed'
                )?.[1]
            ).toMatchObject({
                chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                error: 'OpenClaw turn ended before producing a reply.',
                runId: 'tavern-run:message-1',
            });
            expect(appendSessionTranscriptMessage).toHaveBeenCalledTimes(2);
            const persistedTranscriptPath = transcriptUpdates[0]?.sessionFile;

            expect(transcriptUpdates[0]).toMatchObject({
                message: {
                    chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    messageId: 'message-1',
                    role: 'user',
                    senderName: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            });
            expect(transcriptUpdates[1]).toMatchObject({
                message: {
                    messageId: 'tavern-turn-failure:tavern-run:message-1',
                    metadata: {
                        tavern: {
                            turnFailure: {
                                messageId: 'message-1',
                                runId: 'tavern-run:message-1',
                            },
                        },
                        isError: true,
                        stopReason: 'error',
                    },
                    role: 'system',
                    senderName: 'OpenClaw',
                },
            });
            expect(typeof persistedTranscriptPath).toBe('string');
            const transcript = await readFile(persistedTranscriptPath, 'utf8');

            expect(transcript).toContain('use web search');
            expect(transcript).toContain('OpenClaw turn failed');
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('completes when OpenClaw delivers a visible reply but returns zero final count', async () => {
        runPrepared.mockClear();
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;
        nextDispatchResult = { counts: { final: 0 }, queuedFinal: false };

        const response = {};
        const broadcast = mock(() => undefined);
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-observed-delivery-test-'));
        const storePath = join(tempDir, 'sessions.json');
        await writeFile(storePath, '{}\n');

        try {
            await dispatchInboundTavernMessage({
                context: { broadcast },
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'use read then answer',
                        id: 'message-1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                },
                respond: (ok, payload, error) => {
                    response.ok = ok;
                    response.payload = payload;
                    response.error = error;
                },
                runtime: createRuntime({
                    dispatchReplyWithBufferedBlockDispatcher,
                    runPrepared,
                    storePath,
                }),
            });

            await waitForBroadcast(broadcast, 'plugin.tavern.turn.completed');

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });
            expect(
                broadcast.mock.calls.some(
                    ([eventName]) => eventName === 'plugin.tavern.turn.failed'
                )
            ).toBe(false);
            expect(
                broadcast.mock.calls.find(
                    ([eventName]) => eventName === 'plugin.tavern.message.created'
                )?.[1]
            ).toMatchObject({
                text: 'reply',
            });
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('completes when OpenClaw persisted the final transcript reply but dispatch counts lag', async () => {
        runPrepared.mockClear();
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;

        const response = {};
        const broadcast = mock(() => undefined);
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-transcript-final-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const sessionKey = 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
        const transcriptFinalDispatch = mock(async () => {
            const store = JSON.parse(await readFile(storePath, 'utf8'));
            const transcriptPath = store[sessionKey]?.sessionFile;

            await appendSessionTranscriptMessage({
                message: {
                    content: [{ text: 'reply from transcript', type: 'text' }],
                    role: 'assistant',
                    sessionKey,
                    timestamp: Date.parse('2026-05-04T12:00:01.000Z'),
                },
                now: Date.parse('2026-05-04T12:00:01.000Z'),
                sessionId: store[sessionKey]?.sessionId,
                transcriptPath,
            });

            return { counts: { final: 0 }, queuedFinal: false };
        });

        await writeFile(
            storePath,
            `${JSON.stringify({
                [sessionKey]: {
                    sessionId: 'session-1',
                },
            })}\n`
        );

        try {
            await dispatchInboundTavernMessage({
                context: { broadcast },
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'hello',
                        id: 'message-1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey,
                },
                respond: (ok, payload, error) => {
                    response.ok = ok;
                    response.payload = payload;
                    response.error = error;
                },
                runtime: createRuntime({
                    dispatchReplyWithBufferedBlockDispatcher: transcriptFinalDispatch,
                    runPrepared,
                    storePath,
                }),
            });

            await waitForBroadcast(broadcast, 'plugin.tavern.turn.completed');

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });
            expect(
                broadcast.mock.calls.some(
                    ([eventName]) => eventName === 'plugin.tavern.turn.failed'
                )
            ).toBe(false);
            expect(
                broadcast.mock.calls.find(
                    ([eventName]) => eventName === 'plugin.tavern.message.created'
                )?.[1]
            ).toMatchObject({
                text: 'reply from transcript',
            });
            expect(appendSessionTranscriptMessage).toHaveBeenCalledTimes(2);
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('persists a repeated prompt as a distinct inbound message when the message id differs', async () => {
        runPrepared.mockClear();
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;
        nextDispatchResult = { counts: { final: 0 }, queuedFinal: false };
        const silentDispatch = mock(async () => nextDispatchResult);

        const response = {};
        const broadcast = mock(() => undefined);
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-repeat-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const transcriptPath = join(tempDir, 'session.jsonl');
        await writeFile(
            storePath,
            `${JSON.stringify({
                'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3': {
                    sessionFile: transcriptPath,
                    sessionId: 'session-1',
                },
            })}\n`
        );
        await writeFile(
            transcriptPath,
            `${[
                JSON.stringify({
                    cwd: '/tmp',
                    id: 'session-1',
                    timestamp: '2026-05-04T11:59:00.000Z',
                    type: 'session',
                    version: 3,
                }),
                JSON.stringify({
                    id: 'transcript-existing',
                    message: {
                        chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                        content: [{ text: 'use web search', type: 'text' }],
                        messageId: 'message-0',
                        role: 'user',
                        sender: 'Zach',
                        senderId: 'zach',
                        senderName: 'Zach',
                        sessionKey:
                            'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                        timestamp: '2026-05-04T11:59:30.000Z',
                    },
                    parentId: null,
                    timestamp: '2026-05-04T11:59:30.000Z',
                    type: 'message',
                }),
            ].join('\n')}\n`
        );

        try {
            await dispatchInboundTavernMessage({
                context: { broadcast },
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'use web search',
                        id: 'message-1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                },
                respond: (ok, payload, error) => {
                    response.ok = ok;
                    response.payload = payload;
                    response.error = error;
                },
                runtime: createRuntime({
                    dispatchReplyWithBufferedBlockDispatcher: silentDispatch,
                    runPrepared,
                    storePath,
                }),
            });

            await waitForBroadcast(broadcast, 'plugin.tavern.turn.failed');
            await waitForMockCallCount(appendSessionTranscriptMessage, 2);

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });

            const transcript = await readFile(transcriptPath, 'utf8');
            expect(transcript).toContain('"messageId":"message-0"');
            expect(transcript).toContain('"messageId":"message-1"');
            expect(transcript.match(/use web search/g)?.length).toBeGreaterThanOrEqual(2);
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('persists failure rows when the session store only has a sessionId', async () => {
        runPrepared.mockClear();
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;
        nextDispatchResult = { counts: { final: 0 }, queuedFinal: false };
        const silentDispatch = mock(async () => nextDispatchResult);

        const response = {};
        const broadcast = mock(() => undefined);
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-session-id-test-'));
        const storePath = join(tempDir, 'sessions.json');
        await writeFile(
            storePath,
            `${JSON.stringify({
                'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3': {
                    sessionId: 'session-1',
                },
            })}\n`
        );

        try {
            await dispatchInboundTavernMessage({
                context: { broadcast },
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'use web search',
                        id: 'message-1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                },
                respond: (ok, payload, error) => {
                    response.ok = ok;
                    response.payload = payload;
                    response.error = error;
                },
                runtime: createRuntime({
                    dispatchReplyWithBufferedBlockDispatcher: silentDispatch,
                    runPrepared,
                    storePath,
                }),
            });

            await waitForBroadcast(broadcast, 'plugin.tavern.turn.failed');
            await waitForMockCallCount(appendSessionTranscriptMessage, 2);

            const nextStore = JSON.parse(await readFile(storePath, 'utf8'));
            const transcriptPath =
                nextStore['agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3']
                    ?.sessionFile;

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });
            expect(typeof transcriptPath).toBe('string');

            const transcript = await readFile(transcriptPath, 'utf8');
            expect(transcript).toContain('use web search');
            expect(transcript).toContain('OpenClaw turn failed');
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('persists the thrown OpenClaw error message into the failure row', async () => {
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;
        dispatchReplyWithBufferedBlockDispatcher.mockClear();
        const response = {};
        const broadcast = mock(() => undefined);
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-auth-error-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const transcriptPath = join(tempDir, 'session.jsonl');
        const authError =
            'OAuth token refresh failed for openai-codex: Failed to refresh OpenAI Codex token.';
        const failingRunPrepared = mock(async () => {
            throw new Error(authError);
        });
        await writeFile(
            storePath,
            `${JSON.stringify({
                'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3': {
                    sessionFile: transcriptPath,
                    sessionId: 'session-1',
                },
            })}\n`
        );

        try {
            await dispatchInboundTavernMessage({
                context: { broadcast },
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'hi',
                        id: 'message-1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey: 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                },
                respond: (ok, payload, error) => {
                    response.ok = ok;
                    response.payload = payload;
                    response.error = error;
                },
                runtime: createRuntime({
                    dispatchReplyWithBufferedBlockDispatcher,
                    runPrepared: failingRunPrepared,
                    storePath,
                }),
            });

            await waitForBroadcast(broadcast, 'plugin.tavern.turn.failed');
            await waitForMockCallCount(appendSessionTranscriptMessage, 2);

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });
            expect(
                broadcast.mock.calls.find(
                    ([eventName]) => eventName === 'plugin.tavern.turn.failed'
                )?.[1]
            ).toMatchObject({
                error: authError,
            });

            const nextStore = JSON.parse(await readFile(storePath, 'utf8'));
            const persistedTranscriptPath =
                nextStore['agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3']
                    ?.sessionFile;

            expect(typeof persistedTranscriptPath).toBe('string');

            const transcript = await readFile(persistedTranscriptPath, 'utf8');
            expect(transcript).toContain(authError);
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('persists delivered OpenClaw error replies when the turn completes with a visible fallback', async () => {
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;
        const response = {};
        const broadcast = mock(() => undefined);
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-delivered-error-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const sessionKey = 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
        const visibleError =
            '⚠️ Model login failed on the gateway for openai-codex. Please try again.';
        const visibleErrorDispatch = mock(async ({ dispatcherOptions }) => {
            await dispatcherOptions.deliver({
                __replyMetadata: {
                    deliverDespiteSourceReplySuppression: true,
                },
                text: visibleError,
            });

            return {
                counts: { block: 0, final: 1, tool: 0 },
                queuedFinal: true,
            };
        });
        await writeFile(
            storePath,
            `${JSON.stringify({
                [sessionKey]: {
                    sessionId: 'session-1',
                },
            })}\n`
        );

        try {
            await dispatchInboundTavernMessage({
                context: { broadcast },
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'hi',
                        id: 'message-1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey,
                },
                respond: (ok, payload, error) => {
                    response.ok = ok;
                    response.payload = payload;
                    response.error = error;
                },
                runtime: createRuntime({
                    dispatchReplyWithBufferedBlockDispatcher: visibleErrorDispatch,
                    runPrepared,
                    storePath,
                }),
            });

            await waitForBroadcast(broadcast, 'plugin.tavern.turn.completed');
            await waitForMockCallCount(appendSessionTranscriptMessage, 2);

            const nextStore = JSON.parse(await readFile(storePath, 'utf8'));
            const transcriptPath = nextStore[sessionKey]?.sessionFile;

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });
            expect(typeof transcriptPath).toBe('string');
            expect(
                broadcast.mock.calls.find(
                    ([eventName]) => eventName === 'plugin.tavern.message.created'
                )?.[1]
            ).toMatchObject({
                text: visibleError,
            });

            const transcript = await readFile(transcriptPath, 'utf8');
            expect(transcript).toContain('"role":"assistant"');
            expect(transcript).toContain(visibleError);
            expect(transcript).toContain('"stopReason":"error"');
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('waits for the tracked OpenClaw session metadata task before persisting a failure', async () => {
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;
        dispatchReplyWithBufferedBlockDispatcher.mockClear();

        let releaseSessionMetaTask = () => undefined;
        const response = {};
        const broadcast = mock(() => undefined);
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-meta-task-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const sessionKey = 'agent:blippy:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
        const authError =
            'OAuth token refresh failed for openai-codex: Failed to refresh OpenAI Codex token.';
        await writeFile(storePath, '{}\n');

        const recordInboundSession = mock(({ trackSessionMetaTask }) => {
            const task = (async () => {
                await new Promise((resolve) => {
                    releaseSessionMetaTask = resolve;
                });
                await writeFile(
                    storePath,
                    `${JSON.stringify({
                        [sessionKey]: {
                            sessionId: 'session-1',
                        },
                    })}\n`
                );
            })();

            trackSessionMetaTask?.(task);
        });
        const failingRunPrepared = mock(async (params) => {
            await params.recordInboundSession({
                ctx: params.ctxPayload,
                onRecordError: params.record?.onRecordError,
                sessionKey: params.routeSessionKey,
                storePath: params.storePath,
                trackSessionMetaTask: params.record?.trackSessionMetaTask,
            });
            throw new Error(authError);
        });

        try {
            await dispatchInboundTavernMessage({
                context: { broadcast },
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'hi',
                        id: 'message-1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey,
                },
                respond: (ok, payload, error) => {
                    response.ok = ok;
                    response.payload = payload;
                    response.error = error;
                },
                runtime: createRuntime({
                    dispatchReplyWithBufferedBlockDispatcher,
                    recordInboundSession,
                    runPrepared: failingRunPrepared,
                    storePath,
                }),
            });

            releaseSessionMetaTask();

            await waitForBroadcast(broadcast, 'plugin.tavern.turn.failed');
            await waitForMockCallCount(appendSessionTranscriptMessage, 2);

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });

            const nextStore = JSON.parse(await readFile(storePath, 'utf8'));
            const transcriptPath = nextStore[sessionKey]?.sessionFile;

            expect(typeof transcriptPath).toBe('string');

            const transcript = await readFile(transcriptPath, 'utf8');
            expect(transcript).toContain('"messageId":"message-1"');
            expect(transcript).toContain(authError);
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });
});
