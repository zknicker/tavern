import * as React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { getSearchConfig, setSearchQuery } from './search-state.ts';

export function useSearch() {
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const config = getSearchConfig(location.pathname);
    const query = config ? (searchParams.get('q') ?? '') : '';
    const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());

    return {
        deferredQuery,
        isEnabled: config !== null,
        placeholder: config?.placeholder ?? 'Search unavailable on this page',
        query,
        setQuery(nextQuery: string) {
            if (!config) {
                return;
            }

            React.startTransition(() => {
                setSearchParams((current) => setSearchQuery(current, nextQuery), {
                    replace: true,
                });
            });
        },
    };
}
