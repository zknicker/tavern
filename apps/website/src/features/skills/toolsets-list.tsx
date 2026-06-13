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

type ToolsetSummary = SkillListOutput['toolsets'][number];

export function ToolsetsList({
    onConfigure,
    onSetEnabled,
    savingToolsetIds,
    toolsets,
}: {
    onConfigure: (toolset: ToolsetSummary) => void;
    onSetEnabled: (input: { enabled: boolean; toolsetId: string }) => void;
    savingToolsetIds: Set<string>;
    toolsets: ToolsetSummary[];
}) {
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const visibleToolsets = filterToolsets(toolsets, deferredSearch);

    return (
        <div className="grid gap-2">
            <SearchInput
                aria-label="Search toolsets"
                className="w-full [&_[data-slot=input-control]]:h-11 [&_[data-slot=input-control]]:rounded-full"
                name="toolset-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search toolsets..."
                value={search}
            />

            {visibleToolsets.length > 0 ? (
                <FluidList className="mt-2 grid">
                    {visibleToolsets.map((toolset, index) => (
                        <FluidListItem className="-mx-3" index={index} key={toolset.id}>
                            <ToolsetRow
                                onConfigure={() => onConfigure(toolset)}
                                onSetEnabled={(enabled) =>
                                    onSetEnabled({ enabled, toolsetId: toolset.id })
                                }
                                saving={savingToolsetIds.has(toolset.id)}
                                toolset={toolset}
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
                            : 'Runtime toolsets will appear here when the agent engine reports them.'
                    }
                    title={search.trim().length > 0 ? 'No matches' : 'No toolsets yet'}
                />
            )}
        </div>
    );
}

function ToolsetRow({
    onConfigure,
    onSetEnabled,
    saving,
    toolset,
}: {
    onConfigure: () => void;
    onSetEnabled: (enabled: boolean) => void;
    saving: boolean;
    toolset: ToolsetSummary;
}) {
    const needsSetup = toolset.usability === 'not_usable';

    return (
        <div className="flex items-center gap-4 rounded-xl px-3 py-2.5">
            <span
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border/50 bg-muted/40 text-muted-foreground',
                    !toolset.enabled && 'opacity-45'
                )}
            >
                <Icon className="size-5" icon={PlugIcon} />
            </span>
            <span className={cn('min-w-0 flex-1', !toolset.enabled && 'opacity-45')}>
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-[15px] text-foreground">
                        {formatSkillName(toolset.name)}
                    </span>
                    {needsSetup ? (
                        <Badge
                            className="max-w-52 justify-start truncate"
                            size="sm"
                            variant="error"
                        >
                            {toolset.diagnostic ?? 'Needs setup'}
                        </Badge>
                    ) : null}
                </span>
                <span className="mt-0.5 line-clamp-1 text-muted-foreground text-sm">
                    {toolset.description ?? toolset.id}
                </span>
            </span>
            {needsSetup ? (
                <Button
                    className="shrink-0 rounded-full"
                    onClick={onConfigure}
                    size="sm"
                    variant="secondary"
                >
                    Set up
                </Button>
            ) : null}
            <Switch
                aria-label={`${toolset.enabled ? 'Disable' : 'Enable'} ${toolset.name}`}
                checked={toolset.enabled}
                disabled={saving}
                onCheckedChange={onSetEnabled}
            />
        </div>
    );
}

function filterToolsets(toolsets: ToolsetSummary[], search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return toolsets;
    }
    return toolsets.filter((toolset) =>
        [
            toolset.name,
            toolset.description,
            toolset.diagnostic,
            toolset.id,
            toolset.tools.join(' '),
        ].some((value) => (value ?? '').toLowerCase().includes(normalized))
    );
}
