import { expect, test } from 'bun:test';
import { widgetRenderInputSchema } from '../contracts.ts';
import {
    tavernRenderCalendarDayComponentId,
    tavernRenderCalendarDayPropsSchema,
    tavernRenderCalendarDayToolInputSchema,
    tavernRenderCalendarEventComponentId,
    tavernRenderCalendarEventPropsSchema,
    tavernRenderCalendarEventToolInputSchema,
} from './contracts.ts';

test('widget render input accepts the calendar event widget demo payload', () => {
    const result = widgetRenderInputSchema.safeParse({
        component: tavernRenderCalendarEventComponentId,
        fallback: { text: 'Q1 roadmap review' },
        props: {
            calendar: 'Product',
            date: '2026-06-20',
            endTime: '14:00',
            location: 'Design room',
            startTime: '13:00',
            timezone: 'America/New_York',
            title: 'Q1 roadmap review',
        },
        target: 'chat.inline',
    });

    expect(result.success).toBe(true);
});

test('widget render input accepts a calendar day widget payload', () => {
    const result = widgetRenderInputSchema.safeParse({
        component: tavernRenderCalendarDayComponentId,
        fallback: { text: 'Saturday, June 20' },
        props: {
            date: '2026-06-20',
            events: [
                {
                    endTime: '12:45',
                    startTime: '12:00',
                    title: 'Lunch',
                },
                {
                    calendar: 'Product',
                    endTime: '14:00',
                    startTime: '13:00',
                    title: 'Q1 roadmap review',
                },
            ],
            timezone: 'America/New_York',
        },
        target: 'chat.inline',
    });

    expect(result.success).toBe(true);
});

test('calendar event props accept a timed single-day event', () => {
    const result = tavernRenderCalendarEventPropsSchema.safeParse({
        date: '2026-06-20',
        endTime: '14:00',
        startTime: '13:00',
        title: 'Q1 roadmap review',
    });

    expect(result.success).toBe(true);
});

test('calendar event props reject impossible dates', () => {
    const result = tavernRenderCalendarEventPropsSchema.safeParse({
        date: '2026-02-31',
        endTime: '14:00',
        startTime: '13:00',
        title: 'Q1 roadmap review',
    });

    expect(result.success).toBe(false);
});

test('calendar event props reject one-sided time ranges', () => {
    const result = tavernRenderCalendarEventPropsSchema.safeParse({
        date: '2026-06-20',
        startTime: '13:00',
        title: 'Q1 roadmap review',
    });

    expect(result.success).toBe(false);
});

test('calendar event props reject end times before start times', () => {
    const result = tavernRenderCalendarEventPropsSchema.safeParse({
        date: '2026-06-20',
        endTime: '12:30',
        startTime: '13:00',
        title: 'Q1 roadmap review',
    });

    expect(result.success).toBe(false);
});

test('calendar day props accept single-day events', () => {
    const result = tavernRenderCalendarDayPropsSchema.safeParse({
        date: '2026-06-20',
        events: [
            { allDay: true, title: 'Launch day' },
            { endTime: '14:00', startTime: '13:00', title: 'Q1 roadmap review' },
        ],
        timezone: 'America/New_York',
    });

    expect(result.success).toBe(true);
});

test('calendar day props reject impossible dates', () => {
    const result = tavernRenderCalendarDayPropsSchema.safeParse({
        date: '2026-02-31',
        events: [],
    });

    expect(result.success).toBe(false);
});

test('calendar event tool input normalizes Google timed events', () => {
    const result = tavernRenderCalendarEventToolInputSchema.safeParse({
        calendar: 'Product',
        description: 'Review roadmap priorities and launch risks.',
        end: { dateTime: '2026-06-20T14:00:00-04:00', timeZone: 'America/New_York' },
        location: 'Design room',
        start: { dateTime: '2026-06-20T13:00:00-04:00', timeZone: 'America/New_York' },
        summary: 'Q1 roadmap review',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
        calendar: 'Product',
        date: '2026-06-20',
        endTime: '14:00',
        location: 'Design room',
        notes: 'Review roadmap priorities and launch risks.',
        startTime: '13:00',
        timezone: 'America/New_York',
        title: 'Q1 roadmap review',
    });
});

test('calendar event tool input accepts Google all-day events', () => {
    const result = tavernRenderCalendarEventToolInputSchema.safeParse({
        end: { date: '2026-06-21' },
        start: { date: '2026-06-20' },
        summary: 'Launch day',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
        allDay: true,
        date: '2026-06-20',
        title: 'Launch day',
    });
});

test('calendar event tool input rejects multi-day all-day events', () => {
    const result = tavernRenderCalendarEventToolInputSchema.safeParse({
        end: { date: '2026-06-22' },
        start: { date: '2026-06-20' },
        summary: 'Launch window',
    });

    expect(result.success).toBe(false);
});

test('calendar day tool input normalizes and sorts Google events', () => {
    const result = tavernRenderCalendarDayToolInputSchema.safeParse({
        date: '2026-06-20',
        events: [
            {
                end: { dateTime: '2026-06-20T16:00:00-04:00', timeZone: 'America/New_York' },
                start: { dateTime: '2026-06-20T15:30:00-04:00', timeZone: 'America/New_York' },
                summary: 'Team standup',
            },
            {
                end: { dateTime: '2026-06-20T12:45:00-04:00', timeZone: 'America/New_York' },
                start: { dateTime: '2026-06-20T12:00:00-04:00', timeZone: 'America/New_York' },
                summary: 'Lunch',
            },
            {
                calendar: 'Product',
                end: { dateTime: '2026-06-20T14:00:00-04:00', timeZone: 'America/New_York' },
                start: { dateTime: '2026-06-20T13:00:00-04:00', timeZone: 'America/New_York' },
                summary: 'Q1 roadmap review',
            },
        ],
        timezone: 'America/New_York',
        title: 'Saturday schedule',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
        date: '2026-06-20',
        events: [
            {
                endTime: '12:45',
                startTime: '12:00',
                timezone: 'America/New_York',
                title: 'Lunch',
            },
            {
                calendar: 'Product',
                endTime: '14:00',
                startTime: '13:00',
                timezone: 'America/New_York',
                title: 'Q1 roadmap review',
            },
            {
                endTime: '16:00',
                startTime: '15:30',
                timezone: 'America/New_York',
                title: 'Team standup',
            },
        ],
        timezone: 'America/New_York',
        title: 'Saturday schedule',
    });
});

test('calendar day tool input rejects events outside the day', () => {
    const result = tavernRenderCalendarDayToolInputSchema.safeParse({
        date: '2026-06-20',
        events: [
            {
                end: { dateTime: '2026-06-21T11:00:00-04:00', timeZone: 'America/New_York' },
                start: { dateTime: '2026-06-21T10:00:00-04:00', timeZone: 'America/New_York' },
                summary: 'Next day review',
            },
        ],
    });

    expect(result.success).toBe(false);
});

test('calendar event tool input rejects multi-day timed events', () => {
    const result = tavernRenderCalendarEventToolInputSchema.safeParse({
        end: { dateTime: '2026-06-21T10:00:00-04:00', timeZone: 'America/New_York' },
        start: { dateTime: '2026-06-20T13:00:00-04:00', timeZone: 'America/New_York' },
        summary: 'Launch window',
    });

    expect(result.success).toBe(false);
});
