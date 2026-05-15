import { trpc } from '../../lib/trpc.tsx';

export function useAgentProfileUpdate() {
    const utils = trpc.useUtils();

    return trpc.agent.saveProfile.useMutation({
        onSuccess: async ({ agent }) => {
            utils.agent.list.setData(undefined, (current) => {
                if (!current) {
                    return current;
                }

                return {
                    ...current,
                    agents: current.agents.map((currentAgent) =>
                        currentAgent.id === agent.id ? agent : currentAgent
                    ),
                };
            });
            await utils.agent.list.invalidate();
            await utils.agent.primary.invalidate();
            await utils.agent.activity.invalidate();
        },
    });
}
