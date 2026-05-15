import { afterEach, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalDatabasePath = process.env.DATABASE_PATH;
const originalTavernRuntimeUrl = process.env.TAVERN_RUNTIME_URL;

afterEach(() => {
    process.env.DATABASE_PATH = originalDatabasePath;
    process.env.TAVERN_RUNTIME_URL = originalTavernRuntimeUrl;
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
