import * as React from 'react';
import { useDeleteOpenAiSettings } from '../../../hooks/connections/use-delete-openai-settings.ts';
import { useDeleteOpenRouterSettings } from '../../../hooks/connections/use-delete-openrouter-settings.ts';
import { useModelAccess } from '../../../hooks/connections/use-model-access.ts';
import { useOpenAiSettings } from '../../../hooks/connections/use-openai-settings.ts';
import { useOpenRouterSettings } from '../../../hooks/connections/use-openrouter-settings.ts';
import { useSaveOpenAiSettings } from '../../../hooks/connections/use-save-openai-settings.ts';
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
    const openAiSettingsQuery = useOpenAiSettings();
    const openRouterSettingsQuery = useOpenRouterSettings();
    const [openAiFormState, setOpenAiFormState] = React.useState({ apiKey: '' });
    const [formState, setFormState] = React.useState<OpenRouterFormState>(emptyOpenRouterFormState);
    const saveOpenAiMutation = useSaveOpenAiSettings();
    const deleteOpenAiMutation = useDeleteOpenAiSettings();
    const saveMutation = useSaveOpenRouterSettings();
    const deleteMutation = useDeleteOpenRouterSettings();

    const saveOpenAiKey = (state: { apiKey: string }) => {
        const apiKey = state.apiKey.trim();
        setOpenAiFormState({ apiKey: '' });
        saveOpenAiMutation.mutate({ apiKey });
    };

    const deleteOpenAiKey = () => {
        setOpenAiFormState({ apiKey: '' });
        deleteOpenAiMutation.mutate();
    };

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
        openAiFormState,
        openAiSettingsQuery,
        deleteMutation,
        deleteOpenAiKey,
        deleteOpenAiMutation,
        deleteOpenRouterKeys,
        saveOpenAiKey,
        saveOpenAiMutation,
        saveMutation,
        saveOpenRouterKeys,
        settingsQuery: openRouterSettingsQuery,
    };
}
