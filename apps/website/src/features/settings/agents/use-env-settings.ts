import { trpc } from '../../../lib/trpc.tsx';

const emptyEnvSettings = {
    updatedAt: null,
    variables: [] as { hasValue: boolean; name: string }[],
};

export function useAgentEnvSettings() {
    const utils = trpc.useUtils();
    const query = trpc.agent.envSettings.useQuery();
    const mutation = trpc.agent.saveEnvSettings.useMutation({
        onSuccess: async () => {
            await utils.agent.envSettings.invalidate();
        },
    });

    return {
        isLoading: query.isPending,
        isSaving: mutation.isPending,
        save: mutation.mutateAsync,
        settings: query.data ?? emptyEnvSettings,
    };
}
