import type { DefaultOptions } from '@tanstack/react-query';
import { shouldRetryQuery } from './query-retry.ts';

const THIRTY_SECONDS_MS = 30_000;
const FIVE_SECONDS_MS = 5000;
const TWO_SECONDS_MS = 2000;
const FIVE_MINUTES_MS = 5 * 60_000;
const THIRTY_MINUTES_MS = 30 * 60_000;

const stableQueryPolicy = {
    gcTime: THIRTY_MINUTES_MS,
    refetchOnMount: false,
} as const;

export const queryPolicy = {
    localConfig: {
        ...stableQueryPolicy,
        staleTime: FIVE_MINUTES_MS,
    },
    agentRuntimeSnapshot: {
        ...stableQueryPolicy,
        staleTime: THIRTY_SECONDS_MS,
    },
    syncedSnapshot: {
        ...stableQueryPolicy,
        staleTime: THIRTY_SECONDS_MS,
    },
    volatileState: {
        refetchOnMount: false,
        staleTime: 0,
    },
    livePollSlow: {
        ...stableQueryPolicy,
        refetchInterval: THIRTY_SECONDS_MS,
        staleTime: 0,
    },
    livePollFast: {
        ...stableQueryPolicy,
        refetchInterval: FIVE_SECONDS_MS,
        staleTime: 0,
    },
    livePollDetail: {
        ...stableQueryPolicy,
        refetchInterval: TWO_SECONDS_MS,
        staleTime: 0,
    },
} as const;

export const queryClientDefaultOptions = {
    queries: {
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
    },
} satisfies DefaultOptions;
