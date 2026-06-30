import { trpc } from '../../lib/trpc.tsx';

export function useAgentDelete() {
    const utils = trpc.useUtils();

    return trpc.agent.delete.useMutation({
        onSuccess: async ({ agentId }) => {
            utils.agent.list.setData(undefined, (current) => {
                if (!current) {
                    return current;
                }

                return {
                    ...current,
                    agents: current.agents.filter((agent) => agent.id !== agentId),
                };
            });
            await utils.agent.list.invalidate();
            await utils.agent.primary.invalidate();
            await utils.agent.activity.invalidate();
            await utils.model.list.invalidate();
        },
    });
}
