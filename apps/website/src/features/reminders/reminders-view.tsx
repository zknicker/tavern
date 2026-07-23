import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import type { ReminderRunsOutput } from '../../lib/trpc.tsx';
import { ContentTopbar } from '../shell/content-topbar.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import { ReminderEmptyResults } from './reminder-empty-results.tsx';
import { ReminderFilterTabs } from './reminder-filter-tabs.tsx';
import type { ReminderListItem } from './reminder-list-data.ts';
import type { ReminderSelection } from './reminder-selection.ts';
import { RemindersList } from './reminders-list.tsx';
import { RemindersRunsList } from './reminders-runs-list.tsx';
import {
    type RemindersAgentEntry,
    type RemindersCounts,
    RemindersSidebar,
} from './reminders-sidebar.tsx';

type ReminderRun = ReminderRunsOutput['runs'][number];

interface RemindersViewProps {
    actionErrorMessage: string | null;
    activeCancelId: string | null;
    connectionState: 'reachable' | 'unconfigured' | 'unreachable';
    counts: RemindersCounts;
    filteredReminders: ReminderListItem[];
    onCancel: (reminder: ReminderListItem) => void;
    onClearFilters: () => void;
    onHistory: (reminder: ReminderListItem) => void;
    onNavigateToSettings: () => void;
    onOpen: (reminder: ReminderListItem) => void;
    onQueryChange: (query: string) => void;
    onRunSelect: (run: ReminderRun) => void;
    onSelectionChange: (selection: ReminderSelection) => void;
    query: string;
    reminders: ReminderListItem[];
    remindersById: Map<string, ReminderListItem>;
    runs: ReminderRunsOutput['runs'];
    runsPending: boolean;
    selection: ReminderSelection;
    sidebarAgents: RemindersAgentEntry[];
}

// Ported from cron-view.tsx. The create/suggested-automations chrome is gone
// (reminders are agent-authored, D4); everything else — sidebar, search
// topbar, compact filter tabs, list, and the Runs views — is preserved.
export function RemindersView({
    actionErrorMessage,
    activeCancelId,
    connectionState,
    counts,
    filteredReminders,
    onCancel,
    onClearFilters,
    onHistory,
    onNavigateToSettings,
    onOpen,
    onQueryChange,
    onRunSelect,
    onSelectionChange,
    query,
    reminders,
    remindersById,
    runs,
    runsPending,
    selection,
    sidebarAgents,
}: RemindersViewProps) {
    if (reminders.length === 0 && connectionState !== 'reachable') {
        return (
            <EmptyState
                actionLabel="Open settings"
                description="Reminders appear after Grotto can talk to Grotto Runtime. Connect or repair Grotto Runtime from settings, then any scheduled reminders will show up here."
                eyebrow="Reminders"
                onAction={onNavigateToSettings}
                title="Reminders are waiting on Grotto Runtime."
            />
        );
    }

    if (reminders.length === 0) {
        return (
            <EmptyState
                description="Reminders are scheduled by your agents. Ask one in chat — “remind me tomorrow to follow up” — and they will appear here."
                eyebrow="Reminders"
                title="No reminders yet"
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
                <RemindersSidebar
                    agents={sidebarAgents}
                    className="max-md:hidden"
                    counts={counts}
                    onSelect={onSelectionChange}
                    selection={selection}
                />

                <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                    {isRunsView ? null : (
                        <ContentTopbar className="no-drag">
                            <SearchInput
                                aria-label="Search reminders"
                                className="w-full sm:max-w-64"
                                name="reminder-search"
                                onChange={(event) => onQueryChange(event.target.value)}
                                placeholder="Search reminders..."
                                size="default"
                                value={query}
                            />
                        </ContentTopbar>
                    )}
                    <nav
                        aria-label="Reminder filters"
                        className="flex flex-wrap gap-1 px-2 pt-2 md:hidden"
                    >
                        <ReminderFilterTabs
                            canceledCount={counts.canceled}
                            compact
                            filter={selection.kind === 'filter' ? selection.filter : 'all'}
                            firedCount={counts.fired}
                            onFilterChange={(filter) =>
                                onSelectionChange({ filter, kind: 'filter' })
                            }
                            scheduledCount={counts.scheduled}
                            totalCount={counts.total}
                        />
                    </nav>

                    <ScrollArea className="flex-1">
                        <div className="flex w-full flex-col px-6 pt-5 pb-8">
                            {isRunsView ? (
                                <RemindersRunsList
                                    failuresOnly={selection.failuresOnly}
                                    isPending={runsPending}
                                    onRunSelect={onRunSelect}
                                    remindersById={remindersById}
                                    runs={runs}
                                />
                            ) : (
                                <section className="grid gap-3">
                                    {filteredReminders.length > 0 ? (
                                        <RemindersList
                                            activeCancelId={activeCancelId}
                                            onCancel={onCancel}
                                            onHistory={onHistory}
                                            onOpen={onOpen}
                                            reminders={filteredReminders}
                                        />
                                    ) : (
                                        <ReminderEmptyResults
                                            filter={
                                                selection.kind === 'filter'
                                                    ? selection.filter
                                                    : 'all'
                                            }
                                            onClearFilters={onClearFilters}
                                            query={query}
                                        />
                                    )}
                                </section>
                            )}
                        </div>
                    </ScrollArea>
                </section>
            </div>
        </div>
    );
}
