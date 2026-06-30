import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useMcpCatalog, useMcpCatalogInstall } from '../../hooks/skills/use-mcp-catalog.ts';
import type { McpCatalogOutput } from '../../lib/trpc.tsx';
import { EmptyState } from '../shell/empty-state.tsx';

type McpCatalogEntry = McpCatalogOutput['entries'][number];

export function McpCatalogList({ open }: { open: boolean }) {
    const catalogQuery = useMcpCatalog({ enabled: open });
    const [expandedName, setExpandedName] = React.useState<null | string>(null);

    if (catalogQuery.isPending) {
        return (
            <div className="grid min-h-40 place-items-center">
                <Spinner className="size-5" />
            </div>
        );
    }
    if (catalogQuery.error) {
        return <p className="text-error text-sm">{catalogQuery.error.message}</p>;
    }

    const entries = catalogQuery.data?.entries ?? [];
    if (entries.length === 0) {
        return (
            <EmptyState
                className="py-12"
                description="The runtime did not report any catalog MCP servers."
                title="No catalog entries"
            />
        );
    }

    return (
        <div className="grid gap-2">
            {entries.map((entry) => (
                <CatalogEntryCard
                    entry={entry}
                    expanded={expandedName === entry.name}
                    key={entry.name}
                    onToggleExpanded={(next) => setExpandedName(next ? entry.name : null)}
                />
            ))}
        </div>
    );
}

function CatalogEntryCard({
    entry,
    expanded,
    onToggleExpanded,
}: {
    entry: McpCatalogEntry;
    expanded: boolean;
    onToggleExpanded: (expanded: boolean) => void;
}) {
    const install = useMcpCatalogInstall();
    const [env, setEnv] = React.useState<Record<string, string>>({});
    const requiredKeys = entry.requiredEnv.filter((envVar) => envVar.required);
    const missingRequired = requiredKeys.some((envVar) => !(env[envVar.name] ?? '').trim());

    const handleInstall = () => {
        if (entry.requiredEnv.length > 0 && !expanded) {
            onToggleExpanded(true);
            return;
        }
        install.mutate(
            {
                enable: true,
                env: Object.fromEntries(
                    Object.entries(env).filter(([, value]) => value.trim().length > 0)
                ),
                name: entry.name,
            },
            { onSuccess: () => onToggleExpanded(false) }
        );
    };

    return (
        <div className="grid gap-3 rounded-xl border border-border/70 px-4 py-3">
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-foreground text-sm">{entry.name}</p>
                        <Badge size="sm" variant="subtle">
                            {entry.transport}
                        </Badge>
                        {entry.installed ? (
                            <Badge size="sm" variant="success">
                                Installed
                            </Badge>
                        ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                        {entry.description}
                    </p>
                </div>
                {entry.installed ? null : (
                    <Button
                        disabled={install.isPending || (expanded && missingRequired)}
                        onClick={handleInstall}
                        size="sm"
                        variant="outline"
                    >
                        {install.isPending ? <Spinner className="size-4" /> : null}
                        {install.isPending ? 'Installing…' : 'Install'}
                    </Button>
                )}
            </div>

            {expanded && entry.requiredEnv.length > 0 ? (
                <div className="grid gap-2">
                    {entry.requiredEnv.map((envVar) => (
                        <label className="grid gap-1" key={envVar.name}>
                            <span className="text-foreground text-sm">{envVar.prompt}</span>
                            <Input
                                autoComplete="off"
                                onChange={(event) =>
                                    setEnv((previous) => ({
                                        ...previous,
                                        [envVar.name]: event.target.value,
                                    }))
                                }
                                placeholder={envVar.name}
                                type="password"
                                value={env[envVar.name] ?? ''}
                            />
                        </label>
                    ))}
                </div>
            ) : null}

            {install.error ? <p className="text-error text-sm">{install.error.message}</p> : null}
        </div>
    );
}
