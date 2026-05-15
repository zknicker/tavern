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
}
