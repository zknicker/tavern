import { expect, test } from 'bun:test';
import { buildSkillTreePaths, buildSkillTreeSubjects } from './skill-tree-model.ts';

test('buildSkillTreeSubjects maps installed and available skills into SKILL.md paths', () => {
    const subjects = buildSkillTreeSubjects({
        available: {
            builtin: [
                {
                    description: 'Official optional skill',
                    identifier: 'official/browser',
                    name: 'browser',
                    repo: null,
                    source: 'official',
                    tags: [],
                    trustLevel: 'builtin',
                },
            ],
            installed: {
                'official/browser': {
                    name: 'browser',
                    scanVerdict: null,
                    trustLevel: 'builtin',
                },
            },
            taps: [
                {
                    path: 'skills/',
                    repo: 'owner/repo',
                    skills: [
                        {
                            description: 'Tap skill',
                            identifier: 'owner/repo/skills/research',
                            name: 'research',
                            repo: 'owner/repo',
                            source: 'github',
                            tags: [],
                            trustLevel: 'community',
                        },
                    ],
                },
            ],
        },
        hubByName: new Map([
            ['browser', { identifier: 'official/browser', trustLevel: 'builtin' }],
        ]),
        skills: [
            {
                allowedTools: null,
                dependencyState: 'ready',
                description: 'Reads pages',
                diagnostic: null,
                enabled: true,
                id: 'browser',
                missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                name: 'browser',
                plugin: null,
                readOnly: false,
                surface: 'agent',
                updatedAt: null,
                usability: 'enabled',
                version: null,
            },
        ],
    });

    expect(subjects.map((subject) => subject.treePath)).toEqual([
        'Installed skills/browser/SKILL.md',
        'Available skills/owner/repo/research/SKILL.md',
        'Available skills/Built-in library/browser/SKILL.md',
    ]);
    expect(buildSkillTreePaths(subjects)).toContain('Installed skills/browser/');
});

test('buildSkillTreeSubjects groups plugin skills under title-case Plugin Skills', () => {
    const subjects = buildSkillTreeSubjects({
        hubByName: new Map(),
        skills: [
            {
                allowedTools: null,
                dependencyState: 'ready',
                description: 'MerchBase workflow guidance',
                diagnostic: null,
                enabled: true,
                id: 'merchbase',
                missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                name: 'merchbase',
                plugin: {
                    displayName: 'MerchBase',
                    enabled: true,
                    id: 'merchbase',
                },
                readOnly: true,
                surface: 'agent',
                updatedAt: null,
                usability: 'enabled',
                version: null,
            },
        ],
    });

    expect(subjects.map((subject) => subject.treePath)).toEqual([
        'Plugin Skills/MerchBase/merchbase/SKILL.md',
    ]);
});
