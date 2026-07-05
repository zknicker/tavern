import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../../db/connection.ts';
import { ensureRuntimeSchema } from '../../db/schema.ts';
import { upsertStoredAgent } from '../../tavern/agents-store.ts';

import {
    createSemanticMemoryFolder,
    createSemanticMemoryPage,
    deleteSemanticMemoryFolder,
    deleteSemanticMemoryPage,
    getSemanticMemoryPage,
    getSemanticMemorySettings,
    getSemanticMemoryStatus,
    listAgentEpisodicMemoryFiles,
    listSemanticMemoryBacklinks,
    listSemanticMemoryPages,
    moveSemanticMemoryPath,
    prepareSemanticMemoryRoot,
    readSemanticMemoryFile,
    saveSemanticMemoryPage,
    saveSemanticMemorySettings,
    searchSemanticMemory,
    writeSemanticMemoryFile,
} from './store.ts';

describe('Memory store', () => {
    let root: string;
    let previousSemanticMemoryPath: string | undefined;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-semanticMemory-store-'));
        previousSemanticMemoryPath = process.env.TAVERN_MEMORY_PATH;
        process.env.TAVERN_MEMORY_PATH = root;
        const db = initTestDb();
        ensureRuntimeSchema(db);

        await fs.mkdir(path.join(root, 'Projects'), { recursive: true });
        await fs.mkdir(path.join(root, 'Concepts'), { recursive: true });
        await fs.mkdir(path.join(root, '.obsidian'), { recursive: true });
        await fs.writeFile(path.join(root, '.obsidian', 'workspace.md'), '# Hidden\n');
        await fs.writeFile(path.join(root, 'TAXONOMY.md'), '# Memory Taxonomy\n');
        await fs.writeFile(
            path.join(root, 'Projects', 'Alpha.md'),
            [
                '---',
                'title: Alpha Project',
                'tags: [ads, launch]',
                'aliases:',
                '  - alpha brief',
                '---',
                '',
                '# Alpha Project',
                '',
                'Tracks lattice work. See [[Concepts/Lattice|Lattice]].',
                '',
            ].join('\n')
        );
        await fs.writeFile(
            path.join(root, 'Concepts', 'Lattice.md'),
            '# Lattice\n\nBack to [[Alpha Project]].\n'
        );
    });

    afterEach(async () => {
        closeDb();
        restoreEnv('TAVERN_MEMORY_PATH', previousSemanticMemoryPath);
        await fs.rm(root, { force: true, recursive: true });
    });

    test('reports Memory status from the configured root', async () => {
        await expect(getSemanticMemoryStatus()).resolves.toMatchObject({
            configSource: 'environment',
            indexExists: true,
            pageCount: 3,
            readable: true,
            memoryPath: root,
            writable: true,
        });
    });

    test('lists Markdown pages without dot-directory files', async () => {
        const list = await listSemanticMemoryPages();

        expect(list.folders).toEqual(['Concepts', 'Projects']);
        expect(list.pages.map((page) => page.path).sort()).toEqual([
            'Concepts/Lattice.md',
            'Projects/Alpha.md',
            'TAXONOMY.md',
        ]);
    });

    test('reads a Memory file with frontmatter and links', async () => {
        const page = await getSemanticMemoryPage({ path: 'Projects/Alpha.md' });

        expect(page).toMatchObject({
            body: expect.stringContaining('Tracks lattice work.'),
            frontmatter: {
                aliases: ['alpha brief'],
                tags: ['ads', 'launch'],
                title: 'Alpha Project',
            },
            links: [{ label: 'Lattice', target: 'Concepts/Lattice' }],
            path: 'Projects/Alpha.md',
            title: 'Alpha Project',
            memoryPath: root,
        });
    });

    test('creates pages and folders inside the Memory root', async () => {
        await expect(createSemanticMemoryFolder({ path: 'Projects/Beta' })).resolves.toMatchObject({
            kind: 'folder',
            path: 'Projects/Beta',
        });

        await expect(
            createSemanticMemoryPage({ body: '# Launch Plan\n', path: 'Projects/Beta/Launch Plan' })
        ).resolves.toMatchObject({
            kind: 'page',
            page: {
                body: '# Launch Plan\n',
                path: 'Projects/Beta/Launch Plan.md',
                title: 'Launch Plan',
            },
            path: 'Projects/Beta/Launch Plan.md',
        });
    });

    test('saves page bodies while preserving frontmatter', async () => {
        await expect(
            saveSemanticMemoryPage({
                body: '# Alpha Project\n\nUpdated body.\n',
                path: 'Projects/Alpha.md',
            })
        ).resolves.toMatchObject({
            page: {
                body: '# Alpha Project\n\nUpdated body.\n',
                frontmatter: {
                    aliases: ['alpha brief'],
                    tags: ['ads', 'launch'],
                    title: 'Alpha Project',
                },
            },
        });

        await expect(
            fs.readFile(path.join(root, 'Projects', 'Alpha.md'), 'utf8')
        ).resolves.toContain('aliases:\n  - alpha brief\n---\n# Alpha Project\n\nUpdated body.');
    });

    test('moves pages and folders inside the Memory root', async () => {
        await expect(
            moveSemanticMemoryPath({
                fromPath: 'Projects/Alpha.md',
                kind: 'page',
                toPath: 'Projects/Renamed Alpha.md',
            })
        ).resolves.toMatchObject({
            kind: 'page',
            page: { path: 'Projects/Renamed Alpha.md' },
            path: 'Projects/Renamed Alpha.md',
        });
        await expect(getSemanticMemoryPage({ path: 'Projects/Alpha.md' })).resolves.toBeNull();

        await expect(
            moveSemanticMemoryPath({
                fromPath: 'Projects',
                kind: 'folder',
                toPath: 'Archive/Projects',
            })
        ).resolves.toMatchObject({
            kind: 'folder',
            path: 'Archive/Projects',
        });
        await expect(
            getSemanticMemoryPage({ path: 'Archive/Projects/Renamed Alpha.md' })
        ).resolves.toMatchObject({
            title: 'Alpha Project',
        });
    });

    test('page moves tombstone the old path and clear the new path', async () => {
        await deleteSemanticMemoryPage({ path: 'Concepts/Lattice.md' });

        await moveSemanticMemoryPath({
            fromPath: 'Projects/Alpha.md',
            kind: 'page',
            toPath: 'Concepts/Lattice.md',
        });

        await expect(
            writeSemanticMemoryFile({
                content: '# Alpha Project\n\nRecreated by stale evidence.\n',
                expectedHash: null,
                path: 'Projects/Alpha.md',
            })
        ).rejects.toThrow('cannot be recreated by dreaming');

        const moved = await readSemanticMemoryFile({ path: 'Concepts/Lattice.md' });
        await expect(
            writeSemanticMemoryFile({
                content: '# Alpha Project\n\nDreamed update at the new home.\n',
                expectedHash: moved?.hash ?? null,
                path: 'Concepts/Lattice.md',
            })
        ).resolves.toMatchObject({ path: 'Concepts/Lattice.md' });
    });

    test('folder moves tombstone contained pages at their old paths', async () => {
        await moveSemanticMemoryPath({
            fromPath: 'Projects',
            kind: 'folder',
            toPath: 'Archive/Projects',
        });

        await expect(
            writeSemanticMemoryFile({
                content: '# Alpha Project\n\nRecreated by stale evidence.\n',
                expectedHash: null,
                path: 'Projects/Alpha.md',
            })
        ).rejects.toThrow('cannot be recreated by dreaming');
    });

    test('deletes pages and folders inside the Memory root', async () => {
        await expect(
            deleteSemanticMemoryPage({ path: 'Concepts/Lattice.md' })
        ).resolves.toMatchObject({
            kind: 'page',
            path: 'Concepts/Lattice.md',
        });
        await expect(getSemanticMemoryPage({ path: 'Concepts/Lattice.md' })).resolves.toBeNull();

        await expect(deleteSemanticMemoryFolder({ path: 'Projects' })).resolves.toMatchObject({
            kind: 'folder',
            path: 'Projects',
        });
        await expect(getSemanticMemoryPage({ path: 'Projects/Alpha.md' })).resolves.toBeNull();
    });

    test('folder deletes tombstone contained pages for background workers', async () => {
        await expect(deleteSemanticMemoryFolder({ path: 'Projects' })).resolves.toMatchObject({
            kind: 'folder',
            path: 'Projects',
        });

        await expect(
            writeSemanticMemoryFile({
                content: '# Alpha Project\n\nRecreated by stale evidence.\n',
                expectedHash: null,
                path: 'Projects/Alpha.md',
            })
        ).rejects.toThrow('cannot be recreated by dreaming');
    });

    test('searches title, frontmatter, path, and body text', async () => {
        await expect(
            searchSemanticMemory({ limit: 10, offset: 0, query: 'alpha brief' })
        ).resolves.toMatchObject({
            hits: [{ page: { path: 'Projects/Alpha.md' } }],
            totalHitCount: 1,
        });

        await expect(
            searchSemanticMemory({ limit: 10, offset: 0, query: 'lattice' })
        ).resolves.toMatchObject({
            hits: expect.arrayContaining([
                expect.objectContaining({
                    page: expect.objectContaining({ path: 'Concepts/Lattice.md' }),
                }),
                expect.objectContaining({
                    page: expect.objectContaining({ path: 'Projects/Alpha.md' }),
                }),
            ]),
        });
    });

    test('derives backlinks from double-bracket links', async () => {
        await expect(
            listSemanticMemoryBacklinks({ path: 'Projects/Alpha.md' })
        ).resolves.toMatchObject({
            links: [{ fromPath: 'Concepts/Lattice.md', fromTitle: 'Lattice' }],
            targetPath: 'Projects/Alpha.md',
        });
    });

    test('writes semantic files with hash checks for background workers', async () => {
        const snapshot = await readSemanticMemoryFile({ path: 'Projects/Alpha.md' });

        await expect(
            writeSemanticMemoryFile({
                content: '# Alpha Project\n\nDreamed update.\n',
                expectedHash: snapshot?.hash ?? null,
                path: 'Projects/Alpha.md',
            })
        ).resolves.toMatchObject({
            beforeHash: snapshot?.hash,
            path: 'Projects/Alpha.md',
        });
        await expect(
            writeSemanticMemoryFile({
                content: '# Alpha Project\n\nStale update.\n',
                expectedHash: snapshot?.hash ?? null,
                path: 'Projects/Alpha.md',
            })
        ).rejects.toThrow(/changed since it was read/);
    });

    test('rejects worker writes of core memory file names into shared Semantic Memory', async () => {
        await expect(
            writeSemanticMemoryFile({
                content: '# Shared user profile\n',
                expectedHash: null,
                path: 'USER.md',
            })
        ).rejects.toThrow('Core memory files do not live in shared Semantic Memory');
        await expect(
            writeSemanticMemoryFile({
                content: '# Shared memory\n',
                expectedHash: null,
                path: 'Projects/MEMORY.md',
            })
        ).rejects.toThrow('Core memory files do not live in shared Semantic Memory');
    });

    test('prevents dreaming from recreating user-deleted semantic pages', async () => {
        const snapshot = await readSemanticMemoryFile({ path: 'Projects/Alpha.md' });
        await deleteSemanticMemoryPage({ path: 'Projects/Alpha.md' });

        await expect(
            writeSemanticMemoryFile({
                content: snapshot?.content ?? '# Alpha Project\n',
                expectedHash: null,
                path: 'Projects/Alpha.md',
            })
        ).rejects.toThrow(/deleted by the user/);
        await createSemanticMemoryPage({ body: '# Alpha Project\n', path: 'Projects/Alpha.md' });
        await expect(readSemanticMemoryFile({ path: 'Projects/Alpha.md' })).resolves.toMatchObject({
            path: 'Projects/Alpha.md',
        });
    });

    test('reads per-agent episodic files from the agent workspace', async () => {
        const workspaceFolder = path.join(root, 'agents', 'primary');
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: true,
                name: 'Tavern',
                primaryColor: null,
                workspaceFolder,
            },
            syncedAt: '2026-07-02T19:00:00.000Z',
        });
        await fs.mkdir(path.join(workspaceFolder, '.memory', 'episodic'), { recursive: true });
        await fs.writeFile(
            path.join(workspaceFolder, '.memory', 'episodic', '2026-07-02.md'),
            '# 2026-07-02\n\nObservation.\n'
        );

        await expect(listAgentEpisodicMemoryFiles({ agentId: 'agt_primary' })).resolves.toEqual([
            expect.objectContaining({
                content: expect.stringContaining('Observation.'),
                path: '.memory/episodic/2026-07-02.md',
            }),
        ]);
    });

    test('rejects path traversal outside the Memory root', async () => {
        await expect(getSemanticMemoryPage({ path: '../outside.md' })).resolves.toBeNull();
        await expect(createSemanticMemoryPage({ path: '../outside.md' })).rejects.toThrow(
            /inside Memory/
        );
        await expect(createSemanticMemoryFolder({ path: '.obsidian/new' })).rejects.toThrow(
            /dot directories/
        );
        await expect(
            moveSemanticMemoryPath({
                fromPath: 'Projects',
                kind: 'folder',
                toPath: 'Projects/Nested',
            })
        ).rejects.toThrow(/cannot be moved into itself/);
    });

    test('saves a settings-backed Memory path and creates shared Semantic Memory files', async () => {
        restoreEnv('TAVERN_MEMORY_PATH', previousSemanticMemoryPath);
        const nextRoot = path.join(root, 'saved-memory');

        await expect(saveSemanticMemorySettings({ memoryPath: nextRoot })).resolves.toMatchObject({
            configSource: 'settings',
            configuredPath: nextRoot,
            effectivePath: nextRoot,
        });
        await expect(getSemanticMemorySettings()).resolves.toMatchObject({
            configSource: 'settings',
            effectivePath: nextRoot,
        });
        await expect(fs.stat(path.join(nextRoot, 'MEMORY.md'))).rejects.toThrow();
        await expect(fs.stat(path.join(nextRoot, 'USER.md'))).rejects.toThrow();
        await expect(fs.readFile(path.join(nextRoot, 'TAXONOMY.md'), 'utf8')).resolves.toContain(
            'Per-agent core memory files (`USER.md`, `MEMORY.md`) live in each agent workspace'
        );
        await expect(fs.stat(path.join(nextRoot, 'episodic'))).rejects.toThrow();
        expect((await fs.stat(path.join(nextRoot, 'companies'))).isDirectory()).toBe(true);
        expect((await fs.stat(path.join(nextRoot, 'concepts'))).isDirectory()).toBe(true);
        expect((await fs.stat(path.join(nextRoot, 'people'))).isDirectory()).toBe(true);
        expect((await fs.stat(path.join(nextRoot, 'projects'))).isDirectory()).toBe(true);
        expect((await fs.stat(path.join(nextRoot, 'routines'))).isDirectory()).toBe(true);
        expect((await fs.stat(path.join(nextRoot, 'sites'))).isDirectory()).toBe(true);
    });

    test('prepares Memory root without replacing existing taxonomy', async () => {
        await prepareSemanticMemoryRoot(root);

        await expect(fs.readFile(path.join(root, 'TAXONOMY.md'), 'utf8')).resolves.toBe(
            '# Memory Taxonomy\n'
        );
        expect((await fs.stat(path.join(root, 'companies'))).isDirectory()).toBe(true);
        expect((await fs.stat(path.join(root, 'concepts'))).isDirectory()).toBe(true);
        expect((await fs.stat(path.join(root, 'people'))).isDirectory()).toBe(true);
        expect((await fs.stat(path.join(root, 'projects'))).isDirectory()).toBe(true);
        expect((await fs.stat(path.join(root, 'routines'))).isDirectory()).toBe(true);
        expect((await fs.stat(path.join(root, 'sites'))).isDirectory()).toBe(true);
    });
});

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
        return;
    }
    process.env[key] = value;
}
