import type { WikiPage, WikiPageList, WikiSearchResult, WikiStatus } from '@tavern/api';
import { rows, table, ui } from '../ui.ts';

export function renderWikiStatus(status: WikiStatus): string {
    return rows(
        [
            { left: 'Wiki', right: status.wikiPath },
            { left: 'Source', right: status.configSource },
            { left: 'Pages', right: String(status.pageCount) },
            { left: 'TAXONOMY.md', right: status.indexExists ? 'present' : 'missing' },
            { left: 'Access', right: `readable=${status.readable} writable=${status.writable}` },
        ],
        ''
    );
}

export function renderWikiPages(list: WikiPageList, stream: NodeJS.WriteStream): string {
    if (list.pages.length === 0) {
        return ui.dim('No Wiki pages.', stream);
    }
    return table(
        list.pages.map((page) => [page.path, page.title]),
        ''
    );
}

export function renderWikiSearch(result: WikiSearchResult, stream: NodeJS.WriteStream): string {
    if (result.hits.length === 0) {
        return ui.dim(`No matches for "${result.query}".`, stream);
    }
    return table(
        result.hits.map((hit) => [hit.page.path, hit.score.toFixed(2), hit.page.title]),
        ''
    );
}

export function renderWikiPage(page: WikiPage, stream: NodeJS.WriteStream): string {
    const title = ui.bold(`# ${page.title}`, stream);
    const meta = rows([{ left: 'path', right: page.path }], '');
    return `${title}\n\n${meta}\n\n${page.body}`;
}
