import { usePrimaryAgent } from '../../../hooks/agents/use-agent-list.ts';
import {
    type RuntimeConnectionStatus,
    useRuntimeConnection,
} from '../../../hooks/connections/use-runtime-connection.ts';
import { useModelList } from '../../../hooks/models/use-model-list.ts';
import { withSaveErrorToast, withSavingToast } from '../../../lib/saving-toast.ts';
import { type AgentListOutput, type ModelListOutput, trpc } from '../../../lib/trpc.tsx';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';
import { MessagingPlatformsSection } from '../connections/messaging-platform-section.tsx';
import { AgentAppearanceSection } from './appearance-section.tsx';
import { AgentBehaviorSection } from './behavior-section.tsx';
import { AgentEnvSection } from './env-section.tsx';
import { AgentModelSection } from './model-section.tsx';
import { AgentPermissionsSection } from './permissions-section.tsx';
import type { AgentModelDraft } from './types.ts';
import { useAgentEnvSettings } from './use-env-settings.ts';
import { useAgentExecutionSettings } from './use-execution-settings.ts';
import { useAgentPermissionSettings } from './use-permission-settings.ts';

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
    const envSettings = useAgentEnvSettings();
    const executionSettings = useAgentExecutionSettings();
    const permissionSettings = useAgentPermissionSettings();
    const isSavingAgentConfig = updateModel.isPending || updateThinkingDefault.isPending;

    return (
        <div className="grid gap-8">
            <AgentAppearanceSection agent={agent} disabled={isSavingAgentConfig} />

            <AgentModelSection
                disabled={isSavingAgentConfig}
                fallbackModels={executionSettings.settings.fallbackModels}
                fallbacksDisabled={executionSettings.isLoading}
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
                    void withSaveErrorToast(() =>
                        executionSettings.save({ fallbackModels: next })
                    ).catch(() => undefined)
                }
                onSubagentEffortChange={(next) =>
                    void withSaveErrorToast(() =>
                        executionSettings.save({ subagentEffort: next })
                    ).catch(() => undefined)
                }
                onSubagentModelChange={(next) =>
                    void withSaveErrorToast(() =>
                        executionSettings.save({ subagentModel: next })
                    ).catch(() => undefined)
                }
                subagentEffort={executionSettings.settings.subagentEffort}
                subagentModel={executionSettings.settings.subagentModel}
                syncError={modelSetting?.syncError ?? null}
                value={baseline}
            />

            <AgentBehaviorSection
                compression={executionSettings.settings.compression}
                disabled={executionSettings.isLoading}
                onCompressionChange={(next) =>
                    void withSaveErrorToast(() =>
                        executionSettings.save({ compression: next })
                    ).catch(() => undefined)
                }
                onTimezoneChange={(next) =>
                    void withSaveErrorToast(() => executionSettings.save({ timezone: next })).catch(
                        () => undefined
                    )
                }
                timezone={executionSettings.settings.timezone}
            />

            <AgentPermissionsSection
                approvalMode={permissionSettings.settings.approvalMode}
                automationApprovalMode={permissionSettings.settings.automationApprovalMode}
                commandAllowlist={permissionSettings.settings.commandAllowlist}
                disabled={permissionSettings.isLoading}
                onApprovalModeChange={(approvalMode) =>
                    void withSaveErrorToast(() => permissionSettings.save({ approvalMode })).catch(
                        () => undefined
                    )
                }
                onAutomationApprovalModeChange={(automationApprovalMode) =>
                    void withSaveErrorToast(() =>
                        permissionSettings.save({ automationApprovalMode })
                    ).catch(() => undefined)
                }
                onCommandAllowlistChange={(next) =>
                    void withSaveErrorToast(() =>
                        permissionSettings.save({ commandAllowlist: next })
                    ).catch(() => undefined)
                }
            />

            <AgentEnvSection
                disabled={envSettings.isLoading}
                isSaving={envSettings.isSaving}
                onChange={(next) =>
                    withSaveErrorToast(() => envSettings.save(next)).catch(() => undefined)
                }
                variables={envSettings.settings.variables}
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
