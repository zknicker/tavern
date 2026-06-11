import { usePrimaryAgent } from '../../../hooks/agents/use-agent-list.ts';
import {
    type RuntimeConnectionStatus,
    useRuntimeConnection,
} from '../../../hooks/connections/use-runtime-connection.ts';
import { useModelList } from '../../../hooks/models/use-model-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { type AgentListOutput, type ModelListOutput, trpc } from '../../../lib/trpc.tsx';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';
import { MessagingPlatformsSection } from '../connections/messaging-platform-section.tsx';
import { AgentAppearanceSection } from './appearance-section.tsx';
import { AgentBehaviorSection } from './behavior-section.tsx';
import { AgentModelSection } from './model-section.tsx';
import type { AgentModelDraft } from './types.ts';
import { useAgentExecutionSettings } from './use-execution-settings.ts';

export function AgentSettingsPage() {
    const primaryAgentQuery = usePrimaryAgent();
    const runtimeConnection = useRuntimeConnection();
    const modelsQuery = useModelList();

    if (primaryAgentQuery.isPending || modelsQuery.isPending) {
        return <p className="text-muted-foreground text-sm">Loading agent settings...</p>;
    }

    const agent = primaryAgentQuery.data?.agent ?? null;

    if (!agent) {
        return <MissingAgentState agentId="primary" />;
    }

    const modelSetting = modelsQuery.data?.agents.find((entry) => entry.agentId === agent.id);

    return (
        <AgentSettingsContent
            agent={agent}
            baseline={createAgentModelBaseline(modelSetting)}
            modelOptions={modelsQuery.data?.models ?? []}
            modelSetting={modelSetting ?? null}
            runtimeStatus={runtimeConnection.status}
        />
    );
}

function AgentSettingsContent({
    agent,
    runtimeStatus,
    baseline,
    modelOptions,
    modelSetting,
}: {
    agent: AgentListOutput['agents'][number];
    runtimeStatus: RuntimeConnectionStatus;
    baseline: AgentModelDraft | null;
    modelOptions: ModelListOutput['models'];
    modelSetting: ModelListOutput['agents'][number] | null;
}) {
    const utils = trpc.useUtils();
    const updateModel = trpc.agent.updateModel.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.agent.list.invalidate(),
                utils.agent.primary.invalidate(),
                utils.model.list.invalidate(),
            ]);
        },
    });
    const updateThinkingDefault = trpc.agent.updateThinkingDefault.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.agent.list.invalidate(), utils.model.list.invalidate()]);
        },
    });
    const executionSettings = useAgentExecutionSettings();
    const isSavingAgentConfig = updateModel.isPending || updateThinkingDefault.isPending;

    return (
        <div className="grid gap-8">
            <AgentAppearanceSection agent={agent} disabled={isSavingAgentConfig} />

            <AgentModelSection
                disabled={isSavingAgentConfig}
                fallbackModels={executionSettings.settings.fallbackModels}
                fallbacksDisabled={executionSettings.isSaving}
                modelOptions={modelOptions}
                onChange={(model) =>
                    void withSavingToast(() =>
                        saveAgentModel({
                            current: baseline,
                            model,
                            updateModel: (modelRef) =>
                                updateModel.mutateAsync({
                                    agentId: agent.id,
                                    modelRef,
                                }),
                            updateThinkingDefault: (thinkingDefault) =>
                                updateThinkingDefault.mutateAsync({
                                    agentId: agent.id,
                                    thinkingDefault,
                                }),
                        })
                    ).catch(() => undefined)
                }
                onFallbacksChange={(next) =>
                    void withSavingToast(() =>
                        executionSettings.save({ fallbackModels: next })
                    ).catch(() => undefined)
                }
                syncError={modelSetting?.syncError ?? null}
                value={baseline}
            />

            <AgentBehaviorSection
                disabled={executionSettings.isSaving}
                onTimezoneChange={(next) =>
                    void withSavingToast(() => executionSettings.save({ timezone: next })).catch(
                        () => undefined
                    )
                }
                timezone={executionSettings.settings.timezone}
            />

            <MessagingPlatformsSection
                agentId={agent.id}
                runtimeStatus={runtimeStatus}
                title="Connections"
            />
        </div>
    );
}

async function saveAgentModel(input: {
    current: AgentModelDraft | null;
    model: AgentModelDraft | null;
    updateModel: (modelRef: string) => Promise<unknown>;
    updateThinkingDefault: (
        thinkingDefault: AgentModelDraft['thinkingDefault']
    ) => Promise<unknown>;
}) {
    const jobs: Promise<unknown>[] = [];

    if (input.model?.modelRef && input.model.modelRef !== input.current?.modelRef) {
        jobs.push(input.updateModel(input.model.modelRef));
    }

    if (input.model?.thinkingDefault !== input.current?.thinkingDefault) {
        jobs.push(input.updateThinkingDefault(input.model?.thinkingDefault ?? null));
    }

    await Promise.all(jobs);
}

function createAgentModelBaseline(
    modelSetting: ModelListOutput['agents'][number] | undefined
): AgentModelDraft | null {
    return modelSetting
        ? {
              modelRef: modelSetting.modelRef,
              thinkingDefault: modelSetting.overrideThinkingDefault,
          }
        : null;
}
