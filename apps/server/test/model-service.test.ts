import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as runtimeClientFactory from '../src/agent-runtime/client-factory.ts';
import * as runtimeModels from '../src/agent-runtime/models.ts';
import * as agentCatalog from '../src/agents/catalog.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { listModels } from '../src/model/service.ts';
import * as openRouterSettings from '../src/openrouter/settings.ts';
import * as runtimeConnections from '../src/storage/agent-runtime-connections.ts';

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
});

test('listModels exposes Hermes model options from the runtime', async () => {
    spyOn(agentCatalog, 'listAgentCatalog').mockImplementation(async () => []);
    spyOn(runtimeConnections, 'listConfiguredAgentRuntimeConnections').mockImplementation(
        async () => [
            {
                authJson: null,
                baseUrl: 'http://127.0.0.1:29119',
                createdAt: '2026-04-04T12:00:00.000Z',
                enabled: true,
                id: 'runtime-1',
                isActive: true,
                lastCheckedAt: '2026-04-04T12:00:00.000Z',
                lastError: null,
                lastSyncedAt: '2026-04-04T12:00:00.000Z',
                name: 'Hermes',
                updatedAt: '2026-04-04T12:00:00.000Z',
            },
        ]
    );
    spyOn(runtimeClientFactory, 'createAgentRuntimeClientForConnection').mockImplementation(
        () =>
            ({
                close() {},
            }) as never
    );
    spyOn(runtimeModels, 'getAgentRuntimeModels').mockImplementation(async () => ({
        models: [
            {
                id: 'openai-codex/gpt-5.5',
                label: 'GPT-5.5',
                provider: 'openai-codex',
            },
            {
                id: 'anthropic/claude-sonnet-4-6',
                label: 'Claude Sonnet 4.6',
                provider: 'anthropic',
            },
        ],
        updatedAt: '2026-04-04T12:00:00.000Z',
    }));
    spyOn(openRouterSettings, 'getOpenRouterSettings').mockImplementation(async () => ({
        apiKey: '',
        hasApiKey: false,
        hasManagementApiKey: false,
        managementApiKey: '',
        updatedAt: '2026-04-04T12:00:00.000Z',
    }));

    const result = await listModels();
    const codexModel = result.models.find((model) => model.ref === 'openai-codex/gpt-5.5');

    assert.equal(codexModel?.provider, 'openai-codex');
    assert.equal(codexModel?.modelId, 'gpt-5.5');
    assert.equal(codexModel?.name, 'GPT-5.5');
    assert.equal(
        result.models.some((model) => model.provider === 'codex'),
        false
    );
    assert.equal(result.openRouter.updatedAt, '2026-04-04T12:00:00.000Z');
});
