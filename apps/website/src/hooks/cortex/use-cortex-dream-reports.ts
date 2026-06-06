import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useCortexDreamReports(limit = 20) {
    return trpc.cortex.dreamReports.useQuery({ limit }, queryPolicy.agentRuntimeSnapshot);
}
