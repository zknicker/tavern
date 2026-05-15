import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useOpenRouterSettings() {
    return trpc.openRouterSettings.get.useQuery(undefined, queryPolicy.localConfig);
}

export function useOpenRouterSettingsSuspense() {
    return trpc.openRouterSettings.get.useSuspenseQuery(undefined, queryPolicy.localConfig);
}
