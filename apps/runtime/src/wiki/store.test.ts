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
    getWikiAttachment,
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
    uploadWikiAttachment,
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

    test('creates pages with preserved frontmatter', async () => {
        const result = await createWikiPage({
            body: '# Restored\n',
            frontmatter: {
                aliases: ['restored page'],
                confidence: 0.9,
                published: true,
                source: { kind: 'brief', priority: 2 },
            },
            path: 'Projects/Restored.md',
        });

        expect(result.page?.frontmatter).toEqual({
            aliases: ['restored page'],
            confidence: 0.9,
            published: true,
            source: { kind: 'brief', priority: 2 },
        });
    });

    test('saves page bodies while preserving frontmatter', async () => {
        const opened = await getWikiPage({ path: 'Projects/Alpha.md' });
        await expect(
            saveWikiPage({
                body: '# Alpha Project\n\nUpdated body.\n',
                expectedHash: opened?.hash ?? '',
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

    test('rejects stale page saves', async () => {
        const opened = await getWikiPage({ path: 'Projects/Alpha.md' });
        if (!opened) {
            throw new Error('Expected the Alpha Wiki page.');
        }
        const currentContent = await fs.readFile(path.join(root, opened.path), 'utf8');
        await writeWikiFile({
            content: `${currentContent}\nAgent edit.\n`,
            expectedHash: opened.hash,
            path: opened.path,
        });

        await expect(
            saveWikiPage({
                body: '# Alpha Project\n\nStale overwrite.\n',
                expectedHash: opened.hash,
                path: opened.path,
            })
        ).rejects.toThrow('changed since it was opened');
    });

    test('serializes concurrent saves against the same page revision', async () => {
        const opened = await getWikiPage({ path: 'Projects/Alpha.md' });
        if (!opened) {
            throw new Error('Expected the Alpha Wiki page.');
        }

        const results = await Promise.allSettled([
            saveWikiPage({
                body: '# Alpha Project\n\nFirst concurrent edit.\n',
                expectedHash: opened.hash,
                path: opened.path,
            }),
            saveWikiPage({
                body: '# Alpha Project\n\nSecond concurrent edit.\n',
                expectedHash: opened.hash,
                path: opened.path,
            }),
        ]);

        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    });

    test('does not recreate a page during a concurrent move', async () => {
        const opened = await getWikiPage({ path: 'Projects/Alpha.md' });
        if (!opened) {
            throw new Error('Expected the Alpha Wiki page.');
        }

        await Promise.allSettled([
            saveWikiPage({
                body: '# Alpha Project\n\nConcurrent edit.\n',
                expectedHash: opened.hash,
                path: opened.path,
            }),
            moveWikiPath({
                fromPath: opened.path,
                kind: 'page',
                toPath: 'Archive/Alpha.md',
            }),
        ]);

        const pages = await listWikiPages();
        expect(
            pages.pages.filter((page) =>
                ['Archive/Alpha.md', 'Projects/Alpha.md'].includes(page.path)
            )
        ).toHaveLength(1);
    });

    test('stores Wiki image attachments beside the page and reads them back', async () => {
        const content = Buffer.from('png bytes');
        const attachment = await uploadWikiAttachment({
            contentBase64: content.toString('base64'),
            filename: 'Launch chart.PNG',
            mediaType: 'image/png',
            pagePath: 'Projects/Alpha.md',
        });
        const attachmentPath = attachment.path;

        expect(attachment).toMatchObject({
            markdownPath: expect.stringMatching(/^\.\/_attachments\/launch-chart-/u),
            mediaType: 'image/png',
            path: expect.stringMatching(/^Projects\/_attachments\/launch-chart-/u),
            sizeBytes: content.byteLength,
        });
        const loaded = await getWikiAttachment({ path: attachmentPath });
        expect(loaded).toEqual({
            contentBase64: content.toString('base64'),
            mediaType: 'image/png',
            path: attachmentPath,
        });
    });

    test('rejects upload collisions containing different bytes', async () => {
        const content = Buffer.from('original image');
        const input = {
            contentBase64: content.toString('base64'),
            filename: 'chart.png',
            mediaType: 'image/png' as const,
            pagePath: 'Projects/Alpha.md',
        };
        const attachment = await uploadWikiAttachment(input);
        await fs.writeFile(path.join(root, attachment.path), 'different image');

        await expect(uploadWikiAttachment(input)).rejects.toThrow(
            'different Wiki attachment already exists'
        );
    });

    test('keeps attachment directories internal to Wiki navigation and mutations', async () => {
        await fs.mkdir(path.join(root, 'Projects', '_attachments'));

        await expect(listWikiPages()).resolves.toMatchObject({ folders: ['Concepts', 'Projects'] });
        await expect(createWikiFolder({ path: 'Projects/_attachments/nested' })).rejects.toThrow(
            'managed by Tavern'
        );
        await expect(deleteWikiFolder({ path: 'Projects/_attachments' })).rejects.toThrow(
            'managed by Tavern'
        );
        await expect(
            moveWikiPath({
                fromPath: 'Projects/_attachments',
                kind: 'folder',
                toPath: 'Archive/attachments',
            })
        ).rejects.toThrow('managed by Tavern');
    });

    test('does not follow attachment symlinks outside the Wiki root', async () => {
        const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-wiki-outside-'));
        try {
            await fs.writeFile(path.join(outsideRoot, 'outside.png'), 'outside');
            await fs.symlink(outsideRoot, path.join(root, 'Projects', '_attachments'));

            await expect(
                getWikiAttachment({ path: 'Projects/_attachments/outside.png' })
            ).resolves.toBeNull();
            await expect(
                uploadWikiAttachment({
                    contentBase64: Buffer.from('new image').toString('base64'),
                    filename: 'new.png',
                    mediaType: 'image/png',
                    pagePath: 'Projects/Alpha.md',
                })
            ).rejects.toThrow('stay inside the Wiki root');
        } finally {
            await fs.rm(outsideRoot, { force: true, recursive: true });
        }
    });

    test('reads externally managed JPEG attachment extensions', async () => {
        const attachmentDirectory = path.join(root, 'Projects', '_attachments');
        await fs.mkdir(attachmentDirectory);
        await fs.writeFile(path.join(attachmentDirectory, 'photo.jpeg'), 'jpeg bytes');

        await expect(
            getWikiAttachment({ path: 'Projects/_attachments/photo.jpeg' })
        ).resolves.toMatchObject({ mediaType: 'image/jpeg' });
    });

    test('rejects oversized externally managed attachments before reading them', async () => {
        const attachmentDirectory = path.join(root, 'Projects', '_attachments');
        const attachmentPath = path.join(attachmentDirectory, 'oversized.png');
        await fs.mkdir(attachmentDirectory);
        await fs.writeFile(attachmentPath, '');
        await fs.truncate(attachmentPath, 8 * 1024 * 1024 + 1);

        await expect(
            getWikiAttachment({ path: 'Projects/_attachments/oversized.png' })
        ).rejects.toThrow('exceeds the 8 MiB read limit');
    });

    test('copies referenced attachments when a page moves across folders', async () => {
        const attachment = await uploadWikiAttachment({
            contentBase64: Buffer.from('chart image').toString('base64'),
            filename: 'chart.png',
            mediaType: 'image/png',
            pagePath: 'Projects/Alpha.md',
        });
        const opened = await getWikiPage({ path: 'Projects/Alpha.md' });
        if (!opened) {
            throw new Error('Expected the Alpha Wiki page.');
        }
        await saveWikiPage({
            body: `${opened.body}\n![Chart](${attachment.markdownPath})\n`,
            expectedHash: opened.hash,
            path: opened.path,
        });

        await moveWikiPath({
            fromPath: opened.path,
            kind: 'page',
            toPath: 'Archive/Alpha.md',
        });

        const movedAttachmentPath = attachment.path.replace(/^Projects\//u, 'Archive/');
        await expect(getWikiAttachment({ path: movedAttachmentPath })).resolves.toMatchObject({
            path: movedAttachmentPath,
        });
    });

    test('copies externally managed attachment names when a page moves', async () => {
        const attachmentDirectory = path.join(root, 'Projects', '_attachments');
        const filename = 'Launch Chart.PNG';
        await fs.mkdir(attachmentDirectory);
        await fs.writeFile(path.join(attachmentDirectory, filename), 'chart image');
        const opened = await getWikiPage({ path: 'Projects/Alpha.md' });
        if (!opened) {
            throw new Error('Expected the Alpha Wiki page.');
        }
        await saveWikiPage({
            body: `${opened.body}\n![Chart](<_attachments/${encodeURIComponent(filename)}>)\n`,
            expectedHash: opened.hash,
            path: opened.path,
        });

        await moveWikiPath({
            fromPath: opened.path,
            kind: 'page',
            toPath: 'Archive/Alpha.md',
        });

        await expect(
            getWikiAttachment({ path: `Archive/_attachments/${filename}` })
        ).resolves.toMatchObject({ path: `Archive/_attachments/${filename}` });
    });

    test('rejects page moves when an attachment destination has different bytes', async () => {
        const attachment = await uploadWikiAttachment({
            contentBase64: Buffer.from('source image').toString('base64'),
            filename: 'chart.png',
            mediaType: 'image/png',
            pagePath: 'Projects/Alpha.md',
        });
        const opened = await getWikiPage({ path: 'Projects/Alpha.md' });
        if (!opened) {
            throw new Error('Expected the Alpha Wiki page.');
        }
        await saveWikiPage({
            body: `${opened.body}\n![Chart](${attachment.markdownPath})\n`,
            expectedHash: opened.hash,
            path: opened.path,
        });
        const destinationDirectory = path.join(root, 'Archive', '_attachments');
        await fs.mkdir(destinationDirectory, { recursive: true });
        await fs.writeFile(
            path.join(destinationDirectory, path.posix.basename(attachment.path)),
            'different image'
        );

        await expect(
            moveWikiPath({
                fromPath: opened.path,
                kind: 'page',
                toPath: 'Archive/Alpha.md',
            })
        ).rejects.toThrow('different Wiki attachment');
        await expect(getWikiPage({ path: opened.path })).resolves.not.toBeNull();
    });

    test('preflights all attachment conflicts before copying a moved page', async () => {
        const sourceDirectory = path.join(root, 'Projects', '_attachments');
        const destinationDirectory = path.join(root, 'Archive', '_attachments');
        await fs.mkdir(sourceDirectory);
        await fs.mkdir(destinationDirectory, { recursive: true });
        await fs.writeFile(path.join(sourceDirectory, 'first.png'), 'first image');
        await fs.writeFile(path.join(sourceDirectory, 'second.png'), 'second image');
        await fs.writeFile(path.join(destinationDirectory, 'second.png'), 'different image');
        const opened = await getWikiPage({ path: 'Projects/Alpha.md' });
        if (!opened) {
            throw new Error('Expected the Alpha Wiki page.');
        }
        await saveWikiPage({
            body: `${opened.body}\n![First](./_attachments/first.png)\n![Second](./_attachments/second.png)\n`,
            expectedHash: opened.hash,
            path: opened.path,
        });

        await expect(
            moveWikiPath({
                fromPath: opened.path,
                kind: 'page',
                toPath: 'Archive/Alpha.md',
            })
        ).rejects.toThrow('different Wiki attachment');
        await expect(fs.stat(path.join(destinationDirectory, 'first.png'))).rejects.toThrow();
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
