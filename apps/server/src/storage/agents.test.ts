import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const directory = mkdtempSync(join(tmpdir(), 'tavern-agents-storage-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [{ ensureDatabaseSchema }, agentStorage, connectionStorage, { databaseClient }] =
    await Promise.all([
        import('../db/bootstrap.ts'),
        import('./agents.ts'),
        import('./agent-runtime-connections.ts'),
        import('../db/index.ts'),
    ]);

ensureDatabaseSchema();

test.beforeEach(() => {
    databaseClient.exec('delete from agent_runtime_connections');
    databaseClient.exec('delete from agents');
});

test('syncAgentsForRuntime replaces missing config rows for one runtime only', async () => {
    const firstSync = '2026-04-30T12:00:00.000Z';
    const secondSync = '2026-04-30T12:01:00.000Z';

    await agentStorage.syncAgentsForRuntime({
        agents: [
            createAgent({ id: 'planner', name: 'Planner' }),
            createAgent({ id: 'writer', name: 'Writer' }),
        ],
        runtimeId: 'hermes-primary',
        syncedAt: firstSync,
    });
    await agentStorage.syncAgentsForRuntime({
        agents: [createAgent({ id: 'claw', name: 'Claw' })],
        runtimeId: 'hermes-main',
        syncedAt: firstSync,
    });

    await agentStorage.syncAgentsForRuntime({
        agents: [createAgent({ id: 'planner', name: 'Planner Prime' })],
        runtimeId: 'hermes-primary',
        syncedAt: secondSync,
    });

    const agents = await agentStorage.listAgents({ includeInactive: true });

    assert.deepEqual(
        agents.map((agent) => [agent.id, agent.name, agent.lastSyncedAt]),
        [
            ['claw', 'Claw', firstSync],
            ['planner', 'Planner Prime', secondSync],
        ]
    );
});

test('listAgents scopes rows to the active Hermes runtime', async () => {
    await agentStorage.syncAgentsForRuntime({
        agents: [createAgent({ id: 'planner', name: 'Planner' })],
        runtimeId: 'hermes-primary',
    });
    await agentStorage.syncAgentsForRuntime({
        agents: [createAgent({ id: 'claw', name: 'Claw' })],
        runtimeId: 'hermes-main',
    });
    await connectionStorage.saveAgentRuntimeConnection({
        baseUrl: 'wss://hermes.example',
        enabled: true,
        id: 'hermes-main',
        lastCheckedAt: '2026-05-05T12:00:00.000Z',
        lastError: null,
        name: 'Hermes',
    });

    const agents = await agentStorage.listAgents();

    assert.deepEqual(
        agents.map((agent) => agent.id),
        ['claw']
    );
});

function createAgent(input: { id: string; name: string }) {
    return {
        avatar: null,
        enabledSkillIds: [],
        emoji: null,
        id: input.id,
        isAdmin: false,
        name: input.name,
        primaryColor: null,
        workspaceFolder: input.id,
    };
}
