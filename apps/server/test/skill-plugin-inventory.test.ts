import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const directory = mkdtempSync(join(tmpdir(), 'tavern-skill-plugin-inventory-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');

const { buildPluginSummaries, mergeRuntimeSkillDetail } = await import('../src/skills/service.ts');

test('buildPluginSummaries projects agent-facing OpenClaw plugins', () => {
    const plugins = buildPluginSummaries({
        channels: {
            discord: {},
            tavern: {},
        },
        plugins: {
            allow: ['codex', 'discord', 'missing-plugin'],
            entries: {
                codex: {
                    config: {
                        codexPlugins: {
                            enabled: true,
                            plugins: {
                                github: {
                                    enabled: true,
                                    marketplaceName: 'openai-curated',
                                    pluginName: 'github',
                                },
                            },
                        },
                        computerUse: {
                            autoInstall: true,
                        },
                    },
                    enabled: true,
                },
                discord: {
                    enabled: true,
                },
                tavern: {
                    enabled: true,
                },
            },
        },
    });

    assert.deepEqual(
        plugins.map((plugin) => ({
            diagnostic: plugin.diagnostic,
            id: plugin.id,
            source: plugin.source,
            usability: plugin.usability,
        })),
        [
            {
                diagnostic: null,
                id: 'codex',
                source: 'Codex',
                usability: 'enabled',
            },
            {
                diagnostic: 'Plugin is allowed, but no configured plugin entry was found.',
                id: 'missing-plugin',
                source: 'OpenClaw',
                usability: 'not_usable',
            },
        ]
    );
});

test('buildPluginSummaries marks disabled plugins without expanding diagnostic states', () => {
    const plugins = buildPluginSummaries({
        plugins: {
            entries: {
                browser: {
                    enabled: false,
                },
            },
        },
    });

    assert.equal(plugins[0]?.id, 'browser');
    assert.equal(plugins[0]?.enabled, false);
    assert.equal(plugins[0]?.usability, 'disabled');
});

test('mergeRuntimeSkillDetail preserves live requirement metadata from status', () => {
    const emptyRequirements = {
        anyBins: [],
        bins: [],
        config: [],
        env: [],
        os: [],
    };
    const summaryRequirements = {
        anyBins: [],
        bins: ['gog'],
        config: ['gog.account'],
        env: ['GOG_TOKEN'],
        os: [],
    };
    const merged = mergeRuntimeSkillDetail(
        {
            allowedTools: null,
            configChecks: [],
            contentMarkdown: '# gog',
            description: 'Detail description',
            files: [{ path: 'SKILL.md', sizeBytes: 20 }],
            id: 'gog',
            install: [],
            installSource: null,
            missing: emptyRequirements,
            name: 'gog',
            requirements: emptyRequirements,
            source: 'installed',
            updatedAt: null,
        },
        {
            allowedTools: 'Read',
            baseDir: '/tmp/skills/gog',
            commandVisible: true,
            configChecks: [{ path: 'gog.account', satisfied: false }],
            description: 'Status description',
            eligible: false,
            id: 'gog',
            install: [{ bins: ['gog'], id: 'brew', kind: 'brew', label: 'Install gog' }],
            missing: summaryRequirements,
            modelVisible: true,
            name: 'Google Workspace',
            requirements: summaryRequirements,
            runtimeSource: 'openclaw-workspace',
            source: 'installed',
            updatedAt: '2026-05-19T00:00:00.000Z',
        }
    );

    assert.deepEqual(merged.requirements, summaryRequirements);
    assert.deepEqual(merged.missing, summaryRequirements);
    assert.deepEqual(merged.configChecks, [{ path: 'gog.account', satisfied: false }]);
    assert.equal(merged.eligible, false);
    assert.equal(merged.install[0]?.id, 'brew');
    assert.equal(merged.contentMarkdown, '# gog');
    assert.equal(merged.files[0]?.path, 'SKILL.md');
});
