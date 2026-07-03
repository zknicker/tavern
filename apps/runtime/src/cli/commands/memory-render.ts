import type {
    SemanticMemoryPage,
    SemanticMemoryPageList,
    SemanticMemorySearchResult,
    SemanticMemoryStatus,
} from '@tavern/api';
import { rows, table, ui } from '../ui.ts';

export function renderMemoryStatus(status: SemanticMemoryStatus): string {
    return rows(
        [
            { left: 'Memory', right: status.memoryPath },
            { left: 'Source', right: status.configSource },
            { left: 'Pages', right: String(status.pageCount) },
            { left: 'TAXONOMY.md', right: status.indexExists ? 'present' : 'missing' },
            { left: 'Access', right: `readable=${status.readable} writable=${status.writable}` },
        ],
        ''
    );
}

export function renderMemoryPages(
    list: SemanticMemoryPageList,
    stream: NodeJS.WriteStream
): string {
    if (list.pages.length === 0) {
        return ui.dim('No Memory files.', stream);
    }
    return table(
        list.pages.map((page) => [page.path, page.title]),
        ''
    );
}

export function renderMemorySearch(
    result: SemanticMemorySearchResult,
    stream: NodeJS.WriteStream
): string {
    if (result.hits.length === 0) {
        return ui.dim(`No matches for "${result.query}".`, stream);
    }
    return table(
        result.hits.map((hit) => [hit.page.path, hit.score.toFixed(2), hit.page.title]),
        ''
    );
}

export function renderMemoryPage(page: SemanticMemoryPage, stream: NodeJS.WriteStream): string {
    const title = ui.bold(`# ${page.title}`, stream);
    const meta = rows([{ left: 'path', right: page.path }], '');
    return `${title}\n\n${meta}\n\n${page.body}`;
}
