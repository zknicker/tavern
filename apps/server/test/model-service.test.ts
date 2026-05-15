import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as agentCatalog from '../src/agents/catalog.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { listModels } from '../src/model/service.ts';
import * as openRouterSettings from '../src/openrouter/settings.ts';

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
});

test('listModels exposes explicit runtime harness model names', async () => {
    spyOn(agentCatalog, 'listAgentCatalog').mockImplementation(async () => []);
    spyOn(openRouterSettings, 'getOpenRouterSettings').mockImplementation(async () => ({
        apiKey: '',
        hasApiKey: false,
        hasManagementApiKey: false,
        managementApiKey: '',
        updatedAt: '2026-04-04T12:00:00.000Z',
    }));

    const result = await listModels();
    const codexModel = result.models.find((model) => model.ref === 'codex/gpt-5.5');
    const claudeModel = result.models.find((model) => model.ref === 'claude/claude-sonnet-4-6');

    assert.deepEqual(
        codexModel?.openClawNames?.map((name) => ({
            harness: name.harness,
            id: name.id,
            label: name.label,
            preferred: name.isPreferred,
        })),
        [
            {
                harness: 'codex',
                id: 'codex:openai/gpt-5.5',
                label: 'openai/gpt-5.5',
                preferred: true,
            },
        ]
    );
    assert.deepEqual(
        claudeModel?.openClawNames?.map((name) => name.harness),
        ['pi']
    );
    assert.equal(result.openRouter.updatedAt, '2026-04-04T12:00:00.000Z');
});
