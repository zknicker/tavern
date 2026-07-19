import { Clock } from '@hugeicons/core-free-icons';
import { Cancel01Icon } from '@hugeicons-pro/core-solid-rounded';
import { useStore } from '@tanstack/react-form';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Popover,
    PopoverClose,
    PopoverPopup,
    PopoverTrigger,
} from '../../components/ui/popover.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectTriggerIcon,
    SelectValue,
} from '../../components/ui/select.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
import type { CronScheduleKind } from './cron-form.ts';
import type { CronEditorFormApi } from './use-cron-editor-form.ts';

const scheduleOptions = [
    { label: 'Interval', value: 'interval' as const },
    { label: 'Daily', value: 'daily' as const },
    { label: 'Weekdays', value: 'weekdays' as const },
    { label: 'Weekly', value: 'weekly' as const },
    { label: 'Custom', value: 'custom' as const },
];

const dayOptions = [
    { label: 'Sun', value: '0' },
    { label: 'Mon', value: '1' },
    { label: 'Tue', value: '2' },
    { label: 'Wed', value: '3' },
    { label: 'Thu', value: '4' },
    { label: 'Fri', value: '5' },
    { label: 'Sat', value: '6' },
];

export function CronEditorScheduleFields({ form }: { form: CronEditorFormApi }) {
    const scheduleKind = useStore(form.store, (state) => state.values.scheduleKind);
    const scheduleTime = useStore(form.store, (state) => state.values.scheduleTime);
    const scheduleDayOfWeek = useStore(form.store, (state) => state.values.scheduleDayOfWeek);
    const everyMs = useStore(form.store, (state) => state.values.everyMs);
    const cronExpr = useStore(form.store, (state) => state.values.cronExpr);
    const scheduleSummary = getScheduleSummary({
        cronExpr,
        everyMs,
        scheduleDayOfWeek,
        scheduleKind,
        scheduleTime,
    });
    const scheduleSentence = getScheduleSentence({
        cronExpr,
        everyMs,
        scheduleDayOfWeek,
        scheduleKind,
        scheduleTime,
    });

    return (
        <div className="relative [&>span:not([class])]:absolute">
            <Popover>
                <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Interval</span>
                    <PopoverTrigger
                        className="inline-flex min-w-0 max-w-[12rem] items-center gap-1 rounded-md px-2 py-1 text-right text-foreground transition-colors hover:bg-muted"
                        type="button"
                    >
                        <span className="min-w-0 truncate">{scheduleSummary}</span>
                        <SelectTriggerIcon />
                    </PopoverTrigger>
                </div>
                <PopoverPopup align="end" className="w-[min(38rem,calc(100vw-2rem))]" side="bottom">
                    <div className="grid gap-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-2">
                                <Icon
                                    className="size-5 shrink-0 text-muted-foreground"
                                    icon={Clock}
                                />
                                <p className="truncate font-medium text-foreground text-lg">
                                    {scheduleSentence}
                                </p>
                            </div>
                            <PopoverClose
                                aria-label="Close schedule settings"
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                type="button"
                            >
                                <Icon className="size-4" icon={Cancel01Icon} />
                            </PopoverClose>
                        </div>

                        <form.Field name="scheduleKind">
                            {(field) => (
                                <TabsSubtle
                                    onValueChange={(value) =>
                                        field.handleChange(value as CronScheduleKind)
                                    }
                                    value={field.state.value}
                                >
                                    <TabsSubtleList className="rounded-lg bg-muted/80 p-0.5">
                                        {scheduleOptions.map((option) => (
                                            <TabsSubtleItem
                                                key={option.value}
                                                size="sm"
                                                value={option.value}
                                            >
                                                {option.label}
                                            </TabsSubtleItem>
                                        ))}
                                    </TabsSubtleList>
                                </TabsSubtle>
                            )}
                        </form.Field>

                        <div className="grid gap-3">
                            {scheduleKind === 'interval' ? <IntervalFields form={form} /> : null}
                            {scheduleKind === 'daily' || scheduleKind === 'weekdays' ? (
                                <TimeFields form={form} />
                            ) : null}
                            {scheduleKind === 'weekly' ? <WeeklyFields form={form} /> : null}
                            {scheduleKind === 'custom' ? <CustomFields form={form} /> : null}
                        </div>

                        <p className="text-muted-foreground text-sm">
                            Runs are staggered by a few minutes to spread server load.
                        </p>
                    </div>
                </PopoverPopup>
            </Popover>
        </div>
    );
}

