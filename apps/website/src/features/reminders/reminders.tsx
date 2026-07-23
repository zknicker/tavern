import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import {
    toRuntimePageConnectionState,
    useRuntimeConnection,
} from '../../hooks/connections/use-runtime-connection.ts';
import { useReminderList, useReminderRuns } from '../../hooks/reminders/use-reminder-list.ts';
import { useReminderCancel } from '../../hooks/reminders/use-reminder-mutations.ts';
import { useSearch } from '../../hooks/shell/use-search.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { useAgentSelectOptions } from '../agents/use-agent-select-options.ts';
import { useLayoutContext } from '../shell/use-layout-context.ts';
import { CancelReminderDialog } from './cancel-reminder-dialog.tsx';
import { filterReminders } from './filter-reminders.ts';
import { buildReminderList, type ReminderListItem } from './reminder-list-data.ts';
import { defaultReminderSelection, type ReminderSelection } from './reminder-selection.ts';
import { RemindersRunsDrawer } from './reminders-runs-drawer.tsx';
import { RemindersView } from './reminders-view.tsx';

// Ported from cron.tsx. Assembles the reminder list view model, sidebar
// counts, and per-agent buckets, and owns the run-history drawer + cancel
// dialog. Toggle / run-now / edit / create are concept-dead (D4); only Cancel
// mutates.
export function Reminders() {
    const navigate = useNavigate();
    const { navigateToSettings } = useLayoutContext();
    const runtimeConnection = useRuntimeConnection();
    const remindersQuery = useReminderList();
    const cancelMutation = useReminderCancel();
    const { deferredQuery, query, setQuery } = useSearch();
    const relativeNow = useRelativeNow();

    const allRunsQuery = useReminderRuns();
    const allRuns = React.useMemo(() => allRunsQuery.data?.runs ?? [], [allRunsQuery.data?.runs]);
    const reminders = React.useMemo(
        () => buildReminderList(remindersQuery.data?.reminders ?? [], allRuns, relativeNow),
        [allRuns, relativeNow, remindersQuery.data?.reminders]
    );

    const [selection, setSelection] = React.useState<ReminderSelection>(defaultReminderSelection);
    const [historyReminder, setHistoryReminder] = React.useState<ReminderListItem | null>(null);
    const [cancelReminder, setCancelReminder] = React.useState<ReminderListItem | null>(null);
    const runsQuery = useReminderRuns(historyReminder?.id);

    const agentsQuery = useAgentList();
    const agentOptions = useAgentSelectOptions(agentsQuery.data?.agents);
    const remindersById = React.useMemo(
        () => new Map(reminders.map((reminder) => [reminder.id, reminder])),
        [reminders]
    );
    const counts = React.useMemo(
        () => ({
            canceled: reminders.filter((reminder) => reminder.status === 'canceled').length,
            failures: allRuns.filter((run) => run.outcome === 'error').length,
            fired: reminders.filter((reminder) => reminder.status === 'fired').length,
            scheduled: reminders.filter((reminder) => reminder.status === 'scheduled').length,
            total: reminders.length,
        }),
        [allRuns, reminders]
    );
    const sidebarAgents = React.useMemo(
        () =>
            agentOptions
                .map((agent) => ({
                    ...agent,
                    reminderCount: reminders.filter(
                        (reminder) => reminder.ownerAgentId === agent.id
                    ).length,
                }))
                .filter((agent) => agent.reminderCount > 0),
        [agentOptions, reminders]
    );
    const filteredReminders = React.useMemo(() => {
        const scoped =
            selection.kind === 'agent'
                ? reminders.filter((reminder) => reminder.ownerAgentId === selection.agentId)
                : reminders;

        return filterReminders({
            filter: selection.kind === 'filter' ? selection.filter : 'all',
            query: deferredQuery,
            reminders: scoped,
        });
    }, [deferredQuery, reminders, selection]);

    const openReminder = React.useCallback(
        (reminder: ReminderListItem) => {
            if (reminder.anchorChatId) {
                navigate(appRoutes.chat(reminder.anchorChatId));
            }
        },
        [navigate]
    );

    return (
        <>
            <RemindersView
                actionErrorMessage={cancelMutation.error?.message ?? null}
                activeCancelId={
                    cancelMutation.isPending ? (cancelMutation.variables?.reminderId ?? null) : null
                }
                connectionState={toRuntimePageConnectionState(runtimeConnection.status)}
                counts={counts}
                filteredReminders={filteredReminders}
                onCancel={setCancelReminder}
                onClearFilters={() => {
                    setSelection(defaultReminderSelection);
                    setQuery('');
                }}
                onHistory={setHistoryReminder}
                onNavigateToSettings={navigateToSettings}
                onOpen={openReminder}
                onQueryChange={setQuery}
                onRunSelect={(run) => {
                    const reminder = remindersById.get(run.reminderId);
                    if (reminder) {
                        setHistoryReminder(reminder);
                    }
                }}
                onSelectionChange={setSelection}
                query={query}
                reminders={reminders}
                remindersById={remindersById}
                runs={allRuns}
                runsPending={allRunsQuery.isPending}
                selection={selection}
                sidebarAgents={sidebarAgents}
            />
            <RemindersRunsDrawer
                anchorChatId={historyReminder?.anchorChatId ?? null}
                isOpen={historyReminder !== null}
                isPending={runsQuery.isPending}
                onClose={() => setHistoryReminder(null)}
                reminderName={historyReminder?.name ?? null}
                runs={runsQuery.data?.runs ?? []}
            />
            <CancelReminderDialog
                errorMessage={cancelMutation.error?.message ?? null}
                isOpen={cancelReminder !== null}
                isPending={cancelMutation.isPending}
                onClose={() => {
                    if (cancelMutation.isPending) {
                        return;
                    }
                    cancelMutation.reset();
                    setCancelReminder(null);
                }}
                onConfirm={async () => {
                    if (!cancelReminder) {
                        return;
                    }
                    await cancelMutation.mutateAsync({ reminderId: cancelReminder.id });
                    setCancelReminder(null);
                }}
                reminderName={cancelReminder?.name ?? null}
            />
        </>
    );
}
