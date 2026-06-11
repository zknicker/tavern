import { trpc } from '../../../lib/trpc.tsx';

export function useConnectors() {
    const utils = trpc.useUtils();
    const invalidate = () => utils.connector.list.invalidate();
    const listQuery = trpc.connector.list.useQuery();
    const createMutation = trpc.connector.create.useMutation({ onSuccess: invalidate });
    const updateMutation = trpc.connector.update.useMutation({ onSuccess: invalidate });
    const deleteMutation = trpc.connector.delete.useMutation({ onSuccess: invalidate });
    const testMutation = trpc.connector.test.useMutation();

    return {
        connectors: listQuery.data?.connectors ?? [],
        createConnector: createMutation.mutateAsync,
        deleteConnector: deleteMutation.mutateAsync,
        isLoading: listQuery.isPending,
        isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
        testConnector: testMutation.mutateAsync,
        testingId: testMutation.isPending ? (testMutation.variables?.id ?? null) : null,
        updateConnector: updateMutation.mutateAsync,
    };
}
