import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import { Textarea } from '../../../components/ui/textarea.tsx';
import {
    toRuntimePageConnectionState,
    useRuntimeConnection,
} from '../../../hooks/connections/use-runtime-connection.ts';
import {
    useCortexSchema,
    useCortexSettings,
    useCortexStatus,
    useRunCortexJob,
    useSaveCortexSchema,
    useSaveCortexSettings,
} from '../../../hooks/cortex/use-cortex-settings.ts';
import type {
    CortexSchemaOutput,
    CortexSettingsOutput,
    CortexStatusOutput,
} from '../../../lib/trpc.tsx';

type ConnectionStatus = ReturnType<typeof toRuntimePageConnectionState>;
type CortexSettings = NonNullable<CortexSettingsOutput>;
type CortexSchema = NonNullable<CortexSchemaOutput>;
type CortexStatus = NonNullable<CortexStatusOutput>;
type CortexEmbeddingModel = CortexSettings['embedding']['model'];
type CortexRecallMode = CortexSettings['recall']['mode'];

const embeddingModelOptions: Array<{ label: string; value: CortexEmbeddingModel }> = [
    { label: 'text-embedding-3-small', value: 'text-embedding-3-small' },
    { label: 'text-embedding-3-large', value: 'text-embedding-3-large' },
];

const defaultEmbeddingModel: CortexEmbeddingModel = 'text-embedding-3-small';
const defaultRecallMode: CortexRecallMode = 'balanced';

const recallModeOptions: Array<{
    label: string;
    value: CortexRecallMode;
}> = [
    { label: 'Conservative', value: 'conservative' },
    { label: 'Balanced', value: 'balanced' },
    { label: 'Deep', value: 'tokenmax' },
];

function MemoriesSettingsContent() {
    const runtimeConnection = useRuntimeConnection();
    const settingsQuery = useCortexSettings();
    const schemaQuery = useCortexSchema();
    const statusQuery = useCortexStatus();
    const saveSchemaMutation = useSaveCortexSchema();
    const saveSettingsMutation = useSaveCortexSettings();
    const runJobMutation = useRunCortexJob();
    const settings = settingsQuery.data ?? null;
    const connectionStatus = toRuntimePageConnectionState(runtimeConnection.status);
    const isLoading =
        settingsQuery.isPending ||
        runtimeConnection.status === 'checking' ||
        runtimeConnection.status === 'error';
    const embeddingModel = settings?.embedding.model ?? defaultEmbeddingModel;
    const recallMode = settings?.recall.mode ?? defaultRecallMode;

    return (
        <div>
            <BadgeDivider className="pb-4">Cortex Configuration</BadgeDivider>
            <CortexConfigurationGrid
                connectionStatus={connectionStatus}
                embeddingModel={embeddingModel}
                isLoading={isLoading}
                onSaveApiKey={(apiKey) => {
                    return saveSettingsMutation.mutateAsync({
                        embedding: {
                            apiKey,
                            model: embeddingModel,
                            provider: 'openai',
                        },
                    });
                }}
                onSaveEmbeddingModel={(model) => {
                    saveSettingsMutation.mutate({
                        embedding: {
                            model,
                            provider: 'openai',
                        },
                    });
                }}
                onSaveRecallMode={(mode) => {
                    saveSettingsMutation.mutate({
                        embedding: {
                            model: embeddingModel,
                            provider: 'openai',
                        },
                        recall: {
                            mode,
                        },
                    });
                }}
                recallMode={recallMode}
                saveError={saveSettingsMutation.error?.message ?? null}
                savePending={saveSettingsMutation.isPending}
                settings={settings}
            />
            <CortexHealthCards
                onRunJob={(job) => runJobMutation.mutate(job)}
                pendingJob={runJobMutation.isPending ? runJobMutation.variables : null}
                status={statusQuery.data ?? null}
            />
            <CortexSchemaEditor
                disabled={connectionStatus !== 'reachable' || schemaQuery.isPending}
                error={schemaQuery.error?.message ?? saveSchemaMutation.error?.message ?? null}
                onSave={(schema) => saveSchemaMutation.mutateAsync({ schema })}
                pending={saveSchemaMutation.isPending}
                schema={schemaQuery.data ?? null}
            />
        </div>
    );
}

