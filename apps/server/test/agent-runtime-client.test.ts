import { afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { agentRuntimeRoutes } from '@tavern/api';
import { createAgentRuntimeClient } from '../src/agent-runtime/client.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

test('client sends Authorization header when constructed with a token', async () => {
    let capturedAuthorization: string | null | undefined;
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedAuthorization = (init?.headers as Record<string, string>)?.authorization;
        return Response.json({
            capabilities: [],
            health: { ok: true, status: 'healthy', timestamp: new Date().toISOString() },
            info: {
                agentRuntimeId: 'runtime-1',
                name: 'Tavern Runtime',
                protocolVersion: 1,
                version: '1.0.0',
            },
        });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createAgentRuntimeClient('http://runtime.test', { token: 'my-secret-token' });
    await client.listCapabilities();

    assert.equal(capturedAuthorization, 'Bearer my-secret-token');
});

test('client sends no Authorization header when constructed without a token', async () => {
    let capturedAuthorization: string | null | undefined;
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedAuthorization = (init?.headers as Record<string, string>)?.authorization;
        return Response.json({
            capabilities: [],
            health: { ok: true, status: 'healthy', timestamp: new Date().toISOString() },
            info: {
                agentRuntimeId: 'runtime-1',
                name: 'Tavern Runtime',
                protocolVersion: 1,
                version: '1.0.0',
            },
        });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createAgentRuntimeClient('http://runtime.test');
    await client.listCapabilities();

    assert.equal(capturedAuthorization, undefined);
});

test('identity admin methods use runtime-token routes', async () => {
    const requests: Array<{ authorization: string | null; method: string; path: string }> = [];
    const now = '2026-07-18T12:00:00.000Z';
    const invite = {
        code: 'invite-code',
        createdAt: now,
        createdBy: 'usr_owner',
        id: 'inv_test',
        redeemedAt: null,
        redeemedBy: null,
    };
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = new Headers(init?.headers);
        requests.push({
            authorization: headers.get('authorization'),
            method: init?.method ?? 'GET',
            path: url.pathname,
        });
        if (url.pathname === agentRuntimeRoutes.identityMembers) {
            return Response.json({ members: [] });
        }
        if (url.pathname === agentRuntimeRoutes.identityInvites && !init?.method) {
            return Response.json({ invites: [invite] });
        }
        if (url.pathname === agentRuntimeRoutes.identityInvites) {
            return Response.json({ invite });
        }
        return Response.json({ ok: true });
    }) as typeof fetch;

    const client = createAgentRuntimeClient('http://runtime.test', { token: 'runtime-token' });
    await client.listIdentityMembers();
    await client.listIdentityInvites();
    await client.createIdentityInvite();
    await client.deleteIdentityInvite('inv_test');
    await client.removeIdentityMember('usr_member');

    assert.deepEqual(requests, [
        {
            authorization: 'Bearer runtime-token',
            method: 'GET',
            path: agentRuntimeRoutes.identityMembers,
        },
        {
            authorization: 'Bearer runtime-token',
            method: 'GET',
            path: agentRuntimeRoutes.identityInvites,
        },
        {
            authorization: 'Bearer runtime-token',
            method: 'POST',
            path: agentRuntimeRoutes.identityInvites,
        },
        {
            authorization: 'Bearer runtime-token',
            method: 'DELETE',
            path: agentRuntimeRoutes.identityInvite('inv_test'),
        },
        {
            authorization: 'Bearer runtime-token',
            method: 'DELETE',
            path: agentRuntimeRoutes.identityMember('usr_member'),
        },
    ]);
});

test('listEvents sends durable cursor filters to Runtime', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, agentRuntimeRoutes.events);
        assert.equal(url.searchParams.get('after_cursor'), '4');
        assert.equal(url.searchParams.get('limit'), '25');
        return Response.json({
            events: [
                {
                    chatId: 'cht_1',
                    timestamp: '2026-06-27T12:00:00.000Z',
                    type: 'chat.historyChanged',
                },
            ],
        });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createAgentRuntimeClient('http://runtime.test');
    const events = await client.listEvents({ afterCursor: '4', limit: 25 });

    assert.deepEqual(
        events.events.map((event) => event.type),
        ['chat.historyChanged']
    );
});

test('getCurrentAgentSession reads the current global agent session via a chat', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, agentRuntimeRoutes.chatAgentSessionCurrent('cht_general'));
        assert.equal(url.searchParams.get('agentId'), 'agt_primary');
        return Response.json({
            pastSessions: [],
            session: {
                agentId: 'agt_primary',
                archivedAt: null,
                createdAt: '2026-06-29T12:00:00.000Z',
                effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
                generation: 1,
                id: 'ags_agt_primary_1',
                lastTurnAt: null,
                resumeState: null,
                runtimeSessionId: null,
                status: 'active',
                updatedAt: '2026-06-29T12:00:00.000Z',
            },
            stats: { contextTokens: null, turnCount: 0 },
        });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createAgentRuntimeClient('http://runtime.test');
    const result = await client.getCurrentAgentSession({
        agentId: 'agt_primary',
        chatId: 'cht_general',
    });

    assert.equal(result.session?.effectiveModel.model, 'gpt-4.1-mini');
});
