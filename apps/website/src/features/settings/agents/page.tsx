import { useEffect, useRef, useState } from 'react';
import { SimpleCodeEditor } from '../../../components/code-editor/simple-code-editor.tsx';
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
import { usePrimaryAgent } from '../../../hooks/agents/use-agent-list.ts';
import {
    type RuntimeConnectionStatus,
    useRuntimeConnection,
} from '../../../hooks/connections/use-runtime-connection.ts';
import { useModelList } from '../../../hooks/models/use-model-list.ts';
import type { AgentListOutput, ModelListOutput } from '../../../lib/trpc.tsx';
import { agentColorPresets } from '../../agents/agent-color-presets.ts';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';
import { useAgentProfileUpdate } from '../../agents/use-agent-profile-update.ts';
import { MessagingPlatformsSection } from '../connections/messaging-platform-section.tsx';
import { useOpenClawAgentDraft } from '../openclaw-draft/agent-draft.ts';
import { useOpenClawSettingsDraft } from '../openclaw-draft/provider.tsx';
import type { AgentSettingsDraft } from '../openclaw-draft/types.ts';
import { AgentInstructionsPreviewDrawer } from './agent-instructions-preview-drawer.tsx';
import { AgentModelSection } from './model-section.tsx';

export function AgentSettingsPage() {
    const primaryAgentQuery = usePrimaryAgent();
    const runtimeConnection = useRuntimeConnection();
    const modelsQuery = useModelList();
    const { config, isLoading, isSaving } = useOpenClawSettingsDraft();

    if (primaryAgentQuery.isPending || modelsQuery.isPending || isLoading) {
        return <p className="text-muted-foreground text-sm">Loading agent settings...</p>;
    }

    if (!config) {
        return (
            <p className="text-muted-foreground text-sm">
                Runtime config has not synced yet. Start Tavern Runtime, then wait for config sync.
            </p>
        );
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
            disabled={isSaving}
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
    disabled,
    modelOptions,
    modelSetting,
}: {
    agent: AgentListOutput['agents'][number];
    runtimeStatus: RuntimeConnectionStatus;
    baseline: AgentSettingsDraft;
    disabled: boolean;
    modelOptions: ModelListOutput['models'];
    modelSetting: ModelListOutput['agents'][number] | null;
}) {
    const { draft, update } = useOpenClawAgentDraft({
        agent,
        baseline,
        modelOptions,
    });
    const saveAgentProfile = useAgentProfileUpdate();
    const savedUserInstructions = agent.userInstructions;
    const [instructionsDraft, setInstructionsDraft] = useState(savedUserInstructions);
    const previousSavedUserInstructionsRef = useRef(savedUserInstructions);

    useEffect(() => {
        const previousSavedUserInstructions = previousSavedUserInstructionsRef.current;

        if (previousSavedUserInstructions === savedUserInstructions) {
            return;
        }

        previousSavedUserInstructionsRef.current = savedUserInstructions;
        setInstructionsDraft((current) =>
            current === previousSavedUserInstructions ? savedUserInstructions : current
        );
    }, [savedUserInstructions]);

    if (!draft) {
        return <p className="text-muted-foreground text-sm">Loading agent settings...</p>;
    }

    const instructionsChanged = instructionsDraft !== savedUserInstructions;
    const isSavingInstructions =
        saveAgentProfile.isPending && saveAgentProfile.variables?.userInstructions !== undefined;
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
                                disabled={disabled}
                                id="agent-display-name"
                                name="agent-display-name"
                                onChange={(event) =>
                                    update((current) => ({
                                        ...current,
                                        profile: {
                                            ...current.profile,
                                            displayName: event.target.value,
                                        },
                                    }))
                                }
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

            <section>
                <BadgeDivider className="pb-4">Instructions</BadgeDivider>
                <CardFrame>
                    <Card className="relative h-[400px] overflow-hidden p-0">
                        <SimpleCodeEditor
                            disabled={disabled || isSavingInstructions}
                            filePath="AGENTS.md"
                            onChange={setInstructionsDraft}
                            placeholder="Write the agent's role, personality, operating rules, output protocol, and stop rules."
                            value={instructionsDraft}
                        />
                    </Card>
                </CardFrame>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <AgentInstructionsPreviewDrawer agentId={agent.id} />
                    <Button
                        disabled={!instructionsChanged || saveAgentProfile.isPending}
                        loading={isSavingInstructions}
                        onClick={() =>
                            saveAgentProfile.mutate(
                                {
                                    agentId: agent.id,
                                    userInstructions: instructionsDraft,
                                },
                                {
                                    onSuccess: ({ agent: savedAgent }) => {
                                        previousSavedUserInstructionsRef.current =
                                            savedAgent.userInstructions;
                                        setInstructionsDraft(savedAgent.userInstructions);
                                    },
                                }
                            )
                        }
                    >
                        Save
                    </Button>
                </div>
            </section>

            <AgentModelSection
                disabled={disabled}
                modelOptions={modelOptions}
                onChange={(model) =>
                    update((current) => ({
                        ...current,
                        model,
                    }))
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
                  harness: modelSetting.harness ?? 'pi',
                  modelId: modelSetting.modelId,
                  openClawModelNameId: modelSetting.openClawModelNameId,
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
