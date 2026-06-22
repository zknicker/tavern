import { useRef } from 'react';
import { mergeDefined } from '../../../lib/merge-defined.ts';
import { type AppRouterOutputs, trpc } from '../../../lib/trpc.tsx';
import type { CompressionSettings, WebExtractSummarizerSettings } from './behavior-section.tsx';
import type { FallbackModelEntry } from './fallback-models-editor.tsx';
import type { SubagentEffortValue, SubagentModelEntry } from './subagent-rows.tsx';

type ExecutionSettings = AppRouterOutputs['agent']['executionSettings'];

const emptyExecutionSettings: {
    compression: CompressionSettings | null;
    fallbackModels: FallbackModelEntry[];
    subagentEffort: SubagentEffortValue | null;
    subagentModel: SubagentModelEntry | null;
    timezone: null | string;
    webExtractSummarizer: WebExtractSummarizerSettings | null;
} = {
    compression: null,
    fallbackModels: [],
    subagentEffort: null,
    subagentModel: null,
    timezone: null,
    webExtractSummarizer: null,
};

/**
 * Saves apply to the cache optimistically so controls never snap back to the
 * previous server value while a save is in flight. The cache refetches once
 * the last overlapping save settles; errors roll back to the snapshot.
 */
export function useAgentExecutionSettings() {
    const utils = trpc.useUtils();
    const query = trpc.agent.executionSettings.useQuery();
    const pendingSaves = useRef(0);
    const mutation = trpc.agent.saveExecutionSettings.useMutation({
        onError: (_error, _input, context) => {
            const snapshot = context as ExecutionSettings | undefined;

            if (snapshot) {
                utils.agent.executionSettings.setData(undefined, snapshot);
            }
        },
        onMutate: async (input) => {
            pendingSaves.current += 1;
            await utils.agent.executionSettings.cancel();
            const snapshot = utils.agent.executionSettings.getData();

            if (snapshot) {
                utils.agent.executionSettings.setData(undefined, mergeDefined(snapshot, input));
            }

            return snapshot;
        },
        onSettled: () => {
            pendingSaves.current -= 1;

            if (pendingSaves.current === 0) {
                void utils.agent.executionSettings.invalidate();
            }
        },
    });

    return {
        isLoading: query.isPending,
        save: mutation.mutateAsync,
        settings: query.data ?? emptyExecutionSettings,
    };
}
