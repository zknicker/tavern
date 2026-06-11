/**
 * Regression tests: bearer token must survive status-update calls (mark sync, mark reachable,
 * mark failure) on the environment connection record, and every sync client request must carry
 * the Authorization header when the connection has a token.
 *
 * Covers the bug reported in: "Bearer token required." on startup agent sync when
 * TAVERN_RUNTIME_TOKEN is set via the environment.
 */
import { afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalTavernRuntimeUrl = process.env.TAVERN_RUNTIME_URL;
const originalTavernRuntimeToken = process.env.TAVERN_RUNTIME_TOKEN;

const capturedRequests: Array<{ authorization: string | undefined; url: string }> = [];
const originalFetch = globalThis.fetch;

afterEach(() => {
    process.env.DATABASE_PATH = originalDatabasePath;
    process.env.TAVERN_RUNTIME_URL = originalTavernRuntimeUrl;
    process.env.TAVERN_RUNTIME_TOKEN = originalTavernRuntimeToken;
    globalThis.fetch = originalFetch;
    capturedRequests.length = 0;
    mock.restore();
});

test('environment connection authJson is preserved after markAgentRuntimeConnectionSync', async () => {
    const {
        saveEnvironmentAgentRuntimeConnection,
        getEnvironmentAgentRuntimeConnection,
        clearEnvironmentAgentRuntimeConnection,
    } = await import('../src/agent-runtime-connection/environment-override.ts');

    clearEnvironmentAgentRuntimeConnection();

    saveEnvironmentAgentRuntimeConnection({
        auth: { token: 'test-token' },
        baseUrl: 'http://runtime.test',
        id: 'runtime-1',
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        name: 'Test Runtime',
    });

    // Simulate a status-update call that does NOT pass auth (as markAgentRuntimeConnectionSync does)
    saveEnvironmentAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        id: 'runtime-1',
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        lastSyncedAt: new Date().toISOString(),
        name: 'Test Runtime',
    });

    const record = getEnvironmentAgentRuntimeConnection();
    assert.ok(record, 'environment connection record should exist');
    assert.equal(record.authJson, JSON.stringify({ token: 'test-token' }));

    clearEnvironmentAgentRuntimeConnection();
});

test('syncAgentRuntimeAgents sends Authorization header when environment connection has a token', async () => {
    process.env.DATABASE_PATH = join(
        mkdtempSync(join(tmpdir(), 'tavern-auth-regression-test-')),
        'test.sqlite'
    );
    process.env.TAVERN_RUNTIME_URL = 'http://127.0.0.1:18700';
    process.env.TAVERN_RUNTIME_TOKEN = 'e2e-runtime-token';

    const agentListResponse = {
        agents: [
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'main',
                isAdmin: false,
                name: 'Main',
                primaryColor: null,
                workspaceFolder: '/tmp/agent-main',
            },
        ],
    };
    const capabilitiesResponse = {
        capabilities: [],
        health: { ok: true, status: 'healthy', timestamp: new Date().toISOString() },
        info: {
            agentRuntimeId: 'runtime-test-1',
            name: 'Test Runtime',
            protocolVersion: 1,
            version: '1.0.0',
        },
    };

    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const authorization = (init?.headers as Record<string, string>)?.authorization;
        capturedRequests.push({ authorization, url });

        if (url.includes('/agents')) {
            return Response.json(agentListResponse);
        }
        if (url.includes('/workspace-instructions')) {
            return Response.json({
                agentId: 'main',
                renderedAt: new Date().toISOString(),
                sha256: 'abc123',
                updatedAt: new Date().toISOString(),
            });
        }
        return Response.json(capabilitiesResponse);
    }) as typeof fetch;

    const [{ ensureDatabaseSchema }, agentRuntimeConnection, agentRuntimeSync] = await Promise.all([
        import('../src/db/bootstrap.ts'),
        import('../src/agent-runtime-connection/service.ts'),
        import('../src/sync/agent-runtime-sync.ts'),
    ]);

    ensureDatabaseSchema();
    await agentRuntimeConnection.loadAgentRuntimeConnection();
    await agentRuntimeSync.syncAgentRuntimeAgents();

    const agentListRequest = capturedRequests.find((r) => r.url.includes('/agents'));
    assert.ok(agentListRequest, 'expected a request to /agents');
    assert.equal(
        agentListRequest.authorization,
        'Bearer e2e-runtime-token',
        'agents request must carry the bearer token'
    );
});
