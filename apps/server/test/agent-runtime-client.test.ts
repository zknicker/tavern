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
                    id: 'vault',
                    lastHealthyAt: now,
                    metadata: { vaultPath: '/Users/zknicker/.tavern/runtime/memory' },
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
        ['dashboardServer', 'vault']
    );
    assert.equal(capabilities.info.version, '1.2.9');
});
