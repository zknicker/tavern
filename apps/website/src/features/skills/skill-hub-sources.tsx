import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import {
    useSkillHubTapAdd,
    useSkillHubTapRemove,
    useSkillHubTaps,
} from '../../hooks/skills/use-skill-hub-taps.ts';
import type { SkillHubCatalogOutput } from '../../lib/trpc.tsx';

export function SkillHubSources({ catalog }: { catalog: SkillHubCatalogOutput | undefined }) {
    const tapsQuery = useSkillHubTaps({ enabled: true });
    const addTap = useSkillHubTapAdd();
    const removeTap = useSkillHubTapRemove();
    const [repo, setRepo] = React.useState('');
    const taps = tapsQuery.data?.taps ?? [];
    const canAdd = /^[\w.-]+\/[\w.-]+$/u.test(repo.trim());

    return (
        <div className="grid gap-5">
            <section className="grid gap-2">
                <h3 className="font-medium text-foreground text-sm">Catalog sources</h3>
                <div className="flex flex-wrap gap-1.5">
                    {(catalog?.sources ?? []).map((source) => (
                        <Badge key={source.id} size="sm" variant="subtle">
                            {source.label}
                            {source.available === false || source.rateLimited === true
                                ? ' (limited)'
                                : ''}
                        </Badge>
                    ))}
                </div>
            </section>

            <section className="grid gap-2">
                <h3 className="font-medium text-foreground text-sm">Your GitHub repos</h3>
                <p className="text-muted-foreground text-sm">
                    Add a GitHub repo with a <code className="font-mono text-xs">skills/</code>{' '}
                    folder to search and install its skills, including private repos the runtime can
                    access.
                </p>
                {taps.map((tap) => (
                    <div
                        className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-2.5"
                        key={tap.repo}
                    >
                        <span className="min-w-0 flex-1 truncate font-mono text-foreground text-sm">
                            {tap.repo}
                        </span>
                        <Button
                            disabled={removeTap.isPending}
                            onClick={() => removeTap.mutate({ repo: tap.repo })}
                            size="sm"
                            variant="ghost"
                        >
                            Remove
                        </Button>
                    </div>
                ))}
                <form
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!canAdd) {
                            return;
                        }
                        addTap.mutate(
                            { path: 'skills/', repo: repo.trim() },
                            { onSuccess: () => setRepo('') }
                        );
                    }}
                >
                    <Input
                        aria-label="GitHub repository"
                        className="flex-1"
                        onChange={(event) => setRepo(event.target.value)}
                        placeholder="owner/repo"
                        value={repo}
                    />
                    <Button disabled={!canAdd || addTap.isPending} type="submit" variant="outline">
                        {addTap.isPending ? 'Adding…' : 'Add repo'}
                    </Button>
                </form>
                {addTap.error ? <p className="text-error text-sm">{addTap.error.message}</p> : null}
                {removeTap.error ? (
                    <p className="text-error text-sm">{removeTap.error.message}</p>
                ) : null}
            </section>
        </div>
    );
}
