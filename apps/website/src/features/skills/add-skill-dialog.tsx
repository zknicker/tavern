import { ArrowLeft01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useSkillHubCatalog } from '../../hooks/skills/use-skill-hub-catalog.ts';
import { useSkillHubSearch } from '../../hooks/skills/use-skill-hub-search.ts';
import type { SkillHubItemOutput } from '../../lib/trpc.tsx';
import { SkillHubItemList } from './skill-hub-item-list.tsx';
import { SkillHubPreview } from './skill-hub-preview.tsx';
import { SkillHubSources } from './skill-hub-sources.tsx';

type HubView = 'browse' | 'sources';

export function AddSkillDialog({
    onOpenChange,
    open,
}: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const [view, setView] = React.useState<HubView>('browse');
    const [search, setSearch] = React.useState('');
    const [selected, setSelected] = React.useState<SkillHubItemOutput | null>(null);
    const deferredSearch = React.useDeferredValue(search);
    const catalogQuery = useSkillHubCatalog({ enabled: open });
    const searchQuery = useSkillHubSearch({ query: open ? deferredSearch : '' });
    const hasSearch = deferredSearch.trim().length > 0;
    const items = hasSearch
        ? (searchQuery.data?.results ?? [])
        : (catalogQuery.data?.featured ?? []);
    const installed = {
        ...catalogQuery.data?.installed,
        ...searchQuery.data?.installed,
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setSelected(null);
            setSearch('');
            setView('browse');
        }
        onOpenChange(next);
    };

    return (
        <Dialog onOpenChange={handleOpenChange} open={open}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{selected ? selected.name : 'Add skill'}</DialogTitle>
                    <DialogDescription>
                        {selected
                            ? 'Review the skill before installing it.'
                            : 'Search the skill catalog or add skills from your own repos.'}
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel className="grid gap-4">
                    {selected ? (
                        <>
                            <div>
                                <Button onClick={() => setSelected(null)} size="sm" variant="ghost">
                                    <Icon className="size-4" icon={ArrowLeft01Icon} />
                                    Back to results
                                </Button>
                            </div>
                            <SkillHubPreview installed={installed} item={selected} />
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <SearchInput
                                    aria-label="Search the skill catalog"
                                    autoFocus
                                    className="flex-1"
                                    name="skill-hub-search"
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search skills..."
                                    value={search}
                                />
                                <ViewTabs onChange={setView} value={view} />
                            </div>

                            {view === 'sources' ? (
                                <SkillHubSources catalog={catalogQuery.data} />
                            ) : (
                                <BrowseResults
                                    error={
                                        (hasSearch ? searchQuery.error : catalogQuery.error)
                                            ?.message ?? null
                                    }
                                    hasSearch={hasSearch}
                                    installed={installed}
                                    items={items}
                                    loading={
                                        hasSearch ? searchQuery.isPending : catalogQuery.isPending
                                    }
                                    onSelect={setSelected}
                                />
                            )}
                        </>
                    )}
                </DialogPanel>
            </DialogContent>
        </Dialog>
    );
}

function ViewTabs({ onChange, value }: { onChange: (view: HubView) => void; value: HubView }) {
    return (
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
            {(
                [
                    { id: 'browse', label: 'Browse' },
                    { id: 'sources', label: 'Sources' },
                ] as const
            ).map((tab) => (
                <button
                    className={`h-8 rounded-md px-3 font-medium text-sm transition-colors ${
                        value === tab.id
                            ? 'bg-background text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    type="button"
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

function BrowseResults({
    error,
    hasSearch,
    installed,
    items,
    loading,
    onSelect,
}: {
    error: null | string;
    hasSearch: boolean;
    installed: React.ComponentProps<typeof SkillHubItemList>['installed'];
    items: SkillHubItemOutput[];
    loading: boolean;
    onSelect: (item: SkillHubItemOutput) => void;
}) {
    if (loading) {
        return (
            <div className="grid min-h-40 place-items-center">
                <Spinner className="size-5" />
            </div>
        );
    }
    if (error) {
        return <p className="text-error text-sm">{error}</p>;
    }

    return (
        <div className="grid gap-2">
            {hasSearch ? null : <p className="text-muted-foreground text-xs">Featured skills</p>}
            <SkillHubItemList installed={installed} items={items} onSelect={onSelect} />
        </div>
    );
}
