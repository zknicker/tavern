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

test('listCapabilities parses Wiki capability rows', async () => {
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
                    id: 'wiki',
                    lastHealthyAt: now,
                    metadata: { wikiPath: '/Users/zknicker/.tavern/runtime/wiki' },
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
        ['dashboardServer', 'wiki']
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

test('getMemoryActivity reads the Memory activity rollup', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
        assert.equal(String(input), `http://runtime.test${agentRuntimeRoutes.memoryActivity}`);
        return Response.json({
            activities: [
                {
                    enabled: true,
                    kind: 'extraction',
                    lastRun: null,
                    nextRun: { kind: 'waiting', waitingOn: 'chat activity' },
                },
            ],
        });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createAgentRuntimeClient('http://runtime.test');
    const result = await client.getMemoryActivity();

    assert.equal(result.activities[0]?.kind, 'extraction');
    assert.equal(result.activities[0]?.nextRun?.kind, 'waiting');
});

test('getCurrentAgentSession reads the current chat-scoped agent session', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, agentRuntimeRoutes.chatAgentSessionCurrent('cht_general'));
        assert.equal(url.searchParams.get('agentId'), 'agt_primary');
        return Response.json({
            pastSessions: [],
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

test('task attachment methods read bytes and delete one attachment', async () => {
    const requests: Array<{ method: string; url: string }> = [];
    const route = agentRuntimeRoutes.taskAttachment('tsk_1', 'att_1');
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ method: init?.method ?? 'GET', url: String(input) });
        return init?.method === 'DELETE'
            ? Response.json({ deleted: true, id: 'att_1' })
            : Response.json({
                  contentBase64: Buffer.from('deliverable').toString('base64'),
                  filename: 'result.txt',
                  mediaType: 'text/plain',
              });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const client = createAgentRuntimeClient('http://runtime.test');
    const attachment = await client.getTaskAttachment('tsk_1', 'att_1');
    const deleted = await client.deleteTaskAttachment('tsk_1', 'att_1');

    assert.equal(attachment.filename, 'result.txt');
    assert.deepEqual(deleted, { deleted: true, id: 'att_1' });
    assert.deepEqual(requests, [
        { method: 'GET', url: `http://runtime.test${route}` },
        { method: 'DELETE', url: `http://runtime.test${route}` },
    ]);
});