function IntervalFields({ form }: { form: CronEditorFormApi }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-foreground text-sm">Every</span>
            <form.Field name="everyMs">
                {(field) => (
                    <Input
                        aria-label="Interval in milliseconds"
                        className="w-44"
                        inputMode="numeric"
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="300000 ms"
                        value={field.state.value}
                    />
                )}
            </form.Field>
        </div>
    );
}

function TimeFields({ form }: { form: CronEditorFormApi }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-foreground text-sm">At</span>
            <form.Field name="scheduleTime">
                {(field) => (
                    <Input
                        aria-label="Schedule time"
                        className="w-44"
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        type="time"
                        value={field.state.value}
                    />
                )}
            </form.Field>
        </div>
    );
}

function WeeklyFields({ form }: { form: CronEditorFormApi }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-foreground text-sm">At</span>
            <form.Field name="scheduleTime">
                {(field) => (
                    <Input
                        aria-label="Schedule time"
                        className="w-36"
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        type="time"
                        value={field.state.value}
                    />
                )}
            </form.Field>
            <span className="text-foreground text-sm">On</span>
            <form.Field name="scheduleDayOfWeek">
                {(field) => (
                    <Select
                        onValueChange={(value) => {
                            if (value !== null) {
                                field.handleChange(value);
                            }
                        }}
                        value={field.state.value}
                    >
                        <SelectTrigger aria-label="Weekday" className="w-44">
                            <SelectValue>
                                {dayOptions.find((option) => option.value === field.state.value)
                                    ?.label ?? 'Monday'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {dayOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </form.Field>
        </div>
    );
}

function CustomFields({ form }: { form: CronEditorFormApi }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-foreground text-sm">Cron</span>
            <form.Field name="cronExpr">
                {(field) => (
                    <Input
                        aria-label="Cron expression"
                        className="w-72 font-mono"
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="0 7 * * *"
                        value={field.state.value}
                    />
                )}
            </form.Field>
        </div>
    );
}

function getScheduleSummary({
    cronExpr,
    everyMs,
    scheduleDayOfWeek,
    scheduleKind,
    scheduleTime,
}: {
    cronExpr: string;
    everyMs: string;
    scheduleDayOfWeek: string;
    scheduleKind: CronScheduleKind;
    scheduleTime: string;
}) {
    if (scheduleKind === 'interval') {
        return everyMs.trim() ? `Every ${everyMs.trim()}ms` : 'Set interval';
    }

    if (scheduleKind === 'daily') {
        return `Daily at ${formatDisplayTime(scheduleTime)}`;
    }

    if (scheduleKind === 'weekdays') {
        return `Weekdays at ${formatDisplayTime(scheduleTime)}`;
    }

    if (scheduleKind === 'weekly') {
        return `${getDayLabel(scheduleDayOfWeek)} at ${formatDisplayTime(scheduleTime)}`;
    }

    return cronExpr.trim() || 'Custom cron';
}

function getScheduleSentence(input: {
    cronExpr: string;
    everyMs: string;
    scheduleDayOfWeek: string;
    scheduleKind: CronScheduleKind;
    scheduleTime: string;
}) {
    if (input.scheduleKind === 'interval') {
        return input.everyMs.trim() ? `Runs every ${input.everyMs.trim()}ms` : 'Runs on interval';
    }

    if (input.scheduleKind === 'daily') {
        return `Runs daily at ${formatDisplayTime(input.scheduleTime)}`;
    }

    if (input.scheduleKind === 'weekdays') {
        return `Runs weekdays at ${formatDisplayTime(input.scheduleTime)}`;
    }

    if (input.scheduleKind === 'weekly') {
        return `Runs every ${getDayLabel(input.scheduleDayOfWeek)} at ${formatDisplayTime(input.scheduleTime)}`;
    }

    return input.cronExpr.trim() ? `Runs ${input.cronExpr.trim()}` : 'Runs on custom schedule';
}

function formatDisplayTime(value: string) {
    const [hourText = '', minuteText = ''] = value.split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (!(Number.isFinite(hour) && Number.isFinite(minute))) {
        return value || 'time';
    }

    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function getDayLabel(value: string) {
    return dayOptions.find((option) => option.value === value)?.label ?? 'Weekly';
}
