import { CubeIcon, Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
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
        <div className="grid gap-9">
            {available.taps.map((tap) => (
                <section className="grid gap-2" key={tap.repo}>
                    <h3 className="font-semibold text-base text-foreground">{tap.repo}</h3>
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
                <h3 className="font-semibold text-base text-foreground">Built-in library</h3>
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
        <div className="grid">
            {items.map((item) => {
                const isInstalled = item.identifier in installed;

                return (
                    <div
                        className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/40"
                        key={item.identifier}
                    >
                        <button
                            className="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => onSelect(item)}
                            type="button"
                        >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border/50 bg-muted/40 text-muted-foreground">
                                <Icon className="size-5" icon={CubeIcon} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-[15px] text-foreground">
                                    {formatSkillName(item.name)}
                                </span>
                                <span className="mt-0.5 line-clamp-1 text-muted-foreground text-sm">
                                    {item.description || item.identifier}
                                </span>
                            </span>
                        </button>
                        {isInstalled ? (
                            <Icon
                                className="size-4 shrink-0 text-muted-foreground"
                                icon={Tick02Icon}
                            />
                        ) : (
                            <Button
                                className="shrink-0 rounded-full"
                                onClick={() => onSelect(item)}
                                size="sm"
                                variant="secondary"
                            >
                                Add skill
                            </Button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
