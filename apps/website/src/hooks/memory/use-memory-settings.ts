import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useMemorySettings() {
    return trpc.memory.get.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useMemorySettingsSuspense() {
    return trpc.memory.get.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
