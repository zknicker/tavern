import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useSkillHubCatalog } from '../../hooks/skills/use-skill-hub-catalog.ts';
import { useSkillHubSearch } from '../../hooks/skills/use-skill-hub-search.ts';
import { useSkillHubTaps } from '../../hooks/skills/use-skill-hub-taps.ts';
import type { SkillHubItemOutput } from '../../lib/trpc.tsx';
import { SkillHubItemList } from './skill-hub-item-list.tsx';
import { SkillHubPreview } from './skill-hub-preview.tsx';
import { SkillHubSources } from './skill-hub-sources.tsx';

export function SkillBrowse() {
    const [search, setSearch] = React.useState('');
    const [showSources, setShowSources] = React.useState(false);
    const [selected, setSelected] = React.useState<null | SkillHubItemOutput>(null);
    const deferredSearch = React.useDeferredValue(search);
    const catalogQuery = useSkillHubCatalog({ enabled: true });
    const searchQuery = useSkillHubSearch({ query: deferredSearch });
    const tapsQuery = useSkillHubTaps({ enabled: true });
    const hasSearch = deferredSearch.trim().length > 0;
    const installed = {
        ...catalogQuery.data?.installed,
        ...searchQuery.data?.installed,
    };
    const tapRepos = new Set((tapsQuery.data?.taps ?? []).map((tap) => tap.repo));
    const items = hasSearch
        ? (searchQuery.data?.results ?? [])
        : (catalogQuery.data?.featured ?? []);
    const isTapItem = (item: SkillHubItemOutput) =>
        typeof item.repo === 'string' && tapRepos.has(item.repo);
    const tapItems = items.filter((item) => isTapItem(item));
    const popularItems = items.filter((item) => !isTapItem(item));
    const loading = hasSearch ? searchQuery.isPending : catalogQuery.isPending;
    const error = hasSearch ? searchQuery.error : catalogQuery.error;

    return (
        <div className="grid gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <SearchInput
                    aria-label="Search the skill catalog"
                    className="w-full sm:max-w-md"
                    name="skill-browse-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search the skill catalog..."
                    value={search}
                />
                <Button
                    className="shrink-0 sm:ml-auto"
                    onClick={() => setShowSources((previous) => !previous)}
                    variant={showSources ? 'secondary' : 'outline'}
                >
                    Sources
                </Button>
            </div>

            {showSources ? (
                <div className="rounded-xl border border-border/70 px-4 py-4">
                    <SkillHubSources catalog={catalogQuery.data} />
                </div>
            ) : null}

            {loading ? (
                <div className="grid min-h-40 place-items-center">
                    <Spinner className="size-5" />
                </div>
            ) : error ? (
                <p className="text-error text-sm">{error.message}</p>
            ) : (
                <div className="grid gap-6">
                    {tapItems.length > 0 ? (
                        <section className="grid gap-2">
                            <h3 className="font-medium text-foreground text-sm">From your repos</h3>
                            <SkillHubItemList
                                installed={installed}
                                items={tapItems}
                                onSelect={setSelected}
                            />
                        </section>
                    ) : null}

                    <section className="grid gap-2">
                        <h3 className="font-medium text-foreground text-sm">
                            {hasSearch ? 'Results' : 'Popular skills'}
                        </h3>
                        <SkillHubItemList
                            installed={installed}
                            items={popularItems}
                            onSelect={setSelected}
                        />
                    </section>
                </div>
            )}

            <Dialog
                onOpenChange={(open) => {
                    if (!open) {
                        setSelected(null);
                    }
                }}
                open={selected !== null}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selected?.name ?? 'Skill'}</DialogTitle>
                        <DialogDescription>
                            Review the skill before installing it.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogPanel>
                        {selected ? (
                            <SkillHubPreview installed={installed} item={selected} />
                        ) : null}
                    </DialogPanel>
                </DialogContent>
            </Dialog>
        </div>
    );
}
