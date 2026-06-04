import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useCortexSettings() {
    return trpc.cortex.settings.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useCortexStatus() {
    return trpc.cortex.status.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveCortexSettings() {
    const utils = trpc.useUtils();
    return trpc.cortex.saveSettings.useMutation({
        onSuccess: () => {
            utils.agentRuntime.get.invalidate();
            utils.cortex.settings.invalidate();
            utils.cortex.status.invalidate();
        },
    });
}

export function useCortexSchema() {
    return trpc.cortex.schema.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveCortexSchema() {
    const utils = trpc.useUtils();
    return trpc.cortex.saveSchema.useMutation({
        onSuccess: () => {
            utils.cortex.schema.invalidate();
            utils.cortex.list.invalidate();
            utils.cortex.status.invalidate();
        },
    });
}

export function useRunCortexJob() {
    const utils = trpc.useUtils();
    return trpc.cortex.runJob.useMutation({
        onSuccess: () => {
            utils.cortex.status.invalidate();
            utils.cortex.list.invalidate();
        },
    });
}
