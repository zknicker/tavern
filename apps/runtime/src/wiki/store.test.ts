import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';

import {
    createWikiFolder,
    createWikiPage,
    deleteWikiFolder,
    deleteWikiPage,
    getWikiPage,
    getWikiSettings,
    getWikiStatus,
    listAgentEpisodicMemoryFiles,
    listWikiBacklinks,
    listWikiPages,
    moveWikiPath,
    prepareWikiRoot,
    readWikiFile,
    saveWikiPage,
    saveWikiSettings,
    searchWiki,
    writeWikiFile,
} from './store.ts';

describe('Wiki store', () => {
    let root: string;
    let previousWikiPath: string | undefined;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-wiki-store-'));
        previousWikiPath = process.env.TAVERN_WIKI_PATH;
        process.env.TAVERN_WIKI_PATH = root;
        const db = initTestDb();
        ensureRuntimeSchema(db);

        await fs.mkdir(path.join(root, 'Projects'), { recursive: true });
        await fs.mkdir(path.join(root, 'Concepts'), { recursive: true });
        await fs.mkdir(path.join(root, '.obsidian'), { recursive: true });
        await fs.writeFile(path.join(root, '.obsidian', 'workspace.md'), '# Hidden\n');
        await fs.writeFile(path.join(root, 'TAXONOMY.md'), '# Wiki Taxonomy\n');
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
        restoreEnv('TAVERN_WIKI_PATH', previousWikiPath);
        await fs.rm(root, { force: true, recursive: true });
    });

    test('reports Wiki status from the configured root', async () => {
        await expect(getWikiStatus()).resolves.toMatchObject({
            configSource: 'environment',
            indexExists: true,
            pageCount: 3,
            readable: true,
            wikiPath: root,
            writable: true,
        });
    });

    test('lists Markdown pages without dot-directory files', async () => {
        const list = await listWikiPages();

        expect(list.folders).toEqual(['Concepts', 'Projects']);
        expect(list.pages.map((page) => page.path).sort()).toEqual([
            'Concepts/Lattice.md',
            'Projects/Alpha.md',
            'TAXONOMY.md',
        ]);
    });

    test('reads a Wiki page with frontmatter and links', async () => {
        const page = await getWikiPage({ path: 'Projects/Alpha.md' });

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
            wikiPath: root,
        });
    });

    test('creates pages and folders inside the Wiki root', async () => {
        await expect(createWikiFolder({ path: 'Projects/Beta' })).resolves.toMatchObject({
            kind: 'folder',
            path: 'Projects/Beta',
        });

        await expect(
            createWikiPage({ body: '# Launch Plan\n', path: 'Projects/Beta/Launch Plan' })
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
            saveWikiPage({
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

    test('moves pages and folders inside the Wiki root', async () => {
        await expect(
            moveWikiPath({
                fromPath: 'Projects/Alpha.md',
                kind: 'page',
                toPath: 'Projects/Renamed Alpha.md',
            })
        ).resolves.toMatchObject({
            kind: 'page',
            page: { path: 'Projects/Renamed Alpha.md' },
            path: 'Projects/Renamed Alpha.md',
        });
        await expect(getWikiPage({ path: 'Projects/Alpha.md' })).resolves.toBeNull();

        await expect(
            moveWikiPath({
                fromPath: 'Projects',
                kind: 'folder',
                toPath: 'Archive/Projects',
            })
        ).resolves.toMatchObject({
            kind: 'folder',
            path: 'Archive/Projects',
        });
        await expect(
            getWikiPage({ path: 'Archive/Projects/Renamed Alpha.md' })
        ).resolves.toMatchObject({
            title: 'Alpha Project',
        });
    });

    test('page moves block dreaming at the old path but allow the new path', async () => {
        await deleteWikiPage({ path: 'Concepts/Lattice.md' });

        await moveWikiPath({
            fromPath: 'Projects/Alpha.md',
            kind: 'page',
            toPath: 'Concepts/Lattice.md',
        });

        await expect(
            writeWikiFile({
                content: '# Alpha Project\n\nRecreated by stale evidence.\n',
                expectedHash: null,
                path: 'Projects/Alpha.md',
            })
        ).rejects.toThrow('cannot be recreated by dreaming');

        const moved = await readWikiFile({ path: 'Concepts/Lattice.md' });
        await expect(
            writeWikiFile({
                content: '# Alpha Project\n\nDreamed update at the new home.\n',
                expectedHash: moved?.hash ?? null,
                path: 'Concepts/Lattice.md',
            })
        ).resolves.toMatchObject({ path: 'Concepts/Lattice.md' });
    });

    test('folder moves block dreaming at contained old paths', async () => {
        await moveWikiPath({
            fromPath: 'Projects',
            kind: 'folder',
            toPath: 'Archive/Projects',
        });

        await expect(
            writeWikiFile({
                content: '# Alpha Project\n\nRecreated by stale evidence.\n',
                expectedHash: null,
                path: 'Projects/Alpha.md',
            })
        ).rejects.toThrow('cannot be recreated by dreaming');
    });

    test('deletes pages and folders inside the Wiki root', async () => {
        await expect(deleteWikiPage({ path: 'Concepts/Lattice.md' })).resolves.toMatchObject({
            kind: 'page',
            path: 'Concepts/Lattice.md',
        });
        await expect(getWikiPage({ path: 'Concepts/Lattice.md' })).resolves.toBeNull();

        await expect(deleteWikiFolder({ path: 'Projects' })).resolves.toMatchObject({
            kind: 'folder',
            path: 'Projects',
        });
        await expect(getWikiPage({ path: 'Projects/Alpha.md' })).resolves.toBeNull();
    });

    test('folder deletes block dreaming at recently deleted contained pages', async () => {
        await expect(deleteWikiFolder({ path: 'Projects' })).resolves.toMatchObject({
            kind: 'folder',
            path: 'Projects',
        });

        await expect(
            writeWikiFile({
                content: '# Alpha Project\n\nRecreated by stale evidence.\n',
                expectedHash: null,
                path: 'Projects/Alpha.md',
            })
        ).rejects.toThrow('cannot be recreated by dreaming');
    });

    test('searches title, frontmatter, path, and body text', async () => {
        await expect(
            searchWiki({ limit: 10, offset: 0, query: 'alpha brief' })
        ).resolves.toMatchObject({
            hits: [{ page: { path: 'Projects/Alpha.md' } }],
            totalHitCount: 1,
        });

        await expect(searchWiki({ limit: 10, offset: 0, query: 'lattice' })).resolves.toMatchObject(
            {
                hits: expect.arrayContaining([
                    expect.objectContaining({
                        page: expect.objectContaining({ path: 'Concepts/Lattice.md' }),
                    }),
                    expect.objectContaining({
                        page: expect.objectContaining({ path: 'Projects/Alpha.md' }),
                    }),
                ]),
            }
        );
    });

    test('derives backlinks from double-bracket links', async () => {
        await expect(listWikiBacklinks({ path: 'Projects/Alpha.md' })).resolves.toMatchObject({
            links: [{ fromPath: 'Concepts/Lattice.md', fromTitle: 'Lattice' }],
            targetPath: 'Projects/Alpha.md',
        });
    });

    test('writes Wiki files with hash checks for background workers', async () => {
        const snapshot = await readWikiFile({ path: 'Projects/Alpha.md' });

        await expect(
            writeWikiFile({
                content: '# Alpha Project\n\nDreamed update.\n',
                expectedHash: snapshot?.hash ?? null,
                path: 'Projects/Alpha.md',
            })
        ).resolves.toMatchObject({
            beforeHash: snapshot?.hash,
            path: 'Projects/Alpha.md',
        });
        await expect(
            writeWikiFile({
                content: '# Alpha Project\n\nStale update.\n',
                expectedHash: snapshot?.hash ?? null,
                path: 'Projects/Alpha.md',
            })
        ).rejects.toThrow(/changed since it was read/);
    });

    test('rejects worker writes of core memory file names into Wiki', async () => {
        await expect(
            writeWikiFile({
                content: '# Shared user profile\n',
                expectedHash: null,
                path: 'USER.md',
            })
        ).rejects.toThrow('Core memory files do not live in Wiki');
        await expect(
            writeWikiFile({
                content: '# Project briefing\n',
                expectedHash: null,
                path: 'Projects/MEMORY.md',
            })
        ).rejects.toThrow('Core memory files do not live in Wiki');
    });

    test('prevents dreaming from recreating recently deleted Wiki pages', async () => {
        const snapshot = await readWikiFile({ path: 'Projects/Alpha.md' });
        await deleteWikiPage({ path: 'Projects/Alpha.md' });

        await expect(
            writeWikiFile({
                content: snapshot?.content ?? '# Alpha Project\n',
                expectedHash: null,
                path: 'Projects/Alpha.md',
            })
        ).rejects.toThrow(/deleted recently/);
        await createWikiPage({ body: '# Alpha Project\n', path: 'Projects/Alpha.md' });
        await expect(readWikiFile({ path: 'Projects/Alpha.md' })).resolves.toMatchObject({
            path: 'Projects/Alpha.md',
        });
        const restored = await readWikiFile({ path: 'Projects/Alpha.md' });
        await expect(
            writeWikiFile({
                content: '# Alpha Project\n\nDreamed update after user restore.\n',
                expectedHash: restored?.hash ?? null,
                path: 'Projects/Alpha.md',
            })
        ).resolves.toMatchObject({
            beforeHash: restored?.hash,
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

    test('rejects path traversal outside the Wiki root', async () => {
        await expect(getWikiPage({ path: '../outside.md' })).resolves.toBeNull();
        await expect(createWikiPage({ path: '../outside.md' })).rejects.toThrow(
            /inside the Wiki root/
        );
        await expect(createWikiFolder({ path: '.obsidian/new' })).rejects.toThrow(
            /dot directories/
        );
        await expect(
            moveWikiPath({
                fromPath: 'Projects',
                kind: 'folder',
                toPath: 'Projects/Nested',
            })
        ).rejects.toThrow(/cannot be moved into itself/);
    });

    test('saves a settings-backed Wiki path and creates shared Wiki files', async () => {
        restoreEnv('TAVERN_WIKI_PATH', previousWikiPath);
        const nextRoot = path.join(root, 'saved-memory');

        await expect(saveWikiSettings({ wikiPath: nextRoot })).resolves.toMatchObject({
            configSource: 'settings',
            configuredPath: nextRoot,
            effectivePath: nextRoot,
        });
        await expect(getWikiSettings()).resolves.toMatchObject({
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

    test('prepares Wiki root without replacing existing taxonomy', async () => {
        await prepareWikiRoot(root);

        await expect(fs.readFile(path.join(root, 'TAXONOMY.md'), 'utf8')).resolves.toBe(
            '# Wiki Taxonomy\n'
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
