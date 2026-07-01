import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { createNewAgentName, selectSettingsAgent } from './page.tsx';

const agents = [
    createAgent({ id: 'agt_alpha', name: 'Alpha' }),
    createAgent({ id: 'agt_beta', name: 'Beta' }),
] satisfies AgentListOutput['agents'];

test('selectSettingsAgent preserves the selected agent', () => {
    assert.equal(selectSettingsAgent(agents, 'agt_beta')?.id, 'agt_beta');
});

test('selectSettingsAgent falls back to the first listed agent', () => {
    assert.equal(selectSettingsAgent(agents, null)?.id, 'agt_alpha');
    assert.equal(selectSettingsAgent(agents, 'missing')?.id, 'agt_alpha');
});

test('createNewAgentName picks the next available default name', () => {
    assert.equal(createNewAgentName(agents), 'New agent');
    assert.equal(
        createNewAgentName([
            ...agents,
            createAgent({ id: 'agt_new', name: 'New agent' }),
            createAgent({ id: 'agt_new_2', name: 'New agent 2' }),
        ]),
        'New agent 3'
    );
});

function createAgent(input: { id: string; name: string }): AgentListOutput['agents'][number] {
    return {
        character: null,
        defaultCharacter: 'robot',
        defaultPrimaryColor: '#6f7f9b',
        effectiveCharacter: 'robot',
        effectivePrimaryColor: '#6f7f9b',
        enabledPluginIds: [],
        enabledSkillIds: [],
        id: input.id,
        name: input.name,
        primaryColor: null,
        runtimeId: 'runtime-local',
        title: input.name,
        updatedAt: '2026-06-29T00:00:00.000Z',
        userInstructions: '',
        usesAllSkills: false,
    };
}
