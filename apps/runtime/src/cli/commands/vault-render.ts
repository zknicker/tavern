import type { VaultPage, VaultPageList, VaultSearchResult, VaultStatus } from '@tavern/api';
import { rows, table, ui } from '../ui.ts';

export function renderVaultStatus(status: VaultStatus): string {
    return rows(
        [
            { left: 'Memory', right: status.vaultPath },
            { left: 'Source', right: status.configSource },
            { left: 'Pages', right: String(status.pageCount) },
            { left: 'TAXONOMY.md', right: status.indexExists ? 'present' : 'missing' },
            { left: 'Access', right: `readable=${status.readable} writable=${status.writable}` },
        ],
        ''
    );
}

export function renderVaultPages(list: VaultPageList, stream: NodeJS.WriteStream): string {
    if (list.pages.length === 0) {
        return ui.dim('No Memory files.', stream);
    }
    return table(
        list.pages.map((page) => [page.path, page.title]),
        ''
    );
}

export function renderVaultSearch(result: VaultSearchResult, stream: NodeJS.WriteStream): string {
    if (result.hits.length === 0) {
        return ui.dim(`No matches for "${result.query}".`, stream);
    }
    return table(
        result.hits.map((hit) => [hit.page.path, hit.score.toFixed(2), hit.page.title]),
        ''
    );
}

export function renderVaultPage(page: VaultPage, stream: NodeJS.WriteStream): string {
    const title = ui.bold(`# ${page.title}`, stream);
    const meta = rows([{ left: 'path', right: page.path }], '');
    return `${title}\n\n${meta}\n\n${page.body}`;
}
