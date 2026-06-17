import { Plus } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import { CronEmptyResults } from './cron-empty-results.tsx';
import { CronFilterTabs } from './cron-filter-tabs.tsx';
import { CronJobsList } from './cron-jobs-list.tsx';
import type { CronListItem } from './cron-list-data.ts';
import type { CronFilter } from './filter-cron-jobs.ts';

interface CronViewProps {
    actionErrorMessage: string | null;
    activeDeleteJobId: string | null;
    activeRunJobId: string | null;
    activeToggleJobId: string | null;
    canEdit: boolean;
    connectionState: 'reachable' | 'unconfigured' | 'unreachable';
    cronJobs: CronListItem[];
    enabledJobs: number;
    filter: CronFilter;
    filteredJobs: CronListItem[];
    isMutating: boolean;
    onClearFilters: () => void;
    onCreate: () => void;
    onDelete: (job: CronListItem) => Promise<void>;
    onEdit: (job: CronListItem) => void;
    onFilterChange: (filter: CronFilter) => void;
    onHistory: (job: CronListItem) => void;
    onNavigateToSettings: () => void;
    onQueryChange: (query: string) => void;
    onRun: (job: CronListItem) => Promise<void>;
    onToggle: (job: CronListItem, enabled: boolean) => Promise<void>;
    pausedJobs: number;
    query: string;
    totalJobs: number;
}

export function CronView({
    actionErrorMessage,
    activeDeleteJobId,
    activeRunJobId,
    activeToggleJobId,
    canEdit,
    connectionState,
    cronJobs,
    enabledJobs,
    filter,
    filteredJobs,
    isMutating,
    onCreate,
    onClearFilters,
    onDelete,
    onEdit,
    onFilterChange,
    onHistory,
    onNavigateToSettings,
    onQueryChange,
    onRun,
    onToggle,
    pausedJobs,
    query,
    totalJobs,
}: CronViewProps) {
    if (cronJobs.length === 0 && connectionState !== 'reachable') {
        return (
            <EmptyState
                actionLabel="Open settings"
                description="Automations appear after Tavern can talk to Tavern Runtime. Connect or repair Tavern Runtime from settings, then any configured automations will show up here."
                eyebrow="Automations"
                onAction={onNavigateToSettings}
                title="Automations are waiting on Tavern Runtime."
            />
        );
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {actionErrorMessage ? (
                <div className="border-error/40 border-b bg-error-bg px-4 py-3">
                    <p className="text-error-foreground text-sm">{actionErrorMessage}</p>
                </div>
            ) : null}

            {cronJobs.length === 0 ? (
                <EmptyState
                    actionLabel="Create your first automation"
                    description="Create an automation to schedule recurring work for your agent."
                    eyebrow="Automations"
                    onAction={onCreate}
                    title="No automations configured"
                />
            ) : (
                <ScrollArea className="flex-1">
                    <div className="mx-auto flex w-full max-w-3xl flex-col px-5 py-8">
                        <header className="relative z-40 flex items-start pb-6">
                            <div>
                                <h1 className="font-semibold text-2xl text-foreground">
                                    Automations
                                </h1>
                                <p className="mt-1 text-muted-foreground text-sm">
                                    Schedule recurring work for your agent
                                </p>
                            </div>
                            <Button
                                className="ml-auto shrink-0 rounded-full"
                                disabled={isMutating}
                                onClick={onCreate}
                                size="sm"
                                type="button"
                                variant="secondary"
                            >
                                <Icon aria-hidden="true" className="size-4" icon={Plus} />
                                New Automation
                            </Button>
                        </header>

                        <section className="grid gap-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <CronFilterTabs
                                    enabledJobs={enabledJobs}
                                    filter={filter}
                                    onFilterChange={onFilterChange}
                                    pausedJobs={pausedJobs}
                                    totalJobs={totalJobs}
                                />
                                <SearchInput
                                    aria-label="Search automations"
                                    className="w-full sm:ml-auto sm:max-w-64 [&_[data-slot=input-control]]:rounded-full"
                                    name="automation-search"
                                    onChange={(event) => onQueryChange(event.target.value)}
                                    placeholder="Search automations..."
                                    size="default"
                                    value={query}
                                />
                            </div>

                            {filteredJobs.length > 0 ? (
                                <CronJobsList
                                    activeDeleteJobId={activeDeleteJobId}
                                    activeRunJobId={activeRunJobId}
                                    activeToggleJobId={activeToggleJobId}
                                    canEdit={canEdit}
                                    jobs={filteredJobs}
                                    onDelete={onDelete}
                                    onEdit={onEdit}
                                    onHistory={onHistory}
                                    onRun={onRun}
                                    onToggle={onToggle}
                                />
                            ) : (
                                <CronEmptyResults
                                    filter={filter}
                                    onClearFilters={onClearFilters}
                                    query={query}
                                />
                            )}
                        </section>
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}
