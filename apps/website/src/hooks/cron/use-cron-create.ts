import { trpc } from '../../lib/trpc.tsx';

export function useCronCreate() {
    const utils = trpc.useUtils();

    return trpc.cron.create.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.cron.get.invalidate(),
                utils.cron.list.invalidate(),
                utils.cron.runs.invalidate(),
            ]);
        },
    });
}
