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

    test('parses block-list frontmatter values', async () => {
        await writeTopicPage(
            'project-notes',
            'wiki/sourced.md',
            [
                '---',
                'title: Sourced Article',
                'sources:',
                '  - raw/articles/2026-01-01-origin.md',
                '  - raw/papers/2026-02-02-study.md',
                'tags:',
                '  - lattice-theory',
                'summary: "Block list parsing check."',
                '---',
                '# Sourced',
            ].join('\n')
        );

        await expect(
            getCortexPage({ path: 'wiki/sourced.md', topic: 'project-notes' })
        ).resolves.toMatchObject({
            frontmatter: {
                sources: ['raw/articles/2026-01-01-origin.md', 'raw/papers/2026-02-02-study.md'],
                summary: 'Block list parsing check.',
                tags: ['lattice-theory'],
                title: 'Sourced Article',
            },
        });
    });

    test('parses frontmatter-only files with no trailing newline', async () => {
        await writeTopicPage(
            'project-notes',
            'inventory/verify-claim.md',
            ['---', 'title: Verify Claim', 'status: proposed', 'owner: user', '---'].join('\n')
        );

        await expect(
            getCortexPage({ path: 'inventory/verify-claim.md', topic: 'project-notes' })
        ).resolves.toMatchObject({
            body: '',
            frontmatter: { owner: 'user', status: 'proposed', title: 'Verify Claim' },
            section: 'inventory',
        });
    });

    test('derives backlinks from markdown dual-links across topics', async () => {
        await writeTopicPage(
            'project-notes',
            'wiki/delta.md',
            ['# Delta', '', 'See [[alpha|Alpha Page]] ([Alpha Page](../wiki/alpha.md)).'].join('\n')
        );
        await writeTopicPage(
            'sibling-notes',
            'wiki/observer.md',
            [
                '# Observer',
                '',
                'Cross-topic note on [Alpha Page](../../project-notes/wiki/alpha.md).',
            ].join('\n')
        );

        const backlinks = await listCortexBacklinks({
            path: 'wiki/alpha.md',
            topic: 'project-notes',
        });
        const fromPages = backlinks.links.map((link) => `${link.topic}:${link.fromPath}`);

        expect(fromPages).toContain('project-notes:wiki/delta.md');
        expect(fromPages).toContain('sibling-notes:wiki/observer.md');
        expect(fromPages.filter((entry) => entry === 'project-notes:wiki/delta.md')).toHaveLength(
            1
        );
    });

    test('matches frontmatter tags, aliases, and summary in search', async () => {
        await writeTopicPage(
            'project-notes',
            'wiki/tagged.md',
            [
                '---',
                'title: Tagged Article',
                'tags: [quantum-lattice]',
                'aliases: [QL Primer]',
                'summary: "An overview of resonance cascades."',
                '---',
                '# Tagged',
                '',
                'Body without the search terms.',
            ].join('\n')
        );

        await expect(
            searchCortex({ limit: 10, offset: 0, query: 'quantum-lattice' })
        ).resolves.toMatchObject({
            hits: [{ page: { path: 'wiki/tagged.md' } }],
            totalHitCount: 1,
        });
        await expect(
            searchCortex({ limit: 10, offset: 0, query: 'ql primer' })
        ).resolves.toMatchObject({ totalHitCount: 1 });
        await expect(
            searchCortex({ limit: 10, offset: 0, query: 'resonance cascades' })
        ).resolves.toMatchObject({
            hits: [{ snippet: expect.stringContaining('resonance cascades') }],
            totalHitCount: 1,
        });
    });

    test('exposes audit and librarian reports, hides archived outputs', async () => {
        await writeTopicPage('project-notes', '.librarian/REPORT.md', '# Librarian Report');
        await writeTopicPage('project-notes', '.audit/REPORT.md', '# Audit Report');
        await writeTopicPage('project-notes', 'output/.archive/old-output.md', '# Old Output');
        await writeTopicPage('project-notes', 'output/current.md', '# Current Output');

        const list = await listCortexPages({ topic: 'project-notes' });
        const paths = list.pages.map((page) => page.path);

        expect(paths).toContain('.librarian/REPORT.md');
        expect(paths).toContain('.audit/REPORT.md');
        expect(paths).toContain('output/current.md');
        expect(paths).not.toContain('output/.archive/old-output.md');
        expect(list.pages.find((page) => page.path === '.audit/REPORT.md')?.section).toBe(
            'reports'
        );
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
