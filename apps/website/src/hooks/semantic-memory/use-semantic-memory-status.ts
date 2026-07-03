import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useSemanticMemoryStatus() {
    return trpc.semanticMemory.status.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSemanticMemoryStatusSuspense() {
    return trpc.semanticMemory.status.useSuspenseQuery();
}

export function useSemanticMemorySettings() {
    return trpc.semanticMemory.settings.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveSemanticMemorySettings() {
    const utils = trpc.useUtils();
    return trpc.semanticMemory.saveSettings.useMutation({
        async onSuccess() {
            await Promise.all([
                utils.semanticMemory.settings.invalidate(),
                utils.semanticMemory.status.invalidate(),
            ]);
        },
    });
}
