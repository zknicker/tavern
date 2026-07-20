import type { IncomingMessage, ServerResponse } from 'node:http';

export const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json',
        },
    });

export const badRequest = (message: string) =>
    json(
        {
            code: 'bad_request',
            message,
            retryable: false,
        },
        400
    );

export const unauthorized = (message: string) =>
    json(
        {
            code: 'unauthorized',
            message,
            retryable: false,
        },
        401
    );

export const forbidden = (message: string) =>
    json(
        {
            code: 'forbidden',
            message,
            retryable: false,
        },
        403
    );

export const conflict = (message: string) =>
    json(
        {
            code: 'conflict',
            message,
            retryable: false,
        },
        409
    );

export const payloadTooLarge = (message: string) =>
    json(
        {
            code: 'payload_too_large',
            message,
            retryable: false,
        },
        413
    );

export const notFound = () =>
    json(
        {
            code: 'not_found',
            message: 'Not found',
            retryable: false,
        },
        404
    );

export const internalError = (message: string) =>
    json(
        {
            code: 'internal_error',
            message,
            retryable: true,
        },
        500
    );

export async function readJson(request: Request) {
    return await request.json();
}

export const maxTavernRuntimeRequestBodyBytes = 12 * 1024 * 1024;

export class RequestBodyTooLargeError extends Error {
    constructor() {
        super('Tavern Runtime request body exceeds the 12 MiB limit.');
        this.name = 'RequestBodyTooLargeError';
    }
}

async function readBody(request: IncomingMessage, maxBodyBytes?: number) {
    const contentLength = Number(request.headers['content-length']);
    if (maxBodyBytes && Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
        throw new RequestBodyTooLargeError();
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        size += buffer.byteLength;
        if (maxBodyBytes && size > maxBodyBytes) {
            throw new RequestBodyTooLargeError();
        }
        chunks.push(buffer);
    }
    return Buffer.concat(chunks);
}

export async function toFetchRequest(
    request: IncomingMessage,
    baseUrl: string,
    options: { maxBodyBytes?: number } = {}
): Promise<Request> {
    const url = new URL(request.url ?? '/', baseUrl);
    const method = request.method ?? 'GET';
    const headers = new Headers();

    for (const [key, value] of Object.entries(request.headers)) {
        if (value === undefined) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                headers.append(key, item);
            }
            continue;
        }

        headers.set(key, value);
    }

    if (method === 'GET' || method === 'HEAD') {
        return new Request(url.toString(), {
            headers,
            method,
        });
    }

    const body = await readBody(request, options.maxBodyBytes);
    return new Request(url.toString(), {
        body,
        duplex: 'half',
        headers,
        method,
    });
}

export async function writeFetchResponse(response: Response, serverResponse: ServerResponse) {
    serverResponse.statusCode = response.status;
    response.headers.forEach((value, key) => {
        serverResponse.setHeader(key, value);
    });

    const body = Buffer.from(await response.arrayBuffer());
    serverResponse.end(body);
}
