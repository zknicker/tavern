import { useRef } from 'react';
import { mergeDefined } from '../../lib/merge-defined.ts';
import { type AppRouterOutputs, trpc } from '../../lib/trpc.tsx';

type AutoDispatchSettings = AppRouterOutputs['tasks']['autoDispatchSettings'];

const emptyAutoDispatchSettings: AutoDispatchSettings = {
    autoDispatchConcurrency: 1,
    autoDispatchEnabled: false,
    updatedAt: null,
};

/**
 * Global auto-dispatch controls (kill switch + concurrency). Saves apply to the
 * cache optimistically so toggles and the stepper never snap back while a save
 * is in flight; the cache refetches once overlapping saves settle and rolls
 * back to the snapshot on error.
 */
export function useAutoDispatchSettings() {
    const utils = trpc.useUtils();
    const query = trpc.tasks.autoDispatchSettings.useQuery();
    const pendingSaves = useRef(0);
    const mutation = trpc.tasks.saveAutoDispatchSettings.useMutation({
        onError: (_error, _input, context) => {
            const snapshot = context as AutoDispatchSettings | undefined;

            if (snapshot) {
                utils.tasks.autoDispatchSettings.setData(undefined, snapshot);
            }
        },
        onMutate: async (input) => {
            pendingSaves.current += 1;
            await utils.tasks.autoDispatchSettings.cancel();
            const snapshot = utils.tasks.autoDispatchSettings.getData();

            if (snapshot) {
                utils.tasks.autoDispatchSettings.setData(undefined, mergeDefined(snapshot, input));
            }

            return snapshot;
        },
        onSettled: () => {
            pendingSaves.current -= 1;

            if (pendingSaves.current === 0) {
                void utils.tasks.autoDispatchSettings.invalidate();
            }
        },
    });

    return {
        isLoading: query.isPending,
        save: mutation.mutateAsync,
        settings: query.data ?? emptyAutoDispatchSettings,
    };
}
