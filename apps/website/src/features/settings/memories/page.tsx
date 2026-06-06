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
    useCortexSchemaAdditions,
    useCortexSettings,
    useCortexStatus,
    useSaveCortexSchema,
    useSaveCortexSettings,
} from '../../../hooks/cortex/use-cortex-settings.ts';
import { useJobRun } from '../../../hooks/jobs/use-job-run.ts';
import { useModelInventory } from '../../../hooks/models/use-model-inventory.ts';
import type {
    CortexSchemaAdditionsOutput,
    CortexSchemaOutput,
    CortexSettingsOutput,
    CortexStatusOutput,
    ModelInventoryOutput,
} from '../../../lib/trpc.tsx';

type ConnectionStatus = ReturnType<typeof toRuntimePageConnectionState>;
type CortexSettings = NonNullable<CortexSettingsOutput>;
type CortexSchema = NonNullable<CortexSchemaOutput>;
type CortexSchemaAdditionsData = NonNullable<CortexSchemaAdditionsOutput>;
type CortexStatus = NonNullable<CortexStatusOutput>;
type CortexEmbeddingModel = CortexSettings['embedding']['model'];
type CortexEmbeddingModelRef = CortexSettings['models']['embedding'];
type CortexChatModelRef = CortexSettings['models']['queryExpansion'];
type CortexGeneralModelRef = CortexSettings['models']['chatIngestion'];
type CortexRecallMode = CortexSettings['recall']['mode'];
type ModelInventory = NonNullable<ModelInventoryOutput>;
type ModelCapability =
    ModelInventory['providers'][number]['models'][number]['capabilities'][number];
type ModelProviderId = ModelInventory['providers'][number]['provider'];

interface ModelOption<T extends string = string> {
    label: string;
    value: T;
}

