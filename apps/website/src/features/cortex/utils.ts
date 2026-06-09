import type { CortexListOutput } from '../../lib/trpc.tsx';
import type { CortexPageNode } from './types.ts';

export function filterPages(pages: CortexPageNode[], query: string) {
    const terms = query.trim().toLowerCase();
    if (!terms) {
        return pages;
    }

    return pages.filter((page) =>
        [page.title, page.topic, page.path, page.section].join(' ').toLowerCase().includes(terms)
    );
}

export function formatTimestamp(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export function resolveSelectedPage(
    list: CortexListOutput,
    selected: { path: string; topic: string } | null
) {
    if (selected) {
        const exact = list.pages.find(
            (page) => page.path === selected.path && page.topic === selected.topic
        );
        if (exact) {
            return exact;
        }
    }
    return list.pages[0] ?? null;
}

export function pageKey(page: Pick<CortexPageNode, 'path' | 'topic'>) {
    return `${page.topic}:${page.path}`;
}
