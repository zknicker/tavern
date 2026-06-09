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

export function useCronDeliveryTargets() {
    useCronDeliveryTargetInvalidation();

    return trpc.cron.deliveryTargets.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useCronDeliveryTargetsSuspense() {
    useCronDeliveryTargetInvalidation();

    return trpc.cron.deliveryTargets.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
