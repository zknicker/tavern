import { afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalTavernRuntimeUrl = process.env.TAVERN_RUNTIME_URL;
const listCapabilities = mock(async () => {
    throw new Error('Runtime request failed with status 502.');
});
const closeRuntimeClient = mock(() => undefined);

mock.module('../src/agent-runtime/client-factory.ts', () => ({
    createAgentRuntimeClientForConnection: mock(() => ({
        close: closeRuntimeClient,
        listCapabilities,
    })),
}));

afterEach(() => {
    process.env.DATABASE_PATH = originalDatabasePath;
    process.env.TAVERN_RUNTIME_URL = originalTavernRuntimeUrl;
    listCapabilities.mockImplementation(async () => {
        throw new Error('Runtime request failed with status 502.');
    });
    listCapabilities.mockClear();
    closeRuntimeClient.mockClear();
});

test('clearAgentRuntimeConnection can clear an active Tavern Runtime environment override', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-agent-runtime-connection-test-')),
        'test.sqlite'
    );
    process.env.TAVERN_RUNTIME_URL = 'http://tavern-runtime.test';

    const [{ ensureDatabaseSchema }, agentRuntimeConnection] = await Promise.all([
        import('../src/db/bootstrap.ts'),
        import('../src/agent-runtime-connection/service.ts'),
    ]);

    await ensureDatabaseSchema();
    await agentRuntimeConnection.clearAgentRuntimeConnection({ clearEnvironmentOverride: true });

    assert.equal(process.env.TAVERN_RUNTIME_URL, undefined);
    assert.equal(agentRuntimeConnection.getCurrentAgentRuntimeUrl(), null);
    assert.equal(await agentRuntimeConnection.getAgentRuntimeConnection(), null);
});

test('unreachable saved Runtime keeps its URL without reporting a version mismatch', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-agent-runtime-connection-test-')),
        'test.sqlite'
    );
    process.env.TAVERN_RUNTIME_URL = undefined;

    const [{ ensureDatabaseSchema }, agentRuntimeConnection, storage] = await Promise.all([
        import('../src/db/bootstrap.ts'),
        import('../src/agent-runtime-connection/service.ts'),
        import('../src/storage/agent-runtime-connections.ts'),
    ]);

    await ensureDatabaseSchema();
    await storage.saveAgentRuntimeConnection({
        baseUrl: 'https://zachs-mac-mini.taila0b849.ts.net:18790',
        enabled: true,
        id: 'tavern-hermes-managed',
        isActive: true,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        name: 'Tavern Runtime',
    });

    const connection = await agentRuntimeConnection.getAgentRuntimeConnection();

    assert.equal(connection?.baseUrl, 'https://zachs-mac-mini.taila0b849.ts.net:18790');
    assert.equal(connection?.lastError, 'Runtime request failed with status 502.');
    assert.equal(connection?.runtimeVersion, null);
    assert.equal(connection?.versionStatus, 'unknown');
});

test('startup load can use a saved Runtime without refreshing capabilities', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-agent-runtime-connection-test-')),
        'test.sqlite'
    );
    process.env.TAVERN_RUNTIME_URL = undefined;

    const [{ ensureDatabaseSchema }, agentRuntimeConnection, storage] = await Promise.all([
        import('../src/db/bootstrap.ts'),
        import('../src/agent-runtime-connection/service.ts'),
        import('../src/storage/agent-runtime-connections.ts'),
    ]);

    await ensureDatabaseSchema();
    await storage.saveAgentRuntimeConnection({
        baseUrl: 'https://zachs-mac-mini.taila0b849.ts.net:18790',
        enabled: true,
        id: 'tavern-hermes-managed',
        isActive: true,
        lastCheckedAt: null,
        lastError: null,
        name: 'Tavern Runtime',
    });

    const connection = await agentRuntimeConnection.loadAgentRuntimeConnection({
        refreshStatus: false,
    });

    assert.equal(connection?.baseUrl, 'https://zachs-mac-mini.taila0b849.ts.net:18790');
    assert.equal(connection?.runtimeVersion, null);
    assert.equal(agentRuntimeConnection.getCurrentAgentRuntimeUrl(), connection?.baseUrl);
    assert.equal(listCapabilities.mock.calls.length, 0);
});

