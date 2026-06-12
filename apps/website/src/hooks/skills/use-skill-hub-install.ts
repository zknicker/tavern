import { trpc } from '../../lib/trpc.tsx';

export function useSkillHubInstall() {
    const utils = trpc.useUtils();

    return trpc.skill.hubInstall.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.skill.list.invalidate(),
                utils.skill.hubAvailable.invalidate(),
            ]);
        },
    });
}
