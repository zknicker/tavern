import { AddCircleIcon, CubeIcon, PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { CardStack, CardStackItem } from '../../components/ui/card-stack.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { EmptyState } from '../shell/empty-state.tsx';

type SkillSummary = SkillListOutput['skills'][number];
type ToolsetSummary = SkillListOutput['toolsets'][number];
type CatalogItem =
    | {
          item: SkillSummary;
          kind: 'skill';
          name: string;
      }
    | {
          item: ToolsetSummary;
          kind: 'toolset';
          name: string;
      };
type CatalogFilter = 'skills' | 'toolsets';

const catalogFilters: Array<{
    id: CatalogFilter;
    label: string;
}> = [
    { id: 'skills', label: 'Skills' },
    { id: 'toolsets', label: 'Toolsets' },
];

const prettyNameOverrides = new Map<string, string>([
    ['ai', 'AI'],
    ['api', 'API'],
    ['ci', 'CI'],
    ['cli', 'CLI'],
    ['codex', 'Codex'],
    ['css', 'CSS'],
    ['csv', 'CSV'],
    ['github', 'GitHub'],
    ['html', 'HTML'],
    ['json', 'JSON'],
    ['llm', 'LLM'],
    ['mcp', 'MCP'],
    ['openai', 'OpenAI'],
    ['pdf', 'PDF'],
    ['pr', 'PR'],
    ['sdk', 'SDK'],
    ['ui', 'UI'],
    ['url', 'URL'],
]);

export function SkillsCatalog({
    onAddSkill,
    onConfigureToolset,
    onSetSkillEnabled,
    onSetToolsetEnabled,
    savingSkillIds = new Set(),
    savingToolsetIds = new Set(),
    skills,
    toolsets,
}: {
    onAddSkill?: () => void;
    onConfigureToolset?: (toolset: ToolsetSummary) => void;
    onSetSkillEnabled?: (input: { enabled: boolean; skillId: string }) => void;
    onSetToolsetEnabled?: (input: { enabled: boolean; toolsetId: string }) => void;
    savingSkillIds?: Set<string>;
    savingToolsetIds?: Set<string>;
    skills: SkillListOutput['skills'];
    toolsets: SkillListOutput['toolsets'];
}) {
    const [search, setSearch] = React.useState('');
    const [filter, setFilter] = React.useState<CatalogFilter>('skills');
    const deferredSearch = React.useDeferredValue(search);
    const items = buildCatalogItems({ skills, toolsets });
    const filteredItems = filterCatalogItemsByKind(items, filter);
    const visibleItems = filterCatalogItems(filteredItems, deferredSearch);
    const filterCounts = countCatalogFilters(items);
    const hasSearch = search.trim().length > 0;
    const searchLabel = filter === 'toolsets' ? 'Search toolsets' : 'Search skills';

    return (
        <div className="grid gap-10">
            <section>
                <BadgeDivider className="pb-4">Skills & Toolsets</BadgeDivider>
                <div className="grid gap-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                        <CatalogFilterTabs
                            counts={filterCounts}
                            onChange={setFilter}
                            value={filter}
                        />
                        <SearchInput
                            aria-label={searchLabel}
                            className="w-full xl:ml-auto xl:max-w-xs"
                            name="skill-search"
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={`${searchLabel}...`}
                            value={search}
                        />
                        {onAddSkill ? (
                            <Button className="shrink-0" onClick={onAddSkill}>
                                <Icon className="size-4" icon={AddCircleIcon} />
                                Add skill
                            </Button>
                        ) : null}
                    </div>

                    {visibleItems.length > 0 ? (
                        <CardStack>
                            {visibleItems.map((catalogItem) => (
                                <CatalogCard
                                    item={catalogItem}
                                    key={`${catalogItem.kind}:${catalogItem.item.id}`}
                                    onConfigureToolset={onConfigureToolset}
                                    onSetSkillEnabled={onSetSkillEnabled}
                                    onSetToolsetEnabled={onSetToolsetEnabled}
                                    savingSkillIds={savingSkillIds}
                                    savingToolsetIds={savingToolsetIds}
                                />
                            ))}
                        </CardStack>
                    ) : (
                        <EmptyState
                            className="py-16"
                            description={
                                hasSearch
                                    ? 'Try a different name, tool, or description.'
                                    : emptyFilterDescription(filter)
                            }
                            title={hasSearch ? 'No matches' : emptyFilterTitle(filter)}
                        />
                    )}
                </div>
            </section>
        </div>
    );
}

function CatalogFilterTabs({
    counts,
    onChange,
    value,
}: {
    counts: Record<CatalogFilter, number>;
    onChange: (value: CatalogFilter) => void;
    value: CatalogFilter;
}) {
    return (
        <div
            aria-label="Filter skills and toolsets"
            className="flex min-w-0 flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-1"
            role="tablist"
        >
            {catalogFilters.map((filter) => {
                const active = value === filter.id;

                return (
                    <button
                        aria-selected={active}
                        className={cn(
                            'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 font-medium text-muted-foreground text-sm transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active && 'bg-background text-foreground shadow-xs'
                        )}
                        key={filter.id}
                        onClick={() => onChange(filter.id)}
                        role="tab"
                        type="button"
                    >
                        <span>{filter.label}</span>
                        <span className="font-mono text-muted-foreground text-xs tabular-nums">
                            {counts[filter.id]}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export function buildCatalogItems(input: {
    skills: SkillSummary[];
    toolsets: ToolsetSummary[];
}): CatalogItem[] {
    return [
        ...input.skills.map((skill) => ({
            item: skill,
            kind: 'skill' as const,
            name: formatCatalogName(skill.name),
        })),
        ...input.toolsets.map((toolset) => ({
            item: toolset,
            kind: 'toolset' as const,
            name: formatCatalogName(toolset.name),
        })),
    ].sort((left, right) => left.name.localeCompare(right.name));
}

export function filterCatalogItems(items: CatalogItem[], search: string) {
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch.length === 0) {
        return items;
    }

    return items.filter((catalogItem) =>
        [
            catalogItem.kind,
            catalogItem.name,
            catalogItem.item.name,
            catalogItem.item.description,
            catalogItem.item.diagnostic,
            catalogItem.item.id,
            catalogItem.kind === 'toolset' ? catalogItem.item.tools.join(' ') : null,
        ].some((value) => (value ?? '').toLowerCase().includes(normalizedSearch))
    );
}

function filterCatalogItemsByKind(items: CatalogItem[], filter: CatalogFilter) {
    return items.filter((item) => item.kind === (filter === 'toolsets' ? 'toolset' : 'skill'));
}

function countCatalogFilters(items: CatalogItem[]): Record<CatalogFilter, number> {
    return {
        skills: items.filter((item) => item.kind === 'skill').length,
        toolsets: items.filter((item) => item.kind === 'toolset').length,
    };
}

function isReadyItem(item: CatalogItem) {
    if (item.kind === 'skill') {
        return item.item.enabled && item.item.dependencyState === 'ready';
    }
    return item.item.enabled && item.item.usability === 'enabled';
}

function isSetupNeededItem(item: CatalogItem) {
    if (item.kind === 'skill') {
        return item.item.enabled && item.item.dependencyState === 'missing';
    }
    return item.item.enabled && item.item.usability === 'not_usable';
}

function formatCatalogStatus(item: CatalogItem) {
    if (item.kind === 'skill') {
        if (!item.item.enabled) {
            return null;
        }
        if (item.item.dependencyState === 'ready') {
            return null;
        }
        if (item.item.dependencyState === 'unknown') {
            return 'Unknown';
        }
        return (
            item.item.diagnostic ?? formatMissingRequirements(item.item.missing) ?? 'Needs setup'
        );
    }

    if (!item.item.enabled) {
        return null;
    }
    if (item.item.usability === 'enabled') {
        return null;
    }
    return item.item.diagnostic ?? 'Needs setup';
}

function catalogStatusVariant(item: CatalogItem): React.ComponentProps<typeof Badge>['variant'] {
    if (isReadyItem(item)) {
        return 'success';
    }
    if (isSetupNeededItem(item)) {
        return 'error';
    }
    return 'secondary';
}

function formatMissingRequirements(requirements: SkillSummary['missing']) {
    const missing = [
        ...requirements.bins.map((value) => `bin ${value}`),
        ...requirements.anyBins.map((value) => `any bin ${value}`),
        ...requirements.env.map((value) => `env ${value}`),
        ...requirements.config.map((value) => `config ${value}`),
        ...requirements.os.map((value) => `os ${value}`),
    ];

    return missing.length > 0 ? `Missing ${missing.join(', ')}` : null;
}

export function formatCatalogName(name: string) {
    const normalizedName = normalizeQualifiedCatalogName(name);

    return normalizedName
        .split(/[-_\s]+/u)
        .filter(Boolean)
        .map(formatCatalogNamePart)
        .join(' ');
}

function normalizeQualifiedCatalogName(name: string) {
    const [prefix, ...rest] = name.split(':');
    if (!prefix || rest.length === 0) {
        return name;
    }

    const suffix = rest.join(':');
    return normalizeCatalogNameToken(prefix) === normalizeCatalogNameToken(suffix) ? suffix : name;
}

function normalizeCatalogNameToken(name: string) {
    return name
        .split(/[-_\s:]+/u)
        .filter(Boolean)
        .map((part) => part.toLowerCase())
        .join(' ');
}

function formatCatalogNamePart(part: string) {
    const lower = part.toLowerCase();
    return prettyNameOverrides.get(lower) ?? `${lower[0]?.toUpperCase() ?? ''}${lower.slice(1)}`;
}

function emptyFilterTitle(filter: CatalogFilter) {
    return filter === 'toolsets' ? 'No toolsets yet' : 'No skills yet';
}

function emptyFilterDescription(filter: CatalogFilter) {
    if (filter === 'toolsets') {
        return 'Runtime toolsets will appear here when the agent engine reports them.';
    }
    return 'Runtime-visible skills will appear here when the agent engine reports them.';
}

function CatalogCard({
    item,
    onConfigureToolset,
    onSetSkillEnabled,
    onSetToolsetEnabled,
    savingSkillIds,
    savingToolsetIds,
}: {
    item: CatalogItem;
    onConfigureToolset?: (toolset: ToolsetSummary) => void;
    onSetSkillEnabled?: (input: { enabled: boolean; skillId: string }) => void;
    onSetToolsetEnabled?: (input: { enabled: boolean; toolsetId: string }) => void;
    savingSkillIds: Set<string>;
    savingToolsetIds: Set<string>;
}) {
    const isSkill = item.kind === 'skill';
    const savingSkill = isSkill && savingSkillIds.has(item.item.id);
    const savingToolset = !isSkill && savingToolsetIds.has(item.item.id);
    const status = formatCatalogStatus(item);

    return (
        <CardStackItem
            actions={
                isSkill ? (
                    <Switch
                        aria-label={`${item.item.enabled ? 'Disable' : 'Enable'} ${item.name}`}
                        checked={item.item.enabled}
                        disabled={savingSkill || !onSetSkillEnabled}
                        onCheckedChange={(checked) =>
                            onSetSkillEnabled?.({ enabled: checked, skillId: item.item.id })
                        }
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {onConfigureToolset && item.item.usability === 'not_usable' ? (
                            <Button
                                onClick={() => onConfigureToolset(item.item)}
                                size="sm"
                                variant="outline"
                            >
                                Set up
                            </Button>
                        ) : null}
                        <Switch
                            aria-label={`${item.item.enabled ? 'Disable' : 'Enable'} ${item.name}`}
                            checked={item.item.enabled}
                            disabled={savingToolset || !onSetToolsetEnabled}
                            onCheckedChange={(checked) =>
                                onSetToolsetEnabled?.({ enabled: checked, toolsetId: item.item.id })
                            }
                        />
                    </div>
                )
            }
        >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground">
                <Icon className="size-4" icon={isSkill ? CubeIcon : PlugIcon} />
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-foreground text-sm">{item.name}</p>
                        <Badge size="sm" variant="secondary">
                            {isSkill ? 'Skill' : 'Toolset'}
                        </Badge>
                    </div>
                    <p className="mt-1 truncate text-muted-foreground text-sm">
                        {item.item.description ?? item.item.id}
                    </p>
                </div>

                {status ? (
                    <div className="hidden shrink-0 items-center gap-3 text-muted-foreground text-sm md:flex">
                        <Badge
                            className="max-w-52 justify-start truncate"
                            size="sm"
                            variant={catalogStatusVariant(item)}
                        >
                            {status}
                        </Badge>
                    </div>
                ) : null}
            </div>
        </CardStackItem>
    );
}
