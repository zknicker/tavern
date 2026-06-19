import * as z from 'zod';
import {
    dateTimeParts,
    isCalendarDate,
    isoDatePattern,
    minutes,
    nextCalendarDate,
    timePattern,
} from './datetime.ts';

export const tavernRenderCalendarEventToolName = 'render_calendar_event' as const;
export const tavernRenderCalendarEventComponentId = 'tavern.render_calendar_event' as const;
export const tavernRenderCalendarDayToolName = 'render_calendar_day' as const;
export const tavernRenderCalendarDayComponentId = 'tavern.render_calendar_day' as const;

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

export const tavernRenderCalendarDayEventPropsSchema = z
    .object({
        allDay: z.boolean().optional(),
        calendar: z.string().trim().min(1).max(80).optional(),
        endTime: z.string().trim().regex(timePattern, 'End time must use HH:mm.').optional(),
        location: z.string().trim().min(1).max(160).optional(),
        notes: z.string().trim().min(1).max(280).optional(),
        startTime: z.string().trim().regex(timePattern, 'Start time must use HH:mm.').optional(),
        timezone: z.string().trim().min(1).max(80).optional(),
        title: z.string().trim().min(1).max(160),
    })
    .strict()
    .superRefine((event, context) => {
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

export type TavernRenderCalendarDayEventProps = z.infer<
    typeof tavernRenderCalendarDayEventPropsSchema
>;

export const tavernRenderCalendarDayPropsSchema = z
    .object({
        date: z.string().trim().regex(isoDatePattern, 'Date must use YYYY-MM-DD.'),
        events: z.array(tavernRenderCalendarDayEventPropsSchema).max(12),
        timezone: z.string().trim().min(1).max(80).optional(),
        title: z.string().trim().min(1).max(160).optional(),
    })
    .strict()
    .superRefine((day, context) => {
        if (!isCalendarDate(day.date)) {
            context.addIssue({
                code: 'custom',
                message: 'Date must be a real calendar date.',
                path: ['date'],
            });
        }
    });

export type TavernRenderCalendarDayProps = z.infer<typeof tavernRenderCalendarDayPropsSchema>;

export const tavernRenderCalendarDayToolInputSchema = z
    .object({
        date: z.string().trim().regex(isoDatePattern, 'Date must use YYYY-MM-DD.'),
        events: z.array(tavernRenderCalendarEventToolInputSchema).max(12).default([]),
        timezone: z.string().trim().min(1).max(80).optional(),
        title: z.string().trim().min(1).max(160).optional(),
    })
    .strict()
    .superRefine((day, context) => {
        if (!isCalendarDate(day.date)) {
            context.addIssue({
                code: 'custom',
                message: 'Date must be a real calendar date.',
                path: ['date'],
            });
        }

        for (const [index, event] of day.events.entries()) {
            if (event.date !== day.date) {
                context.addIssue({
                    code: 'custom',
                    message: 'Calendar day events must match the day date.',
                    path: ['events', index, 'start'],
                });
            }
        }
    })
    .transform((day) => normalizeCalendarDayToolInput(day));

export type TavernRenderCalendarDayToolInput = z.input<
    typeof tavernRenderCalendarDayToolInputSchema
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

function normalizeCalendarDayToolInput(input: {
    date: string;
    events: TavernRenderCalendarEventProps[];
    timezone?: string;
    title?: string;
}): TavernRenderCalendarDayProps {
    const events = input.events
        .map(calendarDayEventFromCalendarEvent)
        .sort((left, right) => dayEventSortValue(left) - dayEventSortValue(right));
    const timezone = input.timezone ?? input.events.find((event) => event.timezone)?.timezone;
    const props: TavernRenderCalendarDayProps = {
        date: input.date,
        events,
    };

    if (input.title) {
        props.title = input.title;
    }
    if (timezone) {
        props.timezone = timezone;
    }

    return props;
}

function calendarDayEventFromCalendarEvent(
    event: TavernRenderCalendarEventProps
): TavernRenderCalendarDayEventProps {
    const { date: _date, ...props } = event;
    return props;
}

function dayEventSortValue(event: TavernRenderCalendarDayEventProps) {
    return event.allDay ? -1 : minutes(event.startTime ?? '23:59');
}
