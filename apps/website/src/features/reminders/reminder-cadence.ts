import { formatTimestamp } from '../../lib/format.ts';
import type { ReminderRecord } from '../../lib/trpc.tsx';

const weekdayLabels: Record<string, string> = {
    fri: 'Fri',
    mon: 'Mon',
    sat: 'Sat',
    sun: 'Sun',
    thu: 'Thu',
    tue: 'Tue',
    wed: 'Wed',
};

// Humanize a reminder's schedule: recurring cadences read as prose, one-shots
// as their absolute fire time. Mirrors formatCronSchedule's role.
export function formatReminderSchedule(reminder: Pick<ReminderRecord, 'fire_at' | 'repeat'>) {
    const cadence = reminder.repeat ? formatReminderCadence(reminder.repeat) : null;
    return cadence ?? formatTimestamp(reminder.fire_at);
}

export function formatReminderCadence(repeat: string): string | null {
    const every = /^every:(\d+)([mhd])$/u.exec(repeat);
    if (every?.[1] && every[2]) {
        const amount = Number(every[1]);
        const unit = every[2] === 'm' ? 'minute' : every[2] === 'h' ? 'hour' : 'day';
        return amount === 1 ? `Every ${unit}` : `Every ${amount} ${unit}s`;
    }
    const daily = /^daily@(\d{2}:\d{2})$/u.exec(repeat);
    if (daily?.[1]) {
        return `Daily at ${daily[1]}`;
    }
    const weekly = /^weekly:([a-z,]+)@(\d{2}:\d{2})$/u.exec(repeat);
    if (weekly?.[1] && weekly[2]) {
        const days = weekly[1]
            .split(',')
            .map((day) => weekdayLabels[day] ?? day)
            .join(', ');
        return `Weekly on ${days} at ${weekly[2]}`;
    }
    return repeat;
}
