import { describe, expect, test } from 'bun:test';
import { widgetComponentId, widgetRenderInputSchema } from '../contracts.ts';
import { widgetCalendarDayPropsSchema, widgetCalendarEventPropsSchema } from './contracts.ts';

describe('Widget calendar contracts', () => {
    test('render input accepts calendar event props', () => {
        const props = widgetCalendarEventPropsSchema.parse({
            date: '2026-06-20',
            endTime: '14:00',
            startTime: '13:00',
            timezone: 'America/New_York',
            title: 'Q1 roadmap review',
        });

        const result = widgetRenderInputSchema.safeParse({
            component: widgetComponentId('calendar-event'),
            fallback: { text: props.title },
            props,
            target: 'chat.inline',
        });

        expect(result.success).toBe(true);
    });

    test('calendar day validates same-day event props', () => {
        const result = widgetCalendarDayPropsSchema.safeParse({
            date: '2026-06-20',
            events: [
                {
                    endTime: '12:45',
                    startTime: '12:00',
                    title: 'Lunch',
                },
            ],
            title: 'Saturday schedule',
        });

        expect(result.success).toBe(true);
    });

    test('timed events need an end time', () => {
        const result = widgetCalendarEventPropsSchema.safeParse({
            date: '2026-06-20',
            startTime: '13:00',
            title: 'Q1 roadmap review',
        });

        expect(result.success).toBe(false);
    });
});
