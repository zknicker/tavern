import { describe, expect, it } from 'bun:test';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { buildSkillMentionOptions } from './use-tool-mention-options.ts';

describe('buildSkillMentionOptions', () => {
    it('returns runtime skills without tool fallbacks', () => {
        const options = buildSkillMentionOptions({
            query: '',
            skills: [
                createSkill({
                    description: "Browser automation for the user's Chrome browser.",
                    id: 'browser',
                    name: 'Chrome',
                }),
                createSkill({
                    id: 'writer',
                    name: 'Publish Changes',
                }),
                createSkill({
                    id: 'unused',
                    name: 'Unused Skill',
                }),
            ],
        });

        expect(options).toEqual([
            {
                description: "Browser automation for the user's Chrome browser.",
                id: 'browser',
                kind: 'skill',
                label: 'Chrome',
                sourceLabel: 'Runtime skill',
            },
            {
                description: null,
                id: 'writer',
                kind: 'skill',
                label: 'Publish Changes',
                sourceLabel: 'Runtime skill',
            },
            {
                description: null,
                id: 'unused',
                kind: 'skill',
                label: 'Unused Skill',
                sourceLabel: 'Runtime skill',
            },
        ]);
    });

    it('filters skills by name, id, and description', () => {
        const options = buildSkillMentionOptions({
            query: 'animated',
            skills: [
                createSkill({
                    description: "Browser automation for the user's Chrome browser.",
                    id: 'browser',
                    name: 'Chrome',
                }),
                createSkill({
                    description: 'Create Codex-compatible animated pets and spritesheets.',
                    id: 'hatch-pet',
                    name: 'Hatch Pet',
                }),
            ],
        });

        expect(options).toEqual([
            {
                description: 'Create Codex-compatible animated pets and spritesheets.',
                id: 'hatch-pet',
                kind: 'skill',
                label: 'Hatch Pet',
                sourceLabel: 'Runtime skill',
            },
        ]);
    });
});

function createSkill(
    input: Partial<SkillListOutput['skills'][number]> & {
        id: string;
        name: string;
    }
): SkillListOutput['skills'][number] {
    const { id, name, ...rest } = input;

    return {
        agentCount: 0,
        allowedTools: null,
        diagnostic: null,
        dependencyState: 'ready',
        description: null,
        id,
        missing: {
            anyBins: [],
            bins: [],
            config: [],
            env: [],
            os: [],
        },
        name,
        updatedAt: null,
        usability: 'enabled',
        version: null,
        ...rest,
    };
}
