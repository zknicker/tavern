import * as z from 'zod';
import { isCalendarDate, isoDatePattern, minutes, timePattern } from './datetime.ts';

export const richResponseCalendarEventComponentType = 'CalendarEvent' as const;
export const richResponseCalendarDayComponentType = 'CalendarDay' as const;

export const richResponseCalendarEventPropsSchema = z
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

export type RichResponseCalendarEventProps = z.infer<typeof richResponseCalendarEventPropsSchema>;

export const richResponseCalendarDayEventPropsSchema = z
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

export type RichResponseCalendarDayEventProps = z.infer<
    typeof richResponseCalendarDayEventPropsSchema
>;

export const richResponseCalendarDayPropsSchema = z
    .object({
        date: z.string().trim().regex(isoDatePattern, 'Date must use YYYY-MM-DD.'),
        events: z.array(richResponseCalendarDayEventPropsSchema).max(12),
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

export type RichResponseCalendarDayProps = z.infer<typeof richResponseCalendarDayPropsSchema>;
