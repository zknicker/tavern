import { trpc } from '../../lib/trpc.tsx';

export function useSaveMemorySettings(options?: { onSuccess?: () => Promise<void> | void }) {
    const utils = trpc.useUtils();

    return trpc.memory.save.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.memory.get.invalidate(), utils.memory.status.invalidate()]);
            await options?.onSuccess?.();
        },
    });
}
