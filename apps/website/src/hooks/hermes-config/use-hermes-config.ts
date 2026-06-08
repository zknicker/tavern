import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useHermesConfig() {
    return trpc.hermesConfig.get.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
