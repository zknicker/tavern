import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

function useCronDeliveryTargetInvalidation() {
    const utils = trpc.useUtils();

    trpc.chat.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.cron.deliveryTargets.invalidate();
        },
    });
}

export function useCronDeliveryTargets(agentId: string | null) {
    useCronDeliveryTargetInvalidation();

    return trpc.cron.deliveryTargets.useQuery(
        { agentId: agentId ?? '' },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            enabled: Boolean(agentId),
        }
    );
}
