import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const directory = mkdtempSync(join(tmpdir(), 'tavern-agent-settings-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [{ saveCatalogAgentProfile }, { ensureDatabaseSchema }, agentStorage, { databaseClient }] =
    await Promise.all([
        import('../src/agents/catalog.ts'),
        import('../src/db/bootstrap.ts'),
        import('../src/storage/agents.ts'),
        import('../src/db/index.ts'),
    ]);

ensureDatabaseSchema();

test.beforeEach(() => {
    databaseClient.exec('delete from agent_profiles');
    databaseClient.exec('delete from agents');
});

test('saveCatalogAgentProfile saves color without requiring a runtime connection', async () => {
    await agentStorage.syncAgentsForRuntime({
        agents: [
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'blippy',
                isAdmin: false,
                name: 'Blippy',
                primaryColor: null,
                workspaceFolder: 'blippy',
            },
        ],
        runtimeId: 'openclaw-primary',
    });

    const agent = await saveCatalogAgentProfile({
        agentId: 'blippy',
        primaryColor: '#14b8a6',
    });

    assert.equal(agent.primaryColor, '#14b8a6');
    assert.equal(agent.effectivePrimaryColor, '#14b8a6');
});
