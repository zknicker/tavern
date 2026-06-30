import { Plus } from '@hugeicons/core-free-icons';
import { useEffect, useState } from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import { useModelList } from '../../../hooks/models/use-model-list.ts';
import { withSaveErrorToast, withSavingToast } from '../../../lib/saving-toast.ts';
import { type AgentListOutput, type ModelListOutput, trpc } from '../../../lib/trpc.tsx';
import { AgentAppearanceSection } from './appearance-section.tsx';
import { AgentBehaviorSection } from './behavior-section.tsx';
import { AgentEnvSection } from './env-section.tsx';
import { AgentModelSection } from './model-section.tsx';
import type { AgentModelDraft } from './types.ts';
import { useAgentEnvSettings } from './use-env-settings.ts';
import { useAgentExecutionSettings } from './use-execution-settings.ts';

export function AgentSettingsPage() {
    const agentsQuery = useAgentList();
    const modelsQuery = useModelList();
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const utils = trpc.useUtils();
    const createAgent = trpc.agent.create.useMutation({
        onSuccess: async ({ agent }) => {
            setSelectedAgentId(agent.id);
            await Promise.all([
                utils.agent.list.invalidate(),
                utils.agent.primary.invalidate(),
                utils.model.list.invalidate(),
            ]);
        },
    });

    if (agentsQuery.isPending || modelsQuery.isPending) {
        return <p className="text-muted-foreground text-sm">Loading agent settings...</p>;
    }

    const agents = agentsQuery.data?.agents ?? [];
    const agent = selectSettingsAgent(agents, selectedAgentId);

    if (!agent) {
        return <p className="text-muted-foreground text-sm">No agents are available.</p>;
    }

    const modelSetting = modelsQuery.data?.agents.find((entry) => entry.agentId === agent.id);

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]">
            <AgentSettingsList
                agents={agents}
                isCreating={createAgent.isPending}
                onCreate={() => {
                    void withSavingToast(() =>
                        createAgent.mutateAsync({
                            name: createNewAgentName(agents),
                        })
                    ).catch(() => undefined);
                }}
                onSelect={setSelectedAgentId}
                selectedAgentId={agent.id}
            />
            <AgentSettingsContent
                agent={agent}
                baseline={createAgentModelBaseline(modelSetting)}
                modelOptions={modelsQuery.data?.models ?? []}
                modelSetting={modelSetting ?? null}
            />
        </div>
    );
}

export function selectSettingsAgent(
    agents: AgentListOutput['agents'],
    selectedAgentId: null | string
) {
    if (selectedAgentId) {
        const selected = agents.find((agent) => agent.id === selectedAgentId);
        if (selected) {
            return selected;
        }
    }

    return agents[0] ?? null;
}

export function createNewAgentName(agents: AgentListOutput['agents']) {
    const names = new Set(agents.map((agent) => agent.name.trim().toLowerCase()));
    if (!names.has('new agent')) {
        return 'New agent';
    }

    let suffix = 2;
    while (names.has(`new agent ${suffix}`)) {
        suffix += 1;
    }
    return `New agent ${suffix}`;
}

function AgentSettingsList({
    agents,
    isCreating,
    onCreate,
    onSelect,
    selectedAgentId,
}: {
    agents: AgentListOutput['agents'];
    isCreating: boolean;
    onCreate: () => void;
    onSelect: (agentId: string) => void;
    selectedAgentId: string;
}) {
    return (
        <aside aria-label="Agents" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 px-1">
                <h2 className="font-medium text-muted-foreground text-sm">Agents</h2>
                <Button
                    aria-label="Create agent"
                    loading={isCreating}
                    onClick={onCreate}
                    size="icon-xs"
                    variant="ghost"
                >
                    <Icon icon={Plus} />
                </Button>
            </div>
            <div className="flex flex-col gap-1">
                {agents.map((agent) => (
                    <button
                        aria-current={agent.id === selectedAgentId ? 'page' : undefined}
                        className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted aria-[current=page]:bg-muted"
                        key={agent.id}
                        onClick={() => onSelect(agent.id)}
                        type="button"
                    >
                        <span
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: agent.effectivePrimaryColor }}
                        />
                        <span className="min-w-0">
                            <span className="block truncate font-medium">{agent.name}</span>
                            <span className="block truncate text-muted-foreground text-xs">
                                {agent.id}
                            </span>
                        </span>
                    </button>
                ))}
            </div>
        </aside>
    );
}

function AgentSettingsContent({
    agent,
    baseline,
    modelOptions,
    modelSetting,
}: {
    agent: AgentListOutput['agents'][number];
    baseline: AgentModelDraft | null;
    modelOptions: ModelListOutput['models'];
    modelSetting: ModelListOutput['agents'][number] | null;
}) {
    const [modelDraft, setModelDraft] = useState<AgentModelDraft | null>(baseline);
    const baselineModelRef = baseline?.modelRef ?? null;
    const baselineThinkingDefault = baseline?.thinkingDefault ?? null;
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
    const isSavingAgentConfig = updateModel.isPending || updateThinkingDefault.isPending;

    useEffect(() => {
        if (!isSavingAgentConfig) {
            setModelDraft(
                baselineModelRef
                    ? {
                          modelRef: baselineModelRef,
                          thinkingDefault: baselineThinkingDefault,
                      }
                    : null
            );
        }
    }, [baselineModelRef, baselineThinkingDefault, isSavingAgentConfig]);

    return (
        <div className="grid gap-8">
            <AgentAppearanceSection agent={agent} disabled={isSavingAgentConfig} />

            <AgentModelSection
                disabled={isSavingAgentConfig}
                modelOptions={modelOptions}
                onChange={(model) => {
                    setModelDraft(model);

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
                    ).catch(() => setModelDraft(baseline));
                }}
                syncError={modelSetting?.syncError ?? null}
                value={modelDraft}
            />

            <AgentBehaviorSection
                disabled={executionSettings.isLoading}
                onTimezoneChange={(next) =>
                    void withSaveErrorToast(() => executionSettings.save({ timezone: next })).catch(
                        () => undefined
                    )
                }
                timezone={executionSettings.settings.timezone}
            />

            <AgentEnvSection
                disabled={envSettings.isLoading}
                isSaving={envSettings.isSaving}
                onChange={(next) =>
                    withSaveErrorToast(() => envSettings.save(next)).catch(() => undefined)
                }
                variables={envSettings.settings.variables}
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
