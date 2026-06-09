import { trpc } from '../../lib/trpc.tsx';

export function useSkillEnabledSet() {
    const utils = trpc.useUtils();

    return trpc.skill.setEnabled.useMutation({
        onSuccess: async () => {
            await utils.skill.list.invalidate();
        },
    });
}
