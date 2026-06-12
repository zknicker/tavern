import { trpc } from '../../lib/trpc.tsx';

export function useSkillHubUninstall() {
    const utils = trpc.useUtils();

    return trpc.skill.hubUninstall.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.skill.list.invalidate(),
                utils.skill.hubAvailable.invalidate(),
            ]);
        },
    });
}
