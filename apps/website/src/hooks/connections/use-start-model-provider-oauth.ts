import { trpc } from '../../lib/trpc.tsx';

export function useStartModelProviderOAuth(options?: { onSuccess?: () => Promise<void> | void }) {
    const utils = trpc.useUtils();

    return trpc.modelAccess.startProviderOAuth.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.model.inventory.invalidate(),
                utils.modelAccess.get.invalidate(),
            ]);
            await options?.onSuccess?.();
        },
    });
}
