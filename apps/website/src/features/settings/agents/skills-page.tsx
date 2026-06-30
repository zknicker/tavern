import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Alert, AlertDescription } from '../../../components/ui/alert.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import { useSkillHubAvailable } from '../../../hooks/skills/use-skill-hub-available.ts';
import { useSkillList } from '../../../hooks/skills/use-skill-list.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput, SkillListOutput } from '../../../lib/trpc.tsx';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';
import { useAgentSkillsUpdate } from '../../agents/use-agent-skills-update.ts';
import type { SkillEnablementController } from '../../skills/skill-preview-pane.tsx';
import { SkillSourcesDialog } from '../../skills/skill-sources-dialog.tsx';
import { SkillsBrowser } from '../../skills/skills-browser.tsx';
import { SkillsPageSkeleton } from '../../skills/skills-page-skeleton.tsx';

type Agent = AgentListOutput['agents'][number];
type SkillSummary = SkillListOutput['skills'][number];

export function AgentSkillsSettingsPage() {
    const { agentId } = useParams();
    const [sourcesOpen, setSourcesOpen] = React.useState(false);
    const agentsQuery = useAgentList();
    const skillsQuery = useSkillList();
    const availableQuery = useSkillHubAvailable({ enabled: true });
    const saveSkills = useAgentSkillsUpdate();
    const agent = agentsQuery.data?.agents.find((candidate) => candidate.id === agentId) ?? null;
    const skills = skillsQuery.data?.skills ?? [];
    const agentSkills = React.useMemo(
        () => mapAgentSkillEnabledState(skills, agent),
        [agent, skills]
    );
    const hubByName = React.useMemo(() => {
        const byName = new Map<string, { identifier: string; trustLevel: null | string }>();

        for (const [identifier, entry] of Object.entries(availableQuery.data?.installed ?? {})) {
            if (entry.name) {
                byName.set(entry.name, { identifier, trustLevel: entry.trustLevel });
            }
        }

        return byName;
    }, [availableQuery.data?.installed]);
    const skillEnablement = React.useMemo<SkillEnablementController | undefined>(() => {
        if (!agent) {
            return undefined;
        }

        return {
            error: saveSkills.error,
            isPending: saveSkills.isPending,
            mutate: ({ enabled, skillId }) => {
                const next = enabled
                    ? [...agent.enabledSkillIds, skillId]
                    : agent.enabledSkillIds.filter((candidate) => candidate !== skillId);

                void withSavingToast(() =>
                    saveSkills.mutateAsync({
                        agentId: agent.id,
                        enabledSkillIds: [...new Set(next)],
                    })
                ).catch(() => undefined);
            },
        };
    }, [agent, saveSkills]);

    if (
        (agentsQuery.isPending || skillsQuery.isPending) &&
        !(agentsQuery.data && skillsQuery.data)
    ) {
        return <SkillsPageSkeleton />;
    }

    if (!(agent && agentId)) {
        return <MissingAgentState agentId={agentId ?? 'unknown'} />;
    }

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col">
            <SkillsBrowser
                available={availableQuery.data}
                availableError={availableQuery.error?.message ?? null}
                availablePending={availableQuery.isPending}
                hubByName={hubByName}
                onManageSources={() => setSourcesOpen(true)}
                skillEnablement={skillEnablement}
                skills={agentSkills}
            />
            <SkillSourcesDialog onOpenChange={setSourcesOpen} open={sourcesOpen} />

            {skillsQuery.error ? (
                <div className="fixed inset-x-4 bottom-4 z-50">
                    <Alert variant="error">
                        <Icon icon={AlertCircleIcon} />
                        <AlertDescription>{skillsQuery.error.message}</AlertDescription>
                    </Alert>
                </div>
            ) : null}
        </div>
    );
}

function mapAgentSkillEnabledState(skills: SkillSummary[], agent: Agent | null) {
    if (!agent) {
        return skills;
    }

    const enabledSkillIds = new Set(agent.enabledSkillIds);
    return skills.map((skill) => ({
        ...skill,
        enabled: enabledSkillIds.has(skill.id),
    }));
}
