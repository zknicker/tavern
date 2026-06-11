import { useRef } from 'react';
import { mergeDefined } from '../../../lib/merge-defined.ts';
import { type AppRouterOutputs, trpc } from '../../../lib/trpc.tsx';
import type { ApprovalModeValue } from './permissions-section.tsx';

type PermissionSettings = AppRouterOutputs['agent']['permissionSettings'];

const emptyPermissionSettings: {
    approvalMode: ApprovalModeValue;
    automationApprovalMode: ApprovalModeValue;
    commandAllowlist: string[];
} = {
    approvalMode: 'ask',
    automationApprovalMode: 'deny',
    commandAllowlist: [],
};

/**
 * Saves apply to the cache optimistically so controls never snap back to the
 * previous server value while a save is in flight. The cache refetches once
 * the last overlapping save settles; errors roll back to the snapshot.
 */
export function useAgentPermissionSettings() {
    const utils = trpc.useUtils();
    const query = trpc.agent.permissionSettings.useQuery();
    const pendingSaves = useRef(0);
    const mutation = trpc.agent.savePermissionSettings.useMutation({
        onError: (_error, _input, context) => {
            const snapshot = context as PermissionSettings | undefined;

            if (snapshot) {
                utils.agent.permissionSettings.setData(undefined, snapshot);
            }
        },
        onMutate: async (input) => {
            pendingSaves.current += 1;
            await utils.agent.permissionSettings.cancel();
            const snapshot = utils.agent.permissionSettings.getData();

            if (snapshot) {
                utils.agent.permissionSettings.setData(undefined, mergeDefined(snapshot, input));
            }

            return snapshot;
        },
        onSettled: () => {
            pendingSaves.current -= 1;

            if (pendingSaves.current === 0) {
                void utils.agent.permissionSettings.invalidate();
            }
        },
    });

    return {
        isLoading: query.isPending,
        save: mutation.mutateAsync,
        settings: query.data ?? emptyPermissionSettings,
    };
}
