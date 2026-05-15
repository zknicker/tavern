import { trpc } from '../../lib/trpc.tsx';

export function useJobsEvents() {
    const utils = trpc.useUtils();

    trpc.jobs.onUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.jobs.list.invalidate();
            void utils.jobs.get.invalidate(undefined, { exact: false });
        },
    });
}
