import { describe, expect, it, mock } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntime, waitForDispatch, waitForMockCallCount } from './turn-test-support.js';

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
        await replyOptions?.onReasoningStream?.({ text: 'Checking Tavern QA context.' });
        await replyOptions?.onItemEvent?.({
            id: 'rs_mock_summary',
            status: 'completed',
            summary: [{ text: 'Reasoning summary visible in Tavern.' }],
            type: 'reasoning',
        });
        await replyOptions?.onItemEvent?.({
            itemId: 'tool:call_tool_1|fc_tool_1',
            kind: 'tool',
            name: 'web_search',
            phase: 'start',
            status: 'running',
            title: 'web search Tavern QA',
        });
        await replyOptions?.onPartialReply?.({
            delta: 'reply',
            text: 'reply',
        });
        await dispatcherOptions.deliver({ text: 'reply' });
        await replyOptions?.onItemEvent?.({
            itemId: 'tool:call_tool_1|fc_tool_1',
            kind: 'tool',
            name: 'web_search',
            phase: 'end',
            status: 'completed',
            summary: 'Found sources',
            title: 'web search Tavern QA',
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
    acquireSessionWriteLock: async () => ({
        release: async () => undefined,
    }),
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

function createTurnTestContext() {
    return {
        tavern: {
            createDelivery: mock(async (input) => ({
                cursor: '1',
                id: input.deliveryId,
                idempotent: false,
                message: {
                    id: input.messageId,
                },
            })),
            updateTurnActivity: mock(async (turn, input = {}) => ({
                ...turn,
                ...input,
            })),
        },
    };
}

async function waitForActivityStatus(tavern, status) {
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
        if (tavern.updateTurnActivity.mock.calls.some(([, input]) => input?.status === status)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(`Tavern activity status ${status} was not written.`);
}

function hasActivityStatus(tavern, status) {
    return tavern.updateTurnActivity.mock.calls.some(([, input]) => input?.status === status);
}

function lastActivityInput(tavern, status) {
    return tavern.updateTurnActivity.mock.calls
        .map(([, input]) => input)
        .filter((input) => input?.status === status)
        .at(-1);
}

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
                    label: params.conversation?.label ?? null,
                    ...(params.conversation?.groupChannel
                        ? { groupChannel: params.conversation.groupChannel }
                        : {}),
                    ...(params.conversation?.groupSubject
                        ? { groupSubject: params.conversation.groupSubject }
                        : {}),
                    ...(params.conversation?.groupSystemPrompt
                        ? { groupSystemPrompt: params.conversation.groupSystemPrompt }
                        : {}),
                },
                kind: 'inbound-message',
                message: {
                    attachments: [],
                    id: params.message.id,
                    metadata: params.message.metadata,
                    nonce: params.message.nonce,
                    senderId: params.sender?.id,
                    senderName: params.sender?.name,
                    sequence: params.message.sequence,
                    text: params.message.content ?? params.message.text,
                    timestamp: params.message.sentAt,
                },
                recentMessages: params.recentMessages,
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
        const context = createTurnTestContext();
        const runtime = createRuntime({ dispatchReplyWithBufferedBlockDispatcher, runPrepared });

        await dispatchInboundTavernMessage({
            context,
            params: {
                agent: {
                    agentId: 'blippy',
                },
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                message: {
                    content: 'hello',
                    id: 'msg_1',
                    metadata: {
                        tavern: {
                            mentions: [
                                {
                                    end: 10,
                                    id: 'chrome',
                                    kind: 'skill',
                                    label: 'Chrome',
                                    projection: 'skill-context',
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
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            respond: (ok, payload, error) => {
                response.ok = ok;
                response.payload = payload;
                response.error = error;
            },
            runtime,
        });

        await waitForDispatch(runPrepared);
        await waitForActivityStatus(context.tavern, 'completed');

        expect(response).toMatchObject({
            ok: true,
            payload: {
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                status: 'accepted',
            },
        });
        expect(runPrepared).toHaveBeenCalledTimes(1);
        expect(runPrepared.mock.calls[0][0]).toMatchObject({
            accountId: 'default',
            channel: 'tavern',
            messageId: 'msg_1',
            routeSessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        });
        expect(runPrepared.mock.calls[0][0].ctxPayload).toMatchObject({
            BodyForAgent: [
                '<skill>',
                '<name>Chrome</name>',
                '<path>chrome</path>',
                '</skill>',
                '',
                'hello',
            ].join('\n'),
            TavernMessageMetadata: {
                tavern: {
                    mentions: [
                        {
                            end: 10,
                            id: 'chrome',
                            kind: 'skill',
                            label: 'Chrome',
                            projection: 'skill-context',
                            start: 4,
                            text: 'Chrome',
                        },
                    ],
                },
            },
            ChatType: 'channel',
            From: 'chat:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            Provider: 'tavern',
            SessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            To: 'chat:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        });
        expect(dispatchReplyWithBufferedBlockDispatcher).toHaveBeenCalledTimes(1);
        expect(
            dispatchReplyWithBufferedBlockDispatcher.mock.calls[0][0].replyOptions
        ).toMatchObject({
            allowProgressCallbacksWhenSourceDeliverySuppressed: true,
            runId: 'run_1',
            suppressDefaultToolProgressMessages: true,
        });
        expect(
            typeof dispatchReplyWithBufferedBlockDispatcher.mock.calls[0][0].replyOptions
                .onItemEvent
        ).toBe('function');
        expect(
            typeof dispatchReplyWithBufferedBlockDispatcher.mock.calls[0][0].replyOptions
                .onCommandOutput
        ).toBe('function');
        expect(
            dispatchReplyWithBufferedBlockDispatcher.mock.calls[0][0].replyOptions
        ).not.toHaveProperty('onToolStart');
        expect(
            dispatchReplyWithBufferedBlockDispatcher.mock.calls[0][0].replyOptions
        ).not.toHaveProperty('onAgentEvent');

        expect(context.tavern.createDelivery).toHaveBeenCalledTimes(1);
        expect(context.tavern.createDelivery.mock.calls[0][0]).toMatchObject({
            chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            deliveryId: 'del_1_final_1',
            messageId: 'msg_1_final_1',
            requestMessageId: 'msg_1',
            runId: 'run_1',
            text: 'reply',
        });
        expect(
            context.tavern.updateTurnActivity.mock.calls.map(([, input]) => input)
        ).toMatchObject([
            {
                status: 'running',
            },
            {
                step: {
                    id: 'act_reasoning',
                    kind: 'reasoning',
                    metadata: {
                        detail: 'Checking Tavern QA context.',
                    },
                    status: 'running',
                    title: 'Reasoning',
                },
                status: 'running',
            },
            {
                step: {
                    id: 'act_rs_mock_summary',
                    kind: 'reasoning',
                    metadata: {
                        detail: 'Reasoning summary visible in Tavern.',
                        runtime: {
                            openClawKind: 'reasoning',
                        },
                    },
                    status: 'completed',
                    title: 'Reasoning',
                },
                status: 'running',
            },
            {
                step: {
                    id: 'act_call_tool_1',
                    kind: 'tool_call',
                    status: 'running',
                    title: 'web search Tavern QA',
                },
                status: 'running',
            },
            {
                step: {
                    id: 'act_call_tool_1',
                    kind: 'tool_call',
                    metadata: {
                        detail: 'Found sources',
                    },
                    status: 'completed',
                    title: 'web search Tavern QA',
                },
                status: 'running',
            },
            {
                status: 'completed',
            },
        ]);
    });

    it('passes trusted Tavern conversation fields into OpenClaw context when supplied', async () => {
        runPrepared.mockClear();
        const response = {};

        await dispatchInboundTavernMessage({
            context: createTurnTestContext(),
            params: {
                agent: {
                    agentId: 'blippy',
                },
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                conversation: {
                    groupChannel: '#general',
                    groupSubject: '#general',
                    groupSystemPrompt: 'Keep this chat focused on Tavern work.',
                    label: '#general',
                },
                message: {
                    content: 'hello',
                    id: 'msg_1',
                    sentAt: '2026-05-04T12:00:00.000Z',
                },
                sender: {
                    id: 'zach',
                    name: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            respond: (ok, payload, error) => {
                response.ok = ok;
                response.payload = payload;
                response.error = error;
            },
            runtime: createRuntime({ dispatchReplyWithBufferedBlockDispatcher, runPrepared }),
        });

        await waitForDispatch(runPrepared);

        expect(response).toMatchObject({ ok: true });
        expect(runPrepared.mock.calls[0][0].ctxPayload).toMatchObject({
            ChatType: 'channel',
            ConversationLabel: '#general',
            GroupChannel: '#general',
            GroupSubject: '#general',
            GroupSystemPrompt: 'Keep this chat focused on Tavern work.',
        });
    });

    it('passes recent Tavern chat history into OpenClaw inbound context', async () => {
        runPrepared.mockClear();
        dispatchReplyWithBufferedBlockDispatcher.mockClear();
        nextDispatchResult = { counts: { final: 1 }, queuedFinal: false };

        const response = {};
        const context = createTurnTestContext();

        await dispatchInboundTavernMessage({
            context,
            params: {
                agent: {
                    agentId: 'blippy',
                },
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                message: {
                    content: 'continue',
                    id: 'msg_3',
                    sentAt: '2026-05-04T12:02:00.000Z',
                },
                recentMessages: [
                    {
                        body: 'first durable chat message',
                        messageId: 'msg_1',
                        sender: 'Zach',
                        timestamp: Date.parse('2026-05-04T12:00:00.000Z'),
                    },
                    {
                        body: 'second durable chat message',
                        messageId: 'msg_2',
                        sender: 'Blippy',
                        timestamp: Date.parse('2026-05-04T12:01:00.000Z'),
                    },
                ],
                sender: {
                    id: 'zach',
                    name: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            respond: (ok, payload, error) => {
                response.ok = ok;
                response.payload = payload;
                response.error = error;
            },
            runtime: createRuntime({ dispatchReplyWithBufferedBlockDispatcher, runPrepared }),
        });

        await waitForDispatch(runPrepared);

        expect(response).toMatchObject({ ok: true });
        expect(runPrepared.mock.calls[0][0].ctxPayload.InboundHistory).toEqual([
            {
                body: 'first durable chat message',
                messageId: 'msg_1',
                sender: 'Zach',
                timestamp: Date.parse('2026-05-04T12:00:00.000Z'),
            },
            {
                body: 'second durable chat message',
                messageId: 'msg_2',
                sender: 'Blippy',
                timestamp: Date.parse('2026-05-04T12:01:00.000Z'),
            },
        ]);
    });

    it('does not persist OpenClaw new-session notices as assistant deliveries', async () => {
        runPrepared.mockClear();
        const response = {};
        const context = createTurnTestContext();
        const dispatchWithNewSessionNotice = mock(async ({ dispatcherOptions }) => {
            await dispatcherOptions.deliver({
                text: '🧭 New session: d348a369-223c-42a7-8220-67c7340810c2',
            });
            await dispatcherOptions.deliver({ text: 'gm!' });
            return { counts: { final: 2 }, queuedFinal: false };
        });

        await dispatchInboundTavernMessage({
            context,
            params: {
                agent: {
                    agentId: 'blippy',
                },
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                message: {
                    content: 'Gm',
                    id: 'msg_1',
                    sentAt: '2026-06-01T15:17:23.941Z',
                },
                sender: {
                    id: 'zach',
                    name: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            respond: (ok, payload, error) => {
                response.ok = ok;
                response.payload = payload;
                response.error = error;
            },
            runtime: createRuntime({
                dispatchReplyWithBufferedBlockDispatcher: dispatchWithNewSessionNotice,
                runPrepared,
            }),
        });

        await waitForActivityStatus(context.tavern, 'completed');

        expect(response).toMatchObject({ ok: true });
        expect(context.tavern.createDelivery).toHaveBeenCalledTimes(1);
        expect(context.tavern.createDelivery.mock.calls[0][0]).toMatchObject({
            deliveryId: 'del_1_final_1',
            messageId: 'msg_1_final_1',
            text: 'gm!',
        });
        expect(
            context.tavern.updateTurnActivity.mock.calls.map(([, input]) => input?.step)
        ).toContainEqual(
            expect.objectContaining({
                id: 'act_runtime_notice_new_session_d348a369-223c-42a7-8220-67c7340810c2',
                kind: 'custom',
                metadata: expect.objectContaining({
                    detail: 'd348a369-223c-42a7-8220-67c7340810c2',
                    runtime: expect.objectContaining({
                        notice: expect.objectContaining({
                            kind: 'new_session',
                            sessionId: 'd348a369-223c-42a7-8220-67c7340810c2',
                            title: 'Started new session',
                        }),
                    }),
                }),
                title: 'Started new session',
            })
        );
    });

    it('strips OpenClaw new-session notice prefixes from combined final replies', async () => {
        runPrepared.mockClear();
        const response = {};
        const context = createTurnTestContext();
        const dispatchWithCombinedNewSessionNotice = mock(async ({ dispatcherOptions }) => {
            await dispatcherOptions.deliver({
                text: [
                    '🧭 New session: ede39adf-cec5-4678-883c-b8215c559159',
                    '',
                    'Doing well, thanks. How are ya?',
                ].join('\n'),
            });
            return { counts: { final: 1 }, queuedFinal: false };
        });

        await dispatchInboundTavernMessage({
            context,
            params: {
                agent: {
                    agentId: 'blippy',
                },
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                message: {
                    content: 'Hi how are ya',
                    id: 'msg_1',
                    sentAt: '2026-06-01T17:55:23.941Z',
                },
                sender: {
                    id: 'zach',
                    name: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            respond: (ok, payload, error) => {
                response.ok = ok;
                response.payload = payload;
                response.error = error;
            },
            runtime: createRuntime({
                dispatchReplyWithBufferedBlockDispatcher: dispatchWithCombinedNewSessionNotice,
                runPrepared,
            }),
        });

        await waitForActivityStatus(context.tavern, 'completed');

        expect(response).toMatchObject({ ok: true });
        expect(context.tavern.createDelivery).toHaveBeenCalledTimes(1);
        expect(context.tavern.createDelivery.mock.calls[0][0]).toMatchObject({
            deliveryId: 'del_1_final_1',
            messageId: 'msg_1_final_1',
            text: 'Doing well, thanks. How are ya?',
        });
        expect(context.tavern.createDelivery.mock.calls[0][0].text).not.toContain('New session');
        expect(
            context.tavern.updateTurnActivity.mock.calls.map(([, input]) => input?.step)
        ).toContainEqual(
            expect.objectContaining({
                id: 'act_runtime_notice_new_session_ede39adf-cec5-4678-883c-b8215c559159',
                kind: 'custom',
                metadata: expect.objectContaining({
                    detail: 'ede39adf-cec5-4678-883c-b8215c559159',
                    runtime: expect.objectContaining({
                        notice: expect.objectContaining({
                            kind: 'new_session',
                            sessionId: 'ede39adf-cec5-4678-883c-b8215c559159',
                            title: 'Started new session',
                        }),
                    }),
                }),
                title: 'Started new session',
            })
        );
    });

    it('maps OpenClaw auto-compaction final notices to runtime notice activity', async () => {
        runPrepared.mockClear();
        const response = {};
        const context = createTurnTestContext();
        const dispatchWithCompactionNotice = mock(async ({ dispatcherOptions }) => {
            await dispatcherOptions.deliver({ text: '🧹 Auto-compaction complete (count 2).' });
            return { counts: { final: 1 }, queuedFinal: false };
        });

        await dispatchInboundTavernMessage({
            context,
            params: {
                agent: {
                    agentId: 'blippy',
                },
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                message: {
                    content: 'Do long work',
                    id: 'msg_1',
                    sentAt: '2026-06-01T15:17:23.941Z',
                },
                sender: {
                    id: 'zach',
                    name: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            respond: (ok, payload, error) => {
                response.ok = ok;
                response.payload = payload;
                response.error = error;
            },
            runtime: createRuntime({
                dispatchReplyWithBufferedBlockDispatcher: dispatchWithCompactionNotice,
                runPrepared,
            }),
        });

        await waitForActivityStatus(context.tavern, 'completed');

        expect(response).toMatchObject({ ok: true });
        expect(context.tavern.createDelivery).toHaveBeenCalledTimes(0);
        expect(
            context.tavern.updateTurnActivity.mock.calls.map(([, input]) => input?.step)
        ).toContainEqual(
            expect.objectContaining({
                id: 'act_runtime_notice_auto_compaction',
                kind: 'custom',
                metadata: expect.objectContaining({
                    detail: '🧹 Auto-compaction complete (count 2).',
                    runtime: expect.objectContaining({
                        notice: expect.objectContaining({
                            compactionCount: 2,
                            kind: 'auto_compaction',
                            title: 'Compacted context',
                        }),
                    }),
                }),
                title: 'Compacted context',
            })
        );
    });

    it('maps structured OpenClaw status final payloads to runtime notice activity', async () => {
        runPrepared.mockClear();
        const response = {};
        const context = createTurnTestContext();
        const dispatchWithStatusNotice = mock(async ({ dispatcherOptions }) => {
            await dispatcherOptions.deliver({
                isStatusNotice: true,
                text: 'Runtime status updated.',
            });
            return { counts: { final: 1 }, queuedFinal: false };
        });

        await dispatchInboundTavernMessage({
            context,
            params: {
                agent: {
                    agentId: 'blippy',
                },
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                message: {
                    content: 'Status please',
                    id: 'msg_1',
                    sentAt: '2026-06-01T15:17:23.941Z',
                },
                sender: {
                    id: 'zach',
                    name: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            respond: (ok, payload, error) => {
                response.ok = ok;
                response.payload = payload;
                response.error = error;
            },
            runtime: createRuntime({
                dispatchReplyWithBufferedBlockDispatcher: dispatchWithStatusNotice,
                runPrepared,
            }),
        });

        await waitForActivityStatus(context.tavern, 'completed');

        expect(response).toMatchObject({ ok: true });
        expect(context.tavern.createDelivery).toHaveBeenCalledTimes(0);
        expect(
            context.tavern.updateTurnActivity.mock.calls.map(([, input]) => input?.step)
        ).toContainEqual(
            expect.objectContaining({
                kind: 'custom',
                metadata: expect.objectContaining({
                    detail: 'Runtime status updated.',
                    runtime: expect.objectContaining({
                        notice: expect.objectContaining({
                            kind: 'status',
                            text: 'Runtime status updated.',
                        }),
                    }),
                }),
                title: 'Runtime status updated.',
            })
        );
    });

    it('keeps assistant activity to structured pre-tool preamble events', async () => {
        runPrepared.mockClear();
        const response = {};
        const context = createTurnTestContext();
        const dispatchWithPreamble = mock(async ({ dispatcherOptions, replyOptions }) => {
            await replyOptions?.onPartialReply?.({
                delta: 'I will inspect the workspace first.',
                text: 'I will inspect the workspace first.',
            });
            await replyOptions?.onItemEvent?.({
                itemId: 'msg_preamble_1',
                kind: 'preamble',
                phase: 'update',
                progressText: 'I will inspect the workspace first.',
                status: 'running',
                title: 'Preamble',
            });
            await replyOptions?.onItemEvent?.({
                itemId: 'raw-assistant-2',
                kind: 'preamble',
                phase: 'update',
                progressText: 'I will inspect the workspace first.',
                status: 'running',
                title: 'Preamble',
            });
            await replyOptions?.onItemEvent?.({
                itemId: 'tool:call_tool_1|fc_tool_1',
                kind: 'tool',
                name: 'exec',
                phase: 'start',
                status: 'running',
                title: 'exec sleep 4',
            });
            await replyOptions?.onPartialReply?.({
                delta: 'FINAL-MARKER',
                text: 'FINAL-MARKER',
            });
            await dispatcherOptions.deliver({ text: 'FINAL-MARKER' });
            return { counts: { final: 1 }, queuedFinal: false };
        });

        await dispatchInboundTavernMessage({
            context,
            params: {
                agent: {
                    agentId: 'blippy',
                },
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                message: {
                    content: 'hello',
                    id: 'msg_1',
                    sentAt: '2026-05-04T12:00:00.000Z',
                },
                sender: {
                    id: 'zach',
                    name: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            respond: (ok, payload, error) => {
                response.ok = ok;
                response.payload = payload;
                response.error = error;
            },
            runtime: createRuntime({
                dispatchReplyWithBufferedBlockDispatcher: dispatchWithPreamble,
                runPrepared,
            }),
        });

        await waitForActivityStatus(context.tavern, 'completed');

        const messageSteps = context.tavern.updateTurnActivity.mock.calls
            .map(([, input]) => input?.step)
            .filter((step) => step?.kind === 'message');

        expect(response).toMatchObject({ ok: true });
        expect(new Set(messageSteps.map((step) => step.id))).toEqual(
            new Set(['act_msg_preamble_1'])
        );
        expect(messageSteps.at(-1)).toMatchObject({
            id: 'act_msg_preamble_1',
            metadata: {
                detail: 'I will inspect the workspace first.',
            },
            title: 'Assistant reply',
        });
        expect(JSON.stringify(messageSteps)).not.toContain('FINAL-MARKER');
    });

    it('maps the OpenClaw turn callback surface into Tavern activity writes', async () => {
        runPrepared.mockClear();
        const response = {};
        const context = createTurnTestContext();
        const dispatchWithAllProgress = mock(async ({ dispatcherOptions, replyOptions }) => {
            await replyOptions?.onPlanUpdate?.({
                items: [{ status: 'in_progress', title: 'Inspect workspace' }],
            });
            await replyOptions?.onReasoningStream?.({ text: 'Reasoning through next step.' });
            await replyOptions?.onItemEvent?.({
                itemId: 'msg_preamble_1',
                kind: 'preamble',
                phase: 'update',
                progressText: 'I will run a check before using tools.',
                status: 'running',
                title: 'Preamble',
            });
            await replyOptions?.onPartialReply?.({
                delta: 'I will inspect the workspace.',
                text: 'I will inspect the workspace.',
            });
            await replyOptions?.onApprovalEvent?.({
                itemId: 'approval_1',
                status: 'running',
                title: 'Approval requested',
            });
            await replyOptions?.onPatchSummary?.({
                itemId: 'patch_1',
                status: 'completed',
                summary: 'Updated README.md',
                title: 'Patch summary',
            });
            await replyOptions?.onItemEvent?.({
                itemId: 'call_read_1',
                kind: 'tool',
                name: 'read',
                phase: 'start',
                status: 'running',
                title: 'read QA_KICKOFF_TASK.md',
            });
            await replyOptions?.onCommandOutput?.({
                itemId: 'call_read_1',
                name: 'read',
                resultText: 'QA evidence',
                status: 'completed',
                title: 'read QA_KICKOFF_TASK.md',
            });
            await replyOptions?.onItemEvent?.({
                itemId: 'call_web_fetch_2',
                kind: 'tool',
                name: 'web_fetch',
                phase: 'start',
                status: 'running',
                title: 'web_fetch docs',
            });
            await replyOptions?.onToolResult?.({
                itemId: 'call_web_fetch_2',
                name: 'web_fetch',
                resultText: 'Fetched docs',
                status: 'completed',
                title: 'web_fetch docs',
                toolCallId: 'call_web_fetch_2',
            });
            await dispatcherOptions.deliver({ text: 'FINAL-MARKER' });
            return { counts: { final: 1 }, queuedFinal: false };
        });

        await dispatchInboundTavernMessage({
            context,
            params: {
                agent: {
                    agentId: 'blippy',
                },
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                message: {
                    content: 'exercise progress callbacks',
                    id: 'msg_1',
                    sentAt: '2026-05-04T12:00:00.000Z',
                },
                sender: {
                    id: 'zach',
                    name: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            respond: (ok, payload, error) => {
                response.ok = ok;
                response.payload = payload;
                response.error = error;
            },
            runtime: createRuntime({
                dispatchReplyWithBufferedBlockDispatcher: dispatchWithAllProgress,
                runPrepared,
            }),
        });

        await waitForActivityStatus(context.tavern, 'completed');

        const steps = context.tavern.updateTurnActivity.mock.calls
            .map(([, input]) => input?.step)
            .filter(Boolean);

        expect(response).toMatchObject({ ok: true });
        expect(steps.map((step) => step.kind)).toEqual(
            expect.arrayContaining([
                'planning',
                'reasoning',
                'message',
                'approval',
                'artifact',
                'tool_call',
            ])
        );
        expect(steps.find((step) => step.id === 'act_msg_preamble_1')).toMatchObject({
            detail: 'I will run a check before using tools.',
            kind: 'message',
            status: 'running',
            title: 'Assistant reply',
        });
        expect(steps.filter((step) => step.kind === 'message')).toHaveLength(1);
        expect(steps.find((step) => step.kind === 'approval')).toMatchObject({
            id: 'act_approval_1',
            status: 'running',
            title: 'Approval requested',
        });
        expect(steps.find((step) => step.kind === 'artifact')).toMatchObject({
            id: 'act_patch_1',
            status: 'completed',
            title: 'Patch summary',
        });
        expect(
            steps.filter((step) => step.id === 'act_call_read_1').map((step) => step.status)
        ).toEqual(expect.arrayContaining(['running', 'completed']));
        expect(
            steps.find((step) => step.id === 'act_call_web_fetch_2' && step.status === 'completed')
        ).toMatchObject({
            status: 'completed',
            title: 'web_fetch docs',
        });
    });

    it('reconciles transcript tool details into the canonical live tool activity row', async () => {
        runPrepared.mockClear();
        const response = {};
        const context = createTurnTestContext();
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-tool-reconcile-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const transcriptPath = join(tempDir, 'session.jsonl');
        const sessionKey = 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
        await writeFile(
            storePath,
            `${JSON.stringify({
                [sessionKey]: {
                    sessionFile: transcriptPath,
                    sessionId: 'session-1',
                },
            })}\n`
        );
        await writeFile(
            transcriptPath,
            `${JSON.stringify({
                cwd: '/tmp',
                id: 'session-1',
                timestamp: '2026-05-04T11:59:00.000Z',
                type: 'session',
                version: 3,
            })}\n`
        );
        const dispatchWithToolTranscript = mock(async ({ dispatcherOptions, replyOptions }) => {
            await replyOptions?.onItemEvent?.({
                itemId: 'call_123',
                kind: 'command',
                name: 'bash',
                phase: 'start',
                status: 'running',
                title: 'Command',
            });
            await replyOptions?.onItemEvent?.({
                itemId: 'call_123',
                kind: 'command',
                name: 'bash',
                phase: 'end',
                status: 'completed',
                title: 'Command',
            });
            await writeFile(
                transcriptPath,
                `${[
                    JSON.stringify({
                        id: 'tool-call-message',
                        message: {
                            content: [
                                {
                                    arguments: {
                                        command: "/bin/zsh -lc 'sleep 3'",
                                    },
                                    id: 'call_123',
                                    name: 'bash',
                                    type: 'toolCall',
                                },
                            ],
                            role: 'assistant',
                        },
                        parentId: null,
                        timestamp: '2026-05-04T12:00:01.000Z',
                        type: 'message',
                    }),
                    JSON.stringify({
                        id: 'tool-result-message',
                        message: {
                            content: [{ text: 'done', type: 'text' }],
                            role: 'toolResult',
                            toolCallId: 'call_123',
                        },
                        parentId: null,
                        timestamp: '2026-05-04T12:00:04.000Z',
                        type: 'message',
                    }),
                ].join('\n')}\n`,
                { flag: 'a' }
            );
            await dispatcherOptions.deliver({ text: 'Done.' });
            return { counts: { final: 1 }, queuedFinal: false };
        });

        try {
            await dispatchInboundTavernMessage({
                context,
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'run a shell tool',
                        id: 'msg_1',
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
                    dispatchReplyWithBufferedBlockDispatcher: dispatchWithToolTranscript,
                    runPrepared,
                    storePath,
                }),
            });

            await waitForActivityStatus(context.tavern, 'completed');

            const toolSteps = context.tavern.updateTurnActivity.mock.calls
                .map(([, input]) => input?.step)
                .filter(Boolean)
                .filter((step) => step.id === 'act_call_123');

            expect(response).toMatchObject({ ok: true });
            expect(toolSteps.map((step) => step.id)).toEqual([
                'act_call_123',
                'act_call_123',
                'act_call_123',
            ]);
            expect(JSON.stringify(context.tavern.updateTurnActivity.mock.calls)).not.toContain(
                'act_call_read_123'
            );
            expect(JSON.stringify(context.tavern.updateTurnActivity.mock.calls)).not.toContain(
                'Command'
            );
            expect(toolSteps[0]).toMatchObject({
                status: 'running',
                title: 'bash',
            });
            expect(toolSteps[1]).toMatchObject({
                status: 'completed',
                title: 'bash',
            });
            expect(toolSteps.at(-1)).toMatchObject({
                metadata: {
                    runtime: {
                        toolCallId: 'call_123',
                        toolName: 'bash',
                    },
                    tool: {
                        arguments: {
                            command: "/bin/zsh -lc 'sleep 3'",
                        },
                        name: 'bash',
                        result: 'done',
                    },
                },
                status: 'completed',
                title: "bash /bin/zsh -lc 'sleep 3'",
            });
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('persists the accepted inbound message before waiting for the final reply', async () => {
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;

        let releaseDispatch = () => undefined;
        const response = {};
        const context = createTurnTestContext();
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-accepted-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const sessionKey = 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
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
                context,
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'hello before final',
                        id: 'msg_1',
                        nonce: 'msg_1',
                        sequence: 7,
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
                messageId: 'msg_1',
                metadata: {
                    tavern: {
                        acceptedMessageId: 'msg_1',
                        acceptedRunId: 'run_1',
                        nonce: 'msg_1',
                        sequence: 7,
                        sessionKey,
                    },
                },
                nonce: 'msg_1',
                role: 'user',
                sequence: 7,
                sessionKey,
            });
            expect(transcriptUpdates[0]).toMatchObject({
                sessionKey,
            });

            await waitForMockCallCount(blockingDispatch, 1);
            releaseDispatch();
            await waitForActivityStatus(context.tavern, 'completed');
        } finally {
            releaseDispatch();
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('writes turn failure activity when OpenClaw finishes without a final reply', async () => {
        runPrepared.mockClear();
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;
        nextDispatchResult = { counts: { final: 0 }, queuedFinal: false };
        const silentDispatch = mock(async () => nextDispatchResult);

        const response = {};
        const context = createTurnTestContext();
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const transcriptPath = join(tempDir, 'session.jsonl');
        await writeFile(
            storePath,
            `${JSON.stringify({
                'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3': {
                    sessionFile: transcriptPath,
                    sessionId: 'session-1',
                },
            })}\n`
        );

        try {
            await dispatchInboundTavernMessage({
                context,
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'use web search',
                        id: 'msg_1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey:
                        'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
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

            await waitForActivityStatus(context.tavern, 'failed');
            await waitForMockCallCount(appendSessionTranscriptMessage, 2);
            await waitForMockCallCount(emitSessionTranscriptUpdate, 2);

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });
            expect(lastActivityInput(context.tavern, 'failed')).toMatchObject({
                status: 'failed',
                summary: 'OpenClaw turn ended before producing a reply.',
            });
            expect(appendSessionTranscriptMessage).toHaveBeenCalledTimes(2);
            const persistedTranscriptPath = transcriptUpdates[0]?.sessionFile;

            expect(transcriptUpdates[0]).toMatchObject({
                message: {
                    chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    messageId: 'msg_1',
                    role: 'user',
                    senderName: 'Zach',
                },
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            });
            expect(transcriptUpdates[1]).toMatchObject({
                message: {
                    messageId: 'tavern-turn-failure:run_1',
                    metadata: {
                        tavern: {
                            turnFailure: {
                                messageId: 'msg_1',
                                runId: 'run_1',
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
        const context = createTurnTestContext();
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-observed-delivery-test-'));
        const storePath = join(tempDir, 'sessions.json');
        await writeFile(storePath, '{}\n');

        try {
            await dispatchInboundTavernMessage({
                context,
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'use read then answer',
                        id: 'msg_1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey:
                        'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
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

            await waitForActivityStatus(context.tavern, 'completed');

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });
            expect(hasActivityStatus(context.tavern, 'failed')).toBe(false);
            expect(context.tavern.createDelivery.mock.calls[0][0]).toMatchObject({
                text: 'reply',
            });
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
        const context = createTurnTestContext();
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-repeat-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const transcriptPath = join(tempDir, 'session.jsonl');
        await writeFile(
            storePath,
            `${JSON.stringify({
                'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3': {
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
                        chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                        content: [{ text: 'use web search', type: 'text' }],
                        messageId: 'msg_0',
                        role: 'user',
                        sender: 'Zach',
                        senderId: 'zach',
                        senderName: 'Zach',
                        sessionKey:
                            'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
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
                context,
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'use web search',
                        id: 'msg_1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey:
                        'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
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

            await waitForActivityStatus(context.tavern, 'failed');
            await waitForMockCallCount(appendSessionTranscriptMessage, 2);

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });

            const transcript = await readFile(transcriptPath, 'utf8');
            expect(transcript).toContain('"messageId":"msg_0"');
            expect(transcript).toContain('"messageId":"msg_1"');
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
        const context = createTurnTestContext();
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-session-id-test-'));
        const storePath = join(tempDir, 'sessions.json');
        await writeFile(
            storePath,
            `${JSON.stringify({
                'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3': {
                    sessionId: 'session-1',
                },
            })}\n`
        );

        try {
            await dispatchInboundTavernMessage({
                context,
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'use web search',
                        id: 'msg_1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey:
                        'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
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

            await waitForActivityStatus(context.tavern, 'failed');
            await waitForMockCallCount(appendSessionTranscriptMessage, 2);

            const nextStore = JSON.parse(await readFile(storePath, 'utf8'));
            const transcriptPath =
                nextStore['agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3']
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
        const context = createTurnTestContext();
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
                'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3': {
                    sessionFile: transcriptPath,
                    sessionId: 'session-1',
                },
            })}\n`
        );

        try {
            await dispatchInboundTavernMessage({
                context,
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'hi',
                        id: 'msg_1',
                        sentAt: '2026-05-04T12:00:00.000Z',
                    },
                    sender: {
                        id: 'zach',
                        name: 'Zach',
                    },
                    sessionKey:
                        'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
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

            await waitForActivityStatus(context.tavern, 'failed');
            await waitForMockCallCount(appendSessionTranscriptMessage, 2);

            expect(response).toMatchObject({
                ok: true,
                payload: {
                    status: 'accepted',
                },
            });
            expect(lastActivityInput(context.tavern, 'failed')).toMatchObject({
                summary: authError,
            });

            const nextStore = JSON.parse(await readFile(storePath, 'utf8'));
            const persistedTranscriptPath =
                nextStore['agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3']
                    ?.sessionFile;

            expect(typeof persistedTranscriptPath).toBe('string');

            const transcript = await readFile(persistedTranscriptPath, 'utf8');
            expect(transcript).toContain(authError);
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });

    it('persists delivered OpenClaw error replies when the turn completes with a visible final delivery', async () => {
        appendSessionTranscriptMessage.mockClear();
        emitSessionTranscriptUpdate.mockClear();
        transcriptUpdates.length = 0;
        const response = {};
        const context = createTurnTestContext();
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-delivered-error-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const sessionKey = 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
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
                context,
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'hi',
                        id: 'msg_1',
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

            await waitForActivityStatus(context.tavern, 'completed');
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
            expect(context.tavern.createDelivery.mock.calls[0][0]).toMatchObject({
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
        const context = createTurnTestContext();
        const tempDir = await mkdtemp(join(tmpdir(), 'tavern-turn-meta-task-test-'));
        const storePath = join(tempDir, 'sessions.json');
        const sessionKey = 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
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
                context,
                params: {
                    agent: {
                        agentId: 'blippy',
                    },
                    chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    message: {
                        content: 'hi',
                        id: 'msg_1',
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

            await waitForDispatch(failingRunPrepared);
            releaseSessionMetaTask();

            await waitForActivityStatus(context.tavern, 'failed');
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
            expect(transcript).toContain('"messageId":"msg_1"');
            expect(transcript).toContain(authError);
        } finally {
            await rm(tempDir, { force: true, recursive: true });
        }
    });
});
