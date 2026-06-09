import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as agentRuntimeAgents from '../src/agent-runtime/agents.ts';
import type { TavernAgentRuntimeClient } from '../src/agent-runtime/client.ts';
import * as invalidationEvents from '../src/api/invalidation-events.ts';

function createAgentRuntimeClient(
    agentRuntimeConfigs: Array<{
        avatar: string | null;
        enabledSkillIds: string[];
        emoji: string | null;
        id: string;
        isAdmin: boolean;
        name: string;
        primaryColor: string | null;
        workspaceFolder: string;
    }>
): TavernAgentRuntimeClient {
    const byId = new Map(agentRuntimeConfigs.map((config) => [config.id, config] as const));

    return {
        createCronJob: async () => {
            throw new Error('not used');
        },
        deleteCronJob: async () => {
            throw new Error('not used');
        },
        getAgentConfig: async (agentId) => byId.get(agentId) ?? null!,
        getCronJob: async () => {
            throw new Error('not used');
        },
        getStatus: async () => {
            throw new Error('not used');
        },
        listAgents: async () => ({
            agents: [...byId.values()],
        }),
        listCronJobs: async () => {
            throw new Error('not used');
        },
        listChats: async () => {
            throw new Error('not used');
        },
        listCronRuns: async () => {
            throw new Error('not used');
        },
        listSessionMessages: async () => {
            throw new Error('not used');
        },
        listSessions: async () => {
            throw new Error('not used');
        },
        listSkills: async () => ({
            skills: [],
        }),
        postMessage: async () => {
            throw new Error('not used');
        },
        runCronJob: async () => {
            throw new Error('not used');
        },
        updateCronJob: async () => {
            throw new Error('not used');
        },
        upsertAgent: async () => {
            throw new Error('not used');
        },
    };
}

afterEach(() => {
    mock.restore();
});

test('syncAgents stores runtime agent ids without importing config fields', async () => {
    const invalidateSpy = spyOn(invalidationEvents, 'emitAgentUpdated').mockImplementation();

    const synced = await agentRuntimeAgents.syncAgents(
        createAgentRuntimeClient([
            {
                avatar: 'PX',
                enabledSkillIds: ['agent-browser'],
                emoji: 'PX',
                id: 'agent:planner',
                isAdmin: false,
                name: 'Planner from Runtime',
                primaryColor: '#14b8a6',
                workspaceFolder: 'agent-planner',
            },
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'agent:writer',
                isAdmin: false,
                name: 'Writer from Runtime',
                primaryColor: null,
                workspaceFolder: 'agent-writer',
            },
        ])
    );

    assert.deepEqual(
        synced.map((agent) => agent.id),
        ['agent:planner', 'agent:writer']
    );
    assert.equal(invalidateSpy.mock.calls.length, 1);
});

test('syncAgent stores a single runtime agent id without importing config fields', async () => {
    const invalidateSpy = spyOn(invalidationEvents, 'emitAgentUpdated').mockImplementation();

    const synced = await agentRuntimeAgents.syncAgent(
        'agent:planner',
        createAgentRuntimeClient([
            {
                avatar: 'PL',
                enabledSkillIds: ['agent-browser'],
                emoji: 'PL',
                id: 'agent:planner',
                isAdmin: false,
                name: 'Planner',
                primaryColor: '#14b8a6',
                workspaceFolder: 'agent-planner',
            },
        ])
    );

    assert.equal(synced?.id, 'agent:planner');
    assert.equal(synced?.name, 'Planner');
    assert.equal(invalidateSpy.mock.calls.length, 1);
});

test('syncAgents leaves the local agent registry alone when runtime is unavailable', async () => {
    const invalidateSpy = spyOn(invalidationEvents, 'emitAgentUpdated').mockImplementation();

    const synced = await agentRuntimeAgents.syncAgents(null);

    assert.deepEqual(synced, []);
    assert.equal(invalidateSpy.mock.calls.length, 0);
});
