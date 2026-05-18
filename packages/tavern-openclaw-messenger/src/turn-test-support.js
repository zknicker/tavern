import { mock } from 'bun:test';

export function createRuntime({
    dispatchReplyWithBufferedBlockDispatcher,
    recordInboundSession = mock(() => undefined),
    runPrepared,
    runAssembled,
    storePath = '/tmp/tavern-sessions.json',
} = {}) {
    const config = {};

    return {
        channel: {
            reply: {
                dispatchReplyWithBufferedBlockDispatcher,
            },
            session: {
                recordInboundSession,
                resolveStorePath: () => storePath,
            },
            turn: {
                buildContext: buildContextPayload,
                runAssembled:
                    runAssembled ??
                    createRunAssembledFromPrepared({
                        dispatchReplyWithBufferedBlockDispatcher,
                        runPrepared,
                    }),
                runPrepared,
            },
        },
        config: {
            current: () => config,
        },
    };
}

function createRunAssembledFromPrepared({ dispatchReplyWithBufferedBlockDispatcher, runPrepared }) {
    return async (params) =>
        await runPrepared({
            accountId: params.accountId,
            channel: params.channel,
            ctxPayload: params.ctxPayload,
            messageId: params.messageId,
            record: params.record,
            recordInboundSession: params.recordInboundSession,
            routeSessionKey: params.routeSessionKey,
            storePath: params.storePath,
            runDispatch: async () =>
                await dispatchReplyWithBufferedBlockDispatcher({
                    cfg: params.cfg,
                    ctx: params.ctxPayload,
                    dispatcherOptions: {
                        deliver: async (payload, info = { kind: 'final' }) => {
                            const result = await params.delivery.deliver(payload, info);
                            await params.delivery.onDelivered?.(payload, info, result);
                            return result;
                        },
                        onError: params.delivery.onError,
                    },
                    replyOptions: params.replyOptions,
                }),
        });
}

export async function waitForDispatch(runPrepared) {
    for (let index = 0; index < 10; index += 1) {
        if (runPrepared.mock.calls.length > 0) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error('runPrepared was not called.');
}

export async function waitForMockCallCount(mockFn, count) {
    for (let index = 0; index < 100; index += 1) {
        if (mockFn.mock.calls.length >= count) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(`Expected ${count} mock calls.`);
}

function buildContextPayload(params) {
    return {
        AccountId: params.accountId,
        BodyForAgent: params.message.bodyForAgent,
        ...(params.extra ?? {}),
        ChatType: params.conversation.kind,
        CommandAuthorized: params.access.commands.authorizers.some((entry) => entry.allowed),
        From: params.from,
        InboundHistory: params.message.inboundHistory,
        NativeChannelId: params.reply.nativeChannelId,
        OriginatingChannel: params.channel,
        OriginatingTo: params.reply.originatingTo,
        Provider: params.channel,
        RawBody: params.message.rawBody,
        SenderId: params.sender.id,
        SenderName: params.sender.name,
        SessionKey: params.route.routeSessionKey,
        Surface: params.channel,
        Timestamp: params.timestamp,
        To: params.reply.to,
    };
}
