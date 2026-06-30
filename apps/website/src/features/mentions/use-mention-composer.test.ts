import { describe, expect, it } from 'bun:test';
import type { ActiveMentionQuery, MentionOption } from './mention-types.ts';
import { selectVisibleOptions } from './mention-visible-options.ts';

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
    id: '/skills/tavern/SKILL.md',
    insertText: 'tavern',
    kind: 'skill',
    label: 'Tavern Agent',
    projection: 'skill-context',
};

const appOption: MentionOption = {
    description: 'Computer Use',
    id: 'plugin://computer-use@openai-bundled',
    insertText: 'Finder',
    kind: 'app',
    label: 'Finder',
    projection: 'capability-reference',
};
