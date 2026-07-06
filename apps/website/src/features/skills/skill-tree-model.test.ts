import { expect, test } from 'bun:test';
import { buildSkillTreePaths, buildSkillTreeSubjects } from './skill-tree-model.ts';

test('buildSkillTreeSubjects maps installed skills into flat SKILL.md paths', () => {
    const subjects = buildSkillTreeSubjects({
        hubByName: new Map([
            [
                'browser',
                {
                    edited: true,
                    identifier: 'official/browser',
                    trustLevel: 'builtin',
                    updateAvailable: true,
                },
            ],
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

    expect(subjects.map((subject) => subject.treePath)).toEqual(['browser/SKILL.md']);
    expect(buildSkillTreePaths(subjects)).toContain('browser/');

    const installedBrowser = subjects.find((subject) => subject.treePath === 'browser/SKILL.md');
    expect(installedBrowser?.edited).toBe(true);
    expect(installedBrowser?.updateAvailable).toBe(true);
    expect(installedBrowser?.managedSource).toBe('hub');
});

test('buildSkillTreeSubjects sources managed flags from the runtime summary', () => {
    const subjects = buildSkillTreeSubjects({
        hubByName: new Map(),
        runtimeByName: new Map([
            ['tavern-agent', { edited: false, managedSource: 'seeded', updateAvailable: true }],
            ['merchbase', { edited: true, managedSource: 'plugin', updateAvailable: false }],
        ]),
        skills: [
            {
                allowedTools: null,
                dependencyState: 'ready',
                description: 'Seeded agent skill',
                diagnostic: null,
                enabled: true,
                id: 'tavern-agent',
                missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                name: 'tavern-agent',
                plugin: null,
                readOnly: false,
                surface: 'agent',
                updatedAt: null,
                usability: 'enabled',
                version: null,
            },
            {
                allowedTools: null,
                dependencyState: 'ready',
                description: 'MerchBase workflow guidance',
                diagnostic: null,
                enabled: true,
                id: 'merchbase',
                missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                name: 'merchbase',
                plugin: { displayName: 'MerchBase', enabled: true, id: 'merchbase' },
                readOnly: true,
                surface: 'agent',
                updatedAt: null,
                usability: 'enabled',
                version: null,
            },
        ],
    });

    const seeded = subjects.find((subject) => subject.treePath === 'tavern-agent/SKILL.md');
    expect(seeded?.managedSource).toBe('seeded');
    expect(seeded?.updateAvailable).toBe(true);
    expect(seeded?.edited).toBe(false);

    const plugin = subjects.find((subject) => subject.treePath === 'merchbase/SKILL.md');
    expect(plugin?.managedSource).toBe('plugin');
    expect(plugin?.edited).toBe(true);
    expect(plugin?.updateAvailable).toBe(false);
});

test('buildSkillTreeSubjects keeps plugin skills flat without a group folder', () => {
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

    expect(subjects.map((subject) => subject.treePath)).toEqual(['merchbase/SKILL.md']);
    expect(subjects[0]?.managedSource).toBe(null);
});
