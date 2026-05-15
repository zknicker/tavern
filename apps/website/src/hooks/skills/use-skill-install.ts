import { trpc } from '../../lib/trpc.tsx';

export function useSkillInstall() {
    const utils = trpc.useUtils();

    return trpc.skill.install.useMutation({
        onSuccess: async (data) => {
            await Promise.all([
                data.skill
                    ? utils.skill.get.invalidate({
                          skillId: data.skill.id,
                      })
                    : Promise.resolve(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}
