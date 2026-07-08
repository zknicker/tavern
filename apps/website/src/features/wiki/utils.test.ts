import assert from 'node:assert/strict';
import test from 'node:test';
import type { WikiPageNode } from './types.ts';
import { buildWikiPageTree, resolveWikiLinkTarget } from './utils.ts';

test('buildWikiPageTree groups pages by path directories', () => {
    const pages = [
        page({ path: 'Projects/Alpha.md', title: 'Alpha' }),
        page({ path: 'Projects/Beta.md', title: 'Beta' }),
        page({ path: 'Concepts/Lattice.md', title: 'Lattice' }),
        page({ path: 'MEMORY.md', title: 'Memory Overview' }),
    ];

    assert.deepEqual(summarizeTree(buildWikiPageTree(pages)), [
        {
            children: ['Lattice'],
            name: 'Concepts',
        },
        {
            children: ['Alpha', 'Beta'],
            name: 'Projects',
        },
        'MEMORY',
    ]);
});

test('buildWikiPageTree includes empty folders from the list contract', () => {
    assert.deepEqual(summarizeTree(buildWikiPageTree([], ['Projects/Empty'])), [
        {
            children: [
                {
                    children: [],
                    name: 'Empty',
                },
            ],
            name: 'Projects',
        },
    ]);
});

test('resolveWikiLinkTarget resolves wiki link slugs', () => {
    const pages = [
        page({ path: 'Projects/Alpha.md', title: 'Alpha' }),
        page({ path: 'Concepts/Beta Note.md', title: 'Beta' }),
    ];
    const current = { path: 'Projects/Gamma.md' };

    assert.equal(resolveWikiLinkTarget(pages, current, 'alpha')?.title, 'Alpha');
    assert.equal(resolveWikiLinkTarget(pages, current, 'Beta Note')?.title, 'Beta');
    assert.equal(resolveWikiLinkTarget(pages, current, 'missing'), null);
});

test('resolveWikiLinkTarget resolves relative markdown paths', () => {
    const pages = [
        page({ path: 'Concepts/Alpha.md', title: 'Alpha' }),
        page({ path: 'Research/2026-01-01-source.md', title: 'Source' }),
    ];
    const current = { path: 'Projects/Overview.md' };

    assert.equal(resolveWikiLinkTarget(pages, current, '../Concepts/Alpha.md')?.title, 'Alpha');
    assert.equal(
        resolveWikiLinkTarget(pages, current, '../Research/2026-01-01-source.md')?.title,
        'Source'
    );
});

function page(input: Partial<WikiPageNode>): WikiPageNode {
    return {
        path: 'MEMORY.md',
        title: 'Memory Overview',
        updatedAt: '2026-06-09T00:00:00.000Z',
        ...input,
    };
}

function summarizeTree(nodes: ReturnType<typeof buildWikiPageTree>): unknown[] {
    return nodes.map((node) => {
        if (node.kind === 'file') {
            return node.name;
        }
        return {
            children: summarizeTree(node.children),
            name: node.name,
        };
    });
}
