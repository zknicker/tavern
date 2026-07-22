import { afterAll, afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalTavernRuntimeUrl = process.env.TAVERN_RUNTIME_URL;
const originalFetch = globalThis.fetch;
const listCapabilities = mock(async () => {
    throw new Error('Runtime request failed with status 502.');
});

globalThis.fetch = (async () => Response.json(await listCapabilities())) as typeof fetch;

afterEach(() => {
    process.env.DATABASE_PATH = originalDatabasePath;
    process.env.TAVERN_RUNTIME_URL = originalTavernRuntimeUrl;
    globalThis.fetch = (async () => Response.json(await listCapabilities())) as typeof fetch;
    listCapabilities.mockImplementation(async () => {
        throw new Error('Runtime request failed with status 502.');
    });
    listCapabilities.mockClear();
});

afterAll(() => {
    globalThis.fetch = originalFetch;
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
        id: 'tavern-agent-engine',
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
        id: 'tavern-agent-engine',
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
        id: 'tavern-agent-engine',
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
        id: 'tavern-agent-engine',
        isActive: true,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        name: 'Tavern Runtime',
    });

    const connection = await agentRuntimeConnection.loadAgentRuntimeConnection();
    const saved = await storage.getAgentRuntimeConnection('tavern-agent-engine');

    assert.equal(connection?.source, 'environment');
    assert.equal(connection?.baseUrl, 'http://127.0.0.1:18790');
    assert.equal(saved?.baseUrl, 'https://zachs-mac-mini.example:18790');
    assert.equal(
        connection?.capabilities.some((capability) => capability.capability === 'gateway'),
        true
    );
    assert.deepEqual(
        connection?.capabilities.find((capability) => capability.capability === 'gateway'),
        {
            capability: 'gateway',
            checkedAt: null,
            displayName: null,
            errorCode: null,
            lastHealthyAt: null,
            metadataJson: '{}',
            method: 'app.expected',
            reason: 'Runtime has not reported this capability yet.',
            runtimeId: 'dev-runtime',
            state: 'unknown',
            technicalMessage: null,
            updatedAt: null,
        }
    );

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

test('boot confirm seeds an environment Runtime that has no saved record', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-agent-runtime-connection-test-')),
        'test.sqlite'
    );
    process.env.TAVERN_RUNTIME_URL = 'http://127.0.0.1:18791';
    const originalRuntimeToken = process.env.TAVERN_RUNTIME_TOKEN;
    process.env.TAVERN_RUNTIME_TOKEN = 'env-token-123';
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

    try {
        await ensureDatabaseSchema();
        // The db module caches the first test's database; disable any stored
        // rows earlier tests left so this test exercises the no-record path.
        await agentRuntimeConnection.clearAgentRuntimeConnection();

        // Boot-style non-blocking load leaves no environment record behind.
        await agentRuntimeConnection.loadAgentRuntimeConnection({ refreshStatus: false });
        assert.equal((await storage.listReachableAgentRuntimeConnections()).length, 0);

        // The post-boot confirm must probe the environment config and seed the
        // record so runtime event sync has a reachable connection to attach to.
        assert.equal(await agentRuntimeConnection.confirmAgentRuntimeConnection(), true);

        const reachable = await storage.listReachableAgentRuntimeConnections();
        assert.equal(reachable.length, 1);
        assert.equal(reachable[0]?.baseUrl, 'http://127.0.0.1:18791');
        assert.ok(reachable[0]?.authJson?.includes('env-token-123'));
    } finally {
        await agentRuntimeConnection.clearAgentRuntimeConnection({
            clearEnvironmentOverride: true,
        });
        process.env.TAVERN_RUNTIME_TOKEN = originalRuntimeToken;
    }
});
