import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { useSaveClaudeCredential } from '../../../hooks/connections/use-save-claude-credential.ts';
import { useSaveCodexCredential } from '../../../hooks/connections/use-save-codex-credential.ts';
import type { ModelAccessOutput } from '../../../lib/trpc.tsx';
import { ClaudeCredentialRow } from './claude-credential-row.tsx';
import { CodexCredentialRow } from './codex-credential-row.tsx';
import { OpenRouterRow } from './openrouter-row.tsx';
import { useModelAccessSettings } from './use-model-access-settings.ts';

export function ModelAccessSettings() {
    const {
        modelAccessEntries,
        modelAccessQuery,
        formState,
        deleteMutation,
        deleteOpenRouterKeys,
        saveMutation,
        saveOpenRouterKeys,
        settingsQuery,
    } = useModelAccessSettings();
    const claudeCredentialMutation = useSaveClaudeCredential();
    const codexCredentialMutation = useSaveCodexCredential();

    const claudeCode = resolveCliAccess(
        'claude-code',
        modelAccessEntries,
        modelAccessQuery.error?.message ?? null,
        'Claude Code status is unavailable.'
    );
    const codex = resolveCliAccess(
        'codex',
        modelAccessEntries,
        modelAccessQuery.error?.message ?? null,
        'Codex status is unavailable.'
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
                <ClaudeCredentialRow
                    access={claudeCode}
                    isSaving={claudeCredentialMutation.isPending}
                    onSave={(credential) => {
                        claudeCredentialMutation.mutate({ credential });
                    }}
                    saveError={claudeCredentialMutation.error?.message ?? null}
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
                <Separator />
                <CodexCredentialRow
                    access={codex}
                    isSaving={codexCredentialMutation.isPending}
                    onSave={(credential) => {
                        codexCredentialMutation.mutate({ credential });
                    }}
                    saveError={codexCredentialMutation.error?.message ?? null}
                />
            </Card>
        </CardFrame>
    );
}

function resolveCliAccess(
    accessId: 'claude-code' | 'codex',
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
