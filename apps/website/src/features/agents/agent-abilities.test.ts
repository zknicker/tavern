import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentListOutput, PluginListOutput, SkillListOutput } from '../../lib/trpc.tsx';
import {
    selectAddablePlugins,
    selectAddableSkills,
    selectAgentSkills,
    selectGrantedPlugins,
} from './agent-abilities.ts';

const skills = [
    createSkill({ id: 'skill_enabled', usability: 'enabled' }),
    createSkill({ id: 'skill_disabled', usability: 'disabled' }),
    createSkill({ id: 'skill_broken', usability: 'not_usable' }),
    createSkill({
        id: 'skill_plugin',
        plugin: { displayName: 'Google', enabled: true, id: 'google' },
        usability: 'enabled',
    }),
] satisfies SkillListOutput['skills'];

const plugins = [
    createPlugin({ enabled: true, id: 'google' }),
    createPlugin({ enabled: false, id: 'merchbase' }),
] satisfies PluginListOutput['plugins'];

test('selectAgentSkills keeps assigned non-plugin skills even when unusable', () => {
    const agent = createAgent({ enabledSkillIds: ['skill_broken', 'skill_plugin'] });

    assert.deepEqual(
        selectAgentSkills(skills, agent).map((skill) => skill.id),
        ['skill_broken']
    );
});

test('selectAddableSkills offers only usable, unassigned, non-plugin skills', () => {
    const agent = createAgent({ enabledSkillIds: [] });

    assert.deepEqual(
        selectAddableSkills(skills, agent).map((skill) => skill.id),
        ['skill_enabled']
    );
});

test('selectAddableSkills excludes skills the agent already has', () => {
    const agent = createAgent({ enabledSkillIds: ['skill_enabled'] });

    assert.deepEqual(selectAddableSkills(skills, agent), []);
});

test('selectGrantedPlugins keeps grants for globally disabled plugins', () => {
    const agent = createAgent({ enabledPluginIds: ['merchbase'] });

    assert.deepEqual(
        selectGrantedPlugins(plugins, agent).map((plugin) => plugin.id),
        ['merchbase']
    );
});

test('selectAddablePlugins offers only enabled, ungranted plugins', () => {
    assert.deepEqual(
        selectAddablePlugins(plugins, createAgent({})).map((plugin) => plugin.id),
        ['google']
    );
    assert.deepEqual(
        selectAddablePlugins(plugins, createAgent({ enabledPluginIds: ['google'] })),
        []
    );
});

function createAgent(input: {
    enabledPluginIds?: AgentListOutput['agents'][number]['enabledPluginIds'];
    enabledSkillIds?: string[];
}): AgentListOutput['agents'][number] {
    return {
        autoDispatchEnabled: false,
        bio: null,
        character: null,
        defaultCharacter: 'robot',
        defaultPrimaryColor: '#6f7f9b',
        effectiveCharacter: 'robot',
        effectivePrimaryColor: '#6f7f9b',
        enabledPluginIds: input.enabledPluginIds ?? [],
        enabledSkillIds: input.enabledSkillIds ?? [],
        id: 'agt_alpha',
        name: 'Alpha',
        primaryColor: null,
        runtimeId: 'runtime-local',
        taskReviewPolicy: false,
        title: 'Alpha',
        updatedAt: '2026-07-01T00:00:00.000Z',
        userInstructions: '',
        usesAllSkills: false,
    };
}

function createSkill(input: {
    id: string;
    plugin?: SkillListOutput['skills'][number]['plugin'];
    usability: SkillListOutput['skills'][number]['usability'];
}): SkillListOutput['skills'][number] {
    return {
        allowedTools: null,
        dependencyState: 'ready',
        description: null,
        diagnostic: null,
        enabled: input.usability !== 'disabled',
        id: input.id,
        missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
        name: input.id,
        plugin: input.plugin ?? null,
        readOnly: Boolean(input.plugin),
        surface: 'agent',
        updatedAt: null,
        usability: input.usability,
        version: null,
    };
}

function createPlugin(input: {
    enabled: boolean;
    id: PluginListOutput['plugins'][number]['id'];
}): PluginListOutput['plugins'][number] {
    return {
        config: {},
        description: `${input.id} plugin`,
        displayName: input.id,
        enabled: input.enabled,
        id: input.id,
        secrets: [],
        services: [],
        updatedAt: null,
    };
}
