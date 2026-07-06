import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useTaskList() {
    return trpc.tasks.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
