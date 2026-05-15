import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardContent } from '../../../components/ui/card.tsx';
import { buildConfiguredModelOptions } from '../../../components/ui/model-route-shared.ts';
import {
    toAgentRuntimePageConnectionState,
    useAgentRuntimeConnection,
} from '../../../hooks/connections/use-agent-runtime-connection.ts';
import { useMemorySettingsSuspense } from '../../../hooks/memory/use-memory-settings.ts';
import { useMemoryStatusSuspense } from '../../../hooks/memory/use-memory-status.ts';
import { useModelListSuspense } from '../../../hooks/models/use-model-list.ts';
import type { MemorySettingsOutput } from '../../../lib/trpc.tsx';
import { MemoryStatusGrid } from '../../memory/memory-status-grid.tsx';
import { MemorySettingsEditor } from './memory-settings-editor.tsx';

type MemorySettingsSnapshot = Exclude<MemorySettingsOutput, null>;

const emptyMemorySettings: MemorySettingsSnapshot = {
    dreamModel: null,
    knowledgeModel: null,
    memoryEnabled: false,
    persistenceModel: null,
    updatedAt: null,
    workingModel: null,
};

function buildSettingsSnapshotKey(settings: MemorySettingsSnapshot) {
    return JSON.stringify(settings);
}

function MemoriesSettingsContent() {
    const agentRuntimeConnection = useAgentRuntimeConnection();
    const [memorySettingsResponse] = useMemorySettingsSuspense();
    const [memoryStatus] = useMemoryStatusSuspense();
    const [modelList] = useModelListSuspense();
    const initialSettings: MemorySettingsSnapshot = memorySettingsResponse ?? emptyMemorySettings;

    return (
        <div className="grid gap-10">
            <MemorySettingsEditor
                canEdit={agentRuntimeConnection.status === 'reachable'}
                initialSettings={initialSettings}
                key={buildSettingsSnapshotKey(initialSettings)}
                modelOptions={buildConfiguredModelOptions(modelList)}
            />

            <div>
                <BadgeDivider className="pb-4">Memory Status</BadgeDivider>
                <MemoryStatusGrid
                    connectionStatus={toAgentRuntimePageConnectionState(
                        agentRuntimeConnection.status
                    )}
                    status={memoryStatus}
                />
            </div>
        </div>
    );
}

export function MemoriesSettings() {
    return (
        <React.Suspense fallback={<MemorySettingsLoadingState />}>
            <MemoriesSettingsContent />
        </React.Suspense>
    );
}

function MemorySettingsLoadingState() {
    return (
        <div className="grid gap-10">
            <div>
                <BadgeDivider className="pb-4">Memory Settings</BadgeDivider>
                <Card>
                    <CardContent className="p-4" />
                </Card>
            </div>
            <div>
                <BadgeDivider className="pb-4">Memory Status</BadgeDivider>
                <Card>
                    <CardContent className="p-4" />
                </Card>
            </div>
        </div>
    );
}
