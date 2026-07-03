import { trpc } from '../../lib/trpc.tsx';

export function useAgentEvents() {
    const utils = trpc.useUtils();

    trpc.agent.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.agent.activity.invalidate();
            void utils.agent.get.invalidate(undefined, { exact: false });
            void utils.agent.list.invalidate();
            void utils.agent.primary.invalidate();
        },
    });

    trpc.agent.onInstructionsUpdate.useSubscription(undefined, {
        onData: (event) => {
            const agentId = typeof event.agentId === 'string' ? event.agentId : null;

            if (!agentId) {
                void utils.agent.instructions.invalidate(undefined, { exact: false });
                return;
            }

            void utils.agent.instructions.invalidate({ agentId });
        },
    });
}
