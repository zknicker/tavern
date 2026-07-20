import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { expect, test } from 'vitest';
import { maxTavernRuntimeRequestBodyBytes, toFetchRequest } from './http.ts';

test('rejects oversized Runtime requests before reading their body', async () => {
    const request = Readable.from([]) as unknown as IncomingMessage;
    request.headers = {
        'content-length': String(maxTavernRuntimeRequestBodyBytes + 1),
    };
    request.method = 'POST';
    request.url = '/wiki/attachments';

    await expect(
        toFetchRequest(request, 'http://127.0.0.1:29333', {
            maxBodyBytes: maxTavernRuntimeRequestBodyBytes,
        })
    ).rejects.toThrow('exceeds the 12 MiB limit');
});

test('bounds streamed Runtime requests without a content length', async () => {
    const request = Readable.from([
        Buffer.alloc(maxTavernRuntimeRequestBodyBytes),
        Buffer.from('x'),
    ]) as unknown as IncomingMessage;
    request.headers = {};
    request.method = 'POST';
    request.url = '/wiki/attachments';

    await expect(
        toFetchRequest(request, 'http://127.0.0.1:29333', {
            maxBodyBytes: maxTavernRuntimeRequestBodyBytes,
        })
    ).rejects.toThrow('exceeds the 12 MiB limit');
});

test('does not impose the Wiki upload limit on other Runtime requests', async () => {
    const request = Readable.from([]) as unknown as IncomingMessage;
    request.headers = {
        'content-length': String(maxTavernRuntimeRequestBodyBytes + 1),
    };
    request.method = 'POST';
    request.url = '/chats/chat-1/messages';

    await expect(toFetchRequest(request, 'http://127.0.0.1:29333')).resolves.toBeInstanceOf(
        Request
    );
});
