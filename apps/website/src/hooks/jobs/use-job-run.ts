import { trpc } from '../../lib/trpc.tsx';

export function useJobRun() {
    const utils = trpc.useUtils();

    return trpc.jobs.run.useMutation({
        onSuccess: async (_, input) => {
            await utils.jobs.list.invalidate();
            await utils.jobs.get.invalidate({ slug: input.slug });
        },
    });
}
