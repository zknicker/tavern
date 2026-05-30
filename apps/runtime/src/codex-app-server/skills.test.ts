import { describe, expect, it } from 'vitest';

import { mapCodexSkillsResult, mergeOpenClawAndCodexSkills } from './skills';

describe('Codex app-server skills', () => {
    it('maps Codex skills into runtime skill summaries', () => {
        const skills = mapCodexSkillsResult({
            data: [
                {
                    cwd: '/repo',
                    skills: [
                        {
                            description: 'Inspect repository history',
                            enabled: true,
                            interface: {
                                displayName: 'Git',
                                shortDescription: 'Work with Git history',
                            },
                            name: 'git',
                            path: '/codex/skills/git/SKILL.md',
                            scope: 'system',
                        },
                    ],
                },
            ],
        });

        expect(skills).toEqual([
            expect.objectContaining({
                description: 'Work with Git history',
                eligible: true,
                id: 'codex:git',
                name: 'Git',
                runtimeSource: 'codex-app-server',
                source: 'builtin',
            }),
        ]);
    });

    it('keeps shared installed skills as OpenClaw rows', () => {
        const merged = mergeOpenClawAndCodexSkills(
            [
                createSkill({
                    filePath: '/Users/me/.agents/skills/agent-browser/SKILL.md',
                    id: 'agent-browser',
                    name: 'agent-browser',
                    runtimeSource: 'agents-skills-personal',
                }),
            ],
            [
                createSkill({
                    filePath: '/Users/me/.agents/skills/agent-browser/SKILL.md',
                    id: 'codex:agent-browser',
                    name: 'Agent Browser',
                    runtimeSource: 'codex-app-server',
                    skillKey: 'agent-browser',
                }),
                createSkill({
                    filePath: '/Users/me/.codex/plugins/cache/github/SKILL.md',
                    id: 'codex:github:github',
                    name: 'GitHub',
                    runtimeSource: 'codex-app-server',
                    skillKey: 'github:github',
                }),
            ]
        );

        expect(merged.map((skill) => skill.id)).toEqual(['agent-browser', 'codex:github:github']);
    });
});

function createSkill(input: {
    filePath?: string;
    id: string;
    name: string;
    runtimeSource: string;
    skillKey?: string;
}) {
    return {
        allowedTools: null,
        configChecks: [],
        description: null,
        filePath: input.filePath,
        id: input.id,
        install: [],
        missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
        name: input.name,
        requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
        runtimeSource: input.runtimeSource,
        skillKey: input.skillKey,
        source: 'installed' as const,
        updatedAt: null,
    };
}
