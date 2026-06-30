import { PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { FluidList, FluidListItem } from '../../components/ui/fluid-list.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { EmptyState } from '../shell/empty-state.tsx';
import { formatSkillName } from './skill-name-format.ts';

type ToolSummary = SkillListOutput['tools'][number];

export function ToolsList({
    emptyDescription,
    emptyTitle,
    onConfigure,
    onSetEnabled,
    savingToolIds,
    searchPlaceholder = 'Search tools...',
    tools,
}: {
    emptyDescription?: string;
    emptyTitle?: string;
    onConfigure: (tool: ToolSummary) => void;
    onSetEnabled: (input: { enabled: boolean; toolId: string }) => void;
    savingToolIds: Set<string>;
    searchPlaceholder?: string;
    tools: ToolSummary[];
}) {
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const visibleTools = filterTools(tools, deferredSearch);

    return (
        <div className="grid gap-2">
            <SearchInput
                aria-label="Search tools"
                className="w-full [&_[data-slot=input-control]]:h-11 [&_[data-slot=input-control]]:rounded-full"
                name="tool-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                value={search}
            />

            {visibleTools.length > 0 ? (
                <FluidList className="mt-2 grid">
                    {visibleTools.map((tool, index) => (
                        <FluidListItem className="-mx-3" index={index} key={tool.id}>
                            <ToolRow
                                onConfigure={() => onConfigure(tool)}
                                onSetEnabled={(enabled) =>
                                    onSetEnabled({ enabled, toolId: tool.id })
                                }
                                saving={savingToolIds.has(tool.id)}
                                tool={tool}
                            />
                        </FluidListItem>
                    ))}
                </FluidList>
            ) : (
                <EmptyState
                    className="py-16"
                    description={
                        search.trim().length > 0
                            ? 'Try a different name, tool, or description.'
                            : (emptyDescription ??
                              'Runtime tools will appear here when the agent engine reports them.')
                    }
                    title={search.trim().length > 0 ? 'No matches' : (emptyTitle ?? 'No tools yet')}
                />
            )}
        </div>
    );
}

function ToolRow({
    onConfigure,
    onSetEnabled,
    saving,
    tool,
}: {
    onConfigure: () => void;
    onSetEnabled: (enabled: boolean) => void;
    saving: boolean;
    tool: ToolSummary;
}) {
    const needsSetup = tool.usability === 'not_usable';
    const locked = tool.plugin !== null || tool.readOnly;

    return (
        <div className="flex select-none items-center gap-4 rounded-xl px-3 py-2.5">
            <span
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border/50 bg-muted/40 text-muted-foreground',
                    !tool.enabled && 'opacity-45'
                )}
            >
                <Icon className="size-5" icon={PlugIcon} />
            </span>
            <span className={cn('min-w-0 flex-1', !tool.enabled && 'opacity-45')}>
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-[15px] text-foreground">
                        {formatSkillName(tool.name)}
                    </span>
                    {needsSetup ? (
                        <Badge
                            className="max-w-52 justify-start truncate"
                            size="sm"
                            variant="error"
                        >
                            {tool.diagnostic ?? 'Needs setup'}
                        </Badge>
                    ) : null}
                    {tool.plugin ? (
                        <Badge size="sm" variant="secondary">
                            Plugin
                        </Badge>
                    ) : null}
                </span>
                <span className="mt-0.5 line-clamp-1 text-muted-foreground text-sm">
                    {tool.description ?? tool.id}
                </span>
            </span>
            {needsSetup && !tool.plugin ? (
                <Button
                    className="shrink-0 rounded-full"
                    onClick={onConfigure}
                    size="sm"
                    variant="secondary"
                >
                    Set up
                </Button>
            ) : null}
            {tool.readOnly ? (
                <Badge size="sm" variant="secondary">
                    Built-in
                </Badge>
            ) : null}
            <Switch
                aria-label={`${tool.enabled ? 'Disable' : 'Enable'} ${tool.name}`}
                checked={tool.enabled}
                disabled={saving || locked}
                onCheckedChange={(enabled) => {
                    if (!locked) {
                        onSetEnabled(enabled);
                    }
                }}
            />
        </div>
    );
}

function filterTools(tools: ToolSummary[], search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return tools;
    }
    return tools.filter((tool) =>
        [tool.name, tool.description, tool.diagnostic, tool.id, tool.tools.join(' ')].some(
            (value) => (value ?? '').toLowerCase().includes(normalized)
        )
    );
}
