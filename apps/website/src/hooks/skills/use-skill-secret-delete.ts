import { trpc } from '../../lib/trpc.tsx';

export function useSkillSecretDelete() {
    const utils = trpc.useUtils();

    return trpc.skill.deleteSecret.useMutation({
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
