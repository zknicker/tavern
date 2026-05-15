import { trpc } from '../../lib/trpc.tsx';

export function useSkillCheckUpdates() {
    const utils = trpc.useUtils();

    return trpc.skill.checkUpdates.useMutation({
        onSuccess: async (_data, variables) => {
            await Promise.all([
                utils.skill.get.invalidate({
                    skillId: variables.skillId,
                }),
                utils.skill.list.invalidate(),
                utils.jobs.list.invalidate(),
            ]);
        },
    });
}
