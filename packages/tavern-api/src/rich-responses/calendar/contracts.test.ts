import { describe, expect, test } from 'bun:test';
import { richResponseComponentId, richResponseRenderInputSchema } from '../contracts.ts';
import {
    richResponseCalendarDayPropsSchema,
    richResponseCalendarEventPropsSchema,
} from './contracts.ts';

describe('Rich Response calendar contracts', () => {
    test('render input accepts a calendar event spec', () => {
        const props = richResponseCalendarEventPropsSchema.parse({
            date: '2026-06-20',
            endTime: '14:00',
            startTime: '13:00',
            timezone: 'America/New_York',
            title: 'Q1 roadmap review',
        });

        const result = richResponseRenderInputSchema.safeParse({
            component: richResponseComponentId,
            fallback: { text: props.title },
            props: {
                spec: {
                    elements: {
                        event: { props, type: 'CalendarEvent' },
                    },
                    root: 'event',
                    state: {},
                },
            },
            target: 'chat.inline',
        });

        expect(result.success).toBe(true);
    });

    test('calendar day validates same-day event props', () => {
        const result = richResponseCalendarDayPropsSchema.safeParse({
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
        const result = richResponseCalendarEventPropsSchema.safeParse({
            date: '2026-06-20',
            startTime: '13:00',
            title: 'Q1 roadmap review',
        });

        expect(result.success).toBe(false);
    });
});
