import { describe, expect, it } from 'bun:test';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { buildSkillMentionOptions } from './use-tool-mention-options.ts';

describe('buildSkillMentionOptions', () => {
    it('returns installed skills without tool fallbacks', () => {
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
                    installSource: { source: 'github', spec: 'tavern/writer' },
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
                sourceLabel: 'Tavern',
            },
            {
                description: null,
                id: 'writer',
                kind: 'skill',
                label: 'Publish Changes',
                sourceLabel: 'GitHub',
            },
            {
                description: null,
                id: 'unused',
                kind: 'skill',
                label: 'Unused Skill',
                sourceLabel: 'Tavern',
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
                    installSource: { source: 'clawhub', spec: 'hatch-pet' },
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
                sourceLabel: 'ClawHub',
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
        dependencyState: 'ready',
        description: null,
        id,
        installSource: null,
        latestVersion: null,
        missing: {
            anyBins: [],
            bins: [],
            config: [],
            env: [],
            os: [],
        },
        name,
        updateAvailable: false,
        updateCheckedAt: null,
        updateError: null,
        updatedAt: null,
        version: null,
        ...rest,
    };
}
