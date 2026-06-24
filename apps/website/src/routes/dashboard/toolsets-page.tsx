import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { AddCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
import { AddToolsetDialog } from '../../features/skills/add-toolset-dialog.tsx';
import { SkillsPageSkeleton } from '../../features/skills/skills-page-skeleton.tsx';
import { ToolsetSetupDialog } from '../../features/skills/toolset-setup-dialog.tsx';
import { ToolsetsList } from '../../features/skills/toolsets-list.tsx';
import { useSkillList } from '../../hooks/skills/use-skill-list.ts';
import { useToolsetEnabledSet } from '../../hooks/skills/use-toolset-enabled-set.ts';
import type { SkillListOutput } from '../../lib/trpc.tsx';

type ToolsetsTab = 'standard' | 'integrations';

export function ToolsetsPage() {
    const [addToolsetOpen, setAddToolsetOpen] = React.useState(false);
    const [tab, setTab] = React.useState<ToolsetsTab>('standard');
    const [setupToolset, setSetupToolset] = React.useState<
        null | SkillListOutput['toolsets'][number]
    >(null);
    const setToolsetEnabled = useToolsetEnabledSet();
    const skillsQuery = useSkillList();
    const toolsets = skillsQuery.data?.toolsets ?? [];
    const standardToolsets = toolsets.filter((toolset) => !toolset.integration);
    const integrationToolsets = toolsets.filter((toolset) => toolset.integration);
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
        <div className="mx-auto w-full max-w-3xl">
            <header className="flex items-start pb-6">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground">Toolsets</h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Grant the agent access to groups of runtime tools
                    </p>
                </div>
                {tab === 'standard' ? (
                    <Button
                        className="ml-auto shrink-0 rounded-full"
                        onClick={() => setAddToolsetOpen(true)}
                        size="sm"
                        variant="secondary"
                    >
                        <Icon className="size-4" icon={AddCircleIcon} />
                        Add toolset
                    </Button>
                ) : null}
            </header>

            <section className="grid gap-4">
                <ToolsetsTabBar
                    counts={{
                        integrations: integrationToolsets.length,
                        standard: standardToolsets.length,
                    }}
                    onChange={setTab}
                    value={tab}
                />
                <ToolsetsList
                    emptyDescription={
                        tab === 'integrations'
                            ? 'Integration toolsets appear here when Integrations expose agent tools.'
                            : undefined
                    }
                    emptyTitle={tab === 'integrations' ? 'No Integration toolsets' : undefined}
                    onConfigure={setSetupToolset}
                    onSetEnabled={(input) => setToolsetEnabled.mutate(input)}
                    savingToolsetIds={savingToolsetIds}
                    searchPlaceholder={
                        tab === 'integrations'
                            ? 'Search Integration toolsets...'
                            : 'Search toolsets...'
                    }
                    toolsets={tab === 'integrations' ? integrationToolsets : standardToolsets}
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

const toolsetTabs: Array<{ id: ToolsetsTab; label: string }> = [
    { id: 'standard', label: 'Toolsets' },
    { id: 'integrations', label: 'Integrations' },
];

function ToolsetsTabBar({
    counts,
    onChange,
    value,
}: {
    counts: Record<ToolsetsTab, number>;
    onChange: (value: ToolsetsTab) => void;
    value: ToolsetsTab;
}) {
    return (
        <TabsSubtle
            aria-label="Filter toolsets"
            className="self-start"
            onValueChange={(nextValue) => onChange(nextValue as ToolsetsTab)}
            value={value}
        >
            <TabsSubtleList>
                {toolsetTabs.map((tab) => (
                    <TabsSubtleItem key={tab.id} size="sm" value={tab.id}>
                        <span>{tab.label}</span>
                        <span className="font-mono text-muted-foreground text-xs tabular-nums">
                            {counts[tab.id]}
                        </span>
                    </TabsSubtleItem>
                ))}
            </TabsSubtleList>
        </TabsSubtle>
    );
}
