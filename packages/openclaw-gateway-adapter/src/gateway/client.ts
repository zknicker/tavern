import { buildConnectParams, defaultOpenClawOperatorScopes } from './auth.ts';
import { OpenClawGatewayError } from './errors.ts';
import { waitForOpenOrChallenge } from './open.ts';
import {
    type OpenClawGatewayResponseFrame,
    openClawGatewayFrameSchema,
    openClawGatewayHelloSchema,
} from './schemas.ts';
import type {
    OpenClawGatewayClient,
    OpenClawGatewayEvent,
    OpenClawGatewayEventHandler,
    OpenClawGatewayOptions,
} from './types.ts';

const defaultRequestTimeoutMs = 15_000;

interface PendingRequest {
    reject: (error: Error) => void;
    resolve: (payload: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
}

export function createOpenClawGatewayClient(
    options: OpenClawGatewayOptions
): OpenClawGatewayClient {
    return new WebSocketOpenClawGatewayClient(options);
}

class WebSocketOpenClawGatewayClient implements OpenClawGatewayClient {
    readonly #closeHandlers = new Set<() => void>();
    readonly #events = new Set<OpenClawGatewayEventHandler>();
    readonly #options: OpenClawGatewayOptions;
    readonly #pending = new Map<string, PendingRequest>();
    #connectPromise: Promise<void> | null = null;
    #socket: WebSocket | null = null;

    constructor(options: OpenClawGatewayOptions) {
        this.#options = options;
    }

    async connect() {
        if (this.#socket?.readyState === WebSocket.OPEN) {
            return;
        }

        if (this.#connectPromise) {
            return this.#connectPromise;
        }

        this.#connectPromise = this.#open();

        try {
            await this.#connectPromise;
        } finally {
            this.#connectPromise = null;
        }
    }

    close() {
        for (const request of this.#pending.values()) {
            clearTimeout(request.timeout);
            request.reject(
                new OpenClawGatewayError({
                    code: 'openclaw_gateway_closed',
                    message: 'OpenClaw Gateway connection closed.',
                    retryable: true,
                })
            );
        }

        this.#pending.clear();
        this.#socket?.close();
        this.#socket = null;
    }

    onEvent(handler: OpenClawGatewayEventHandler) {
        this.#events.add(handler);

        return () => {
            this.#events.delete(handler);
        };
    }

    onClose(handler: () => void) {
        this.#closeHandlers.add(handler);

        return () => {
            this.#closeHandlers.delete(handler);
        };
    }

    async request<TPayload = unknown>(method: string, params?: unknown): Promise<TPayload> {
        await this.connect();

        const socket = this.#socket;

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            throw new OpenClawGatewayError({
                code: 'openclaw_gateway_not_connected',
                message: 'OpenClaw Gateway is not connected.',
                retryable: true,
            });
        }

        const id = crypto.randomUUID();
        const timeoutMs = this.#options.requestTimeoutMs ?? defaultRequestTimeoutMs;

        const promise = new Promise<TPayload>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.#pending.delete(id);
                reject(
                    new OpenClawGatewayError({
                        code: 'openclaw_gateway_timeout',
                        message: `OpenClaw Gateway request "${method}" timed out.`,
                        retryable: true,
                    })
                );
            }, timeoutMs);

            this.#pending.set(id, {
                reject,
                resolve: (payload) => resolve(payload as TPayload),
                timeout,
            });
        });

        socket.send(
            JSON.stringify({
                id,
                method,
                params: params ?? {},
                type: 'req',
            })
        );

        return promise;
    }

    async #open() {
        const socket = new WebSocket(this.#options.gatewayUrl);
        this.#socket = socket;

        const challengeNonce = await waitForOpenOrChallenge({
            hasDevice: Boolean(this.#options.device),
            socket,
            timeoutMs: this.#options.requestTimeoutMs ?? defaultRequestTimeoutMs,
        });

        socket.addEventListener('message', (event) => {
            this.#handleMessage(String(event.data));
        });

        socket.addEventListener('close', () => {
            this.#rejectPendingClose();
            for (const handler of this.#closeHandlers) {
                handler();
            }
        });

        const payload = await this.request('connect', await this.#connectParams(challengeNonce));
        openClawGatewayHelloSchema.parse(payload);
    }

    async #connectParams(challengeNonce: string | null) {
        return await buildConnectParams({
            auth: this.#options.auth,
            challengeNonce,
            clientId: this.#options.clientId ?? 'gateway-client',
            clientMode: this.#options.clientMode ?? 'backend',
            clientVersion: this.#options.clientVersion ?? '0.1.0',
            device: this.#options.device,
            scopes: [...(this.#options.scopes ?? defaultOpenClawOperatorScopes)],
            userAgent: this.#options.userAgent ?? 'tavern/openclaw-gateway-adapter',
        });
    }

    #handleMessage(raw: string) {
        const parsedJson = JSON.parse(raw) as unknown;
        const parsed = openClawGatewayFrameSchema.safeParse(parsedJson);

        if (!parsed.success) {
            return;
        }

        if (parsed.data.type === 'event') {
            const event: OpenClawGatewayEvent = {
                event: parsed.data.event,
                payload: parsed.data.payload,
                seq: parsed.data.seq,
                stateVersion: parsed.data.stateVersion,
            };

            for (const handler of this.#events) {
                handler(event);
            }

            return;
        }

        this.#handleResponse(parsed.data);
    }

    #handleResponse(response: OpenClawGatewayResponseFrame) {
        const pending = this.#pending.get(response.id);

        if (!pending) {
            return;
        }

        clearTimeout(pending.timeout);
        this.#pending.delete(response.id);

        if (response.ok) {
            pending.resolve(response.payload);
            return;
        }

        pending.reject(
            new OpenClawGatewayError({
                code: response.error?.code ?? 'openclaw_gateway_request_failed',
                details: response.error?.details,
                message: response.error?.message ?? 'OpenClaw Gateway request failed.',
                retryAfterMs: response.error?.retryAfterMs ?? null,
                retryable: response.error?.retryable ?? false,
            })
        );
    }

    #rejectPendingClose() {
        this.#socket = null;

        for (const request of this.#pending.values()) {
            clearTimeout(request.timeout);
            request.reject(
                new OpenClawGatewayError({
                    code: 'openclaw_gateway_closed',
                    message: 'OpenClaw Gateway connection closed.',
                    retryable: true,
                })
            );
        }

        this.#pending.clear();
    }
}
