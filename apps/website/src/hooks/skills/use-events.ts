import { trpc } from '../../lib/trpc.tsx';

export function useSkillEvents() {
    const utils = trpc.useUtils();

    trpc.skill.onUpdate.useSubscription(undefined, {
        onData: () => {
            Promise.all([
                utils.agent.list.invalidate(),
                utils.agent.primary.invalidate(),
                utils.skill.list.invalidate(),
                utils.skill.runtimeList.invalidate(),
                utils.skill.get.invalidate(),
                utils.skill.hubAvailable.invalidate(),
            ]).catch(() => undefined);
        },
    });
}
