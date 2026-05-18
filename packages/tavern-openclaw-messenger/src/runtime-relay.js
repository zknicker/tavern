import { getTavernChannelRuntime } from './runtime.js';
import { createTavernPluginApi, deriveTavernApiBaseUrl } from './tavern-api.js';
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
        baseUrl: process.env.TAVERN_API_BASE_URL ?? deriveTavernApiBaseUrl(url),
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
                url,
                value: event.data,
            }).catch((error) => {
                sendFrame(socket, {
                    event: 'tavern.relay.error',
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

async function handleRelayMessage({ socket, url, value }) {
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
            tavern: createTavernPluginApi({
                baseUrl: process.env.TAVERN_API_BASE_URL ?? deriveTavernApiBaseUrl(url),
            }),
        },
    });
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
