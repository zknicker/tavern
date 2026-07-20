import { Plus } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import type { CronRunsOutput } from '../../lib/trpc.tsx';
import { ContentTopbar } from '../shell/content-topbar.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import { AutomationsRunsList } from './automations-runs-list.tsx';
import type { AutomationsSelection } from './automations-selection.ts';
import {
    type AutomationsAgentEntry,
    type AutomationsCounts,
    AutomationsSidebar,
} from './automations-sidebar.tsx';
import { CronEmptyResults } from './cron-empty-results.tsx';
import { CronFilterTabs } from './cron-filter-tabs.tsx';
import { CronJobsList } from './cron-jobs-list.tsx';
import type { CronListItem } from './cron-list-data.ts';
import { suggestedAutomations } from './suggested-automations.ts';
import { SuggestedAutomationsSection } from './suggested-automations-section.tsx';

interface CronViewProps {
    actionErrorMessage: string | null;
    activeDeleteJobId: string | null;
    activeRunJobId: string | null;
    activeToggleJobId: string | null;
    canEdit: boolean;
    connectionState: 'reachable' | 'unconfigured' | 'unreachable';
    counts: AutomationsCounts;
    cronJobs: CronListItem[];
    filteredJobs: CronListItem[];
    isMutating: boolean;
    jobsById: Map<string, CronListItem>;
    onAddSuggested: (id: string) => void;
    onClearFilters: () => void;
    onCreate: () => void;
    onDelete: (job: CronListItem) => Promise<void>;
    onEdit: (job: CronListItem) => void;
    onHistory: (job: CronListItem) => void;
    onNavigateToSettings: () => void;
    onQueryChange: (query: string) => void;
    onRun: (job: CronListItem) => Promise<void>;
    onRunSelect: (run: CronRunsOutput['runs'][number]) => void;
    onSelectionChange: (selection: AutomationsSelection) => void;
    onToggle: (job: CronListItem, enabled: boolean) => Promise<void>;
    query: string;
    runs: CronRunsOutput['runs'];
    runsPending: boolean;
    selection: AutomationsSelection;
    sidebarAgents: AutomationsAgentEntry[];
}

export function CronView({
    actionErrorMessage,
    activeDeleteJobId,
    activeRunJobId,
    activeToggleJobId,
    canEdit,
    connectionState,
    counts,
    cronJobs,
    filteredJobs,
    isMutating,
    jobsById,
    onAddSuggested,
    onCreate,
    onClearFilters,
    onDelete,
    onEdit,
    onHistory,
    onNavigateToSettings,
    onQueryChange,
    onRun,
    onRunSelect,
    onSelectionChange,
    onToggle,
    query,
    runs,
    runsPending,
    selection,
    sidebarAgents,
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

    const existingJobNames = new Set(cronJobs.map((job) => job.name));
    const hasRemainingSuggestions = suggestedAutomations.some(
        (suggestion) => !existingJobNames.has(suggestion.name)
    );

    // With no jobs and no suggestions left, the classic empty state; when
    // suggestions remain, they are the content and read as "start here".
    if (cronJobs.length === 0 && !hasRemainingSuggestions) {
        return (
            <EmptyState
                actionLabel="Create your first automation"
                description="Create an automation to schedule recurring work for your agent."
                eyebrow="Automations"
                onAction={onCreate}
                title="No automations configured"
            />
        );
    }

    const isRunsView = selection.kind === 'runs';

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {actionErrorMessage ? (
                <div className="border-error/40 border-b bg-error-bg px-4 py-3">
                    <p className="text-error-foreground text-sm">{actionErrorMessage}</p>
                </div>
            ) : null}

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
                <AutomationsSidebar
                    agents={sidebarAgents}
                    className="max-md:hidden"
                    counts={counts}
                    onSelect={onSelectionChange}
                    selection={selection}
                />

                <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                    <ContentTopbar className="no-drag">
                        {isRunsView ? null : (
                            <SearchInput
                                aria-label="Search automations"
                                className="w-full sm:max-w-64"
                                name="automation-search"
                                onChange={(event) => onQueryChange(event.target.value)}
                                placeholder="Search automations..."
                                size="default"
                                value={query}
                            />
                        )}
                        <Button
                            className="ml-auto shrink-0"
                            disabled={isMutating}
                            onClick={onCreate}
                            type="button"
                            variant="secondary"
                        >
                            <Icon aria-hidden="true" className="size-4" icon={Plus} />
                            New Automation
                        </Button>
                    </ContentTopbar>
                    <nav
                        aria-label="Automation filters"
                        className="flex flex-wrap gap-1 px-2 pt-2 md:hidden"
                    >
                        <CronFilterTabs
                            compact
                            enabledJobs={counts.active}
                            filter={selection.kind === 'filter' ? selection.filter : 'all'}
                            onFilterChange={(filter) =>
                                onSelectionChange({ filter, kind: 'filter' })
                            }
                            pausedJobs={counts.paused}
                            totalJobs={counts.total}
                        />
                    </nav>

                    <ScrollArea className="flex-1">
                        <div className="flex w-full flex-col px-6 pt-5 pb-8">
                            {isRunsView ? (
                                <AutomationsRunsList
                                    failuresOnly={selection.failuresOnly}
                                    isPending={runsPending}
                                    jobsById={jobsById}
                                    onRunSelect={onRunSelect}
                                    runs={runs}
                                />
                            ) : (
                                <section className="grid gap-3">
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
                                            filter={
                                                selection.kind === 'filter'
                                                    ? selection.filter
                                                    : 'all'
                                            }
                                            onClearFilters={onClearFilters}
                                            query={query}
                                        />
                                    )}

                                    <SuggestedAutomationsSection
                                        existingNames={existingJobNames}
                                        onAdd={onAddSuggested}
                                    />
                                </section>
                            )}
                        </div>
                    </ScrollArea>
                </section>
            </div>
        </div>
    );
}
