import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { useEffect, useMemo, useState } from 'react';
import { RelativeTime } from '../../../components/time/relative-time.tsx';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow, SettingsValue } from '../../../components/ui/settings-row.tsx';
import { useAgentChatList } from '../../../hooks/agents/use-agent-chats.ts';
import { useAgentSession } from '../../../hooks/agents/use-agent-session.ts';
import { useModelList } from '../../../hooks/models/use-model-list.ts';
import { withSaveErrorToast, withSavingToast } from '../../../lib/saving-toast.ts';
import { type AgentListOutput, trpc } from '../../../lib/trpc.tsx';
import { selectMostRecentAgentChat } from './agent-chat-selection.ts';
import { AgentSessionFacts } from './agent-session-facts.tsx';
import { AgentDangerSection } from './danger-section.tsx';
import { AgentEnvSection } from './env-section.tsx';
import { AgentIdentitySection } from './identity-section.tsx';
import { AgentModelSection } from './model-section.tsx';
import { createAgentModelBaseline, saveAgentModel } from './profile-model.ts';
import { AgentSessionSection } from './session-section.tsx';
import { AgentSkillsSection } from './skills-section.tsx';
import { AgentTasksSection } from './tasks-section.tsx';
import type { AgentModelDraft } from './types.ts';
import { useAgentEnvSettings } from './use-env-settings.ts';
import { AgentWebAccessSection } from './web-access-section.tsx';

export function AgentProfileTab({ agent }: { agent: AgentListOutput['agents'][number] }) {
    const modelsQuery = useModelList();
    const chatsQuery = useAgentChatList({ agentId: agent.id });
    const sessionChat = selectMostRecentAgentChat(chatsQuery.data);
    const sessionQuery = useAgentSession({
        agentId: agent.id,
        chatId: sessionChat?.id ?? '',
        enabled: Boolean(sessionChat),
    });
    const modelSetting = modelsQuery.data?.agents.find((entry) => entry.agentId === agent.id);
    const baseline = useMemo(() => createAgentModelBaseline(modelSetting), [modelSetting]);
    const [modelDraft, setModelDraft] = useState<AgentModelDraft | null>(baseline);
    const utils = trpc.useUtils();
    const updateModel = trpc.agent.updateModel.useMutation({ onSuccess: invalidateModels });
    const updateThinking = trpc.agent.updateThinkingDefault.useMutation({
        onSuccess: invalidateModels,
    });
    const envSettings = useAgentEnvSettings();
    const isSavingModel = updateModel.isPending || updateThinking.isPending;

    async function invalidateModels() {
        await Promise.all([
            utils.agent.list.invalidate(),
            utils.agent.primary.invalidate(),
            utils.model.list.invalidate(),
        ]);
    }

    useEffect(() => {
        if (!isSavingModel) {
            setModelDraft(baseline);
        }
    }, [baseline, isSavingModel]);

    return (
        <div className="mx-auto grid w-full max-w-3xl gap-9 py-6">
            <AgentIdentitySection agent={agent} disabled={isSavingModel} />
            <AgentModelSection
                disabled={isSavingModel}
                modelOptions={modelsQuery.data?.models ?? []}
                onChange={(model) => {
                    setModelDraft(model);
                    void withSavingToast(() =>
                        saveAgentModel({
                            current: baseline,
                            model,
                            updateModel: (modelRef) =>
                                updateModel.mutateAsync({ agentId: agent.id, modelRef }),
                            updateThinkingDefault: (thinkingDefault) =>
                                updateThinking.mutateAsync({ agentId: agent.id, thinkingDefault }),
                        })
                    ).catch(() => setModelDraft(baseline));
                }}
                syncError={modelSetting?.syncError ?? null}
                value={modelDraft}
            >
                <SettingsRow title="Session" trailingWidth="wide">
                    {sessionQuery.isPending && sessionChat ? (
                        <SettingsValue>Loading session...</SettingsValue>
                    ) : sessionQuery.isError ? (
                        <SettingsValue className="text-destructive">
                            Could not load the session.
                        </SettingsValue>
                    ) : (
                        <AgentSessionFacts
                            models={modelsQuery.data?.models ?? []}
                            session={sessionQuery.data?.session ?? null}
                            stats={sessionQuery.data?.stats ?? null}
                        />
                    )}
                    {sessionQuery.data?.instructionsFresh === false ? (
                        <Alert variant="warning">
                            <Icon icon={AlertCircleIcon} />
                            <AlertDescription>
                                The system prompt changed. Start a fresh session to use it.
                            </AlertDescription>
                        </Alert>
                    ) : null}
                </SettingsRow>
                {Date.parse(agent.updatedAt) > 0 ? (
                    <>
                        <Separator />
                        <SettingsRow title="Updated">
                            <SettingsValue>
                                <RelativeTime value={agent.updatedAt} />
                            </SettingsValue>
                        </SettingsRow>
                    </>
                ) : null}
            </AgentModelSection>
            <AgentWebAccessSection agent={agent} disabled={isSavingModel} />
            <AgentTasksSection agent={agent} disabled={isSavingModel} />
            <AgentEnvSection
                disabled={envSettings.isLoading}
                isSaving={envSettings.isSaving}
                onChange={(next) =>
                    withSaveErrorToast(() => envSettings.save(next)).catch(() => undefined)
                }
                variables={envSettings.settings.variables}
            />
            <AgentSkillsSection agent={agent} />
            <AgentSessionSection agent={agent} />
            <AgentDangerSection agent={agent} />
        </div>
    );
}
