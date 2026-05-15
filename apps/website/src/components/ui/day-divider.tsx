import { cn } from '../../lib/utils.ts';
import { BadgeDivider } from './badge-divider.tsx';

function sameDay(left: Date, right: Date) {
    return (
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate()
    );
}

export function formatDayLabel(value: string | Date) {
    const date = typeof value === 'string' ? new Date(value) : value;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (sameDay(date, today)) {
        return 'Today';
    }

    if (sameDay(date, yesterday)) {
        return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}

export function DayDivider({ className, label }: { className?: string; label: string }) {
    return (
        <BadgeDivider badgeLocation="right" className={cn('py-2', className)} labelClassName="py-1">
            {label}
        </BadgeDivider>
    );
}
