import { describe, expect, test } from 'bun:test';
import {
    parseWidgetPayload,
    widgetFallbackText,
    widgetRenderInputSchema,
    widgetTablePropsSchema,
} from './contracts.ts';

describe('Widget contracts', () => {
    test('table props accept matrix shorthand and normalize to keyed rows', () => {
        const props = widgetTablePropsSchema.parse({
            columns: ['State', 'Population'],
            rows: [
                ['California', '39,538,223'],
                ['Texas', '29,145,505'],
            ],
        });

        expect(props).toEqual({
            columns: [
                { key: 'col_1', label: 'State' },
                { key: 'col_2', label: 'Population' },
            ],
            rows: [
                { col_1: 'California', col_2: '39,538,223' },
                { col_1: 'Texas', col_2: '29,145,505' },
            ],
        });
    });

    test('table matrix shorthand fills missing cells with null', () => {
        const props = widgetTablePropsSchema.parse({
            columns: ['State', 'Population'],
            rows: [['California']],
        });

        expect(props.rows).toEqual([{ col_1: 'California', col_2: null }]);
    });

    test('parseWidgetPayload produces a durable render envelope', () => {
        const parsed = parseWidgetPayload('bar-chart', {
            data: [
                { day: 'Mon', sold: 4 },
                { day: 'Tue', sold: 7 },
            ],
            series: [{ key: 'sold', label: 'Sold' }],
            title: 'Weekly sales',
            xKey: 'day',
        });

        expect(parsed.name).toBe('bar-chart');
        expect(parsed.fallbackText).toBe('Weekly sales');
        expect(parsed.render.component).toBe('tavern.widget.bar-chart');
        expect(parsed.render.target).toBe('chat.inline');
    });

    test('parseWidgetPayload normalizes table matrix shorthand', () => {
        const parsed = parseWidgetPayload('table', {
            columns: ['State', 'Population'],
            rows: [['California', '39,538,223']],
        });

        expect(parsed.render.component).toBe('tavern.widget.table');
        expect(parsed.fallbackText).toBe('Table: State, Population');
        expect((parsed.render.props as { rows: unknown[] }).rows).toEqual([
            { col_1: 'California', col_2: '39,538,223' },
        ]);
    });

    test('parseWidgetPayload rejects unknown widget names', () => {
        expect(() => parseWidgetPayload('sparkline', { values: [1, 2] })).toThrow(
            'Unknown widget "sparkline".'
        );
    });

    test('parseWidgetPayload rejects invalid props with a pointed error', () => {
        expect(() =>
            parseWidgetPayload('calendar-event', {
                date: '2026-10-04',
                startTime: '19:00',
                title: 'Hamilton',
            })
        ).toThrow(/widget:calendar-event/);
    });

    test('render input rejects mismatched component and props', () => {
        const result = widgetRenderInputSchema.safeParse({
            component: 'tavern.widget.calendar-event',
            fallback: { text: 'Hamilton' },
            props: {
                end: '2026-10-04T20:00:00-04:00',
                start: '2026-10-04T19:00:00-04:00',
                summary: 'Hamilton',
            },
            target: 'chat.inline',
        });

        expect(result.success).toBe(false);
    });

    test('widget fallback text prefers title, then widget-specific shape', () => {
        expect(widgetFallbackText('line-chart', { title: 'Royalties trend' })).toBe(
            'Royalties trend'
        );
        expect(widgetFallbackText('calendar-day', { date: '2026-07-06', events: [] })).toBe(
            'Agenda for 2026-07-06'
        );
        expect(widgetFallbackText('merchbase-sales-chart', {})).toBe('MerchBase sales chart');
    });
});
