import { trpc } from '../../lib/trpc.tsx';

export function useAgentSkillsUpdate() {
    const utils = trpc.useUtils();

    return trpc.agent.saveSkills.useMutation({
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
        },
    });
}
