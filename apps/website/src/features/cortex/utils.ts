import type { CortexListOutput } from '../../lib/trpc.tsx';
import type { CortexPageNode } from './types.ts';

export function filterPages(pages: CortexPageNode[], query: string) {
    const terms = query.trim().toLowerCase();
    if (!terms) {
        return pages;
    }

    return pages.filter((page) =>
        [page.title, page.slug, page.type, ...page.tags].join(' ').toLowerCase().includes(terms)
    );
}

export function formatTimestamp(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export function resolveSelectedPage(list: CortexListOutput, selectedSlug: string | null) {
    return list.pages.find((page) => page.slug === selectedSlug) ?? list.pages[0] ?? null;
}

export function countLinks(list: Pick<CortexListOutput, 'pages'>) {
    return list.pages.reduce((count, page) => count + page.links.length, 0);
}
