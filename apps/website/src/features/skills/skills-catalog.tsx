import { CubeIcon, PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { CardStack, CardStackItem } from '../../components/ui/card-stack.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { EmptyState } from '../shell/empty-state.tsx';

type SkillSummary = SkillListOutput['skills'][number];
type PluginSummary = SkillListOutput['plugins'][number];
type CatalogItem =
    | {
          item: SkillSummary;
          kind: 'skill';
          name: string;
      }
    | {
          item: PluginSummary;
          kind: 'plugin';
          name: string;
      };
type CatalogFilter = 'all' | 'plugins' | 'skills';

const catalogFilters: Array<{
    id: CatalogFilter;
    label: string;
}> = [
    { id: 'all', label: 'All' },
    { id: 'skills', label: 'Skills' },
    { id: 'plugins', label: 'Plugins' },
];

const hiddenCatalogPluginIds = new Set(['tavern-cortex', 'tavern-workspace']);

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
    onOpenSkill,
    plugins,
    skills,
}: {
    onOpenSkill: (skillId: string) => void;
    plugins: SkillListOutput['plugins'];
    skills: SkillListOutput['skills'];
}) {
    const [search, setSearch] = React.useState('');
    const [filter, setFilter] = React.useState<CatalogFilter>('all');
    const deferredSearch = React.useDeferredValue(search);
    const items = buildCatalogItems({ plugins, skills });
    const filteredItems = filterCatalogItemsByKind(items, filter);
    const visibleItems = filterCatalogItems(filteredItems, deferredSearch);
    const filterCounts = countCatalogFilters(items);
    const hasSearch = search.trim().length > 0;

    return (
        <div className="grid gap-10">
            <section>
                <BadgeDivider className="pb-4">Skills & Plugins</BadgeDivider>
                <div className="grid gap-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                        <CatalogFilterTabs
                            counts={filterCounts}
                            onChange={setFilter}
                            value={filter}
                        />
                        <SearchInput
                            aria-label="Search skills and plugins"
                            className="w-full xl:ml-auto xl:max-w-xs"
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
            aria-label="Filter skills and plugins"
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
    plugins: PluginSummary[];
    skills: SkillSummary[];
}): CatalogItem[] {
    return [
        ...input.skills.map((skill) => ({
            item: skill,
            kind: 'skill' as const,
            name: formatCatalogName(skill.name),
        })),
        ...input.plugins
            .filter((plugin) => !hiddenCatalogPluginIds.has(plugin.id))
            .map((plugin) => ({
                item: plugin,
                kind: 'plugin' as const,
                name: formatCatalogName(plugin.name),
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
            catalogItem.kind === 'skill' ? catalogItem.item.surface : null,
            catalogItem.kind === 'plugin' ? catalogItem.item.source : null,
            isCodexOnlyCatalogItem(catalogItem) ? 'codex only' : null,
        ].some((value) => (value ?? '').toLowerCase().includes(normalizedSearch))
    );
}

function filterCatalogItemsByKind(items: CatalogItem[], filter: CatalogFilter) {
    if (filter === 'all') {
        return items;
    }
    if (filter === 'plugins') {
        return items.filter((item) => item.kind === 'plugin');
    }
    return items.filter((item) => item.kind === 'skill');
}

function countCatalogFilters(items: CatalogItem[]): Record<CatalogFilter, number> {
    return {
        all: items.length,
        plugins: items.filter((item) => item.kind === 'plugin').length,
        skills: items.filter((item) => item.kind === 'skill').length,
    };
}

function isReadyItem(item: CatalogItem) {
    if (item.kind === 'skill') {
        return item.item.dependencyState === 'ready';
    }
    return item.item.usability === 'enabled';
}

function isSetupNeededItem(item: CatalogItem) {
    if (item.kind === 'skill') {
        return item.item.dependencyState === 'missing';
    }
    return item.item.usability === 'not_usable';
}

function formatCatalogStatus(item: CatalogItem) {
    if (item.kind === 'skill') {
        if (item.item.dependencyState === 'ready') {
            return 'Ready';
        }
        if (item.item.dependencyState === 'unknown') {
            return 'Checking';
        }
        return (
            item.item.diagnostic ?? formatMissingRequirements(item.item.missing) ?? 'Needs setup'
        );
    }

    if (item.item.usability === 'enabled') {
        return 'Ready';
    }
    if (item.item.usability === 'disabled') {
        return 'Off';
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
    if (filter === 'plugins') {
        return 'No plugins yet';
    }
    if (filter === 'skills') {
        return 'No skills yet';
    }
    return 'No skills or plugins yet';
}

function emptyFilterDescription(filter: CatalogFilter) {
    if (filter === 'plugins') {
        return 'Runtime plugin capabilities will appear here when OpenClaw reports them.';
    }
    if (filter === 'skills') {
        return 'Runtime-visible skills will appear here when OpenClaw reports them.';
    }
    return 'No runtime-visible skills or plugins were found.';
}

function CatalogCard({
    item,
    onOpenSkill,
}: {
    item: CatalogItem;
    onOpenSkill: (skillId: string) => void;
}) {
    const isSkill = item.kind === 'skill';
    const canOpenSkill = isSkill && item.item.surface === 'openclaw';
    const isCodexOnly = isCodexOnlyCatalogItem(item);

    return (
        <CardStackItem
            onOpen={canOpenSkill ? () => onOpenSkill(item.item.id) : undefined}
            openLabel={`Open ${item.name}`}
        >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground">
                <Icon className="size-4" icon={isSkill ? CubeIcon : PlugIcon} />
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-foreground text-sm">{item.name}</p>
                        <Badge size="sm" variant="secondary">
                            {isSkill ? 'Skill' : 'Plugin'}
                        </Badge>
                        {isCodexOnly ? (
                            <Badge size="sm" variant="info">
                                Codex only
                            </Badge>
                        ) : null}
                    </div>
                    <p className="mt-1 truncate text-muted-foreground text-sm">
                        {item.item.description ?? item.item.id}
                    </p>
                </div>

                <div className="hidden shrink-0 items-center gap-3 text-muted-foreground text-sm md:flex">
                    <Badge
                        className="max-w-52 justify-start truncate"
                        size="sm"
                        variant={catalogStatusVariant(item)}
                    >
                        {formatCatalogStatus(item)}
                    </Badge>
                </div>
            </div>
        </CardStackItem>
    );
}

function isCodexOnlyCatalogItem(item: CatalogItem) {
    if (item.kind === 'skill') {
        return item.item.surface === 'codex';
    }
    return item.item.source === 'Codex';
}
