import { trpc } from '../../lib/trpc.tsx';

export function useToolEnabledSet() {
    const utils = trpc.useUtils();

    return trpc.skill.setToolEnabled.useMutation({
        onSuccess: async () => {
            await utils.skill.list.invalidate();
        },
    });
}
