import { useRef } from 'react';
import { mergeDefined } from '../../lib/merge-defined.ts';
import { type AppRouterOutputs, trpc } from '../../lib/trpc.tsx';

type TimezoneSettings = AppRouterOutputs['timezone']['settings'];

const emptyTimezoneSettings: {
    resolvedTimezone: null | string;
    timezone: null | string;
} = {
    resolvedTimezone: null,
    timezone: null,
};

/**
 * Saves apply to the cache optimistically so controls never snap back to the
 * previous server value while a save is in flight. The cache refetches once
 * the last overlapping save settles; errors roll back to the snapshot.
 */
export function useTimezoneSettings() {
    const utils = trpc.useUtils();
    const query = trpc.timezone.settings.useQuery();
    const pendingSaves = useRef(0);
    const mutation = trpc.timezone.saveSettings.useMutation({
        onError: (_error, _input, context) => {
            const snapshot = context as TimezoneSettings | undefined;

            if (snapshot) {
                utils.timezone.settings.setData(undefined, snapshot);
            }
        },
        onMutate: async (input) => {
            pendingSaves.current += 1;
            await utils.timezone.settings.cancel();
            const snapshot = utils.timezone.settings.getData();

            if (snapshot) {
                utils.timezone.settings.setData(undefined, mergeDefined(snapshot, input));
            }

            return snapshot;
        },
        onSettled: () => {
            pendingSaves.current -= 1;

            if (pendingSaves.current === 0) {
                void utils.timezone.settings.invalidate();
            }
        },
    });

    return {
        isLoading: query.isPending,
        save: mutation.mutateAsync,
        settings: query.data ?? emptyTimezoneSettings,
    };
}
