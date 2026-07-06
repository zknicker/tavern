import { appRoutes } from '../../lib/app-routes.ts';

export interface SearchConfig {
    placeholder: string;
}

const searchConfigs: Array<{
    config: SearchConfig;
    match: (pathname: string) => boolean;
}> = [
    {
        match: (pathname) => pathname === appRoutes.automations,
        config: {
            placeholder: 'Filter jobs...',
        },
    },
];

export function getSearchConfig(pathname: string): SearchConfig | null {
    return searchConfigs.find((entry) => entry.match(pathname))?.config ?? null;
}

export function setSearchQuery(searchParams: URLSearchParams, query: string) {
    const nextSearchParams = new URLSearchParams(searchParams);
    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
        nextSearchParams.delete('q');
        return nextSearchParams;
    }

    nextSearchParams.set('q', query);
    return nextSearchParams;
}
