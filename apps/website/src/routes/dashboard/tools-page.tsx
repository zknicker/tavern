import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
import { SkillsPageSkeleton } from '../../features/skills/skills-page-skeleton.tsx';
import { ToolSetupDialog } from '../../features/skills/tool-setup-dialog.tsx';
import { ToolsList } from '../../features/skills/tools-list.tsx';
import { useSkillList } from '../../hooks/skills/use-skill-list.ts';
import { useToolEnabledSet } from '../../hooks/skills/use-tool-enabled-set.ts';
import type { SkillListOutput } from '../../lib/trpc.tsx';

type ToolsTab = 'plugins' | 'standard';
type ToolSummary = SkillListOutput['tools'][number];

export function ToolsPage() {
    const [tab, setTab] = React.useState<ToolsTab>('standard');
    const [setupTool, setSetupTool] = React.useState<null | ToolSummary>(null);
    const setToolEnabled = useToolEnabledSet();
    const skillsQuery = useSkillList();
    const tools = skillsQuery.data?.tools ?? [];
    const standardTools = tools.filter((tool) => !tool.plugin);
    const pluginTools = tools.filter((tool) => tool.plugin);
    const savingToolIds = React.useMemo(
        () =>
            setToolEnabled.isPending && setToolEnabled.variables
                ? new Set([setToolEnabled.variables.toolId])
                : new Set<string>(),
        [setToolEnabled.isPending, setToolEnabled.variables]
    );

    if (skillsQuery.isPending && !skillsQuery.data) {
        return <SkillsPageSkeleton />;
    }

    return (
        <div className="mx-auto w-full max-w-3xl">
            <header className="flex items-start pb-6">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground">Tools</h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Grant the agent access to runtime tools
                    </p>
                </div>
            </header>

            <section className="grid gap-4">
                <ToolsTabBar
                    counts={{
                        plugins: pluginTools.length,
                        standard: standardTools.length,
                    }}
                    onChange={setTab}
                    value={tab}
                />
                <ToolsList
                    emptyDescription={
                        tab === 'plugins'
                            ? 'Plugin tools appear here when Plugins expose agent actions.'
                            : undefined
                    }
                    emptyTitle={tab === 'plugins' ? 'No Plugin tools' : undefined}
                    onConfigure={setSetupTool}
                    onSetEnabled={(input) => setToolEnabled.mutate(input)}
                    savingToolIds={savingToolIds}
                    searchPlaceholder={
                        tab === 'plugins' ? 'Search Plugin tools...' : 'Search tools...'
                    }
                    tools={tab === 'plugins' ? pluginTools : standardTools}
                />
            </section>

            <ToolSetupDialog
                onOpenChange={(open) => {
                    if (!open) {
                        setSetupTool(null);
                    }
                }}
                tool={setupTool}
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

const toolTabs: Array<{ id: ToolsTab; label: string }> = [
    { id: 'standard', label: 'Tools' },
    { id: 'plugins', label: 'Plugins' },
];

function ToolsTabBar({
    counts,
    onChange,
    value,
}: {
    counts: Record<ToolsTab, number>;
    onChange: (value: ToolsTab) => void;
    value: ToolsTab;
}) {
    return (
        <TabsSubtle
            aria-label="Filter tools"
            className="self-start"
            onValueChange={(nextValue) => onChange(nextValue as ToolsTab)}
            value={value}
        >
            <TabsSubtleList>
                {toolTabs.map((tab) => (
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
