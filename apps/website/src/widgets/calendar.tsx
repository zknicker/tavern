import type { TavernRenderCalendarEventProps } from '@tavern/api/widgets/calendar';
import {
    tavernRenderCalendarEventComponentId,
    tavernRenderCalendarEventPropsSchema,
} from '@tavern/api/widgets/calendar';
import { WidgetFrame } from '../components/widgets/widget-frame.tsx';
import { cn } from '../lib/utils.ts';
import type { TavernWidget } from './types.ts';

export function renderCalendarWidget(widget: TavernWidget): React.ReactNode {
    if (widget.component !== tavernRenderCalendarEventComponentId) {
        return null;
    }

    const parsed = tavernRenderCalendarEventPropsSchema.safeParse(widget.props);

    return parsed.success ? <CalendarEventWidget props={parsed.data} /> : null;
}

function CalendarEventWidget({ props }: { props: TavernRenderCalendarEventProps }) {
    const date = dateFromCalendarValue(props.date);
    const timeLabel = formatEventTime(props);
    const detailText = [props.location, props.notes].filter(Boolean).join(' - ');

    return (
        <WidgetFrame>
            <div className="flex gap-3">
                <CalendarTile date={date} />
                <div className="flex h-[72px] min-w-0 flex-1 flex-col justify-center gap-1">
                    <div className="flex min-w-0 items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate font-medium text-foreground text-sm">
                            {props.title}
                        </p>
                        <p className="shrink-0 font-medium text-info-foreground text-sm">
                            {timeLabel}
                        </p>
                    </div>
                    {detailText ? (
                        <p className="line-clamp-2 break-words text-muted-foreground text-sm">
                            {detailText}
                        </p>
                    ) : null}
                </div>
            </div>
        </WidgetFrame>
    );
}

function CalendarTile({ date }: { date: Date }) {
    return (
        <div
            aria-hidden="true"
            className={cn(
                'h-[72px] w-[60px] shrink-0 overflow-hidden rounded-xl border border-border bg-surface-3 shadow-surface-2',
                'text-center'
            )}
        >
            <div className="bg-info px-1 py-1 font-semibold text-[color:var(--color-white)] text-xs leading-none">
                {formatTileMonth(date)}
            </div>
            <div className="flex h-[52px] flex-col items-center justify-center">
                <div className="font-semibold text-2xl text-foreground tabular-nums leading-none">
                    {formatTileDay(date)}
                </div>
                <div className="mt-1 font-semibold text-[11px] text-info-foreground uppercase leading-none">
                    {formatTileWeekday(date)}
                </div>
            </div>
        </div>
    );
}

function formatTileMonth(date: Date) {
    return tileMonthFormatter.format(date).toUpperCase();
}

function formatTileDay(date: Date) {
    return tileDayFormatter.format(date);
}

function formatTileWeekday(date: Date) {
    return tileWeekdayFormatter.format(date).toUpperCase();
}

function formatEventTime(props: TavernRenderCalendarEventProps) {
    const timezoneLabel = timezoneDisplayName(props);

    if (props.allDay) {
        return joinTimeLabel('All day', timezoneLabel);
    }

    if (!(props.startTime && props.endTime)) {
        return joinTimeLabel('Time TBD', timezoneLabel);
    }

    return joinTimeLabel(formatTimeRange(props.startTime, props.endTime), timezoneLabel);
}

function formatTimeRange(startTime: string, endTime: string) {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const startPeriod = period(start.hour);
    const endPeriod = period(end.hour);

    if (startPeriod === endPeriod) {
        return `${hourMinute(start.hour, start.minute)} - ${hourMinute(end.hour, end.minute)} ${endPeriod}`;
    }

    return `${hourMinute(start.hour, start.minute)} ${startPeriod} - ${hourMinute(end.hour, end.minute)} ${endPeriod}`;
}

function parseTime(value: string) {
    const [hour = '0', minute = '0'] = value.split(':');

    return {
        hour: Number(hour),
        minute: Number(minute),
    };
}

function hourMinute(hour: number, minute: number) {
    const normalizedHour = hour % 12 || 12;
    return `${normalizedHour}:${String(minute).padStart(2, '0')}`;
}

function period(hour: number) {
    return hour >= 12 ? 'PM' : 'AM';
}

function timezoneDisplayName(props: TavernRenderCalendarEventProps) {
    if (!props.timezone) {
        return null;
    }

    try {
        const parts = new Intl.DateTimeFormat(undefined, {
            timeZone: props.timezone,
            timeZoneName: 'short',
        }).formatToParts(dateFromCalendarValue(props.date));
        const name = parts.find((part) => part.type === 'timeZoneName')?.value;

        return name && name !== 'GMT' ? name : props.timezone;
    } catch {
        return props.timezone;
    }
}

function joinTimeLabel(time: string, timezone: string | null) {
    return timezone ? `${time} ${timezone}` : time;
}

function dateFromCalendarValue(value: string) {
    const [year = '1970', month = '1', day = '1'] = value.split('-');
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

const tileMonthFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    timeZone: 'UTC',
});

const tileDayFormatter = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    timeZone: 'UTC',
});

const tileWeekdayFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
});
