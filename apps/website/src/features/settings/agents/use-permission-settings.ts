import { trpc } from '../../../lib/trpc.tsx';
import type { ApprovalModeValue } from './permissions-section.tsx';

const emptyPermissionSettings: {
    approvalMode: ApprovalModeValue;
    automationApprovalMode: ApprovalModeValue;
    commandAllowlist: string[];
} = {
    approvalMode: 'ask',
    automationApprovalMode: 'deny',
    commandAllowlist: [],
};

export function useAgentPermissionSettings() {
    const utils = trpc.useUtils();
    const query = trpc.agent.permissionSettings.useQuery();
    const mutation = trpc.agent.savePermissionSettings.useMutation({
        onSuccess: () => utils.agent.permissionSettings.invalidate(),
    });

    return {
        isSaving: mutation.isPending || query.isPending,
        save: mutation.mutateAsync,
        settings: query.data ?? emptyPermissionSettings,
    };
}
