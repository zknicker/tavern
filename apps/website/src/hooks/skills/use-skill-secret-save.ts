import { trpc } from '../../lib/trpc.tsx';

export function useSkillSecretSave() {
    const utils = trpc.useUtils();

    return trpc.skill.saveSecret.useMutation({
        onSuccess: async (_data, variables) => {
            await Promise.all([
                utils.skill.get.invalidate({
                    skillId: variables.skillId,
                }),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}
