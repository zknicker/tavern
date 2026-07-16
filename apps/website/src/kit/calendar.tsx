import { Elevated } from '../components/ui/surface.tsx';
import { cn } from '../lib/utils.ts';
import { Card } from './card.tsx';

export interface CalendarDayEvent {
    allDay?: boolean;
    endTime?: string;
    location?: string;
    notes?: string;
    startTime?: string;
    title: string;
}

export interface CalendarEventProps extends CalendarDayEvent {
    date: string;
    timezone?: string;
}

export interface CalendarDayProps {
    date: string;
    events: CalendarDayEvent[];
    timezone?: string;
    title?: string;
}

export function CalendarEvent(props: CalendarEventProps) {
    const date = dateFromCalendarValue(props.date);
    const timeLabel = formatEventTime(props);
    const detailText = [props.location, props.notes].filter(Boolean).join(' - ');
    const descriptionText = detailText || 'No description.';

    return (
        <Card>
            <div className="flex items-start gap-3">
                <CalendarTile date={date} />
                <div className="flex min-h-[72px] min-w-0 flex-1 flex-col gap-1">
                    <div className="flex min-w-0 items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate font-medium text-foreground text-sm">
                            {props.title}
                        </p>
                        <p className="shrink-0 font-medium text-info-foreground text-sm">
                            {timeLabel}
                        </p>
                    </div>
                    <p className="line-clamp-2 break-words text-muted-foreground text-sm">
                        {descriptionText}
                    </p>
                </div>
            </div>
        </Card>
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

export function CalendarDay(props: CalendarDayProps) {
    const date = dateFromCalendarValue(props.date);
    const timezone = timezoneDisplayNameForDate(date, props.timezone);

    return (
        <Card className="max-w-[30rem]">
            <section
                aria-label={props.title ?? formatFullDate(date)}
                className="flex min-w-0 gap-3 max-[420px]:flex-col"
            >
                <div className="flex w-[60px] shrink-0 flex-col items-center gap-2 max-[420px]:w-full max-[420px]:flex-row">
                    <CalendarTile date={date} />
                    {timezone ? (
                        <p className="max-w-[60px] text-center text-muted-foreground text-xs max-[420px]:text-left">
                            {timezone}
                        </p>
                    ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {props.events.length ? (
                        props.events.map((event, index) => (
                            <CalendarDayEventCard event={event} key={dayEventKey(event, index)} />
                        ))
                    ) : (
                        <Elevated
                            className="rounded-xl border border-border/45 px-3 py-4 text-muted-foreground text-sm"
                            offset={1}
                            shadowLevel={1}
                        >
                            No events scheduled.
                        </Elevated>
                    )}
                </div>
            </section>
        </Card>
    );
}

function CalendarDayEventCard({ event }: { event: CalendarDayEvent }) {
    const detailText = [event.location, event.notes].filter(Boolean).join(' - ');
    const descriptionText = detailText || 'No description.';

    return (
        <Elevated
            className="min-h-[4.5rem] rounded-xl border border-border/45 px-3 py-2.5"
            offset={1}
            shadowLevel={1}
        >
            <div className="flex min-w-0 items-baseline justify-between gap-3">
                <p className="min-w-0 truncate font-medium text-foreground text-sm">
                    {event.title}
                </p>
                <p className="shrink-0 font-medium text-info-foreground text-sm">
                    {formatDayEventTime(event)}
                </p>
            </div>
            <p className="mt-1 line-clamp-2 break-words text-muted-foreground text-sm">
                {descriptionText}
            </p>
        </Elevated>
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

function formatFullDate(date: Date) {
    return fullDateFormatter.format(date);
}

function formatEventTime(props: CalendarEventProps) {
    const timezoneLabel = timezoneDisplayNameForDate(
        dateFromCalendarValue(props.date),
        props.timezone
    );

    if (props.allDay) {
        return joinTimeLabel('All day', timezoneLabel);
    }

    if (!(props.startTime && props.endTime)) {
        return joinTimeLabel('Time TBD', timezoneLabel);
    }

    return joinTimeLabel(formatTimeRange(props.startTime, props.endTime), timezoneLabel);
}

function formatDayEventTime(event: CalendarDayEvent) {
    if (event.allDay) {
        return 'All day';
    }

    if (!(event.startTime && event.endTime)) {
        return 'Time TBD';
    }

    return formatTimeRange(event.startTime, event.endTime);
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

function timezoneDisplayNameForDate(date: Date, timezone: string | undefined) {
    if (!timezone) {
        return null;
    }

    try {
        const parts = new Intl.DateTimeFormat(undefined, {
            timeZone: timezone,
            timeZoneName: 'short',
        }).formatToParts(date);
        const name = parts.find((part) => part.type === 'timeZoneName')?.value;

        return name && name !== 'GMT' ? name : timezone;
    } catch {
        return timezone;
    }
}

function joinTimeLabel(time: string, timezone: string | null) {
    return timezone ? `${time} ${timezone}` : time;
}

function dateFromCalendarValue(value: string) {
    const [year = '1970', month = '1', day = '1'] = value.split('-');
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function dayEventKey(event: CalendarDayEvent, index: number) {
    return `${event.startTime ?? 'all-day'}-${event.endTime ?? 'open'}-${event.title}-${index}`;
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

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
});
