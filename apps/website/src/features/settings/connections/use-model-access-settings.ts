import * as React from 'react';
import { useDeleteOpenRouterSettings } from '../../../hooks/connections/use-delete-openrouter-settings.ts';
import { useModelAccess } from '../../../hooks/connections/use-model-access.ts';
import { useOpenRouterSettings } from '../../../hooks/connections/use-openrouter-settings.ts';
import { useSaveOpenRouterSettings } from '../../../hooks/connections/use-save-openrouter-settings.ts';

interface OpenRouterFormState {
    apiKey: string;
    managementApiKey: string;
}

const emptyOpenRouterFormState: OpenRouterFormState = {
    apiKey: '',
    managementApiKey: '',
};

export function useModelAccessSettings() {
    const modelAccessQuery = useModelAccess();
    const settingsQuery = useOpenRouterSettings();
    const [formState, setFormState] = React.useState<OpenRouterFormState>(emptyOpenRouterFormState);
    const saveMutation = useSaveOpenRouterSettings();
    const deleteMutation = useDeleteOpenRouterSettings();

    const saveOpenRouterKeys = (state: OpenRouterFormState) => {
        const next = {
            apiKey: state.apiKey.trim(),
            managementApiKey: state.managementApiKey.trim(),
        };
        setFormState(emptyOpenRouterFormState);
        saveMutation.mutate({
            apiKey: next.apiKey || null,
            managementApiKey: next.managementApiKey || null,
        });
    };

    const deleteOpenRouterKeys = () => {
        setFormState(emptyOpenRouterFormState);
        deleteMutation.mutate();
    };

    return {
        modelAccessEntries:
            modelAccessQuery.data?.providers ??
            ([] as NonNullable<typeof modelAccessQuery.data>['providers']),
        modelAccessQuery,
        formState,
        deleteMutation,
        deleteOpenRouterKeys,
        saveMutation,
        saveOpenRouterKeys,
        settingsQuery,
    };
}
