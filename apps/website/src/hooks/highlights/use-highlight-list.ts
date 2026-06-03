import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useHighlightList() {
    return trpc.highlight.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
