import { trpc } from '../../../lib/trpc.tsx';

export function useMcpServers() {
    const utils = trpc.useUtils();
    const invalidate = () => utils.mcp.list.invalidate();
    const listQuery = trpc.mcp.list.useQuery();
    const addMutation = trpc.mcp.add.useMutation({ onSuccess: invalidate });
    const removeMutation = trpc.mcp.remove.useMutation({ onSuccess: invalidate });
    const setEnabledMutation = trpc.mcp.setEnabled.useMutation({ onSuccess: invalidate });
    const testMutation = trpc.mcp.test.useMutation();

    return {
        addMcpServer: addMutation.mutateAsync,
        removeMcpServer: removeMutation.mutateAsync,
        setMcpServerEnabled: setEnabledMutation.mutateAsync,
        isLoading: listQuery.isPending,
        isSaving: addMutation.isPending || removeMutation.isPending || setEnabledMutation.isPending,
        mcpServers: listQuery.data?.servers ?? [],
        testMcpServer: testMutation.mutateAsync,
        testingName: testMutation.isPending ? (testMutation.variables?.name ?? null) : null,
    };
}
