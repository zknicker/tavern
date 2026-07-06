import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useTaskGet(taskId: string | null) {
    return trpc.tasks.get.useQuery(
        { taskId: taskId ?? '' },
        { ...queryPolicy.agentRuntimeSnapshot, enabled: taskId !== null }
    );
}
