import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useCortexSettings() {
    return trpc.cortex.settings.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveCortexSettings() {
    const utils = trpc.useUtils();
    return trpc.cortex.saveSettings.useMutation({
        onSuccess: () => {
            utils.cortex.settings.invalidate();
            utils.cortex.status.invalidate();
        },
    });
}
