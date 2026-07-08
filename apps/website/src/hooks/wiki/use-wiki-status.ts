import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useWikiStatus() {
    return trpc.wiki.status.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useWikiStatusSuspense() {
    return trpc.wiki.status.useSuspenseQuery();
}

export function useWikiSettings() {
    return trpc.wiki.settings.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveWikiSettings() {
    const utils = trpc.useUtils();
    return trpc.wiki.saveSettings.useMutation({
        async onSuccess() {
            await Promise.all([utils.wiki.settings.invalidate(), utils.wiki.status.invalidate()]);
        },
    });
}
