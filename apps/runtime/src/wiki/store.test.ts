import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
    getCortexPage,
    getCortexStatus,
    listCortexBacklinks,
    listCortexPages,
    listCortexTopics,
    searchCortex,
} from './store';

describe('wiki store', () => {
    let hubPath: string;
    let previousHome: string | undefined;
    let previousHubPath: string | undefined;

    beforeEach(async () => {
        previousHome = process.env.HOME;
        previousHubPath = process.env.TAVERN_WIKI_HUB_PATH;
        hubPath = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-wiki-'));
        process.env.TAVERN_WIKI_HUB_PATH = hubPath;

        await writeTopicPage(
            'project-notes',
            'wiki/alpha.md',
            ['---', 'title: Alpha Page', '---', '# Alpha', '', 'Important lattice wiki note.'].join(
                '\n'
            )
        );
        await writeTopicPage(
            'project-notes',
            'wiki/beta.md',
            ['# Beta', '', 'References [[alpha|Alpha Page]].'].join('\n')
        );
        await writeTopicPage('project-notes', 'wiki/my-page.md', '# My Page');
        await writeTopicPage(
            'project-notes',
            'wiki/gamma.md',
            ['# Gamma', '', 'References [[My Page]].'].join('\n')
        );
        await writeTopicPage('.archive/project-notes', 'wiki/alpha.md', '# Archived Alpha');
        await writeTopicPage('.archive/project-notes', 'wiki/archived.md', '# Archived Project');
        await writeTopicPage('.archive/old-notes', 'wiki/old.md', '# Old');
    });

    afterEach(async () => {
        restoreEnv('HOME', previousHome);
        restoreEnv('TAVERN_WIKI_HUB_PATH', previousHubPath);
        await fs.rm(hubPath, { force: true, recursive: true });
    });

    test('reads legacy resolved_path llm-wiki config', async () => {
        const homePath = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-wiki-home-'));
        if (previousHubPath === undefined) {
            unsetEnv('TAVERN_WIKI_HUB_PATH');
        }

        process.env.HOME = homePath;
        await writeFile(path.join(hubPath, '_index.md'), '# Existing Hub\n');
        await writeFile(
            path.join(homePath, '.config', 'llm-wiki', 'config.json'),
            JSON.stringify({ resolved_path: hubPath })
        );

        await expect(getCortexStatus()).resolves.toMatchObject({
            configSource: 'config',
            hubPath,
        });
        await fs.rm(homePath, { force: true, recursive: true });
    });

    test('lists llm-wiki topics and pages', async () => {
        await expect(listCortexTopics()).resolves.toMatchObject({
            topics: [{ archived: false, slug: 'project-notes', title: 'Project Notes' }],
        });

        await expect(listCortexTopics({ includeArchived: true })).resolves.toMatchObject({
            topics: [
                { archived: true, slug: '.archive/old-notes' },
                { archived: true, slug: '.archive/project-notes' },
                { archived: false, slug: 'project-notes' },
            ],
        });

        await expect(listCortexPages({ topic: 'project-notes' })).resolves.toMatchObject({
            pages: [
                { path: 'wiki/alpha.md', section: 'wiki', title: 'Alpha Page' },
                { path: 'wiki/beta.md', section: 'wiki', title: 'Beta' },
                { path: 'wiki/gamma.md', section: 'wiki', title: 'Gamma' },
                { path: 'wiki/my-page.md', section: 'wiki', title: 'My Page' },
            ],
            topic: 'project-notes',
        });
    });

    test('reads pages, searches body text, and derives backlinks', async () => {
        await expect(
            getCortexPage({ path: 'wiki/alpha.md', topic: 'project-notes' })
        ).resolves.toMatchObject({
            body: '# Alpha\n\nImportant lattice wiki note.',
            frontmatter: { title: 'Alpha Page' },
            links: [],
            title: 'Alpha Page',
        });

        await expect(
            searchCortex({ limit: 10, offset: 0, query: 'lattice' })
        ).resolves.toMatchObject({
            hits: [{ page: { path: 'wiki/alpha.md', topic: 'project-notes' } }],
            totalHitCount: 1,
        });

        await expect(
            listCortexBacklinks({ path: 'wiki/alpha.md', topic: 'project-notes' })
        ).resolves.toMatchObject({
            links: [{ fromPath: 'wiki/beta.md', label: 'Alpha Page', targetPath: 'wiki/alpha.md' }],
        });

        await expect(
            listCortexBacklinks({ path: 'wiki/my-page.md', topic: 'project-notes' })
        ).resolves.toMatchObject({
            links: [{ fromPath: 'wiki/gamma.md', label: null, targetPath: 'wiki/my-page.md' }],
        });
    });

    test('keeps active and archived topics distinct when slugs collide', async () => {
        const list = await listCortexPages({ includeArchived: true, topic: 'project-notes' });
        expect(list.pages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    archived: false,
                    path: 'wiki/alpha.md',
                    topic: 'project-notes',
                }),
                expect.objectContaining({
                    archived: false,
                    path: 'wiki/alpha.md',
                    topic: 'project-notes',
                }),
            ])
        );

        const archivedList = await listCortexPages({
            includeArchived: true,
            topic: '.archive/project-notes',
        });
        expect(archivedList.pages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    archived: true,
                    path: 'wiki/alpha.md',
                    topic: '.archive/project-notes',
                }),
                expect.objectContaining({
                    archived: true,
                    path: 'wiki/archived.md',
                    topic: '.archive/project-notes',
                }),
            ])
        );

        await expect(
            getCortexPage({ path: 'wiki/alpha.md', topic: 'project-notes' })
        ).resolves.toMatchObject({
            archived: false,
            body: '# Alpha\n\nImportant lattice wiki note.',
        });
        await expect(
            getCortexPage({ path: 'wiki/alpha.md', topic: '.archive/project-notes' })
        ).resolves.toMatchObject({
            archived: true,
            body: '# Archived Alpha',
        });
    });

    test('rejects sibling topic traversal on direct page reads', async () => {
        await writeTopicPage('project-notes-private', 'wiki/secret.md', '# Secret');

        await expect(
            getCortexPage({
                path: '../project-notes-private/wiki/secret.md',
                topic: 'project-notes',
            })
        ).resolves.toBeNull();
    });

    test('reports hub status', async () => {
        await expect(getCortexStatus()).resolves.toMatchObject({
            archivedTopicCount: 2,
            configSource: 'environment',
            hubPath,
            pageCount: 7,
            readable: true,
            topicCount: 1,
        });
    });

    async function writeTopicPage(topic: string, relativePath: string, content: string) {
        const filePath = path.join(hubPath, 'topics', topic, relativePath);
        await writeFile(filePath, content);
    }
});

async function writeFile(filePath: string, content: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        unsetEnv(key);
        return;
    }
    process.env[key] = value;
}

function unsetEnv(key: string) {
    Reflect.deleteProperty(process.env, key);
}
