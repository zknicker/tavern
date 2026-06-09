import WebSocket from 'ws';

interface HermesGatewayOptions {
    baseUrl: string;
    token: string | null;
}

interface JsonRpcResponse {
    error?: { code?: number; message?: string };
    id?: string | number | null;
    result?: unknown;
}

interface HermesGatewayEvent {
    payload: Record<string, unknown>;
    sessionId: string | null;
    type: string;
}

interface PendingRequest {
    reject: (error: Error) => void;
    resolve: (value: unknown) => void;
}

export class HermesGateway {
    readonly #baseUrl: string;
    readonly #token: string | null;
    #nextId = 1;
    #opened: Promise<void> | null = null;
    readonly #pending = new Map<string, PendingRequest>();
    readonly #eventQueues = new Set<AsyncQueue<HermesGatewayEvent>>();
    #socket: WebSocket | null = null;

    constructor(options: HermesGatewayOptions) {
        this.#baseUrl = options.baseUrl.replace(/\/$/u, '');
        this.#token = options.token;
    }

    async connect() {
        await this.#connect();
    }

    async request<T>(method: string, params: Record<string, unknown> = {}) {
        await this.#connect();
        const socket = this.#socket;
        if (!(socket && socket.readyState === WebSocket.OPEN)) {
            throw new Error('Hermes gateway is not connected');
        }

        const id = String(this.#nextId++);
        const result = new Promise<unknown>((resolve, reject) => {
            this.#pending.set(id, { reject, resolve });
        });

        socket.send(JSON.stringify({ id, jsonrpc: '2.0', method, params }));
        return (await result) as T;
    }

    events(options: { sessionId?: string | null; signal?: AbortSignal } = {}) {
        const queue = new AsyncQueue<HermesGatewayEvent>();
        const eventQueues = this.#eventQueues;
        let closed = false;
        const close = () => {
            if (closed) {
                return;
            }
            closed = true;
            eventQueues.delete(queue);
            queue.close();
        };
        this.#eventQueues.add(queue);

        return {
            close,
            async *[Symbol.asyncIterator]() {
                try {
                    while (!options.signal?.aborted) {
                        const event = await queue.shift(options.signal);
                        if (!event) {
                            return;
                        }
                        if (options.sessionId && event.sessionId !== options.sessionId) {
                            continue;
                        }
                        yield event;
                    }
                } finally {
                    close();
                }
            },
        };
    }

    #emitEvent(event: HermesGatewayEvent) {
        for (const queue of this.#eventQueues) {
            queue.push(event);
        }
    }

    #closeEventQueues() {
        for (const queue of this.#eventQueues) {
            queue.close();
        }
        this.#eventQueues.clear();
    }

    close() {
        this.#opened = null;
        this.#closeEventQueues();
        for (const request of this.#pending.values()) {
            request.reject(new Error('Hermes gateway connection closed'));
        }
        this.#pending.clear();
        this.#socket?.close();
        this.#socket = null;
    }

    async #connect() {
        if (this.#opened) {
            return this.#opened;
        }

        this.#opened = new Promise((resolve, reject) => {
            const socket = new WebSocket(this.#webSocketUrl());
            this.#socket = socket;

            socket.once('open', () => resolve());
            socket.once('error', (error) => {
                this.close();
                reject(error);
            });
            socket.on('close', () => this.close());
            socket.on('message', (message) => this.#handleMessage(message.toString()));
        });

        return this.#opened;
    }

    #handleMessage(raw: string) {
        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }

            const message = safeJsonParse(trimmed);
            if (!message) {
                continue;
            }

            if (message.method === 'event') {
                const params = asRecord(message.params);
                const type = readString(params.type) ?? '';
                if (type) {
                    this.#emitEvent({
                        payload: asRecord(params.payload),
                        sessionId: readString(params.session_id),
                        type,
                    });
                }
                continue;
            }

            const response = message as JsonRpcResponse;
            const id = typeof response.id === 'string' ? response.id : String(response.id ?? '');
            const request = this.#pending.get(id);
            if (!request) {
                continue;
            }
            this.#pending.delete(id);

            if (response.error) {
                request.reject(
                    new Error(response.error.message ?? 'Hermes gateway request failed')
                );
            } else {
                request.resolve(response.result);
            }
        }
    }

    #webSocketUrl() {
        const url = new URL(this.#baseUrl);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.pathname = '/api/ws';
        url.search = '';
        if (this.#token) {
            url.searchParams.set('token', this.#token);
        }
        return url.toString();
    }
}

class AsyncQueue<T> {
    #closed = false;
    readonly #items: T[] = [];
    #waiters: ((item: T | null) => void)[] = [];

    push(item: T) {
        const waiter = this.#waiters.shift();
        if (waiter) {
            waiter(item);
            return;
        }
        this.#items.push(item);
    }

    shift(signal?: AbortSignal) {
        const item = this.#items.shift();
        if (item) {
            return Promise.resolve(item);
        }
        if (this.#closed || signal?.aborted) {
            return Promise.resolve(null);
        }
        return new Promise<T | null>((resolve) => {
            const abort = () => {
                this.#waiters = this.#waiters.filter((waiter) => waiter !== resolve);
                resolve(null);
            };
            signal?.addEventListener('abort', abort, { once: true });
            this.#waiters.push((value) => {
                signal?.removeEventListener('abort', abort);
                resolve(value);
            });
        });
    }

    close() {
        this.#closed = true;
        for (const waiter of this.#waiters) {
            waiter(null);
        }
        this.#waiters = [];
    }
}

function safeJsonParse(raw: string) {
    try {
        return asRecord(JSON.parse(raw));
    } catch {
        return null;
    }
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : null;
}
