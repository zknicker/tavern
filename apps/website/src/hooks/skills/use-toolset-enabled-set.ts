import { trpc } from '../../lib/trpc.tsx';

export function useToolsetEnabledSet() {
    const utils = trpc.useUtils();

    return trpc.skill.setToolsetEnabled.useMutation({
        onSuccess: async () => {
            await utils.skill.list.invalidate();
        },
    });
}
