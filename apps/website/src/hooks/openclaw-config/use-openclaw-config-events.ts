import { trpc } from '../../lib/trpc.tsx';

export function useOpenClawConfigEvents() {
    const utils = trpc.useUtils();

    trpc.openClawConfig.onUpdate.useSubscription(undefined, {
        onData: () => {
            void Promise.all([
                utils.openClawConfig.get.invalidate(),
                utils.agent.list.invalidate(),
                utils.agent.primary.invalidate(),
                utils.model.list.invalidate(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}
