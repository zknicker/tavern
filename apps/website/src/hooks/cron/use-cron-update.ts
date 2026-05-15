import { trpc } from '../../lib/trpc.tsx';

export function useCronUpdate() {
    const utils = trpc.useUtils();

    return trpc.cron.update.useMutation({
        onSuccess: async (_data, variables) => {
            await Promise.all([
                utils.cron.get.invalidate(),
                utils.cron.get.invalidate({
                    jobId: variables.jobId,
                }),
                utils.cron.list.invalidate(),
                utils.cron.runs.invalidate(),
            ]);
        },
    });
}
