import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { toAgentCatalogItem } from '../src/agents/catalog.ts';

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
