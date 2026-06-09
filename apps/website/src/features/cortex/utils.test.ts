import assert from 'node:assert/strict';
import test from 'node:test';
import type { CortexPageNode } from './types.ts';
import { buildCortexPageTree } from './utils.ts';

test('buildCortexPageTree groups pages by topic and path directories', () => {
    const pages = [
        page({ path: 'wiki/concepts/_index.md', title: 'Concepts', topic: 'gut-microbiome' }),
        page({
            path: 'wiki/concepts/diet.md',
            section: 'wiki',
            title: 'Diet',
            topic: 'gut-microbiome',
        }),
        page({
            path: 'raw/source-note.md',
            section: 'raw',
            title: 'Source',
            topic: 'gut-microbiome',
        }),
        page({ path: 'wiki/_index.md', title: 'Archived Index', topic: '.archive/old-topic' }),
    ];

    assert.deepEqual(summarizeTree(buildCortexPageTree(pages, { includeTopicRoot: true })), [
        {
            children: [
                {
                    children: [
                        {
                            children: ['_index.md'],
                            name: 'wiki',
                        },
                    ],
                    name: 'old-topic',
                },
            ],
            name: '.archive',
        },
        {
            children: [
                {
                    children: ['source-note.md'],
                    name: 'raw',
                },
                {
                    children: [
                        {
                            children: ['_index.md', 'diet.md'],
                            name: 'concepts',
                        },
                    ],
                    name: 'wiki',
                },
            ],
            name: 'gut-microbiome',
        },
    ]);
});

test('buildCortexPageTree omits topic roots for a selected topic', () => {
    const pages = [
        page({ path: 'wiki/b.md', title: 'B' }),
        page({ path: 'wiki/a.md', title: 'A' }),
        page({ path: 'config.md', title: 'Config', section: 'root' }),
    ];

    assert.deepEqual(summarizeTree(buildCortexPageTree(pages, { includeTopicRoot: false })), [
        {
            children: ['a.md', 'b.md'],
            name: 'wiki',
        },
        'config.md',
    ]);
});

function page(input: Partial<CortexPageNode>): CortexPageNode {
    return {
        archived: false,
        path: 'wiki/_index.md',
        section: 'wiki',
        title: 'Index',
        topic: 'topic',
        updatedAt: '2026-06-09T00:00:00.000Z',
        ...input,
    };
}

function summarizeTree(nodes: ReturnType<typeof buildCortexPageTree>): unknown[] {
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
