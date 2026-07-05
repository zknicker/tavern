import { trpc } from '../../lib/trpc.tsx';

export function useMemoryJobEvents() {
    const utils = trpc.useUtils();

    trpc.memory.onJobsUpdate.useSubscription(undefined, {
        onData: () => {
            void utils.memory.jobs.invalidate();
            void utils.memory.getJob.invalidate();
        },
    });
}
