import { afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { agentRuntimeRoutes } from '@tavern/api';
import { createAgentRuntimeClient } from '../src/agent-runtime/client.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

test('listCapabilities ignores legacy Cortex capability rows from older Runtimes', async () => {
    const now = new Date().toISOString();
    const fetchMock = mock(async (input: RequestInfo | URL) => {
        assert.equal(String(input), `http://runtime.test${agentRuntimeRoutes.capabilities}`);
        return Response.json({
            capabilities: [
                {
                    checkedAt: now,
                    displayName: 'embedding model',
                    healthy: true,
                    id: 'embeddingModel',
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
                    displayName: 'Cortex wiki',
                    healthy: true,
                    id: 'cortexWiki',
                    lastHealthyAt: now,
                    metadata: {},
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
        ['cortexWiki']
    );
    assert.equal(capabilities.info.version, '1.2.9');
});
