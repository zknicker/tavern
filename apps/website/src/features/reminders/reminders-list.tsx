import { FluidList, FluidListItem } from '../../components/ui/fluid-list.tsx';
import { cn } from '../../lib/utils.ts';
import { ReminderActions } from './reminder-actions.tsx';
import type { ReminderListItem } from './reminder-list-data.ts';

interface RemindersListProps {
    activeCancelId?: string | null;
    onCancel?: (reminder: ReminderListItem) => void;
    onHistory?: (reminder: ReminderListItem) => void;
    onOpen?: (reminder: ReminderListItem) => void;
    // The agent-profile tab renders the same rows without the action menu —
    // cancel lives only on the operator Reminders page (D4 read-mostly).
    readOnly?: boolean;
    reminders: ReminderListItem[];
}

interface ReminderRowProps extends Omit<RemindersListProps, 'reminders'> {
    reminder: ReminderListItem;
}

// Ported from cron-jobs-list.tsx. The row keeps its status dot, title, script
// badge, schedule, and secondary line; the cron dot's running/error/paused
// tones map onto the reminder's status and last outcome. Clicking the row
// opens the anchored conversation.
function ReminderRow({
    activeCancelId,
    onCancel,
    onHistory,
    onOpen,
    readOnly = false,
    reminder,
}: ReminderRowProps) {
    const dotState = getReminderDotState(reminder);

    return (
        <div className="group/reminder-row relative flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
            {readOnly || !onOpen ? null : (
                <button
                    aria-label={`Open ${reminder.name}`}
                    className="no-drag absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    data-window-drag-disabled=""
                    onClick={() => onOpen(reminder)}
                    type="button"
                />
            )}

            <span
                aria-label={dotState.label}
                className={cn(
                    'pointer-events-none relative z-10 size-2 shrink-0 rounded-full',
                    dotState.tone === 'scheduled' && 'bg-success',
                    dotState.tone === 'canceled' && 'bg-muted-foreground/35',
                    dotState.tone === 'error' && 'bg-error'
                )}
                role="img"
            />

            <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col gap-1 text-left">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate font-medium text-[15px] text-foreground">
                        {reminder.name}
                    </span>
                    {reminder.isScript ? (
                        <span className="shrink-0 rounded-md bg-muted/60 px-1.5 py-0.5 font-medium text-[11px] text-muted-foreground">
                            Script
                        </span>
                    ) : null}
                    <span className="hidden text-muted-foreground sm:inline">·</span>
                    <span className="hidden min-w-0 truncate text-muted-foreground sm:inline">
                        {reminder.schedule}
                    </span>
                </div>
                {reminder.lastErrorMessage ? (
                    <p
                        className="max-w-[36rem] truncate text-error-foreground text-xs"
                        title={reminder.lastErrorMessage}
                    >
                        {reminder.lastErrorMessage}
                    </p>
                ) : reminder.nextRun !== 'unknown' ? (
                    <p className="max-w-[36rem] truncate text-muted-foreground text-xs">
                        Next fire {reminder.nextRun}
                    </p>
                ) : reminder.lastRun !== 'unknown' ? (
                    <p className="max-w-[36rem] truncate text-muted-foreground text-xs">
                        Last fired {reminder.lastRun}
                    </p>
                ) : null}
            </div>

            {readOnly || !(onCancel && onHistory) ? null : (
                <div className="relative z-20 ml-auto flex h-8 shrink-0 items-center justify-end">
                    <ReminderActions
                        isCanceling={activeCancelId === reminder.id}
                        onCancel={onCancel}
                        onHistory={onHistory}
                        reminder={reminder}
                    />
                </div>
            )}
        </div>
    );
}

function getReminderDotState(reminder: ReminderListItem) {
    if (reminder.lastOutcome === 'error') {
        return { label: 'Error', tone: 'error' } as const;
    }
    if (reminder.status === 'scheduled') {
        return { label: 'Scheduled', tone: 'scheduled' } as const;
    }
    return { label: reminder.status === 'fired' ? 'Fired' : 'Canceled', tone: 'canceled' } as const;
}

export function RemindersList({
    activeCancelId = null,
    onCancel,
    onHistory,
    onOpen,
    readOnly = false,
    reminders,
}: RemindersListProps) {
    return (
        <FluidList className="grid">
            {reminders.map((reminder, index) => (
                <FluidListItem className="-mx-3" index={index} key={reminder.id}>
                    <ReminderRow
                        activeCancelId={activeCancelId}
                        onCancel={onCancel}
                        onHistory={onHistory}
                        onOpen={onOpen}
                        readOnly={readOnly}
                        reminder={reminder}
                    />
                </FluidListItem>
            ))}
        </FluidList>
    );
}
