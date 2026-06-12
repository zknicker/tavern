import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    clearComputerUseAppInventoryCache,
    listComputerUseApps,
} from '../src/api/mention/computer-use-apps.ts';
import { buildMentionInventory, buildMentionOptions } from '../src/api/mention/list.ts';

describe('buildMentionOptions', () => {
    it('lists runtime skills as skill-context mention options', async () => {
        expect(
            await buildMentionOptions({
                codexPluginRoot: await createTempDir(),
                computerUseAppInventory: { entries: [], source: 'local', status: 'unavailable' },
                limit: 10,
                query: 'agent-browser',
                runtimeSkills: [
                    createSkill({
                        description: 'Browser automation CLI for AI agents.',
                        filePath: '/Users/zknicker/.agents/skills/agent-browser/SKILL.md',
                        id: 'agent-browser',
                        name: 'agent-browser',
                    }),
                    createSkill({
                        id: 'hidden',
                        name: 'hidden',
                        userInvocable: false,
                    }),
                ],
                workspaceFolder: await createTempDir(),
            })
        ).toEqual([
            {
                description: 'Browser automation CLI for AI agents.',
                id: '/Users/zknicker/.agents/skills/agent-browser/SKILL.md',
                insertText: 'agent-browser',
                kind: 'skill',
                label: 'Agent Browser',
                metadata: {
                    skillName: 'agent-browser',
                    skillPath: '/Users/zknicker/.agents/skills/agent-browser/SKILL.md',
                },
                projection: 'skill-context',
                sourceLabel: 'Built-in',
            },
        ]);
    });

    it('lists bundled Codex plugins as capability mention options', async () => {
        const root = await createTempDir();
        await writePluginManifest(root, {
            description: 'Inspect local web targets.',
            displayName: 'Browser',
            name: 'browser',
            version: '0.1.0',
        });
        await writePluginManifest(root, {
            description: 'Control Mac apps from Codex.',
            displayName: 'Computer Use',
            name: 'computer-use',
            version: '1.0.0',
        });

        expect(
            await buildMentionOptions({
                codexPluginRoot: root,
                computerUseAppInventory: { entries: [], source: 'local', status: 'unavailable' },
                limit: 10,
                query: 'computer',
                runtimeSkills: [],
                workspaceFolder: await createTempDir(),
            })
        ).toEqual([
            {
                description: 'Control Mac apps from Codex.',
                id: 'plugin://computer-use@openai-bundled',
                insertText: 'Computer Use',
                kind: 'plugin',
                label: 'Computer Use',
                projection: 'capability-reference',
                sourceLabel: 'Plugin',
            },
        ]);

        expect(
            await buildMentionOptions({
                codexPluginRoot: root,
                computerUseAppInventory: { entries: [], source: 'local', status: 'unavailable' },
                limit: 10,
                query: 'browser',
                runtimeSkills: [],
                workspaceFolder: await createTempDir(),
            })
        ).toEqual([
            {
                description: 'Inspect local web targets.',
                id: 'plugin://browser@openai-bundled',
                insertText: 'Browser',
                kind: 'plugin',
                label: 'Browser',
                projection: 'capability-reference',
                sourceLabel: 'Plugin',
            },
        ]);
    });

    it('lists Computer Use app inventory as app mention options', async () => {
        expect(
            await buildMentionOptions({
                codexPluginRoot: await createTempDir(),
                computerUseAppInventory: {
                    entries: [
                        {
                            bundleId: 'net.imput.helium',
                            label: 'Helium',
                            running: true,
                            usageCount: 18_326,
                        },
                        {
                            bundleId: 'com.google.Chrome',
                            label: 'Chrome',
                        },
                    ],
                    source: 'local',
                    status: 'ready',
                },
                limit: 10,
                query: 'helium',
                runtimeSkills: [],
                workspaceFolder: await createTempDir(),
            })
        ).toEqual([
            {
                description: 'Computer Use',
                id: 'plugin://computer-use@openai-bundled',
                insertText: 'Helium',
                kind: 'app',
                label: 'Helium',
                metadata: {
                    bundleId: 'net.imput.helium',
                    running: true,
                    source: 'local',
                    usageCount: 18_326,
                },
                projection: 'capability-reference',
                sourceLabel: 'Mac app',
            },
        ]);
    });

    it('keeps Mac apps visible in the default mention list', async () => {
        const root = await createTempDir();
        await writePluginManifest(root, {
            description: 'Control Mac apps from Codex.',
            displayName: 'Computer Use',
            name: 'computer-use',
            version: '1.0.0',
        });

        const options = await buildMentionOptions({
            codexPluginRoot: root,
            computerUseAppInventory: {
                entries: [
                    {
                        bundleId: 'net.imput.helium',
                        label: 'Helium',
                        running: true,
                    },
                ],
                source: 'local',
                status: 'ready',
            },
            limit: 5,
            query: '',
            runtimeSkills: Array.from({ length: 8 }, (_, index) =>
                createSkill({
                    filePath: `/tmp/skills/skill-${index}/SKILL.md`,
                    id: `skill-${index}`,
                    name: `skill-${index}`,
                })
            ),
            workspaceFolder: await createTempDir(),
        });

        expect(options).toContainEqual(
            expect.objectContaining({
                kind: 'app',
                label: 'Helium',
            })
        );
        expect(options).toContainEqual(
            expect.objectContaining({
                kind: 'skill',
                label: 'Skill 0',
            })
        );
        expect(options).toContainEqual(
            expect.objectContaining({
                kind: 'plugin',
                label: 'Computer Use',
            })
        );
    });

    it('keeps default mention option order aligned with grouped keyboard navigation', async () => {
        const root = await createTempDir();
        await writePluginManifest(root, {
            description: 'Inspect local web targets.',
            displayName: 'Browser',
            name: 'browser',
            version: '0.1.0',
        });

        expect(
            await buildMentionOptions({
                codexPluginRoot: root,
                computerUseAppInventory: { entries: [], source: 'local', status: 'unavailable' },
                limit: 5,
                query: '',
                runtimeSkills: [
                    createSkill({
                        filePath: '/tmp/skills/agent-browser/SKILL.md',
                        id: 'agent-browser',
                        name: 'agent-browser',
                    }),
                    createSkill({
                        filePath: '/tmp/skills/gemini/SKILL.md',
                        id: 'gemini',
                        name: 'gemini',
                    }),
                ],
                workspaceFolder: await createTempDir(),
            }).then((options) => options.map((option) => [option.kind, option.label]))
        ).toEqual([
            ['skill', 'Agent Browser'],
            ['skill', 'Gemini'],
            ['plugin', 'Browser'],
        ]);
    });

    it('marks app inventory unavailable when the local app inventory hangs', async () => {
        clearComputerUseAppInventoryCache();

        const startedAt = Date.now();
        const inventory = await listComputerUseApps({
            fetchInventory: () => new Promise(() => {}),
            now: startedAt,
        });

        expect(Date.now() - startedAt).toBeLessThan(3000);
        expect(inventory).toEqual({
            entries: [],
            source: 'local',
            status: 'unavailable',
        });
    });

    it('passes typed app mention queries through to the app inventory source', async () => {
        clearComputerUseAppInventoryCache();

        const queries: string[] = [];
        const inventory = await listComputerUseApps({
            fetchInventory: async (query) => {
                queries.push(query);
                return {
                    entries: [
                        {
                            bundleId: 'net.imput.helium',
                            label: 'Helium',
                        },
                    ],
                    source: 'local',
                    status: 'ready',
                };
            },
            query: 'Hel',
        });

        expect(queries).toEqual(['Hel']);
        expect(inventory.entries).toEqual([
            {
                bundleId: 'net.imput.helium',
                label: 'Helium',
            },
        ]);

        await listComputerUseApps({
            fetchInventory: async (query) => {
                queries.push(query);
                return {
                    entries: [],
                    source: 'local',
                    status: 'ready',
                };
            },
            query: 'Chrome',
        });

        expect(queries).toEqual(['Hel', 'Chrome']);
    });

    it('lists matching workspace files and directories as path mention options', async () => {
        const workspace = await createTempDir();
        await mkdir(path.join(workspace, 'apps', 'website', 'src', 'components', 'ui'), {
            recursive: true,
        });
        await writeFile(path.join(workspace, 'apps', 'website', 'src', 'mention-picker.tsx'), '');
        await mkdir(path.join(workspace, 'node_modules', 'ignore-me'), { recursive: true });
        await writeFile(path.join(workspace, 'node_modules', 'ignore-me', 'mention.ts'), '');

        expect(
            await buildMentionOptions({
                codexPluginRoot: await createTempDir(),
                computerUseAppInventory: { entries: [], source: 'local', status: 'unavailable' },
                limit: 10,
                query: 'mention',
                runtimeSkills: [],
                workspaceFolder: workspace,
            })
        ).toEqual([
            {
                description: 'apps/website/src',
                id: path.join(workspace, 'apps', 'website', 'src', 'mention-picker.tsx'),
                insertText: 'apps/website/src/mention-picker.tsx',
                kind: 'file',
                label: 'apps/website/src/mention-picker.tsx',
                projection: 'path-reference',
                sourceLabel: 'File',
            },
        ]);

        expect(
            await buildMentionOptions({
                codexPluginRoot: await createTempDir(),
                computerUseAppInventory: { entries: [], source: 'local', status: 'unavailable' },
                limit: 10,
                query: 'components/ui',
                runtimeSkills: [],
                workspaceFolder: workspace,
            })
        ).toEqual([
            {
                description: 'apps/website/src/components',
                id: path.join(workspace, 'apps', 'website', 'src', 'components', 'ui'),
                insertText: 'apps/website/src/components/ui',
                kind: 'directory',
                label: 'apps/website/src/components/ui',
                projection: 'path-reference',
                sourceLabel: 'Folder',
            },
        ]);
    });

    it('can list files from the server workspace', async () => {
        const workspace = path.resolve(process.cwd(), '..', '..');

        expect(
            await buildMentionOptions({
                codexPluginRoot: await createTempDir(),
                computerUseAppInventory: { entries: [], source: 'local', status: 'unavailable' },
                limit: 10,
                query: 'specs/mentions.md',
                runtimeSkills: [],
                workspaceFolder: workspace,
            })
        ).toContainEqual({
            description: 'specs',
            id: path.join(workspace, 'specs', 'mentions.md'),
            insertText: 'specs/mentions.md',
            kind: 'file',
            label: 'specs/mentions.md',
            projection: 'path-reference',
            sourceLabel: 'File',
        });
    });
});

