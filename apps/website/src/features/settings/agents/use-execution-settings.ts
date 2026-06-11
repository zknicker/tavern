import { trpc } from '../../../lib/trpc.tsx';
import type { CompressionSettings } from './behavior-section.tsx';
import type { FallbackModelEntry } from './fallback-models-editor.tsx';
import type { SubagentEffortValue, SubagentModelEntry } from './subagent-rows.tsx';

const emptyExecutionSettings: {
    compression: CompressionSettings | null;
    fallbackModels: FallbackModelEntry[];
    subagentEffort: SubagentEffortValue | null;
    subagentModel: SubagentModelEntry | null;
    timezone: null | string;
} = {
    compression: null,
    fallbackModels: [],
    subagentEffort: null,
    subagentModel: null,
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
