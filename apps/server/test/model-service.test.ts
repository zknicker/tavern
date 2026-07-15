import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as runtimeClientFactory from '../src/agent-runtime/client-factory.ts';
import * as runtimeModels from '../src/agent-runtime/models.ts';
import * as agentCatalog from '../src/agents/catalog.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { listModels } from '../src/model/service.ts';
import * as openRouterSettings from '../src/openrouter/settings.ts';
import * as runtimeConnections from '../src/storage/agent-runtime-connections.ts';
import * as agentStorage from '../src/storage/agents.ts';

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
});

test('listModels exposes agent model options from the runtime', async () => {
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
                name: 'Agent Runtime',
                updatedAt: '2026-04-04T12:00:00.000Z',
            },
        ]
    );
    spyOn(runtimeClientFactory, 'createAgentRuntimeClientForConnection').mockImplementation(
        () =>
            ({
                close() {},
                listAgents: async () => ({ agents: [] }),
            }) as never
    );
    spyOn(runtimeModels, 'getAgentRuntimeModels').mockImplementation(async () => ({
        models: [
            {
                capability: 'agent',
                id: 'codex/gpt-5.5',
                label: 'GPT-5.5',
                provider: 'codex',
                route: { baseUrl: null, model: 'gpt-5.5', provider: 'codex' },
            },
            {
                capability: 'agent',
                id: 'codex/gpt-5.4',
                label: 'GPT-5.4',
                provider: 'codex',
                route: { baseUrl: null, model: 'gpt-5.4', provider: 'codex' },
            },
            {
                capability: 'agent',
                id: 'claude/claude-sonnet-4-6',
                label: 'Claude Sonnet 4.6',
                provider: 'claude',
                route: { baseUrl: null, model: 'claude-sonnet-4-6', provider: 'claude' },
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
    const codexModel = result.models.find((model) => model.ref === 'codex/gpt-5.5');

    assert.equal(codexModel?.provider, 'codex');
    assert.equal(codexModel?.modelId, 'gpt-5.5');
    assert.equal(codexModel?.name, 'GPT-5.5');
    assert.deepEqual(
        result.models.filter((model) => model.provider === 'codex').map((model) => model.ref),
        ['codex/gpt-5.4', 'codex/gpt-5.5']
    );
    assert.equal(
        result.models.some((model) => model.ref === 'claude/claude-sonnet-4-6'),
        true
    );
    assert.equal(result.openRouter.updatedAt, '2026-04-04T12:00:00.000Z');
});

test('listModels reads agent settings from the cached Runtime agent default model', async () => {
    spyOn(agentCatalog, 'listAgentCatalog').mockImplementation(
        async () =>
            [
                {
                    defaultPrimaryColor: '#64748b',
                    effectivePrimaryColor: '#64748b',
                    enabledSkillIds: [],
                    id: 'agt_primary',
                    name: 'Tavern',
                    primaryColor: null,
                    runtimeId: 'runtime-1',
                    title: 'Tavern',
                    updatedAt: '2026-04-04T12:00:00.000Z',
                    userInstructions: '',
                    usesAllSkills: false,
                },
            ] as never
    );
    spyOn(agentStorage, 'listAgents').mockImplementation(
        async () =>
            [
                {
                    enabledSkillIdsJson: '[]',
                    id: 'agt_primary',
                    lastSyncedAt: '2026-04-04T12:00:00.000Z',
                    name: 'Tavern',
                    rawJson: JSON.stringify({
                        enabledSkillIds: [],
                        id: 'agt_primary',
                        isAdmin: true,
                        modelName: { model: 'gpt-5.5', provider: 'openai' },
                        name: 'Tavern',
                        primaryColor: null,
                        thinkingDefault: null,
                        workspaceFolder: '.tavern/agents/agt_primary/workspace',
                    }),
                    runtimeId: 'runtime-1',
                },
            ] as never
    );
    spyOn(runtimeConnections, 'listConfiguredAgentRuntimeConnections').mockImplementation(
        async () => []
    );
    spyOn(openRouterSettings, 'getOpenRouterSettings').mockImplementation(async () => ({
        apiKey: '',
        hasApiKey: false,
        hasManagementApiKey: false,
        managementApiKey: '',
        updatedAt: null,
    }));

    const result = await listModels();

    assert.deepEqual(result.agents[0], {
        agentId: 'agt_primary',
        agentName: 'Tavern',
        effectiveThinkingDefault: null,
        isOverridden: true,
        isThinkingOverridden: false,
        model: 'gpt-5.5',
        modelRef: 'openai/gpt-5.5',
        overrideThinkingDefault: null,
        provider: 'openai',
        syncError: null,
        syncedAt: '2026-04-04T12:00:00.000Z',
    });
});

test('listModels prefers live Runtime agent defaults over cached agent rows', async () => {
    spyOn(agentCatalog, 'listAgentCatalog').mockImplementation(
        async () =>
            [
                {
                    defaultPrimaryColor: '#64748b',
                    effectivePrimaryColor: '#64748b',
                    enabledSkillIds: [],
                    id: 'agt_primary',
                    name: 'Tavern',
                    primaryColor: null,
                    runtimeId: 'runtime-1',
                    title: 'Tavern',
                    updatedAt: '2026-04-04T12:00:00.000Z',
                    userInstructions: '',
                    usesAllSkills: false,
                },
            ] as never
    );
    spyOn(agentStorage, 'listAgents').mockImplementation(
        async () =>
            [
                {
                    enabledSkillIdsJson: '[]',
                    id: 'agt_primary',
                    lastSyncedAt: '2026-04-04T12:00:00.000Z',
                    name: 'Tavern',
                    rawJson: JSON.stringify({
                        enabledSkillIds: [],
                        id: 'agt_primary',
                        isAdmin: true,
                        modelName: { model: 'gpt-4.1-mini', provider: 'openai' },
                        name: 'Tavern',
                        primaryColor: null,
                        thinkingDefault: null,
                        workspaceFolder: '.tavern/agents/agt_primary/workspace',
                    }),
                    runtimeId: 'runtime-1',
                },
            ] as never
    );
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
                name: 'Agent Runtime',
                updatedAt: '2026-04-04T12:00:00.000Z',
            },
        ]
    );
    spyOn(runtimeClientFactory, 'createAgentRuntimeClientForConnection').mockImplementation(
        () =>
            ({
                close() {},
                listAgents: async () => ({
                    agents: [
                        {
                            enabledSkillIds: [],
                            id: 'agt_primary',
                            isAdmin: true,
                            modelName: { model: 'gpt-5.5', provider: 'codex' },
                            name: 'Tavern',
                            primaryColor: null,
                            thinkingDefault: 'high',
                            workspaceFolder: '.tavern/agents/agt_primary/workspace',
                        },
                    ],
                }),
            }) as never
    );
    spyOn(runtimeModels, 'getAgentRuntimeModels').mockImplementation(async () => ({
        models: [],
        updatedAt: '2026-04-04T12:00:00.000Z',
    }));
    spyOn(openRouterSettings, 'getOpenRouterSettings').mockImplementation(async () => ({
        apiKey: '',
        hasApiKey: false,
        hasManagementApiKey: false,
        managementApiKey: '',
        updatedAt: null,
    }));

    const result = await listModels();

    assert.equal(result.agents[0]?.modelRef, 'codex/gpt-5.5');
    assert.equal(result.agents[0]?.overrideThinkingDefault, 'high');
});
