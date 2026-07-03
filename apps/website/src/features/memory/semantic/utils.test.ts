import assert from 'node:assert/strict';
import test from 'node:test';
import type { SemanticMemoryPageNode } from './types.ts';
import { buildSemanticMemoryPageTree, resolveSemanticMemoryLinkTarget } from './utils.ts';

test('buildSemanticMemoryPageTree groups pages by path directories', () => {
    const pages = [
        page({ path: 'Projects/Alpha.md', title: 'Alpha' }),
        page({ path: 'Projects/Beta.md', title: 'Beta' }),
        page({ path: 'Concepts/Lattice.md', title: 'Lattice' }),
        page({ path: 'MEMORY.md', title: 'Memory Overview' }),
    ];

    assert.deepEqual(summarizeTree(buildSemanticMemoryPageTree(pages)), [
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

test('buildSemanticMemoryPageTree includes empty folders from the list contract', () => {
    assert.deepEqual(summarizeTree(buildSemanticMemoryPageTree([], ['Projects/Empty'])), [
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

test('resolveSemanticMemoryLinkTarget resolves memory link slugs', () => {
    const pages = [
        page({ path: 'Projects/Alpha.md', title: 'Alpha' }),
        page({ path: 'Concepts/Beta Note.md', title: 'Beta' }),
    ];
    const current = { path: 'Projects/Gamma.md' };

    assert.equal(resolveSemanticMemoryLinkTarget(pages, current, 'alpha')?.title, 'Alpha');
    assert.equal(resolveSemanticMemoryLinkTarget(pages, current, 'Beta Note')?.title, 'Beta');
    assert.equal(resolveSemanticMemoryLinkTarget(pages, current, 'missing'), null);
});

test('resolveSemanticMemoryLinkTarget resolves relative markdown paths', () => {
    const pages = [
        page({ path: 'Concepts/Alpha.md', title: 'Alpha' }),
        page({ path: 'Research/2026-01-01-source.md', title: 'Source' }),
    ];
    const current = { path: 'Projects/Overview.md' };

    assert.equal(
        resolveSemanticMemoryLinkTarget(pages, current, '../Concepts/Alpha.md')?.title,
        'Alpha'
    );
    assert.equal(
        resolveSemanticMemoryLinkTarget(pages, current, '../Research/2026-01-01-source.md')?.title,
        'Source'
    );
});

function page(input: Partial<SemanticMemoryPageNode>): SemanticMemoryPageNode {
    return {
        path: 'MEMORY.md',
        title: 'Memory Overview',
        updatedAt: '2026-06-09T00:00:00.000Z',
        ...input,
    };
}

function summarizeTree(nodes: ReturnType<typeof buildSemanticMemoryPageTree>): unknown[] {
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
