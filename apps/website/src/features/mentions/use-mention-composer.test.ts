import { describe, expect, it } from 'bun:test';
import type { ActiveMentionQuery, MentionOption } from './mention-types.ts';
import { selectVisibleOptions } from './mention-visible-options.ts';
import { resolveSkillScopeAgentIds } from './use-mention-composer.tsx';

describe('selectVisibleOptions', () => {
    it('uses @ only for agent mentions', () => {
        expect(
            selectVisibleOptions({
                activeQuery: createQuery('@'),
                commandOptions: [],
                mentionOptions: [agentOption, skillOption, appOption],
                supportsCommands: false,
            })
        ).toEqual([agentOption]);
    });

    it('uses $ only for skill mentions', () => {
        expect(
            selectVisibleOptions({
                activeQuery: createQuery('$'),
                commandOptions: [],
                mentionOptions: [agentOption, skillOption, appOption],
                supportsCommands: false,
            })
        ).toEqual([skillOption]);
    });
});

describe('resolveSkillScopeAgentIds', () => {
    it('falls back to all mentionable chat agents when no agent is tagged', () => {
        expect(
            resolveSkillScopeAgentIds({
                agentId: '',
                mentionableAgentIds: ['agent:planner', 'agent:builder'],
                mentions: [],
            })
        ).toEqual(['agent:planner', 'agent:builder']);
    });

    it('uses the tagged agent union when agent mentions exist', () => {
        expect(
            resolveSkillScopeAgentIds({
                agentId: '',
                mentionableAgentIds: ['agent:planner', 'agent:builder', 'agent:critic'],
                mentions: [
                    {
                        end: 8,
                        id: 'agent://agent%3Aplanner',
                        kind: 'agent',
                        label: 'Planner',
                        projection: 'agent-reference',
                        start: 0,
                        text: '@Planner',
                    },
                    {
                        end: 17,
                        id: 'agent://agent%3Abuilder',
                        kind: 'agent',
                        label: 'Builder',
                        projection: 'agent-reference',
                        start: 9,
                        text: '@Builder',
                    },
                ],
            })
        ).toEqual(['agent:planner', 'agent:builder']);
    });

    it('ignores stale agent mentions outside the current mentionable chat agents', () => {
        expect(
            resolveSkillScopeAgentIds({
                agentId: '',
                mentionableAgentIds: ['agent:planner'],
                mentions: [
                    {
                        end: 6,
                        id: 'agent://agent%3Astale',
                        kind: 'agent',
                        label: 'Stale',
                        projection: 'agent-reference',
                        start: 0,
                        text: '@Stale',
                    },
                ],
            })
        ).toEqual(['agent:planner']);
    });

    it('falls back to the composer agent when no chat agent set exists', () => {
        expect(
            resolveSkillScopeAgentIds({
                agentId: 'agent:primary',
                mentionableAgentIds: [],
                mentions: [],
            })
        ).toEqual(['agent:primary']);
    });
});

function createQuery(trigger: '@' | '$'): ActiveMentionQuery {
    return {
        end: 1,
        query: '',
        start: 0,
        trigger,
    };
}

const agentOption: MentionOption = {
    description: 'Agent in this chat',
    id: 'agt_primary',
    insertText: '@Tavern',
    kind: 'agent',
    label: 'Tavern',
    projection: 'agent-reference',
};

const skillOption: MentionOption = {
    description: 'Use Tavern chat context, memory, files, and local tools.',
    id: 'skill://tavern',
    insertText: 'tavern',
    kind: 'skill',
    label: 'Tavern Agent',
    projection: 'skill-activation',
};

const appOption: MentionOption = {
    description: 'Computer Use',
    id: 'plugin://computer-use@openai-bundled',
    insertText: 'Finder',
    kind: 'app',
    label: 'Finder',
    projection: 'capability-reference',
};
