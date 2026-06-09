import { hermesFetchError } from './errors';
import type { HermesSseEvent, LocalHermesClientOptions } from './protocol';
import { parseSse } from './sse';

export class HermesHttp {
    readonly #baseUrl: string;
    readonly #token: string | null;

    constructor(options: LocalHermesClientOptions) {
        this.#baseUrl = options.baseUrl.replace(/\/$/u, '');
        this.#token = options.token;
    }

    async get(pathname: string) {
        const response = await fetch(`${this.#baseUrl}${pathname}`, {
            headers: this.#headers(),
        });
        if (!response.ok) {
            throw await hermesFetchError(response);
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            return (await response.json()) as unknown;
        }
        return await response.text();
    }

    async post(pathname: string, body: unknown) {
        const response = await fetch(`${this.#baseUrl}${pathname}`, {
            body: JSON.stringify(body),
            headers: this.#headers(),
            method: 'POST',
        });
        if (!response.ok && response.status !== 409) {
            throw await hermesFetchError(response);
        }
    }

    async postJson(pathname: string, body: unknown) {
        const response = await fetch(`${this.#baseUrl}${pathname}`, {
            body: JSON.stringify(body),
            headers: this.#headers(),
            method: 'POST',
        });
        if (!response.ok && response.status !== 409) {
            throw await hermesFetchError(response);
        }
        const contentType = response.headers.get('content-type') ?? '';
        return contentType.includes('application/json') ? ((await response.json()) as unknown) : {};
    }

    async putJson(pathname: string, body: unknown) {
        const response = await fetch(`${this.#baseUrl}${pathname}`, {
            body: JSON.stringify(body),
            headers: this.#headers(),
            method: 'PUT',
        });
        if (!response.ok && response.status !== 409) {
            throw await hermesFetchError(response);
        }
        const contentType = response.headers.get('content-type') ?? '';
        return contentType.includes('application/json') ? ((await response.json()) as unknown) : {};
    }

    async *streamPost(
        pathname: string,
        body: unknown,
        signal?: AbortSignal
    ): AsyncGenerator<HermesSseEvent> {
        const response = await fetch(`${this.#baseUrl}${pathname}`, {
            body: JSON.stringify(body),
            headers: this.#headers({ accept: 'text/event-stream' }),
            method: 'POST',
            signal,
        });
        if (!(response.ok && response.body)) {
            throw await hermesFetchError(response);
        }

        yield* parseSse(response.body);
    }

    #headers(options?: { accept?: string }) {
        return {
            ...(options?.accept ? { Accept: options.accept } : {}),
            'Content-Type': 'application/json',
            ...(this.#token
                ? {
                      Authorization: `Bearer ${this.#token}`,
                      'X-Hermes-Session-Token': this.#token,
                  }
                : {}),
        };
    }
}
