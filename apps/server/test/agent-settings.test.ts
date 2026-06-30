import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const directory = mkdtempSync(join(tmpdir(), 'tavern-agent-settings-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;
const originalFetch = globalThis.fetch;

const [
    { createAgent },
    { saveCatalogAgentProfile, saveCatalogAgentSettings },
    { ensureDatabaseSchema },
    agentStorage,
    { databaseClient },
    { saveAgentRuntimeConnection },
] = await Promise.all([
    import('../src/agent-settings/service.ts'),
    import('../src/agents/catalog.ts'),
    import('../src/db/bootstrap.ts'),
    import('../src/storage/agents.ts'),
    import('../src/db/index.ts'),
    import('../src/storage/agent-runtime-connections.ts'),
]);

ensureDatabaseSchema();

test.beforeEach(() => {
    globalThis.fetch = originalFetch;
    databaseClient.exec('delete from agent_profiles');
    databaseClient.exec('delete from agent_runtime_connections');
    databaseClient.exec('delete from agents');
});

test('createAgent creates through Runtime and syncs the catalog row', async () => {
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-06-29T00:00:00.000Z',
        lastError: null,
        name: 'Runtime',
    });
    let createdAgent: {
        enabledSkillIds: string[];
        id: string;
        isAdmin: boolean;
        name: string;
        primaryColor: null | string;
        workspaceFolder: string;
    } | null = null;
    globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === '/agents' && init?.method === 'POST') {
            const body = JSON.parse(String(init.body)) as {
                id: string;
                name: string;
                primaryColor?: null | string;
            };
            createdAgent = {
                enabledSkillIds: [],
                id: body.id,
                isAdmin: false,
                name: body.name,
                primaryColor: body.primaryColor ?? null,
                workspaceFolder: `/runtime/agents/${body.id}/workspace`,
            };
            return Response.json(createdAgent);
        }
        if (url.pathname === '/agents') {
            return Response.json({ agents: createdAgent ? [createdAgent] : [] });
        }
        throw new Error(`Unexpected fetch: ${url.pathname}`);
    };

    const agent = await createAgent({ name: 'Planner' });

    assert.ok(agent.id.startsWith('agt_planner_'));
    assert.equal(agent.name, 'Planner');
    assert.equal(agent.runtimeId, 'runtime-1');
});

test('saveCatalogAgentProfile saves color without requiring a runtime connection', async () => {
    await agentStorage.syncAgentsForRuntime({
        agents: [
            {
                enabledSkillIds: [],
                id: 'blippy',
                isAdmin: false,
                name: 'Blippy',
                primaryColor: null,
                workspaceFolder: 'blippy',
            },
        ],
        runtimeId: 'agent-primary',
    });

    const agent = await saveCatalogAgentProfile({
        agentId: 'blippy',
        primaryColor: '#14b8a6',
    });

    assert.equal(agent.primaryColor, '#14b8a6');
    assert.equal(agent.effectivePrimaryColor, '#14b8a6');
});

test('saveCatalogAgentSettings persists skill enablement through runtime agent config', async () => {
    await agentStorage.syncAgentsForRuntime({
        agents: [
            {
                enabledSkillIds: [],
                id: 'blippy',
                isAdmin: false,
                name: 'Blippy',
                primaryColor: null,
                workspaceFolder: 'blippy',
            },
        ],
        runtimeId: 'agent-primary',
    });

    let savedEnabledSkillIds: string[] | null = null;
    let listedSkillsAgentId: string | null = null;
    const runtimeClient = {
        getAgentConfig: async () => ({
            enabledSkillIds: [],
            id: 'blippy',
            isAdmin: false,
            name: 'Blippy',
            primaryColor: null,
            workspaceFolder: 'blippy',
        }),
        listAgents: async () => ({
            agents: [
                {
                    enabledSkillIds: savedEnabledSkillIds ?? [],
                    id: 'blippy',
                    isAdmin: false,
                    name: 'Blippy',
                    primaryColor: null,
                    workspaceFolder: 'blippy',
                },
            ],
        }),
        listSkills: async (options?: { agentId?: string }) => {
            listedSkillsAgentId = options?.agentId ?? null;
            return {
                skills: [
                    {
                        allowedTools: null,
                        baseDir: null,
                        bundled: null,
                        commandVisible: null,
                        configChecks: [],
                        description: null,
                        disabled: null,
                        eligible: true,
                        filePath: null,
                        id: 'browser',
                        install: [],
                        missing: {
                            anyBins: [],
                            bins: [],
                            config: [],
                            env: [],
                            os: [],
                        },
                        modelVisible: true,
                        name: 'Browser',
                        primaryEnv: null,
                        requirements: {
                            anyBins: [],
                            bins: [],
                            config: [],
                            env: [],
                            os: [],
                        },
                        runtimeSource: null,
                        skillKey: null,
                        source: null,
                        updatedAt: null,
                        userInvocable: true,
                    },
                ],
            };
        },
        upsertAgent: async (agent: { enabledSkillIds: string[] }) => {
            savedEnabledSkillIds = agent.enabledSkillIds;
            return {
                enabledSkillIds: agent.enabledSkillIds,
                id: 'blippy',
                isAdmin: false,
                name: 'Blippy',
                primaryColor: null,
                workspaceFolder: 'blippy',
            };
        },
    };

    const agent = await saveCatalogAgentSettings(
        {
            agentId: 'blippy',
            enabledSkillIds: ['browser'],
        },
        runtimeClient as never
    );

    assert.deepEqual(savedEnabledSkillIds, ['browser']);
    assert.equal(listedSkillsAgentId, 'blippy');
    assert.deepEqual(agent.enabledSkillIds, ['browser']);
});

test('saveCatalogAgentSettings leaves skills untouched for name-only saves', async () => {
    await agentStorage.syncAgentsForRuntime({
        agents: [
            {
                enabledSkillIds: ['runtime-newer-skill'],
                id: 'blippy',
                isAdmin: false,
                name: 'Blippy',
                primaryColor: null,
                workspaceFolder: 'blippy',
            },
        ],
        runtimeId: 'agent-primary',
    });

    let savedEnabledSkillIds: string[] | undefined;
    const runtimeClient = {
        getAgentConfig: async () => ({
            enabledSkillIds: ['runtime-newer-skill'],
            id: 'blippy',
            isAdmin: false,
            name: 'Blippy',
            primaryColor: null,
            workspaceFolder: 'blippy',
        }),
        listAgents: async () => ({
            agents: [
                {
                    enabledSkillIds: ['runtime-newer-skill'],
                    id: 'blippy',
                    isAdmin: false,
                    name: 'Renamed',
                    primaryColor: null,
                    workspaceFolder: 'blippy',
                },
            ],
        }),
        listSkills: async () => {
            throw new Error('skills inventory should not be read');
        },
        upsertAgent: async (agent: { enabledSkillIds?: string[]; name: string }) => {
            savedEnabledSkillIds = agent.enabledSkillIds;
            return {
                enabledSkillIds: ['runtime-newer-skill'],
                id: 'blippy',
                isAdmin: false,
                name: agent.name,
                primaryColor: null,
                workspaceFolder: 'blippy',
            };
        },
    };

    const agent = await saveCatalogAgentSettings(
        {
            agentId: 'blippy',
            displayName: 'Renamed',
        },
        runtimeClient as never
    );

    assert.equal(savedEnabledSkillIds, undefined);
    assert.equal(agent.name, 'Renamed');
    assert.deepEqual(agent.enabledSkillIds, ['runtime-newer-skill']);
});