describe('buildMentionInventory', () => {
    it('keeps plugins in the inventory when apps and skills fill the limit', async () => {
        const root = await createTempDir();
        await writePluginManifest(root, {
            description: 'Inspect local web targets.',
            displayName: 'Browser',
            name: 'browser',
            version: '0.1.0',
        });

        const skills = Array.from({ length: 12 }, (_, index) =>
            createSkill({ id: `skill-${index}`, name: `skill-${index}` })
        );
        const inventory = await buildMentionInventory({
            codexPluginRoot: root,
            computerUseAppInventory: { entries: [], source: 'local', status: 'unavailable' },
            limit: 10,
            runtimeSkills: skills,
        });

        expect(inventory).toHaveLength(10);
        expect(inventory.filter((option) => option.kind === 'plugin')).toEqual([
            {
                description: 'Inspect local web targets.',
                id: 'plugin://browser@openai-bundled',
                insertText: 'Browser',
                kind: 'plugin',
                label: 'Browser',
                projection: 'capability-reference',
                sourceLabel: 'Plugin',
            },
        ]);
    });
});

async function createTempDir() {
    return await mkdtemp(path.join(os.tmpdir(), 'tavern-mentions-'));
}

function createSkill(input: {
    description?: string;
    disabled?: boolean;
    eligible?: boolean;
    filePath?: string;
    id: string;
    name: string;
    runtimeSource?: string;
    source?: 'builtin' | 'installed' | 'workspace';
    userInvocable?: boolean;
}) {
    return {
        allowedTools: null,
        configChecks: [],
        description: input.description ?? null,
        disabled: input.disabled,
        eligible: input.eligible,
        filePath: input.filePath,
        id: input.id,
        install: [],
        missing: {
            anyBins: [],
            bins: [],
            config: [],
            env: [],
            os: [],
        },
        name: input.name,
        requirements: {
            anyBins: [],
            bins: [],
            config: [],
            env: [],
            os: [],
        },
        runtimeSource: input.runtimeSource,
        source: input.source ?? 'builtin',
        updatedAt: null,
        userInvocable: input.userInvocable,
    };
}

async function writePluginManifest(
    root: string,
    input: {
        description: string;
        displayName: string;
        name: string;
        version: string;
    }
) {
    const pluginDir = path.join(root, input.name, input.version);
    await mkdir(path.join(pluginDir, '.codex-plugin'), { recursive: true });
    await writeFile(
        path.join(pluginDir, '.codex-plugin', 'plugin.json'),
        `${JSON.stringify(
            {
                description: input.description,
                interface: {
                    displayName: input.displayName,
                },
                name: input.name,
                version: input.version,
            },
            null,
            2
        )}\n`
    );
}
