import { describe, expect, test, vi } from 'vitest';
import * as z from 'zod';
import { AgentApiClient } from './agent-api-client.ts';
import { AgentCliError } from './agent-error.ts';

const context = {
    agentId: 'agt_wren',
    serverUrl: 'http://127.0.0.1:18790',
    token: `grta_${'a'.repeat(43)}`,
    tokenFile: '/tmp/token',
};

describe('AgentApiClient', () => {
    test('sends bearer auth and JSON', async () => {
        let captured: { init?: RequestInit; url: string } | null = null;
        const fetcher = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
            captured = { init, url: String(input) };
            return Response.json({ ok: true });
        }) as typeof fetch;
        const client = new AgentApiClient(context, fetcher);

        await expect(
            client.request('/api/agent/test', z.object({ ok: z.boolean() }), {
                body: { value: 1 },
                method: 'POST',
            })
        ).resolves.toEqual({ ok: true });

        expect(captured).not.toBeNull();
        const request = captured as unknown as { init: RequestInit; url: string };
        expect(request.url).toBe('http://127.0.0.1:18790/api/agent/test');
        expect(request.init.headers).toMatchObject({ authorization: `Bearer ${context.token}` });
        expect(request.init.body).toBe('{"value":1}');
    });

    test('surfaces 4xx agent errors verbatim', async () => {
        const client = new AgentApiClient(
            context,
            vi.fn(async () =>
                Response.json(
                    {
                        code: 'AMBIGUOUS_ID',
                        draftSaved: true,
                        message: 'Message id is ambiguous.',
                        nextAction: 'Use the full message id.',
                    },
                    { status: 409 }
                )
            ) as unknown as typeof fetch
        );

        const error = await client
            .request('/api/agent/test', z.unknown())
            .catch((caught) => caught);
        expect(error).toBeInstanceOf(AgentCliError);
        expect(error).toMatchObject({ code: 'AMBIGUOUS_ID', message: 'Message id is ambiguous.' });
        expect((error as AgentCliError).options.nextAction).toBe('Use the full message id.');
        expect((error as AgentCliError).options.draftSaved).toBe(true);
    });

    test.each([
        vi.fn(async () => new Response('crash', { status: 503 })),
        vi.fn(async () => {
            throw new Error('ECONNREFUSED');
        }),
    ])('maps server and network failures to SERVER_5XX', async (fetcher) => {
        const client = new AgentApiClient(context, fetcher as unknown as typeof fetch);
        const error = await client
            .request('/api/agent/test', z.unknown())
            .catch((caught) => caught);
        expect(error).toMatchObject({ code: 'SERVER_5XX' });
    });

    test('rejects invalid successful JSON shapes', async () => {
        const client = new AgentApiClient(
            context,
            vi.fn(async () => Response.json({ nope: true })) as unknown as typeof fetch
        );
        const error = await client
            .request('/api/agent/test', z.object({ ok: z.boolean() }))
            .catch((caught) => caught);
        expect(error).toMatchObject({ code: 'INVALID_JSON_RESPONSE' });
    });
});
