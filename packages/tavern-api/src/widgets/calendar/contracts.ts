import * as z from 'zod';

export const tavernRenderCalendarEventToolName = 'render_calendar_event' as const;
export const tavernRenderCalendarEventComponentId = 'tavern.render_calendar_event' as const;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const dateTimePattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/u;
const explicitOffsetPattern = /(?:z|[+-]\d{2}:?\d{2})$/iu;

export const tavernRenderCalendarEventPropsSchema = z
    .object({
        allDay: z.boolean().optional(),
        calendar: z.string().trim().min(1).max(80).optional(),
        date: z.string().trim().regex(isoDatePattern, 'Date must use YYYY-MM-DD.'),
        endTime: z.string().trim().regex(timePattern, 'End time must use HH:mm.').optional(),
        location: z.string().trim().min(1).max(160).optional(),
        notes: z.string().trim().min(1).max(280).optional(),
        startTime: z.string().trim().regex(timePattern, 'Start time must use HH:mm.').optional(),
        timezone: z.string().trim().min(1).max(80).optional(),
        title: z.string().trim().min(1).max(160),
    })
    .strict()
    .superRefine((event, context) => {
        if (!isCalendarDate(event.date)) {
            context.addIssue({
                code: 'custom',
                message: 'Date must be a real calendar date.',
                path: ['date'],
            });
        }

        const hasStart = Boolean(event.startTime);
        const hasEnd = Boolean(event.endTime);

        if (event.allDay && (hasStart || hasEnd)) {
            context.addIssue({
                code: 'custom',
                message: 'All-day events must not include startTime or endTime.',
                path: ['allDay'],
            });
            return;
        }

        if (hasStart !== hasEnd) {
            context.addIssue({
                code: 'custom',
                message: 'Timed events need both startTime and endTime.',
                path: hasStart ? ['endTime'] : ['startTime'],
            });
            return;
        }

        if (
            event.startTime &&
            event.endTime &&
            minutes(event.endTime) <= minutes(event.startTime)
        ) {
            context.addIssue({
                code: 'custom',
                message: 'endTime must be later than startTime.',
                path: ['endTime'],
            });
        }
    });

export type TavernRenderCalendarEventProps = z.infer<typeof tavernRenderCalendarEventPropsSchema>;

const googleCalendarTimeSchema = z
    .object({
        date: z.string().trim().regex(isoDatePattern, 'Date must use YYYY-MM-DD.').optional(),
        dateTime: z.string().trim().min(1).max(80).optional(),
        timeZone: z.string().trim().min(1).max(80).optional(),
    })
    .strict()
    .superRefine((value, context) => {
        const hasDate = Boolean(value.date);
        const hasDateTime = Boolean(value.dateTime);

        if (hasDate === hasDateTime) {
            context.addIssue({
                code: 'custom',
                message: 'Calendar times need exactly one of date or dateTime.',
            });
            return;
        }

        if (value.date && !isCalendarDate(value.date)) {
            context.addIssue({
                code: 'custom',
                message: 'Date must be a real calendar date.',
                path: ['date'],
            });
        }

        if (value.dateTime && !dateTimeParts(value.dateTime, value.timeZone)) {
            context.addIssue({
                code: 'custom',
                message: 'dateTime must start with an ISO date and HH:mm time.',
                path: ['dateTime'],
            });
        }
    });

