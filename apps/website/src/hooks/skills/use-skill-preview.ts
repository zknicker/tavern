import { trpc } from '../../lib/trpc.tsx';

export function useSkillPreview(input: { skillId: null | string }) {
    return trpc.skill.get.useQuery(input.skillId ?? '', {
        enabled: input.skillId !== null,
        retry: false,
    });
}
