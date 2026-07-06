import * as React from 'react';
import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useGoogleSettings() {
    return trpc.plugin.googleSettings.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveGoogleSettings() {
    const utils = trpc.useUtils();
    return trpc.plugin.saveGoogleSettings.useMutation({
        async onSuccess() {
            await invalidateGooglePluginQueries(utils);
        },
    });
}

export function useStartGoogleOAuth() {
    return trpc.plugin.startGoogleOAuth.useMutation();
}

export function usePollGoogleOAuth(sessionId: string | null) {
    const utils = trpc.useUtils();
    const query = trpc.plugin.pollGoogleOAuth.useQuery(
        { sessionId: sessionId ?? '' },
        {
            enabled: Boolean(sessionId),
            refetchInterval(query) {
                return query.state.data?.status === 'pending' ? 1000 : false;
            },
            retry: false,
        }
    );

    React.useEffect(() => {
        if (query.data && query.data.status !== 'pending') {
            void invalidateGooglePluginQueries(utils);
        }
    }, [query.data, utils]);

    return query;
}

export function useDisconnectGoogleOAuth() {
    const utils = trpc.useUtils();
    return trpc.plugin.disconnectGoogleOAuth.useMutation({
        async onSuccess() {
            await invalidateGooglePluginQueries(utils);
        },
    });
}

async function invalidateGooglePluginQueries(utils: ReturnType<typeof trpc.useUtils>) {
    await Promise.all([
        utils.plugin.googleSettings.invalidate(),
        utils.plugin.googleCalendarEvents.invalidate(),
        utils.plugin.list.invalidate(),
        utils.agentRuntime.get.invalidate(),
        utils.skill.list.invalidate(),
    ]);
}
