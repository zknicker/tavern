import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useMerchbaseSettings() {
    return trpc.integration.merchbaseSettings.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveMerchbaseSettings() {
    const utils = trpc.useUtils();
    return trpc.integration.saveMerchbaseSettings.useMutation({
        async onSuccess() {
            await Promise.all([
                utils.integration.merchbaseSettings.invalidate(),
                utils.agentRuntime.get.invalidate(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}
