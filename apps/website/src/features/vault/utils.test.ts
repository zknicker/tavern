import assert from 'node:assert/strict';
import test from 'node:test';
import type { VaultPageNode } from './types.ts';
import { buildVaultPageTree, resolveVaultLinkTarget } from './utils.ts';

test('buildVaultPageTree groups pages by path directories', () => {
    const pages = [
        page({ path: 'Projects/Alpha.md', title: 'Alpha' }),
        page({ path: 'Projects/Beta.md', title: 'Beta' }),
        page({ path: 'Concepts/Lattice.md', title: 'Lattice' }),
        page({ path: 'INDEX.md', title: 'Index' }),
    ];

    assert.deepEqual(summarizeTree(buildVaultPageTree(pages)), [
        {
            children: ['Lattice.md'],
            name: 'Concepts',
        },
        {
            children: ['Alpha.md', 'Beta.md'],
            name: 'Projects',
        },
        'INDEX.md',
    ]);
});

test('resolveVaultLinkTarget resolves wikilink slugs', () => {
    const pages = [
        page({ path: 'Projects/Alpha.md', title: 'Alpha' }),
        page({ path: 'Concepts/Beta Note.md', title: 'Beta' }),
    ];
    const current = { path: 'Projects/Gamma.md' };

    assert.equal(resolveVaultLinkTarget(pages, current, 'alpha')?.title, 'Alpha');
    assert.equal(resolveVaultLinkTarget(pages, current, 'Beta Note')?.title, 'Beta');
    assert.equal(resolveVaultLinkTarget(pages, current, 'missing'), null);
});

test('resolveVaultLinkTarget resolves relative markdown paths', () => {
    const pages = [
        page({ path: 'Concepts/Alpha.md', title: 'Alpha' }),
        page({ path: 'Research/2026-01-01-source.md', title: 'Source' }),
    ];
    const current = { path: 'Projects/Overview.md' };

    assert.equal(resolveVaultLinkTarget(pages, current, '../Concepts/Alpha.md')?.title, 'Alpha');
    assert.equal(
        resolveVaultLinkTarget(pages, current, '../Research/2026-01-01-source.md')?.title,
        'Source'
    );
});

function page(input: Partial<VaultPageNode>): VaultPageNode {
    return {
        path: 'INDEX.md',
        title: 'Index',
        updatedAt: '2026-06-09T00:00:00.000Z',
        ...input,
    };
}

function summarizeTree(nodes: ReturnType<typeof buildVaultPageTree>): unknown[] {
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
