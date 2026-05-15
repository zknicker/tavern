import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useSkillGet(skillId: null | string) {
    return trpc.skill.get.useQuery(
        {
            skillId: skillId ?? '',
        },
        {
            enabled: skillId !== null,
            ...queryPolicy.agentRuntimeSnapshot,
        }
    );
}
