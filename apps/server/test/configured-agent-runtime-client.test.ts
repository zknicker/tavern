import { afterEach, beforeEach, test } from 'bun:test';
import assert from 'node:assert/strict';
import { createConfiguredAgentRuntimeClientForRuntimeId } from '../src/agent-runtime/configured-client.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { saveAgentRuntimeConnection } from '../src/storage/agent-runtime-connections.ts';

ensureDatabaseSchema();

beforeEach(() => {
    clearRuntimeTestTables();
});

afterEach(() => {
    clearRuntimeTestTables();
});

function clearRuntimeTestTables() {
    databaseClient.exec('DELETE FROM agent_runtime_connections;');
}

test('runtime client remains configured when the connection is reachable', async () => {
    const runtimeId = 'runtime-with-degraded-chat';
    await saveRuntimeConnection({
        id: runtimeId,
        lastError: null,
    });

    const client = await createConfiguredAgentRuntimeClientForRuntimeId(runtimeId);

    assert.ok(client);
});

test('runtime client remains configured when the last health check failed', async () => {
    const runtimeId = 'runtime-with-degraded-status';
    await saveRuntimeConnection({
        id: runtimeId,
        lastError: 'Failed to connect to OpenClaw Gateway.',
    });

    const client = await createConfiguredAgentRuntimeClientForRuntimeId(runtimeId);

    assert.ok(client);
});

async function saveRuntimeConnection(input: { id: string; lastError: null | string }) {
    await saveAgentRuntimeConnection({
        baseUrl: 'ws://127.0.0.1:18789',
        enabled: true,
        id: input.id,
        isActive: true,
        lastCheckedAt: new Date().toISOString(),
        lastError: input.lastError,
        name: 'Tavern Runtime',
    });
}
