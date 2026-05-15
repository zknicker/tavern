import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useSkillList() {
    return trpc.skill.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSkillListSuspense() {
    return trpc.skill.list.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
