import { trpc } from '../../../lib/trpc.tsx';
import type { FallbackModelEntry } from './fallback-models-editor.tsx';

const emptyExecutionSettings: {
    fallbackModels: FallbackModelEntry[];
    timezone: null | string;
} = {
    fallbackModels: [],
    timezone: null,
};

export function useAgentExecutionSettings() {
    const utils = trpc.useUtils();
    const query = trpc.agent.executionSettings.useQuery();
    const mutation = trpc.agent.saveExecutionSettings.useMutation({
        onSuccess: () => utils.agent.executionSettings.invalidate(),
    });

    return {
        isSaving: mutation.isPending || query.isPending,
        save: mutation.mutateAsync,
        settings: query.data ?? emptyExecutionSettings,
    };
}
