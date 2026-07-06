import { trpc } from '../../lib/trpc.tsx';

export function useSkillReset() {
    const utils = trpc.useUtils();

    return trpc.skill.reset.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.skill.list.invalidate(),
                utils.skill.runtimeList.invalidate(),
                utils.skill.get.invalidate(),
                utils.skill.hubAvailable.invalidate(),
            ]);
        },
    });
}
