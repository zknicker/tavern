import { CubeIcon, Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Badge } from '../../components/ui/badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { SkillHubCatalogOutput, SkillHubItemOutput } from '../../lib/trpc.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import { formatSkillSourceLabel, SkillTrustBadge } from './skill-hub-badges.tsx';

export function SkillHubItemList({
    installed,
    items,
    onSelect,
}: {
    installed: SkillHubCatalogOutput['installed'];
    items: SkillHubItemOutput[];
    onSelect: (item: SkillHubItemOutput) => void;
}) {
    if (items.length === 0) {
        return (
            <EmptyState
                className="py-12"
                description="Try a different skill name or topic."
                title="No skills found"
            />
        );
    }

    return (
        <div className="grid gap-2">
            {items.map((item) => {
                const isInstalled = item.identifier in installed;

                return (
                    <button
                        className="flex items-start gap-3 rounded-xl border border-border/70 px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        key={`${item.source}:${item.identifier}`}
                        onClick={() => onSelect(item)}
                        type="button"
                    >
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground">
                            <Icon className="size-4" icon={CubeIcon} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate font-medium text-foreground text-sm">
                                    {item.name}
                                </span>
                                <SkillTrustBadge trustLevel={item.trustLevel} />
                                <Badge size="sm" variant="secondary">
                                    {formatSkillSourceLabel(item.source)}
                                </Badge>
                                {isInstalled ? (
                                    <Badge size="sm" variant="success">
                                        <Icon className="size-3" icon={Tick02Icon} />
                                        Installed
                                    </Badge>
                                ) : null}
                            </span>
                            <span className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                                {item.description || item.identifier}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
