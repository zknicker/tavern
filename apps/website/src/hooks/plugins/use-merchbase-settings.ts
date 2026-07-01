import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useMerchbaseSettings() {
    return trpc.plugin.merchbaseSettings.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveMerchbaseSettings() {
    const utils = trpc.useUtils();
    return trpc.plugin.saveMerchbaseSettings.useMutation({
        async onSuccess() {
            await Promise.all([
                utils.plugin.merchbaseSettings.invalidate(),
                utils.plugin.list.invalidate(),
                utils.plugin.merchbaseSalesSeries.invalidate(),
                utils.agentRuntime.get.invalidate(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}
