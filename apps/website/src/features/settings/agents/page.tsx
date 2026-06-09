import { useEffect, useState } from 'react';
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
import { usePrimaryAgent } from '../../../hooks/agents/use-agent-list.ts';
import {
    type RuntimeConnectionStatus,
    useRuntimeConnection,
} from '../../../hooks/connections/use-runtime-connection.ts';
import { useModelList } from '../../../hooks/models/use-model-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { type AgentListOutput, type ModelListOutput, trpc } from '../../../lib/trpc.tsx';
import { agentColorPresets } from '../../agents/agent-color-presets.ts';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';
import { useAgentProfileUpdate } from '../../agents/use-agent-profile-update.ts';
import { MessagingPlatformsSection } from '../connections/messaging-platform-section.tsx';
import { AgentModelSection } from './model-section.tsx';
import type { AgentModelDraft, AgentSettingsDraft } from './types.ts';

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
    const baseline = createAgentSettingsBaseline({
        agent,
        modelSetting,
    });

    return (
        <AgentSettingsContent
            agent={agent}
            baseline={baseline}
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
    baseline: AgentSettingsDraft;
    modelOptions: ModelListOutput['models'];
    modelSetting: ModelListOutput['agents'][number] | null;
}) {
    const utils = trpc.useUtils();
    const saveAgentProfile = useAgentProfileUpdate();
    const updateName = trpc.agent.updateName.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.agent.list.invalidate(), utils.agent.primary.invalidate()]);
        },
    });
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
    const [displayName, setDisplayName] = useState(baseline.profile.displayName);
    const draft = {
        ...baseline,
        profile: {
            ...baseline.profile,
            displayName,
        },
    };
    const isSavingAgentConfig =
        updateName.isPending || updateModel.isPending || updateThinkingDefault.isPending;

    useEffect(() => {
        setDisplayName(baseline.profile.displayName);
    }, [baseline.profile.displayName]);

    const selectedColor = agent.effectivePrimaryColor;
    const selectedColorPreset =
        agentColorPresets.find(
            (preset) => preset.color.toLowerCase() === selectedColor.toLowerCase()
        ) ?? null;

    return (
        <div className="grid gap-8">
            <section>
                <BadgeDivider className="pb-4">Appearance</BadgeDivider>
                <CardFrame>
                    <Card className="overflow-hidden p-0">
                        <SettingsRow title="Display name">
                            <Input
                                disabled={isSavingAgentConfig}
                                id="agent-display-name"
                                name="agent-display-name"
                                onBlur={() => {
                                    const nextName = displayName.trim() || agent.id;

                                    if (nextName === baseline.profile.displayName) {
                                        return;
                                    }

                                    void withSavingToast(() =>
                                        updateName.mutateAsync({
                                            agentId: agent.id,
                                            name: nextName,
                                        })
                                    ).catch(() => undefined);
                                }}
                                onChange={(event) => {
                                    setDisplayName(event.target.value);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.currentTarget.blur();
                                    }
                                }}
                                placeholder={agent.id}
                                value={draft.profile.displayName}
                            />
                        </SettingsRow>

                        <Separator />

                        <SettingsRow title="Color">
                            <Select
                                disabled={saveAgentProfile.isPending}
                                onValueChange={(color) => {
                                    if (!color) {
                                        return;
                                    }

                                    saveAgentProfile.mutate({
                                        agentId: agent.id,
                                        primaryColor:
                                            color.toLowerCase() ===
                                            agent.defaultPrimaryColor.toLowerCase()
                                                ? null
                                                : color,
                                    });
                                }}
                                value={selectedColor.toLowerCase()}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose color">
                                        <AgentColorOption
                                            color={selectedColor}
                                            label={selectedColorPreset?.label ?? selectedColor}
                                        />
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {agentColorPresets.map((preset) => (
                                        <SelectItem key={preset.color} value={preset.color}>
                                            <AgentColorOption
                                                color={preset.color}
                                                label={preset.label}
                                            />
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </SettingsRow>
                    </Card>
                </CardFrame>
            </section>

            <AgentModelSection
                disabled={isSavingAgentConfig}
                modelOptions={modelOptions}
                onChange={(model) =>
                    void withSavingToast(() =>
                        saveAgentModel({
                            current: draft.model,
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
                syncError={modelSetting?.syncError ?? null}
                value={draft.model}
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

function AgentColorOption({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="truncate">{label}</span>
        </span>
    );
}

function createAgentSettingsBaseline({
    agent,
    modelSetting,
}: {
    agent: AgentListOutput['agents'][number];
    modelSetting: ModelListOutput['agents'][number] | undefined;
}): AgentSettingsDraft {
    return {
        model: modelSetting
            ? {
                  modelRef: modelSetting.modelRef,
                  thinkingDefault: modelSetting.overrideThinkingDefault,
              }
            : null,
        profile: {
            defaultPrimaryColor: agent.defaultPrimaryColor,
            displayName: agent.name,
            primaryColor: agent.effectivePrimaryColor,
        },
    };
}
