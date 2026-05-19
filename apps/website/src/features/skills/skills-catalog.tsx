import { CubeIcon, PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { CardStack, CardStackItem } from '../../components/ui/card-stack.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { EmptyState } from '../shell/empty-state.tsx';

type SkillSummary = SkillListOutput['skills'][number];
type PluginSummary = SkillListOutput['plugins'][number];
type CatalogItem =
    | {
          item: SkillSummary;
          kind: 'skill';
      }
    | {
          item: PluginSummary;
          kind: 'plugin';
      };

export function SkillsCatalog({
    onOpenSkill,
    plugins,
    skills,
}: {
    onOpenSkill: (skillId: string) => void;
    plugins: SkillListOutput['plugins'];
    skills: SkillListOutput['skills'];
}) {
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const items = buildCatalogItems({ plugins, skills });
    const visibleItems = filterCatalogItems(items, deferredSearch);
    const hasSearch = search.trim().length > 0;

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <ScrollArea className="flex-1">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="text-muted-foreground text-sm tabular-nums">
                            {items.length} skills & plugins
                        </div>
                        <SearchInput
                            aria-label="Search skills and plugins"
                            className="w-full sm:ml-auto sm:max-w-xs"
                            name="skill-search"
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search skills and plugins..."
                            value={search}
                        />
                    </div>

                    {visibleItems.length > 0 ? (
                        <CardStack>
                            {visibleItems.map((catalogItem) => (
                                <CatalogCard
                                    item={catalogItem}
                                    key={`${catalogItem.kind}:${catalogItem.item.id}`}
                                    onOpenSkill={onOpenSkill}
                                />
                            ))}
                        </CardStack>
                    ) : (
                        <EmptyState
                            className="py-16"
                            description={
                                hasSearch
                                    ? 'Try a different name, source, or description.'
                                    : 'No runtime-visible skills or plugins were found.'
                            }
                            title={hasSearch ? 'No matches' : 'No skills or plugins yet'}
                        />
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

export function buildCatalogItems(input: {
    plugins: PluginSummary[];
    skills: SkillSummary[];
}): CatalogItem[] {
    return [
        ...input.skills.map((skill) => ({
            item: skill,
            kind: 'skill' as const,
        })),
        ...input.plugins.map((plugin) => ({
            item: plugin,
            kind: 'plugin' as const,
        })),
    ].sort((left, right) => left.item.name.localeCompare(right.item.name));
}

export function filterCatalogItems(items: CatalogItem[], search: string) {
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch.length === 0) {
        return items;
    }

    return items.filter((catalogItem) =>
        [
            catalogItem.kind,
            catalogItem.item.name,
            catalogItem.item.description,
            catalogItem.item.id,
            catalogItem.kind === 'plugin' ? catalogItem.item.source : null,
        ].some((value) => (value ?? '').toLowerCase().includes(normalizedSearch))
    );
}

function formatUsability(item: CatalogItem) {
    if (item.item.usability === 'enabled') {
        return 'Enabled';
    }
    if (item.item.usability === 'disabled') {
        return 'Disabled';
    }
    return 'Not usable';
}

function usabilityVariant(item: CatalogItem): React.ComponentProps<typeof Badge>['variant'] {
    if (item.item.usability === 'enabled') {
        return 'success';
    }
    if (item.item.usability === 'not_usable') {
        return 'error';
    }
    return 'secondary';
}

function CatalogCard({
    item,
    onOpenSkill,
}: {
    item: CatalogItem;
    onOpenSkill: (skillId: string) => void;
}) {
    const isSkill = item.kind === 'skill';

    return (
        <CardStackItem
            onOpen={isSkill ? () => onOpenSkill(item.item.id) : undefined}
            openLabel={`Open ${item.item.name}`}
        >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground">
                <Icon className="size-4" icon={isSkill ? CubeIcon : PlugIcon} />
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-foreground text-sm">
                            {item.item.name}
                        </p>
                        <Badge size="sm" variant="secondary">
                            {isSkill ? 'Skill' : 'Plugin'}
                        </Badge>
                    </div>
                    <p className="mt-1 truncate text-muted-foreground text-sm">
                        {item.item.description ?? item.item.id}
                    </p>
                </div>

                <div className="hidden shrink-0 items-center gap-3 text-muted-foreground text-sm md:flex">
                    <Badge size="sm" variant={usabilityVariant(item)}>
                        {formatUsability(item)}
                    </Badge>
                    {item.kind === 'plugin' ? (
                        <span className="max-w-36 truncate">{item.item.source}</span>
                    ) : null}
                </div>
            </div>
        </CardStackItem>
    );
}
