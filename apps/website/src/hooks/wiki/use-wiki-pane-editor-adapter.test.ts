import { expect, test } from 'bun:test';
import type { WikiPageDetail } from '../../features/wiki/types.ts';
import { validateWikiImageFile } from './wiki-image-file.ts';
import { refreshWikiPageSnapshot, wikiPaneEditorTargetKey } from './wiki-pane-editor-snapshot.ts';

const refreshedPage: WikiPageDetail = {
    body: '# Refreshed',
    frontmatter: {},
    hash: 'b'.repeat(64),
    links: [],
    path: 'Demos/Panel Brief.md',
    size: 11,
    title: 'Refreshed',
    updatedAt: '2026-07-20T15:00:00.000Z',
    wikiPath: '/tmp/wiki',
};

test('refreshes the authoritative Wiki editor snapshot after a conflict', async () => {
    const calls: string[] = [];
    const snapshot = await refreshWikiPageSnapshot({
        fetch: async () => {
            calls.push('fetch');
            return refreshedPage;
        },
        invalidate: async () => {
            calls.push('invalidate');
        },
    });

    expect(calls).toEqual(['invalidate', 'fetch']);
    expect(snapshot).toEqual({
        content: refreshedPage.body,
        document: refreshedPage,
        revision: refreshedPage.hash,
    });
});

test('rejects unsupported or oversized Wiki images before reading them', () => {
    expect(() => validateWikiImageFile({ size: 1, type: 'image/svg+xml' })).toThrow(
        'PNG, JPEG, GIF, or WebP'
    );
    expect(() => validateWikiImageFile({ size: 8 * 1024 * 1024 + 1, type: 'image/png' })).toThrow(
        'between 1 byte and 8 MiB'
    );
    expect(validateWikiImageFile({ size: 8 * 1024 * 1024, type: 'image/webp' })).toBe('image/webp');
});

test('scopes Wiki editor drafts to the active Wiki root', () => {
    expect(wikiPaneEditorTargetKey('/wiki/one', 'Projects/Alpha.md')).not.toBe(
        wikiPaneEditorTargetKey('/wiki/two', 'Projects/Alpha.md')
    );
});
