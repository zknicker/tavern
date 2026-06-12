import { CubeIcon, Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Badge } from '../../components/ui/badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useSkillHubAvailable } from '../../hooks/skills/use-skill-hub-available.ts';
import type { SkillHubAvailableOutput, SkillHubItemOutput } from '../../lib/trpc.tsx';
import { formatSkillName } from './skill-name-format.ts';

/**
 * Skills that could be installed, grouped by the source the user chose: tap
 * repos first, then the engine's built-in library.
 */
export function AvailableSkillsList({
    onSelect,
}: {
    onSelect: (item: SkillHubItemOutput) => void;
}) {
    const availableQuery = useSkillHubAvailable({ enabled: true });
    const available = availableQuery.data;

    if (availableQuery.isPending) {
        return (
            <div className="grid min-h-40 place-items-center">
                <Spinner className="size-5" />
            </div>
        );
    }
    if (availableQuery.error) {
        return <p className="text-error text-sm">{availableQuery.error.message}</p>;
    }
    if (!available) {
        return null;
    }

    return (
        <div className="grid gap-7">
            {available.taps.map((tap) => (
                <section className="grid gap-2" key={tap.repo}>
                    <h3 className="font-mono text-foreground text-sm">{tap.repo}</h3>
                    {tap.skills.length > 0 ? (
                        <SourceSkillRows
                            installed={available.installed}
                            items={tap.skills}
                            onSelect={onSelect}
                        />
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            No skills found under{' '}
                            <code className="font-mono text-xs">{tap.path}</code>. Check the repo
                            layout or runtime GitHub access.
                        </p>
                    )}
                </section>
            ))}

            <section className="grid gap-2">
                <header className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground text-sm">Built-in library</h3>
                    <span className="text-muted-foreground text-xs">
                        Optional skills maintained by the agent engine
                    </span>
                </header>
                {available.builtin.length > 0 ? (
                    <SourceSkillRows
                        installed={available.installed}
                        items={available.builtin}
                        onSelect={onSelect}
                    />
                ) : (
                    <p className="text-muted-foreground text-sm">
                        The engine install did not report a built-in skill library.
                    </p>
                )}
            </section>
        </div>
    );
}

function SourceSkillRows({
    installed,
    items,
    onSelect,
}: {
    installed: SkillHubAvailableOutput['installed'];
    items: SkillHubItemOutput[];
    onSelect: (item: SkillHubItemOutput) => void;
}) {
    return (
        <div className="grid gap-2">
            {items.map((item) => {
                const isInstalled = item.identifier in installed;

                return (
                    <div
                        className="flex items-center gap-3 rounded-xl border border-border/70 pr-4 transition-colors hover:border-border-strong"
                        key={item.identifier}
                    >
                        <button
                            className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => onSelect(item)}
                            type="button"
                        >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground">
                                <Icon className="size-4" icon={CubeIcon} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="truncate font-medium text-foreground text-sm">
                                    {formatSkillName(item.name)}
                                </span>
                                <span className="mt-1 line-clamp-1 block text-muted-foreground text-sm">
                                    {item.description || item.identifier}
                                </span>
                            </span>
                        </button>
                        {isInstalled ? (
                            <Badge size="sm" variant="success">
                                <Icon className="size-3" icon={Tick02Icon} />
                                Installed
                            </Badge>
                        ) : (
                            <Button onClick={() => onSelect(item)} size="sm" variant="outline">
                                Add skill
                            </Button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
