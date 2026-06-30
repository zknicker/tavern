import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import { withSaveErrorToast, withSavingToast } from '../../../lib/saving-toast.ts';
import { type AgentListOutput, type ModelListOutput, trpc } from '../../../lib/trpc.tsx';
import { DeleteAgentDialog } from '../../agents/delete-agent-dialog.tsx';
import { AgentAppearanceSection } from './appearance-section.tsx';
import { AgentBehaviorSection } from './behavior-section.tsx';
import { AgentEnvSection } from './env-section.tsx';
import { AgentModelSection } from './model-section.tsx';
import type { AgentModelDraft } from './types.ts';
import { useAgentEnvSettings } from './use-env-settings.ts';
import { useAgentExecutionSettings } from './use-execution-settings.ts';
import { AgentWorkspaceFileEditor } from './workspace-file-page.tsx';

export function AgentGeneralSettingsContent({
    agent,
    baseline,
    deleteRedirectTo,
    modelOptions,
    modelSetting,
}: {
    agent: AgentListOutput['agents'][number];
    baseline: AgentModelDraft | null;
    deleteRedirectTo: string;
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

            <AgentWorkspaceFileEditor
                agentId={agent.id}
                agentName={agent.name}
                editorClassName="h-[28rem]"
                path="SOUL.md"
            />

            <AgentDeleteSection agent={agent} deleteRedirectTo={deleteRedirectTo} />
        </div>
    );
}

function AgentDeleteSection({
    agent,
    deleteRedirectTo,
}: {
    agent: AgentListOutput['agents'][number];
    deleteRedirectTo: string;
}) {
    const navigate = useNavigate();
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    return (
        <section>
            <BadgeDivider className="pb-4">Delete Agent</BadgeDivider>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow
                        description={`Remove ${agent.name} from Tavern Runtime. This cannot be undone.`}
                        title="Delete this agent"
                        trailingWidth="intrinsic"
                    >
                        <Button
                            onClick={() => setIsDeleteOpen(true)}
                            size="sm"
                            variant="destructive-outline"
                        >
                            Delete Agent
                        </Button>
                    </SettingsRow>
                </Card>
            </CardFrame>

            <DeleteAgentDialog
                agent={agent}
                onDeleted={() => navigate(deleteRedirectTo, { replace: true })}
                onOpenChange={setIsDeleteOpen}
                open={isDeleteOpen}
            />
        </section>
    );
}

export function createAgentModelBaseline(
    modelSetting: ModelListOutput['agents'][number] | undefined
): AgentModelDraft | null {
    return modelSetting
        ? {
              modelRef: modelSetting.modelRef,
              thinkingDefault: modelSetting.overrideThinkingDefault,
          }
        : null;
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
