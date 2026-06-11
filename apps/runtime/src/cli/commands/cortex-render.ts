import type {
    CortexPage,
    CortexPageList,
    CortexSearchResult,
    CortexStatus,
    CortexTopicList,
} from '@tavern/api';
import { rows, table, ui } from '../ui.ts';

/**
 * Pure human renderers for the cortex subcommands. No fetch, no console: each
 * takes a parsed schema object and the target stream (for TTY-aware styling) and
 * returns the text block. The `--json` path bypasses these entirely.
 */

export function renderCortexStatus(status: CortexStatus): string {
    return rows(
        [
            { left: 'Hub', right: status.hubPath },
            {
                left: 'Topics',
                right: `${status.topicCount} active, ${status.archivedTopicCount} archived`,
            },
            { left: 'Pages', right: String(status.pageCount) },
            { left: 'Access', right: `readable=${status.readable} writable=${status.writable}` },
        ],
        ''
    );
}

export function renderCortexTopics(list: CortexTopicList, stream: NodeJS.WriteStream): string {
    if (list.topics.length === 0) {
        return ui.dim('No topics.', stream);
    }
    return table(
        list.topics.map((topic) => [
            topic.slug,
            topic.archived ? 'archived' : 'active',
            topic.path,
        ]),
        ''
    );
}

export function renderCortexPages(list: CortexPageList, stream: NodeJS.WriteStream): string {
    if (list.pages.length === 0) {
        return ui.dim('No pages.', stream);
    }
    return table(
        list.pages.map((page) => [page.topic, page.section, page.path, page.title]),
        ''
    );
}

export function renderCortexSearch(result: CortexSearchResult, stream: NodeJS.WriteStream): string {
    if (result.hits.length === 0) {
        return ui.dim(`No matches for "${result.query}".`, stream);
    }
    return table(
        result.hits.map((hit) => [
            hit.page.topic,
            hit.page.path,
            hit.score.toFixed(2),
            hit.page.title,
        ]),
        ''
    );
}

export function renderCortexPage(page: CortexPage, stream: NodeJS.WriteStream): string {
    const title = ui.bold(`# ${page.title}`, stream);
    const meta = rows(
        [
            { left: 'topic', right: page.topic },
            { left: 'path', right: page.path },
        ],
        ''
    );
    return `${title}\n\n${meta}\n\n${page.body}`;
}
