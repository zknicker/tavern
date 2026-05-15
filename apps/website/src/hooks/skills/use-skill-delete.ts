import { trpc } from '../../lib/trpc.tsx';

export function useSkillDelete() {
    const utils = trpc.useUtils();

    return trpc.skill.delete.useMutation({
        onSuccess: async (_data, variables) => {
            await Promise.all([
                utils.agent.list.invalidate(),
                utils.agent.primary.invalidate(),
                utils.skill.get.invalidate(),
                utils.skill.get.invalidate({
                    skillId: variables.skillId,
                }),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}
