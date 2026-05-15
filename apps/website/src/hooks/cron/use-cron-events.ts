import { trpc } from '../../lib/trpc.tsx';

export function useCronEvents() {
    const utils = trpc.useUtils();

    trpc.cron.onUpdate.useSubscription(undefined, {
        onData: () => {
            Promise.all([
                utils.cron.get.invalidate(),
                utils.cron.list.invalidate(),
                utils.cron.runs.invalidate(),
            ]).catch(() => undefined);
        },
    });
}
