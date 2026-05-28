import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
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
import {
    toAgentRuntimePageConnectionState,
    useAgentRuntimeConnection,
} from '../../../hooks/connections/use-agent-runtime-connection.ts';
import {
    useCortexSettings,
    useSaveCortexSettings,
} from '../../../hooks/cortex/use-cortex-settings.ts';
import type { CortexSettingsOutput } from '../../../lib/trpc.tsx';

type ConnectionStatus = ReturnType<typeof toAgentRuntimePageConnectionState>;
type CortexSettings = NonNullable<CortexSettingsOutput>;
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
    const agentRuntimeConnection = useAgentRuntimeConnection();
    const settingsQuery = useCortexSettings();
    const saveSettingsMutation = useSaveCortexSettings();
    const settings = settingsQuery.data ?? null;
    const connectionStatus = toAgentRuntimePageConnectionState(agentRuntimeConnection.status);
    const isLoading =
        settingsQuery.isPending ||
        agentRuntimeConnection.status === 'checking' ||
        agentRuntimeConnection.status === 'error';
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
        </div>
    );
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

function getUnavailableValue(connectionStatus: ConnectionStatus, isLoading: boolean) {
    if (isLoading) {
        return 'Loading...';
    }

    return connectionStatus === 'reachable' ? null : 'Tavern Runtime unavailable';
}
