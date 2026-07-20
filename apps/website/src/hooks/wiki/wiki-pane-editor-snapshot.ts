import type { WikiPageDetail } from '../../features/wiki/types.ts';

export function wikiPageSnapshot(page: WikiPageDetail | null) {
    return page ? { content: page.body, document: page, revision: page.hash } : null;
}

export function wikiPaneEditorTargetKey(wikiPath: string | null, pagePath: string) {
    return JSON.stringify({ kind: 'wikiPage', pagePath, wikiPath });
}

export async function refreshWikiPageSnapshot(input: {
    fetch: () => Promise<WikiPageDetail | null>;
    invalidate: () => Promise<unknown>;
}) {
    await input.invalidate();
    return wikiPageSnapshot(await input.fetch());
}
