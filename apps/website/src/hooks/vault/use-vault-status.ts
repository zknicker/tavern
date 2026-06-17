import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useVaultStatus() {
    return trpc.vault.status.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useVaultStatusSuspense() {
    return trpc.vault.status.useSuspenseQuery();
}

export function useVaultSettings() {
    return trpc.vault.settings.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveVaultSettings() {
    const utils = trpc.useUtils();
    return trpc.vault.saveSettings.useMutation({
        async onSuccess() {
            await Promise.all([utils.vault.settings.invalidate(), utils.vault.status.invalidate()]);
        },
    });
}
