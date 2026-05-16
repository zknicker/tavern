import { getTavernChannelRuntime } from './runtime.js';
import { handleTavernInboundMessage } from './turn.js';

const reconnectDelayMs = 500;

export async function startTavernGatewayAccount(ctx) {
    const url = process.env.TAVERN_RUNTIME_CHANNEL_URL;

    if (!url) {
        throw new Error('TAVERN_RUNTIME_CHANNEL_URL is required for Tavern channel relay.');
    }

    ctx.setStatus?.({
        accountId: ctx.account?.accountId ?? 'default',
        configured: true,
        enabled: true,
        running: true,
        baseUrl: url,
    });

    while (!ctx.abortSignal.aborted) {
        try {
            await runRelayConnection({ ctx, url });
        } catch (error) {
            if (ctx.abortSignal.aborted) {
                break;
            }
            ctx.log?.warn?.(
                `Tavern runtime relay disconnected: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        await sleep(reconnectDelayMs, ctx.abortSignal).catch(() => undefined);
    }

    ctx.setStatus?.({
        accountId: ctx.account?.accountId ?? 'default',
        running: false,
    });
}

function runRelayConnection({ ctx, url }) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url);
        const close = () => {
            try {
                socket.close();
            } catch {
                // Already closed.
            }
        };
        const abort = () => {
            close();
            resolve();
        };

        ctx.abortSignal.addEventListener('abort', abort, { once: true });

        socket.addEventListener('open', () => {
            ctx.log?.info?.('Tavern runtime relay connected.');
        });
        socket.addEventListener('message', (event) => {
            void handleRelayMessage({
                socket,
                value: event.data,
            }).catch((error) => {
                sendFrame(socket, {
                    event: 'plugin.tavern.relay.error',
                    kind: 'runtime-log',
                    payload: {
                        error: error instanceof Error ? error.message : String(error),
                    },
                });
            });
        });
        socket.addEventListener('error', () => {
            reject(new Error('Tavern runtime relay socket failed.'));
        });
        socket.addEventListener('close', () => {
            ctx.abortSignal.removeEventListener('abort', abort);
            resolve();
        });
    });
}

async function handleRelayMessage({ socket, value }) {
    const event = JSON.parse(String(value));

    if (event.kind !== 'inbound-message') {
        return;
    }

    await handleTavernInboundMessage({
        event,
        runtime: getTavernChannelRuntime(),
        sendAccepted: (accepted) =>
            sendFrame(socket, {
                accepted,
                kind: 'message-accepted',
                requestId: event.requestId,
            }),
        context: {
            broadcast: (name, payload) => {
                const runtimeEvent = mapTavernPluginEvent(name, payload);

                if (runtimeEvent) {
                    sendFrame(socket, {
                        deliveryId:
                            payload && typeof payload === 'object'
                                ? readString(payload.deliveryId)
                                : undefined,
                        event: runtimeEvent,
                        kind: 'runtime-event',
                    });
                    return;
                }

                sendFrame(socket, {
                    event: name,
                    kind: 'runtime-log',
                    payload: payload && typeof payload === 'object' ? payload : {},
                });
            },
        },
    });
}

function mapTavernPluginEvent(name, payload) {
    const timestamp = new Date().toISOString();
    const turn = readTurn(payload, timestamp);

    if (!turn) {
        return null;
    }

    if (name === 'plugin.tavern.turn.started') {
        return {
            timestamp,
            turn,
            type: 'turn.started',
        };
    }

    if (name === 'plugin.tavern.message.created') {
        return {
            isThinking: false,
            replace: true,
            text: typeof payload.text === 'string' ? payload.text : '',
            timestamp,
            turn,
            type: 'turn.replyUpdated',
        };
    }

    if (name === 'plugin.tavern.turn.progress') {
        const step = readProgressStep(payload);

        if (!step) {
            return null;
        }

        return {
            step,
            timestamp,
            turn,
            type: 'turn.progress',
        };
    }

    if (name === 'plugin.tavern.turn.completed') {
        return {
            timestamp,
            turn,
            type: 'turn.completed',
        };
    }

    if (name === 'plugin.tavern.turn.failed') {
        return {
            error: String(payload.error ?? 'OpenClaw Tavern turn failed.'),
            timestamp,
            turn,
            type: 'turn.failed',
        };
    }

    return null;
}

function readTurn(payload, fallbackTimestamp) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    if (!(payload.agentId && payload.chatId && payload.runId && payload.sessionKey)) {
        return null;
    }

    return {
        agentId: String(payload.agentId),
        chatId: String(payload.chatId),
        runId: String(payload.runId),
        sessionKey: String(payload.sessionKey),
        startedAt: readDate(payload.startedAt) ?? fallbackTimestamp,
    };
}

function readDate(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function readProgressStep(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const rawStep = payload.step && typeof payload.step === 'object' ? payload.step : payload;
    const id = readString(rawStep.id ?? rawStep.stepId);
    const label = readString(rawStep.label);
    const kind = readProgressKind(rawStep.kind);
    const status = readProgressStatus(rawStep.status);

    if (!(id && label && kind && status)) {
        return null;
    }

    return {
        detail: readString(rawStep.detail) ?? null,
        id,
        kind,
        label,
        status,
    };
}

function readProgressKind(value) {
    return ['command', 'message', 'plan', 'reasoning', 'tool'].includes(value) ? value : null;
}

function readProgressStatus(value) {
    return ['active', 'completed', 'failed'].includes(value) ? value : null;
}

function readString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function sendFrame(socket, frame) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(frame));
    }
}

function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                reject(new Error('aborted'));
            },
            { once: true }
        );
    });
}
