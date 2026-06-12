import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { AddSkillDialog } from '../../features/skills/add-skill-dialog.tsx';
import { AddToolsetDialog } from '../../features/skills/add-toolset-dialog.tsx';
import { SkillsCatalog } from '../../features/skills/skills-catalog.tsx';
import { SkillsPageSkeleton } from '../../features/skills/skills-page-skeleton.tsx';
import { ToolsetSetupDialog } from '../../features/skills/toolset-setup-dialog.tsx';
import { useSkillEnabledSet } from '../../hooks/skills/use-skill-enabled-set.ts';
import { useSkillList } from '../../hooks/skills/use-skill-list.ts';
import { useToolsetEnabledSet } from '../../hooks/skills/use-toolset-enabled-set.ts';
import type { SkillListOutput } from '../../lib/trpc.tsx';

export function SkillsPage() {
    const [addSkillOpen, setAddSkillOpen] = React.useState(false);
    const [addToolsetOpen, setAddToolsetOpen] = React.useState(false);
    const [setupToolset, setSetupToolset] = React.useState<
        null | SkillListOutput['toolsets'][number]
    >(null);
    const setSkillEnabled = useSkillEnabledSet();
    const setToolsetEnabled = useToolsetEnabledSet();
    const skillsQuery = useSkillList();
    const skills = skillsQuery.data?.skills ?? [];
    const toolsets = skillsQuery.data?.toolsets ?? [];
    const savingSkillIds = React.useMemo(
        () =>
            setSkillEnabled.isPending && setSkillEnabled.variables
                ? new Set([setSkillEnabled.variables.skillId])
                : new Set<string>(),
        [setSkillEnabled.isPending, setSkillEnabled.variables]
    );
    const savingToolsetIds = React.useMemo(
        () =>
            setToolsetEnabled.isPending && setToolsetEnabled.variables
                ? new Set([setToolsetEnabled.variables.toolsetId])
                : new Set<string>(),
        [setToolsetEnabled.isPending, setToolsetEnabled.variables]
    );

    if (skillsQuery.isPending && !skillsQuery.data) {
        return <SkillsPageSkeleton />;
    }

    return (
        <div>
            <SkillsCatalog
                onAddSkill={() => setAddSkillOpen(true)}
                onAddToolset={() => setAddToolsetOpen(true)}
                onConfigureToolset={setSetupToolset}
                onSetSkillEnabled={(input) => setSkillEnabled.mutate(input)}
                onSetToolsetEnabled={(input) => setToolsetEnabled.mutate(input)}
                savingSkillIds={savingSkillIds}
                savingToolsetIds={savingToolsetIds}
                skills={skills}
                toolsets={toolsets}
            />

            <AddSkillDialog onOpenChange={setAddSkillOpen} open={addSkillOpen} />
            <AddToolsetDialog onOpenChange={setAddToolsetOpen} open={addToolsetOpen} />
            <ToolsetSetupDialog
                onOpenChange={(open) => {
                    if (!open) {
                        setSetupToolset(null);
                    }
                }}
                toolset={setupToolset}
            />

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
