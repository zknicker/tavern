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

test('listCapabilities parses Memory capability rows', async () => {
    const now = new Date().toISOString();
    const fetchMock = mock(async (input: RequestInfo | URL) => {
        assert.equal(String(input), `http://runtime.test${agentRuntimeRoutes.capabilities}`);
        return Response.json({
            capabilities: [
                {
                    checkedAt: now,
                    displayName: 'dashboard server',
                    healthy: true,
                    id: 'dashboardServer',
                    lastHealthyAt: now,
                    metadata: {},
                    nextCheckAt: now,
                    reason: null,
                    state: 'healthy',
                    technicalMessage: null,
                    updatedAt: now,
                },
                {
                    checkedAt: now,
                    displayName: 'Memory',
                    healthy: true,
                    id: 'semanticMemory',
                    lastHealthyAt: now,
                    metadata: { memoryPath: '/Users/zknicker/.tavern/runtime/memory' },
                    nextCheckAt: now,
                    reason: null,
                    state: 'healthy',
                    technicalMessage: null,
                    updatedAt: now,
                },
            ],
            health: {
                ok: true,
                status: 'healthy',
                timestamp: now,
            },
            info: {
                agentRuntimeId: 'runtime-1',
                name: 'Tavern Runtime',
                protocolVersion: 1,
                version: '1.2.9',
            },
        });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createAgentRuntimeClient('http://runtime.test');
    const capabilities = await client.listCapabilities();

    assert.deepEqual(
        capabilities.capabilities.map((capability) => capability.id),
        ['dashboardServer', 'semanticMemory']
    );
    assert.equal(capabilities.info.version, '1.2.9');
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

test('getCurrentAgentSession reads the current chat-scoped agent session', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, agentRuntimeRoutes.chatAgentSessionCurrent('cht_general'));
        assert.equal(url.searchParams.get('agentParticipantId'), 'agt_primary');
        return Response.json({
            session: {
                agentId: 'agt_primary',
                agentParticipantId: 'agt_primary',
                archivedAt: null,
                chatId: 'cht_general',
                createdAt: '2026-06-29T12:00:00.000Z',
                effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
                generation: 1,
                id: 'ags_cht_general_agt_primary_1',
                resumeState: null,
                runtimeSessionId: null,
                status: 'active',
                updatedAt: '2026-06-29T12:00:00.000Z',
            },
        });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createAgentRuntimeClient('http://runtime.test');
    const result = await client.getCurrentAgentSession({
        agentParticipantId: 'agt_primary',
        chatId: 'cht_general',
    });

    assert.equal(result.session?.effectiveModel.model, 'gpt-4.1-mini');
});

test('updateAgentSessionModel writes the chat-scoped agent session model', async () => {
    let capturedBody: unknown;
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, agentRuntimeRoutes.chatAgentSessionModel('cht_general'));
        assert.equal(init?.method, 'PATCH');
        capturedBody = JSON.parse(String(init?.body));
        return Response.json({
            rotated: true,
            session: {
                agentId: 'agt_primary',
                agentParticipantId: 'agt_primary',
                archivedAt: null,
                chatId: 'cht_general',
                createdAt: '2026-06-29T12:00:00.000Z',
                effectiveModel: { model: 'claude-opus-4-8', provider: 'claude' },
                generation: 2,
                id: 'ags_cht_general_agt_primary_2',
                resumeState: null,
                runtimeSessionId: null,
                status: 'active',
                updatedAt: '2026-06-29T12:00:00.000Z',
            },
        });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createAgentRuntimeClient('http://runtime.test');
    const result = await client.updateAgentSessionModel('cht_general', {
        agentParticipantId: 'agt_primary',
        model: { model: 'claude-opus-4-8', provider: 'claude' },
    });

    assert.deepEqual(capturedBody, {
        agentParticipantId: 'agt_primary',
        model: { model: 'claude-opus-4-8', provider: 'claude' },
    });
    assert.equal(result.rotated, true);
    assert.equal(result.session.effectiveModel.provider, 'claude');
});
