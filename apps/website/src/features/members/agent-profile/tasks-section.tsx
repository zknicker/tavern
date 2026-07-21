import { useEffect, useState } from 'react';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { useCapability } from '../../../hooks/connections/use-capability.ts';
import { useAgentTaskSettingsUpdate } from '../../../hooks/tasks/use-agent-task-settings.ts';
import { withSaveErrorToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';

export function AgentTasksSection({
    agent,
    disabled,
}: {
    agent: AgentListOutput['agents'][number];
    disabled: boolean;
}) {
    const capability = useCapability('autoDispatch');
    const update = useAgentTaskSettingsUpdate();
    const [autoDispatch, setAutoDispatch] = useState(agent.autoDispatchEnabled);
    const [reviewPolicy, setReviewPolicy] = useState(agent.taskReviewPolicy);

    useEffect(() => {
        setAutoDispatch(agent.autoDispatchEnabled);
    }, [agent.autoDispatchEnabled]);

    useEffect(() => {
        setReviewPolicy(agent.taskReviewPolicy);
    }, [agent.taskReviewPolicy]);

    if (!capability.healthy) {
        return null;
    }

    const isSaving = disabled || update.isPending;

    return (
        <SettingsSection title="Tasks">
            <SettingsGroup>
                <SettingsRow
                    description="Work queued tasks assigned to this agent automatically."
                    title="Auto-dispatch"
                >
                    <div className="flex justify-start md:justify-end">
                        <Switch
                            aria-label="Auto-dispatch"
                            checked={autoDispatch}
                            disabled={isSaving}
                            onCheckedChange={(enabled) => {
                                setAutoDispatch(enabled);
                                void withSaveErrorToast(() =>
                                    update.mutateAsync({
                                        agentId: agent.id,
                                        autoDispatchEnabled: enabled,
                                    })
                                ).catch(() => setAutoDispatch(agent.autoDispatchEnabled));
                            }}
                        />
                    </div>
                </SettingsRow>
                <Separator />
                <SettingsRow
                    description="Completions land in Review for you to check instead of Done."
                    title="Review completed work"
                >
                    <div className="flex justify-start md:justify-end">
                        <Switch
                            aria-label="Review completed work"
                            checked={reviewPolicy}
                            disabled={isSaving}
                            onCheckedChange={(enabled) => {
                                setReviewPolicy(enabled);
                                void withSaveErrorToast(() =>
                                    update.mutateAsync({
                                        agentId: agent.id,
                                        taskReviewPolicy: enabled,
                                    })
                                ).catch(() => setReviewPolicy(agent.taskReviewPolicy));
                            }}
                        />
                    </div>
                </SettingsRow>
            </SettingsGroup>
        </SettingsSection>
    );
}
