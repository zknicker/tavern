import { trpc } from '../../lib/trpc.tsx';

export function useAgentToolsSave() {
    const utils = trpc.useUtils();

    return trpc.agent.saveTools.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.agent.list.invalidate(),
                utils.openClawConfig.get.invalidate(),
            ]);
        },
    });
}
