import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useOpenClawConfig() {
    return trpc.openClawConfig.get.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
