import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    formatTaskNumber,
    taskStatusIcons,
    taskStatusLabels,
    todayIsoDate,
} from './task-presentation.ts';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The board laid out by scheduledFor. Reads the board only: undated tasks never
// appear. A light month grid rather than react-day-picker, which is a compact
// date picker and fights multi-item day cells.
export function TasksCalendar({
    onOpen,
    tasks,
}: {
    onOpen: (task: TaskRecord) => void;
    tasks: TaskRecord[];
}) {
    const [monthAnchor, setMonthAnchor] = React.useState(() => startOfMonth(new Date()));
    const today = todayIsoDate();

    const tasksByDay = React.useMemo(() => {
        const map = new Map<string, TaskRecord[]>();

        for (const task of tasks) {
            if (!task.scheduledFor) {
                continue;
            }

            const bucket = map.get(task.scheduledFor);

            if (bucket) {
                bucket.push(task);
            } else {
                map.set(task.scheduledFor, [task]);
            }
        }

        for (const bucket of map.values()) {
            bucket.sort((a, b) => a.number - b.number);
        }

        return map;
    }, [tasks]);

    const days = React.useMemo(() => buildMonthDays(monthAnchor), [monthAnchor]);
    const monthLabel = monthAnchor.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-2 px-3 pb-2">
                <h2 className="font-medium text-foreground text-sm">{monthLabel}</h2>
                <div className="ml-auto flex items-center gap-1">
                    <Button
                        aria-label="Previous month"
                        onClick={() => setMonthAnchor((prev) => shiftMonth(prev, -1))}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                    >
                        <Icon aria-hidden="true" className="size-4" icon={ArrowLeft01Icon} />
                    </Button>
                    <Button
                        onClick={() => setMonthAnchor(startOfMonth(new Date()))}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        Today
                    </Button>
                    <Button
                        aria-label="Next month"
                        onClick={() => setMonthAnchor((prev) => shiftMonth(prev, 1))}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                    >
                        <Icon aria-hidden="true" className="size-4" icon={ArrowRight01Icon} />
                    </Button>
                </div>
            </div>

            <div className="grid shrink-0 grid-cols-7 border-border/60 border-y px-2">
                {weekdayLabels.map((label) => (
                    <div
                        className="px-2 py-1.5 text-muted-foreground/72 text-xs uppercase tracking-wide"
                        key={label}
                    >
                        {label}
                    </div>
                ))}
            </div>

            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-px overflow-y-auto bg-border/40 [scrollbar-gutter:stable]">
                {days.map((day) => (
                    <CalendarDay
                        dayTasks={tasksByDay.get(day.iso) ?? []}
                        inMonth={day.inMonth}
                        iso={day.iso}
                        isToday={day.iso === today}
                        key={day.iso}
                        label={day.dayOfMonth}
                        onOpen={onOpen}
                    />
                ))}
            </div>
        </div>
    );
}

function CalendarDay({
    dayTasks,
    inMonth,
    isToday,
    label,
    onOpen,
}: {
    dayTasks: TaskRecord[];
    inMonth: boolean;
    iso: string;
    isToday: boolean;
    label: number;
    onOpen: (task: TaskRecord) => void;
}) {
    return (
        <div
            className={cn(
                'flex min-h-24 flex-col gap-1 bg-background p-1.5',
                inMonth ? null : 'bg-muted/20'
            )}
        >
            <span
                className={cn(
                    'flex size-5 shrink-0 items-center justify-center self-start rounded-full text-xs tabular-nums',
                    isToday ? 'bg-primary font-medium text-primary-foreground' : null,
                    inMonth ? 'text-foreground' : 'text-muted-foreground/60'
                )}
            >
                {label}
            </span>
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                {dayTasks.map((task) => (
                    <CalendarChip key={task.id} onOpen={onOpen} task={task} />
                ))}
            </div>
        </div>
    );
}

function CalendarChip({ onOpen, task }: { onOpen: (task: TaskRecord) => void; task: TaskRecord }) {
    return (
        <button
            className="flex w-full items-center gap-1 rounded-md bg-muted/50 px-1.5 py-1 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onOpen(task)}
            title={`${formatTaskNumber(task)} ${task.title} · ${taskStatusLabels[task.status]}`}
            type="button"
        >
            <Icon
                aria-hidden="true"
                className="size-3 shrink-0 text-muted-foreground"
                icon={taskStatusIcons[task.status]}
            />
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                {formatTaskNumber(task)}
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground text-xs">{task.title}</span>
        </button>
    );
}

function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, delta: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

interface CalendarDayCell {
    dayOfMonth: number;
    inMonth: boolean;
    iso: string;
}

// Six Sunday-start weeks covering the month, padded with leading and trailing
// days so every row is full.
function buildMonthDays(monthAnchor: Date): CalendarDayCell[] {
    const firstWeekday = monthAnchor.getDay();
    const gridStart = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1 - firstWeekday);
    const cells: CalendarDayCell[] = [];

    for (let offset = 0; offset < 42; offset += 1) {
        const date = new Date(
            gridStart.getFullYear(),
            gridStart.getMonth(),
            gridStart.getDate() + offset
        );

        cells.push({
            dayOfMonth: date.getDate(),
            inMonth: date.getMonth() === monthAnchor.getMonth(),
            iso: toIsoDate(date),
        });
    }

    return cells;
}
