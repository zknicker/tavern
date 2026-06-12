import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { AddCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { AddToolsetDialog } from '../../features/skills/add-toolset-dialog.tsx';
import { SkillsPageSkeleton } from '../../features/skills/skills-page-skeleton.tsx';
import { ToolsetSetupDialog } from '../../features/skills/toolset-setup-dialog.tsx';
import { ToolsetsList } from '../../features/skills/toolsets-list.tsx';
import { useSkillList } from '../../hooks/skills/use-skill-list.ts';
import { useToolsetEnabledSet } from '../../hooks/skills/use-toolset-enabled-set.ts';
import type { SkillListOutput } from '../../lib/trpc.tsx';

export function ToolsetsPage() {
    const [addToolsetOpen, setAddToolsetOpen] = React.useState(false);
    const [setupToolset, setSetupToolset] = React.useState<
        null | SkillListOutput['toolsets'][number]
    >(null);
    const setToolsetEnabled = useToolsetEnabledSet();
    const skillsQuery = useSkillList();
    const toolsets = skillsQuery.data?.toolsets ?? [];
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
            <section className="grid gap-4">
                <BadgeDivider className="pb-4">Toolsets</BadgeDivider>
                <div className="flex items-center">
                    <Button className="ml-auto" onClick={() => setAddToolsetOpen(true)}>
                        <Icon className="size-4" icon={AddCircleIcon} />
                        Add toolset
                    </Button>
                </div>

                <ToolsetsList
                    onConfigure={setSetupToolset}
                    onSetEnabled={(input) => setToolsetEnabled.mutate(input)}
                    savingToolsetIds={savingToolsetIds}
                    toolsets={toolsets}
                />
            </section>

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