function CortexHealthCards({
    onRunJob,
    pendingJob,
    status,
}: {
    onRunJob: (job: 'generate-embeddings' | 'maintenance' | 'sync') => void;
    pendingJob: 'dream' | 'generate-embeddings' | 'lint' | 'maintenance' | 'signal' | 'sync' | null;
    status: CortexStatus | null;
}) {
    const recommendations = status?.recommendations ?? [];
    if (recommendations.length === 0) {
        return null;
    }
    return (
        <div className="mt-4">
            <BadgeDivider className="pb-4">Cortex Health</BadgeDivider>
            <div className="grid gap-2 md:grid-cols-2">
                {recommendations.map((recommendation) => (
                    <CardFrame key={`${recommendation.kind}:${recommendation.action}`}>
                        <Card className="space-y-2 p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="font-medium text-sm">{recommendation.kind}</div>
                                    <div className="text-muted-foreground text-xs">
                                        {recommendation.summary}
                                    </div>
                                </div>
                                <span className="rounded border px-2 py-0.5 text-xs">
                                    {recommendation.count}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
                                <span>{recommendation.severity}</span>
                                <span>{formatRecommendationAction(recommendation.action)}</span>
                            </div>
                            {toRunnableCortexJob(recommendation.action) ? (
                                <Button
                                    disabled={pendingJob !== null}
                                    loading={
                                        pendingJob === toRunnableCortexJob(recommendation.action)
                                    }
                                    onClick={() => {
                                        const job = toRunnableCortexJob(recommendation.action);
                                        if (job) {
                                            onRunJob(job);
                                        }
                                    }}
                                    size="sm"
                                >
                                    Run
                                </Button>
                            ) : null}
                        </Card>
                    </CardFrame>
                ))}
            </div>
        </div>
    );
}

function toRunnableCortexJob(
    action: CortexStatus['recommendations'][number]['action']
): 'generate-embeddings' | 'maintenance' | 'sync' | null {
    switch (action) {
        case 'run-cortex-generate-embeddings':
            return 'generate-embeddings';
        case 'run-cortex-maintenance':
            return 'maintenance';
        case 'run-cortex-sync':
            return 'sync';
        default:
            return null;
    }
}

export function MemoriesSettings() {
    return <MemoriesSettingsContent />;
}

