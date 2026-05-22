import * as React from 'react';
import { queryPolicy } from '../../lib/query-policy.ts';
import type {
    AgentListOutput,
    MentionInventoryOutput,
    MentionPathOutput,
} from '../../lib/trpc.tsx';
import { trpc } from '../../lib/trpc.tsx';
import type { MentionOption } from './mention-types.ts';

export function useMentionOptions({
    agentId,
    query,
}: {
    agentId: string;
    agents: AgentListOutput['agents'];
    query: string;
}) {
    const normalizedQuery = normalizeQuery(query);
    const debouncedPathQuery = useDebouncedValue(query, 150);
    const inventory = trpc.mention.inventory.useQuery(
        {
            agentId: agentId || undefined,
        },
        queryPolicy.agentRuntimeSnapshot
    );
    const shouldSearchPaths = shouldSearchPathMentions(debouncedPathQuery);
    const paths = trpc.mention.paths.useQuery(
        {
            agentId: agentId || undefined,
            query: debouncedPathQuery,
        },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            enabled: Boolean(agentId) && shouldSearchPaths,
        }
    );

    const options = React.useMemo(() => {
        return selectMentionOptionsForQuery({
            inventoryData: inventory.data,
            pathData: paths.data,
            query,
        });
    }, [inventory.data, paths.data, query]);

    return {
        isPathSearchLoading:
            shouldSearchPathMentions(query) &&
            (debouncedPathQuery !== query || paths.isLoading || paths.isFetching),
        isPathSearchActive: shouldSearchPathMentions(query),
        options,
    };
}

export function selectMentionOptionsForQuery({
    inventoryData,
    pathData,
    query,
}: {
    inventoryData?: MentionInventoryOutput;
    pathData?: MentionPathOutput;
    query: string;
}) {
    const inventoryOptions = inventoryData
        ? filterMentionOptionsForQuery(inventoryData.options, query)
        : [];
    const pathOptions =
        pathData && normalizeQuery(pathData.query) === normalizeQuery(query)
            ? pathData.options
            : [];

    return [...inventoryOptions, ...pathOptions];
}

export function filterMentionOptionsForQuery(options: MentionOption[], query: string) {
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
        return options;
    }

    return options.filter((option) =>
        normalizeQuery(
            [option.label, option.insertText, option.id, option.description, option.sourceLabel]
                .filter(Boolean)
                .join(' ')
        ).includes(normalizedQuery)
    );
}

function normalizeQuery(value: string) {
    return value.trim().toLowerCase();
}

function shouldSearchPathMentions(query: string) {
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
        return false;
    }

    return (
        normalizedQuery.includes('/') ||
        normalizedQuery.startsWith('.') ||
        normalizedQuery.startsWith('~') ||
        /\.[a-z0-9]+$/u.test(normalizedQuery) ||
        normalizedQuery.length >= 3
    );
}

function useDebouncedValue(value: string, delayMs: number) {
    const [debouncedValue, setDebouncedValue] = React.useState(value);

    React.useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [delayMs, value]);

    return debouncedValue;
}