const defaultEmbeddingModel: CortexEmbeddingModel = 'text-embedding-3-small';
const defaultEmbeddingModelRef: CortexEmbeddingModelRef = 'openai/text-embedding-3-small';
const defaultQueryExpansionModel: CortexChatModelRef = 'openrouter/google/gemini-2.5-flash-lite';
const defaultChatIngestionModel: CortexChatModelRef = 'codex/gpt-5.5';
const defaultDreamModel: CortexChatModelRef = 'codex/gpt-5.5';
const defaultAudioTranscriptionModel: CortexGeneralModelRef = 'openai/whisper-1';
const defaultOcrModel: CortexGeneralModelRef = 'openai/gpt-4o-mini';
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
    const inventoryQuery = useModelInventory();
    const schemaQuery = useCortexSchema();
    const schemaAdditionsQuery = useCortexSchemaAdditions();
    const statusQuery = useCortexStatus();
    const saveSchemaMutation = useSaveCortexSchema();
    const saveSettingsMutation = useSaveCortexSettings();
    const runJobMutation = useJobRun();
    const settings = settingsQuery.data ?? null;
    const connectionStatus = toRuntimePageConnectionState(runtimeConnection.status);
    const isLoading =
        settingsQuery.isPending ||
        inventoryQuery.isPending ||
        runtimeConnection.status === 'checking' ||
        runtimeConnection.status === 'error';
    const embeddingModel = settings?.embedding.model ?? defaultEmbeddingModel;
    const embeddingModelRef = settings?.models.embedding ?? defaultEmbeddingModelRef;
    const queryExpansionModel = settings?.models.queryExpansion ?? defaultQueryExpansionModel;
    const chatIngestionModel = settings?.models.chatIngestion ?? defaultChatIngestionModel;
    const dreamModel = settings?.models.dream ?? defaultDreamModel;
    const audioTranscriptionModel =
        settings?.models.audioTranscription ?? defaultAudioTranscriptionModel;
    const ocrModel = settings?.models.ocr ?? defaultOcrModel;
    const recallMode = settings?.recall.mode ?? defaultRecallMode;

    return (
        <div>
            <BadgeDivider className="pb-4">Models</BadgeDivider>
            <CortexConfigurationGrid
                audioTranscriptionModel={audioTranscriptionModel}
                chatIngestionModel={chatIngestionModel}
                connectionStatus={connectionStatus}
                dreamModel={dreamModel}
                embeddingModelRef={embeddingModelRef}
                inventory={inventoryQuery.data ?? null}
                isLoading={isLoading}
                ocrModel={ocrModel}
                onSaveEmbeddingModel={(modelRef) => {
                    saveSettingsMutation.mutate({
                        embedding: {
                            model: modelRef.split('/').at(-1) as CortexEmbeddingModel,
                            modelRef,
                            provider: 'openai',
                        },
                        models: {
                            ...settings?.models,
                            embedding: modelRef,
                        },
                    });
                }}
                onSaveModel={(key, modelRef) => {
                    saveSettingsMutation.mutate({
                        embedding: {
                            model: embeddingModel,
                            modelRef: embeddingModelRef,
                            provider: 'openai',
                        },
                        models: {
                            ...settings?.models,
                            [key]: modelRef,
                        },
                    });
                }}
                onSaveRecallMode={(mode) => {
                    saveSettingsMutation.mutate({
                        embedding: {
                            model: embeddingModel,
                            modelRef: embeddingModelRef,
                            provider: 'openai',
                        },
                        models: settings?.models,
                        recall: {
                            mode,
                        },
                    });
                }}
                queryExpansionModel={queryExpansionModel}
                recallMode={recallMode}
                savePending={saveSettingsMutation.isPending}
            />
            <CortexHealthCards
                onRunJob={(slug) =>
                    runJobMutation.mutate({
                        payload: slug === 'cortex-generate-embeddings' ? { stale: true } : {},
                        slug,
                    })
                }
                pendingJob={runJobMutation.isPending ? runJobMutation.variables?.slug : null}
                status={statusQuery.data ?? null}
            />
            <CortexSchemaAdditions
                additions={schemaAdditionsQuery.data?.additions ?? []}
                error={schemaAdditionsQuery.error?.message ?? null}
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

export function CortexSchemaAdditions({
    additions,
    error,
}: {
    additions: CortexSchemaAdditionsData['additions'];
    error: string | null;
}) {
    if (additions.length === 0 && !error) {
        return null;
    }
    return (
        <div className="mt-4">
            <BadgeDivider className="pb-4">Schema Additions</BadgeDivider>
            {error ? <div className="text-error text-xs">{error}</div> : null}
            {additions.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                    {additions.map((addition) => (
                        <CardFrame key={addition.id}>
                            <Card className="space-y-2 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate font-medium text-sm">
                                            {addition.name}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {addition.reason}
                                        </div>
                                    </div>
                                    <span className="shrink-0 rounded border px-2 py-0.5 text-xs">
                                        {formatSchemaAdditionKind(addition.kind)}
                                    </span>
                                </div>
                                {Object.keys(addition.example).length > 0 ? (
                                    <div className="truncate text-muted-foreground text-xs">
                                        {formatSchemaAdditionExample(addition.example)}
                                    </div>
                                ) : null}
                                <div className="text-muted-foreground text-xs">
                                    {addition.usageCount} usage
                                </div>
                            </Card>
                        </CardFrame>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function CortexHealthCards({
    onRunJob,
    pendingJob,
    status,
}: {
    onRunJob: (
        job: 'cortex-generate-embeddings' | 'cortex-repair-derived-state' | 'cortex-sync'
    ) => void;
    pendingJob: string | null;
    status: CortexStatus | null;
}) {
    const recommendations = status?.recommendations ?? [];
    if (recommendations.length === 0) {
        return null;
    }
    return (
        <div className="mt-4">
            <BadgeDivider className="pb-4">Health</BadgeDivider>
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
): 'cortex-generate-embeddings' | 'cortex-repair-derived-state' | 'cortex-sync' | null {
    switch (action) {
        case 'run-cortex-generate-embeddings':
            return 'cortex-generate-embeddings';
        case 'run-cortex-repair-derived-state':
            return 'cortex-repair-derived-state';
        case 'run-cortex-sync':
            return 'cortex-sync';
        default:
            return null;
    }
}

export function MemoriesSettings() {
    return <MemoriesSettingsContent />;
}

function CortexConfigurationGrid({
    audioTranscriptionModel,
    connectionStatus,
    dreamModel,
    embeddingModelRef,
    inventory,
    isLoading,
    onSaveEmbeddingModel,
    onSaveModel,
    onSaveRecallMode,
    ocrModel,
    queryExpansionModel,
    recallMode,
    savePending,
    chatIngestionModel,
}: {
    audioTranscriptionModel: CortexGeneralModelRef;
    connectionStatus: ConnectionStatus;
    dreamModel: CortexChatModelRef;
    embeddingModelRef: CortexEmbeddingModelRef;
    inventory: ModelInventory | null;
    isLoading: boolean;
    onSaveEmbeddingModel: (model: CortexEmbeddingModelRef) => void;
    onSaveModel: (
        key: 'audioTranscription' | 'chatIngestion' | 'dream' | 'ocr' | 'queryExpansion',
        model: CortexGeneralModelRef
    ) => void;
    onSaveRecallMode: (mode: CortexRecallMode) => void;
    ocrModel: CortexGeneralModelRef;
    queryExpansionModel: CortexChatModelRef;
    recallMode: CortexRecallMode;
    savePending: boolean;
    chatIngestionModel: CortexChatModelRef;
}) {
    const unavailable = getUnavailableValue(connectionStatus, isLoading);
    const embeddingOptions = listModelOptionsByCapability(
        inventory,
        'embedding',
        embeddingModelRef
    ) as ModelOption<CortexEmbeddingModelRef>[];
    const queryExpansionOptions = listModelOptionsByProviderCapability(
        inventory,
        'openrouter',
        'general',
        queryExpansionModel
    ) as ModelOption<CortexChatModelRef>[];
    const chatIngestionOptions = listModelOptionsByProviderCapability(
        inventory,
        'codex',
        'general',
        chatIngestionModel
    ) as ModelOption<CortexChatModelRef>[];
    const dreamOptions = listModelOptionsByProviderCapability(
        inventory,
        'codex',
        'general',
        dreamModel
    ) as ModelOption<CortexChatModelRef>[];
    const audioTranscriptionOptions = listModelOptionsByProviderCapability(
        inventory,
        'openai',
        'audio-transcription',
        audioTranscriptionModel
    ) as ModelOption<CortexGeneralModelRef>[];
    const ocrOptions = listModelOptionsByProviderCapability(
        inventory,
        'openai',
        'vision',
        ocrModel
    ) as ModelOption<CortexGeneralModelRef>[];

    return (
        <CardFrame>
            <Card className="overflow-hidden p-0">
                <SettingsRow
                    description="Finds related memories through semantic search."
                    title="Embedding model"
                >
                    {unavailable ? (
                        <Input disabled value={unavailable} />
                    ) : (
                        <Select
                            disabled={savePending}
                            onValueChange={(nextValue) => {
                                const modelRef = toEmbeddingModelRef(nextValue);
                                if (modelRef) {
                                    onSaveEmbeddingModel(modelRef);
                                }
                            }}
                            value={embeddingModelRef}
                        >
                            <SelectTrigger>
                                <SelectValue>
                                    {formatModelOption(embeddingModelRef, embeddingOptions)}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {embeddingOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </SettingsRow>
                <Separator />
                <ModelSelectRow
                    description="Rewrites searches to recover more relevant memories."
                    disabled={savePending}
                    label="Query expansion model"
                    onSave={(model) => onSaveModel('queryExpansion', model)}
                    options={queryExpansionOptions}
                    unavailable={unavailable}
                    value={queryExpansionModel}
                />
                <Separator />
                <ModelSelectRow
                    description="Detects facts and preferences worth remembering."
                    disabled={savePending}
                    label="Chat ingestion model"
                    onSave={(model) => onSaveModel('chatIngestion', model)}
                    options={chatIngestionOptions}
                    unavailable={unavailable}
                    value={chatIngestionModel}
                />
                <Separator />
                <ModelSelectRow
                    description="Consolidates memories and repairs knowledge overnight."
                    disabled={savePending}
                    label="Dream model"
                    onSave={(model) => onSaveModel('dream', model)}
                    options={dreamOptions}
                    unavailable={unavailable}
                    value={dreamModel}
                />
                <Separator />
                <ModelSelectRow
                    description="Transcribes audio and video before source import."
                    disabled={savePending}
                    label="Audio transcription model"
                    onSave={(model) => onSaveModel('audioTranscription', model)}
                    options={audioTranscriptionOptions}
                    unavailable={unavailable}
                    value={audioTranscriptionModel}
                />
                <Separator />
                <ModelSelectRow
                    description="Extracts text from screenshots and images."
                    disabled={savePending}
                    label="OCR model"
                    onSave={(model) => onSaveModel('ocr', model)}
                    options={ocrOptions}
                    unavailable={unavailable}
                    value={ocrModel}
                />
                <Separator />
                <SettingsRow
                    description="Controls how much memory agents read by default."
                    title="Default read budget"
                >
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

function ModelSelectRow({
    description,
    disabled,
    label,
    onSave,
    options,
    unavailable,
    value,
}: {
    description: string;
    disabled: boolean;
    label: string;
    onSave: (model: CortexGeneralModelRef) => void;
    options: ModelOption<CortexGeneralModelRef>[];
    unavailable: string | null;
    value: CortexGeneralModelRef;
}) {
    return (
        <SettingsRow description={description} title={label}>
            {unavailable ? (
                <Input disabled value={unavailable} />
            ) : (
                <Select
                    disabled={disabled}
                    onValueChange={(nextValue) => {
                        const model = toChatModelRef(nextValue, options);
                        if (model) {
                            onSave(model);
                        }
                    }}
                    value={value}
                >
                    <SelectTrigger>
                        <SelectValue>{formatModelOption(value, options)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
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
            <BadgeDivider className="pb-4">Schema</BadgeDivider>
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

function listModelOptionsByCapability(
    inventory: ModelInventory | null,
    capability: ModelCapability,
    currentValue: string
): ModelOption[] {
    return listModelOptions(inventory, capability, currentValue);
}

function listModelOptionsByProviderCapability(
    inventory: ModelInventory | null,
    providerId: ModelProviderId,
    capability: ModelCapability,
    currentValue: string
): ModelOption[] {
    return listModelOptions(inventory, capability, currentValue, providerId);
}

function listModelOptions(
    inventory: ModelInventory | null,
    capability: ModelCapability,
    currentValue: string,
    providerId?: ModelProviderId
): ModelOption[] {
    const options =
        inventory?.providers
            .filter((provider) => !providerId || provider.provider === providerId)
            .flatMap((provider) =>
                provider.models
                    .filter((model) => model.capabilities.includes(capability))
                    .map((model) => ({
                        label: `${provider.displayName} ${model.displayName}`,
                        value: model.ref,
                    }))
            )
            .sort((left, right) => left.label.localeCompare(right.label)) ?? [];

    return options.some((option) => option.value === currentValue)
        ? options
        : [
              ...options,
              {
                  label: currentValue,
                  value: currentValue,
              },
          ];
}

function toEmbeddingModelRef(value: string | null): CortexEmbeddingModelRef | null {
    return value === defaultEmbeddingModelRef ? value : null;
}

function toChatModelRef(
    value: string | null,
    options: ModelOption<CortexGeneralModelRef>[]
): CortexGeneralModelRef | null {
    return options.some((option) => option.value === value)
        ? (value as CortexGeneralModelRef)
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

function formatModelOption<T extends string>(model: T, options: ModelOption<T>[]) {
    return options.find((option) => option.value === model)?.label ?? model;
}

function formatRecommendationAction(action: CortexStatus['recommendations'][number]['action']) {
    switch (action) {
        case 'configure-embeddings':
            return 'Configure embeddings';
        case 'inspect-lint':
            return 'Inspect lint';
        case 'run-cortex-generate-embeddings':
            return 'Generate embeddings';
        case 'run-cortex-repair-derived-state':
            return 'Repair derived state';
        case 'run-cortex-sync':
            return 'Run sync';
    }
}

function formatSchemaAdditionKind(
    kind: CortexSchemaAdditionsData['additions'][number]['kind']
): string {
    switch (kind) {
        case 'link-type':
            return 'Link type';
        case 'page-type':
            return 'Page type';
    }
}

function formatSchemaAdditionExample(example: Record<string, unknown>): string {
    return Object.entries(example)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(' · ');
}

function getUnavailableValue(connectionStatus: ConnectionStatus, isLoading: boolean) {
    if (isLoading) {
        return 'Loading...';
    }

    return connectionStatus === 'reachable' ? null : 'Tavern Runtime unavailable';
}