function CortexConfigurationGrid({
    connectionStatus,
    embeddingModel,
    isLoading,
    onSaveApiKey,
    onSaveEmbeddingModel,
    onSaveRecallMode,
    recallMode,
    saveError,
    savePending,
    settings,
}: {
    connectionStatus: ConnectionStatus;
    embeddingModel: CortexEmbeddingModel;
    isLoading: boolean;
    onSaveApiKey: (apiKey: string) => Promise<unknown>;
    onSaveEmbeddingModel: (model: CortexEmbeddingModel) => void;
    onSaveRecallMode: (mode: CortexRecallMode) => void;
    recallMode: CortexRecallMode;
    saveError: string | null;
    savePending: boolean;
    settings: CortexSettings | null;
}) {
    const unavailable = getUnavailableValue(connectionStatus, isLoading);

    return (
        <CardFrame>
            <Card className="overflow-hidden p-0">
                <OpenAiKeyRow
                    connectionStatus={connectionStatus}
                    onSave={onSaveApiKey}
                    saveError={saveError}
                    savePending={savePending}
                    settings={settings}
                />
                <Separator />
                <SettingsRow title="Embedding model">
                    {unavailable ? (
                        <Input disabled value={unavailable} />
                    ) : (
                        <Select
                            disabled={savePending}
                            onValueChange={(nextValue) => {
                                const model = toEmbeddingModel(nextValue);
                                if (model) {
                                    onSaveEmbeddingModel(model);
                                }
                            }}
                            value={embeddingModel}
                        >
                            <SelectTrigger>
                                <SelectValue>{embeddingModel}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {embeddingModelOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </SettingsRow>
                <Separator />
                <SettingsRow title="Default read budget">
                    {unavailable ? (
                        <Input disabled value={unavailable} />
                    ) : (
                        <Select
                            disabled={savePending}
                            onValueChange={(nextValue) => {
                                const mode = toRecallMode(nextValue);
                                if (mode) {
                                    onSaveRecallMode(mode);
                                }
                            }}
                            value={recallMode}
                        >
                            <SelectTrigger>
                                <SelectValue>{formatRecallMode(recallMode)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {recallModeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </SettingsRow>
            </Card>
        </CardFrame>
    );
}

function OpenAiKeyRow({
    connectionStatus,
    onSave,
    saveError,
    savePending,
    settings,
}: {
    connectionStatus: ConnectionStatus;
    onSave: (apiKey: string) => Promise<unknown>;
    saveError: string | null;
    savePending: boolean;
    settings: CortexSettings | null;
}) {
    const [apiKey, setApiKey] = React.useState('');
    React.useEffect(() => {
        setApiKey(settings?.embedding.apiKey ?? '');
    }, [settings?.embedding.apiKey]);

    const trimmedApiKey = apiKey.trim();
    const canSaveApiKey =
        connectionStatus === 'reachable' &&
        trimmedApiKey.startsWith('sk-') &&
        !trimmedApiKey.startsWith('sk-ant-') &&
        !trimmedApiKey.startsWith('sk-or-');
    const savedApiKey = settings?.embedding.apiKey ?? '';

    return (
        <SettingsRow error={saveError} title="OpenAI API key">
            <Input
                autoComplete="off"
                className="font-mono text-xs"
                disabled={savePending}
                onBlur={() => {
                    if (canSaveApiKey && trimmedApiKey !== savedApiKey) {
                        void onSave(trimmedApiKey);
                    }
                }}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
                type="text"
                value={apiKey}
            />
        </SettingsRow>
    );
}

function CortexSchemaEditor({
    disabled,
    error,
    onSave,
    pending,
    schema,
}: {
    disabled: boolean;
    error: string | null;
    onSave: (schema: CortexSchema['schema']) => Promise<unknown>;
    pending: boolean;
    schema: CortexSchema | null;
}) {
    const [draft, setDraft] = React.useState('');
    const [parseError, setParseError] = React.useState<string | null>(null);

    React.useEffect(() => {
        setDraft(schema ? JSON.stringify(schema.schema, null, 2) : '');
        setParseError(null);
    }, [schema]);

    return (
        <div className="mt-4">
            <BadgeDivider className="pb-4">Cortex Schema</BadgeDivider>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow
                        error={parseError ?? error}
                        title={
                            schema ? `${schema.schema.name} v${schema.schema.version}` : 'Schema'
                        }
                    >
                        <div className="space-y-2">
                            <Textarea
                                className="w-full"
                                disabled={disabled || pending}
                                onChange={(event) => {
                                    setDraft(event.target.value);
                                    setParseError(null);
                                }}
                                spellCheck={false}
                                textareaClassName="min-h-64 font-mono text-xs"
                                value={draft}
                            />
                            {schema && schema.validation.length > 0 ? (
                                <div className="space-y-1 text-xs">
                                    {schema.validation.map((issue) => (
                                        <div
                                            className="text-muted-foreground"
                                            key={`${issue.kind}:${issue.value}`}
                                        >
                                            {issue.severity}: {issue.message} ({issue.affectedCount}
                                            )
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            <div className="flex justify-end">
                                <Button
                                    disabled={disabled || pending || !schema}
                                    loading={pending}
                                    onClick={() => {
                                        try {
                                            const parsed = JSON.parse(
                                                draft
                                            ) as CortexSchema['schema'];
                                            void onSave(parsed);
                                        } catch (error_) {
                                            setParseError(
                                                error_ instanceof Error
                                                    ? error_.message
                                                    : 'Invalid schema JSON.'
                                            );
                                        }
                                    }}
                                    size="sm"
                                >
                                    Save
                                </Button>
                            </div>
                        </div>
                    </SettingsRow>
                </Card>
            </CardFrame>
        </div>
    );
}

function toEmbeddingModel(value: string | null): CortexEmbeddingModel | null {
    return embeddingModelOptions.some((option) => option.value === value)
        ? (value as CortexEmbeddingModel)
        : null;
}

function toRecallMode(value: string | null): CortexRecallMode | null {
    return recallModeOptions.some((option) => option.value === value)
        ? (value as CortexRecallMode)
        : null;
}

function formatRecallMode(mode: CortexRecallMode) {
    return recallModeOptions.find((option) => option.value === mode)?.label ?? mode;
}

function formatRecommendationAction(action: CortexStatus['recommendations'][number]['action']) {
    switch (action) {
        case 'configure-embeddings':
            return 'Configure embeddings';
        case 'inspect-lint':
            return 'Inspect lint';
        case 'run-cortex-generate-embeddings':
            return 'Generate embeddings';
        case 'run-cortex-maintenance':
            return 'Run maintenance';
        case 'run-cortex-sync':
            return 'Run sync';
    }
}

function getUnavailableValue(connectionStatus: ConnectionStatus, isLoading: boolean) {
    if (isLoading) {
        return 'Loading...';
    }

    return connectionStatus === 'reachable' ? null : 'Tavern Runtime unavailable';
}
