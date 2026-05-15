import { trpc } from '../../lib/trpc.tsx';
import { invalidateModelList } from '../models/invalidate-model-list.ts';

export function useSyncEvents() {
    const utils = trpc.useUtils();

    trpc.sync.onDataUpdate.useSubscription(undefined, {
        onData: () => {
            Promise.all([
                utils.agent.activity.invalidate(),
                utils.chat.list.invalidate(),
                utils.chat.log.list.invalidate(),
                utils.log.list.invalidate(),
                invalidateModelList(utils),
                utils.cron.deliveryTargets.invalidate(),
                utils.agentRuntime.get.invalidate(),
                utils.session.get.invalidate(),
                utils.session.list.invalidate(),
                utils.session.history.get.invalidate(),
                utils.session.tool.get.invalidate(),
                utils.subAgent.list.invalidate(),
            ]).catch(() => undefined);
        },
    });
}
