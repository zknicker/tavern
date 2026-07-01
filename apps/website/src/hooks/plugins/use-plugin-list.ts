import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function usePluginList() {
    return trpc.plugin.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSetAgentPluginGrant() {
    const utils = trpc.useUtils();
    return trpc.plugin.setAgentGrant.useMutation({
        async onSuccess() {
            await Promise.all([
                utils.agent.list.invalidate(),
                utils.agent.primary.invalidate(),
                utils.plugin.list.invalidate(),
            ]);
        },
    });
}