export const tavernRenderCalendarEventToolInputSchema = z
    .object({
        calendar: z.string().trim().min(1).max(80).optional(),
        description: z.string().trim().min(1).max(280).optional(),
        end: googleCalendarTimeSchema.optional(),
        location: z.string().trim().min(1).max(160).optional(),
        notes: z.string().trim().min(1).max(280).optional(),
        start: googleCalendarTimeSchema,
        summary: z.string().trim().min(1).max(160).optional(),
        timezone: z.string().trim().min(1).max(80).optional(),
        title: z.string().trim().min(1).max(160).optional(),
    })
    .strict()
    .superRefine((event, context) => {
        if (!(event.summary || event.title)) {
            context.addIssue({
                code: 'custom',
                message: 'summary or title is required.',
                path: ['summary'],
            });
        }

        if (event.start.date) {
            if (event.end?.dateTime) {
                context.addIssue({
                    code: 'custom',
                    message: 'All-day events need end.date or no end.',
                    path: ['end', 'dateTime'],
                });
                return;
            }

            if (event.end?.date && event.end.date !== nextCalendarDate(event.start.date)) {
                context.addIssue({
                    code: 'custom',
                    message: 'Multi-day calendar events are not supported.',
                    path: ['end', 'date'],
                });
            }

            return;
        }

        if (!event.end?.dateTime) {
            context.addIssue({
                code: 'custom',
                message: 'Timed events need end.dateTime.',
                path: ['end', 'dateTime'],
            });
            return;
        }

        const timezone = event.start.timeZone ?? event.end.timeZone ?? event.timezone;
        const start = dateTimeParts(event.start.dateTime, event.start.timeZone ?? timezone);
        const end = dateTimeParts(event.end.dateTime, event.end.timeZone ?? timezone);

        if (!(start && end)) {
            return;
        }

        if (start.date !== end.date) {
            context.addIssue({
                code: 'custom',
                message: 'Multi-day calendar events are not supported.',
                path: ['end', 'dateTime'],
            });
            return;
        }

        if (minutes(end.time) <= minutes(start.time)) {
            context.addIssue({
                code: 'custom',
                message: 'end.dateTime must be later than start.dateTime.',
                path: ['end', 'dateTime'],
            });
        }
    })
    .transform((event) => normalizeCalendarEventToolInput(event));

export type TavernRenderCalendarEventToolInput = z.input<
    typeof tavernRenderCalendarEventToolInputSchema
>;

type GoogleCalendarTime = z.infer<typeof googleCalendarTimeSchema>;

interface GoogleCalendarEventToolInput {
    calendar?: string;
    description?: string;
    end?: GoogleCalendarTime;
    location?: string;
    notes?: string;
    start: GoogleCalendarTime;
    summary?: string;
    timezone?: string;
    title?: string;
}

function normalizeCalendarEventToolInput(
    event: GoogleCalendarEventToolInput
): TavernRenderCalendarEventProps {
    const title = event.summary ?? event.title ?? '';
    const timezone = event.start.timeZone ?? event.end?.timeZone ?? event.timezone;
    const notes = event.description ?? event.notes;
    const start = dateTimeParts(event.start.dateTime, event.start.timeZone ?? timezone);
    const end = dateTimeParts(event.end?.dateTime, event.end?.timeZone ?? timezone);
    const props: TavernRenderCalendarEventProps = event.start.date
        ? {
              allDay: true,
              date: event.start.date,
              title,
          }
        : {
              date: start?.date ?? '',
              endTime: end?.time ?? '',
              startTime: start?.time ?? '',
              title,
          };

    if (event.calendar) {
        props.calendar = event.calendar;
    }
    if (event.location) {
        props.location = event.location;
    }
    if (notes) {
        props.notes = notes;
    }
    if (timezone) {
        props.timezone = timezone;
    }

    return props;
}

function isCalendarDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

function minutes(value: string) {
    const [hour = '0', minute = '0'] = value.split(':');
    return Number(hour) * 60 + Number(minute);
}

function nextCalendarDate(value: string) {
    const [year = '0', month = '0', day = '0'] = value.split('-');
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + 1));
    return date.toISOString().slice(0, 10);
}

function dateTimeParts(value: string | undefined, timezone?: string) {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    const direct = dateTimePattern.exec(trimmed);

    if (!direct) {
        return null;
    }

    const [, date, time] = direct;

    if (!(isCalendarDate(date) && timePattern.test(time))) {
        return null;
    }

    if (timezone && isValidTimeZone(timezone) && explicitOffsetPattern.test(trimmed)) {
        const parsed = new Date(trimmed);

        if (Number.isFinite(parsed.getTime())) {
            return dateTimePartsInTimeZone(parsed, timezone);
        }
    }

    return { date, time };
}

function dateTimePartsInTimeZone(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? '';
    const day = value('day');
    const hour = value('hour');
    const minute = value('minute');
    const month = value('month');
    const year = value('year');

    if (!(year && month && day && hour && minute)) {
        return null;
    }

    return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

function isValidTimeZone(value: string) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
        return true;
    } catch {
        return false;
    }
}
