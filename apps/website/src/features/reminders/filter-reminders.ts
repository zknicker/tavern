import type { ReminderListItem } from './reminder-list-data.ts';

// Ported from filter-cron-jobs.ts. The old active/paused axis becomes the
// reminder status axis (scheduled/fired/canceled) — reminders have no paused
// state (D4).
export type ReminderFilter = 'all' | 'scheduled' | 'fired' | 'canceled';

interface FilterRemindersInput {
    filter: ReminderFilter;
    query: string;
    reminders: ReminderListItem[];
}

export function filterReminders({
    filter,
    query,
    reminders,
}: FilterRemindersInput): ReminderListItem[] {
    return reminders.filter((reminder) => {
        if (filter !== 'all' && reminder.status !== filter) {
            return false;
        }

        if (query.length === 0) {
            return true;
        }

        return (
            reminder.name.toLowerCase().includes(query) ||
            reminder.schedule.toLowerCase().includes(query)
        );
    });
}
