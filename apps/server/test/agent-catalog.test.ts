import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { buildDashboardAgents, toAgentCatalogItem } from '../src/agents/catalog.ts';

function createAgent(
    overrides: Partial<Parameters<typeof toAgentCatalogItem>[0]> = {}
): Parameters<typeof toAgentCatalogItem>[0] {
    return {
        enabledSkillIds: null,
        id: 'agent-1',
        name: 'Alpha Agent',
        primaryColor: null,
        updatedAt: '2026-03-13T00:00:00.000Z',
        ...overrides,
    };
}

test('toAgentCatalogItem keeps runtime-backed agent fields intact', () => {
    const item = toAgentCatalogItem(
        createAgent({
            name: 'Planner',
            primaryColor: '#14b8a6',
        })
    );

    assert.equal(item.name, 'Planner');
    assert.equal(item.primaryColor, '#14b8a6');
    assert.equal(item.effectivePrimaryColor, '#14b8a6');
    assert.equal(item.usesAllSkills, false);
});

test('buildDashboardAgents applies stored overrides and live activity counts', () => {
    const agents = buildDashboardAgents({
        agents: [
            createAgent({
                name: 'Planner',
                primaryColor: '#14b8a6',
            }),
        ],
        cronJobs: [
            {
                cadence: '5m',
                description: 'sync',
                id: 'job-1',
                lastRunAt: '2026-03-13T00:00:00.000Z',
                name: 'Sync',
                schedule: 'Every 5m',
                state: 'enabled',
                successRate: 'ok',
                target: 'agent-1',
            },
        ],
        sessions: [
            {
                agentId: 'agent-1',
                channel: '#ops',
            },
            {
                agentId: 'agent-1',
                channel: '#ops',
            },
        ],
    });

    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.name, 'Planner');
    assert.equal(agents[0]?.accentFrom, '#14b8a6');
    assert.equal(agents[0]?.chatCount, 1);
    assert.equal(agents[0]?.sessionCount, 2);
    assert.equal(agents[0]?.cronCount, 1);
});

test('buildDashboardAgents matches cron targets by agent id instead of substring', () => {
    const agents = buildDashboardAgents({
        agents: [createAgent(), createAgent({ id: 'agent-10', name: 'Beta Agent' })],
        cronJobs: [
            {
                cadence: '5m',
                description: 'sync',
                id: 'job-1',
                lastRunAt: '2026-03-13T00:00:00.000Z',
                name: 'Sync',
                schedule: 'Every 5m',
                state: 'enabled',
                successRate: 'ok',
                target: 'agent-10',
            },
        ],
        sessions: [],
    });

    assert.equal(agents.find((agent) => agent.id === 'agent-1')?.cronCount, 0);
    assert.equal(agents.find((agent) => agent.id === 'agent-10')?.cronCount, 1);
});
