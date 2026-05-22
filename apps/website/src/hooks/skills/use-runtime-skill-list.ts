import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useRuntimeSkillList(input: { agentId?: string }) {
    return trpc.skill.runtimeList.useQuery(input, queryPolicy.agentRuntimeSnapshot);
}
