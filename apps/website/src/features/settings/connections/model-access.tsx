import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import type { ModelAccessOutput } from '../../../lib/trpc.tsx';
import { CodexCredentialRow } from './codex-credential-row.tsx';
import { OpenAiApiRow } from './openai-api-row.tsx';
import { OpenRouterRow } from './openrouter-row.tsx';
import { useModelAccessSettings } from './use-model-access-settings.ts';

export function ModelAccessSettings() {
    const {
        modelAccessEntries,
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
        settingsQuery,
    } = useModelAccessSettings();

    const codex = resolveCliAccess(
        'codex',
        modelAccessEntries,
        modelAccessQuery.error?.message ?? null,
        'Codex status is unavailable.'
    );
    const openAi = resolveCliAccess(
        'openai',
        modelAccessEntries,
        modelAccessQuery.error?.message ?? null,
        'OpenAI API status is unavailable.'
    );

    if (modelAccessQuery.isLoading) {
        return (
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <Skeleton className="h-[4.25rem] rounded-none" />
                    <Separator />
                    <Skeleton className="h-[4.25rem] rounded-none" />
                    <Separator />
                    <Skeleton className="h-[4.25rem] rounded-none" />
                </Card>
            </CardFrame>
        );
    }

    return (
        <CardFrame>
            <Card className="overflow-hidden p-0">
                <CodexCredentialRow access={codex} />
                <Separator />
                <OpenAiApiRow
                    apiKey={openAiFormState.apiKey}
                    hasApiKey={Boolean(openAiSettingsQuery.data?.hasApiKey)}
                    isLoading={openAiSettingsQuery.isLoading}
                    onRemove={deleteOpenAiKey}
                    onSave={saveOpenAiKey}
                    removePending={deleteOpenAiMutation.isPending}
                    saveError={
                        saveOpenAiMutation.error?.message ??
                        deleteOpenAiMutation.error?.message ??
                        (openAi.state === 'error' ? openAi.description : null)
                    }
                    savePending={saveOpenAiMutation.isPending}
                />
                <Separator />
                <OpenRouterRow
                    apiKey={formState.apiKey}
                    hasApiKey={Boolean(settingsQuery.data?.hasApiKey)}
                    hasManagementApiKey={Boolean(settingsQuery.data?.hasManagementApiKey)}
                    isLoading={settingsQuery.isLoading}
                    managementApiKey={formState.managementApiKey}
                    onRemove={deleteOpenRouterKeys}
                    onSave={saveOpenRouterKeys}
                    removePending={deleteMutation.isPending}
                    saveError={saveMutation.error?.message ?? deleteMutation.error?.message ?? null}
                    savePending={saveMutation.isPending}
                />
            </Card>
        </CardFrame>
    );
}

function resolveCliAccess(
    accessId: 'codex' | 'openai' | 'openrouter',
    modelAccessEntries: ModelAccessOutput['providers'],
    queryErrorMessage: string | null,
    fallbackDescription: string
) {
    return (
        modelAccessEntries.find((access) => access.id === accessId) ?? {
            description: queryErrorMessage ?? fallbackDescription,
            id: accessId,
            source: null,
            state: queryErrorMessage ? 'error' : 'needs-auth',
        }
    );
}