test('connection snapshot can read a saved Runtime without refreshing capabilities', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-agent-runtime-connection-test-')),
        'test.sqlite'
    );
    process.env.TAVERN_RUNTIME_URL = undefined;

    const [{ ensureDatabaseSchema }, agentRuntimeConnection, storage] = await Promise.all([
        import('../src/db/bootstrap.ts'),
        import('../src/agent-runtime-connection/service.ts'),
        import('../src/storage/agent-runtime-connections.ts'),
    ]);

    await ensureDatabaseSchema();
    await storage.saveAgentRuntimeConnection({
        baseUrl: 'https://zachs-mac-mini.taila0b849.ts.net:18790',
        enabled: true,
        id: 'tavern-hermes-managed',
        isActive: true,
        lastCheckedAt: null,
        lastError: 'connect timeout',
        name: 'Tavern Runtime',
    });

    const connection = await agentRuntimeConnection.getAgentRuntimeConnection({
        refreshStatus: false,
    });

    assert.equal(connection?.baseUrl, 'https://zachs-mac-mini.taila0b849.ts.net:18790');
    assert.equal(connection?.lastError, 'connect timeout');
    assert.equal(connection?.runtimeVersion, null);
    assert.equal(listCapabilities.mock.calls.length, 0);
});

test('Tavern Runtime environment override does not replace the saved Runtime URL', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-agent-runtime-connection-test-')),
        'test.sqlite'
    );
    process.env.TAVERN_RUNTIME_URL = 'http://127.0.0.1:18790';
    listCapabilities.mockImplementation(async () => ({
        capabilities: [],
        health: {
            ok: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
        },
        info: {
            agentRuntimeId: 'dev-runtime',
            name: 'Dev Tavern Runtime',
            protocolVersion: 1,
            version: '1.2.1',
        },
    }));

    const [{ ensureDatabaseSchema }, agentRuntimeConnection, storage] = await Promise.all([
        import('../src/db/bootstrap.ts'),
        import('../src/agent-runtime-connection/service.ts'),
        import('../src/storage/agent-runtime-connections.ts'),
    ]);

    await ensureDatabaseSchema();
    await storage.saveAgentRuntimeConnection({
        baseUrl: 'https://zachs-mac-mini.example:18790',
        enabled: true,
        id: 'tavern-hermes-managed',
        isActive: true,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        name: 'Tavern Runtime',
    });

    const connection = await agentRuntimeConnection.loadAgentRuntimeConnection();
    const saved = await storage.getAgentRuntimeConnection('tavern-hermes-managed');

    assert.equal(connection?.source, 'environment');
    assert.equal(connection?.baseUrl, 'http://127.0.0.1:18790');
    assert.equal(saved?.baseUrl, 'https://zachs-mac-mini.example:18790');

    await agentRuntimeConnection.clearAgentRuntimeConnection({ clearEnvironmentOverride: true });
});

test('failed Runtime connect attempts still persist the configured URL', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-agent-runtime-connection-test-')),
        'test.sqlite'
    );
    process.env.TAVERN_RUNTIME_URL = undefined;

    const [{ ensureDatabaseSchema }, agentRuntimeConnection, storage] = await Promise.all([
        import('../src/db/bootstrap.ts'),
        import('../src/agent-runtime-connection/service.ts'),
        import('../src/storage/agent-runtime-connections.ts'),
    ]);

    await ensureDatabaseSchema();

    await assert.rejects(
        () =>
            agentRuntimeConnection.saveAgentRuntimeConnection({
                baseUrl: 'https://zachs-mac-mini.taila0b849.ts.net:18790',
                lastError: null,
            }),
        /Runtime request failed with status 502/
    );

    const saved = await storage.getDefaultAgentRuntimeConnection();

    assert.equal(saved?.baseUrl, 'https://zachs-mac-mini.taila0b849.ts.net:18790');
    assert.equal(saved?.enabled, true);
    assert.equal(saved?.isActive, true);
    assert.equal(saved?.lastError, 'Runtime request failed with status 502.');
});
