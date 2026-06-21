import { describe, expect, test } from 'bun:test';
import {
    richResponseComponentId,
    richResponseRenderInputSchema,
    richResponseTablePropsSchema,
} from './contracts.ts';

describe('Rich Response contracts', () => {
    test('table props accept matrix shorthand and normalize to keyed rows', () => {
        const props = richResponseTablePropsSchema.parse({
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
        const props = richResponseTablePropsSchema.parse({
            columns: ['State', 'Population'],
            rows: [['California']],
        });

        expect(props.rows).toEqual([{ col_1: 'California', col_2: null }]);
    });

    test('render input rejects stale chart prop names', () => {
        const result = richResponseRenderInputSchema.safeParse({
            component: richResponseComponentId,
            fallback: { text: "Today's Merch sales" },
            props: {
                spec: {
                    elements: {
                        chart: {
                            props: {
                                barY: ['units'],
                                data: [{ day: '06-21', royalties: 20.22, units: 5 }],
                                lineY: 'royalties',
                                title: 'Units and royalties',
                                x: 'day',
                            },
                            type: 'ComposedChart',
                        },
                    },
                    root: 'chart',
                    state: {},
                },
            },
            target: 'chat.inline',
        });

        expect(result.success).toBe(false);
    });

    test('render input rejects stale calendar event prop names', () => {
        const result = richResponseRenderInputSchema.safeParse({
            component: richResponseComponentId,
            fallback: { text: 'Hamilton' },
            props: {
                spec: {
                    elements: {
                        event: {
                            props: {
                                end: '2026-10-04T20:00:00-04:00',
                                start: '2026-10-04T19:00:00-04:00',
                                summary: 'Hamilton',
                            },
                            type: 'CalendarEvent',
                        },
                    },
                    root: 'event',
                    state: {},
                },
            },
            target: 'chat.inline',
        });

        expect(result.success).toBe(false);
    });

    test('render input accepts json-render state, repeat, visibility, actions, and dynamic props', () => {
        const itemTemplate = ['$', '{title}: ', '$', '{units} units'].join('');
        const result = richResponseRenderInputSchema.safeParse({
            component: richResponseComponentId,
            fallback: { text: 'Sales list' },
            props: {
                spec: {
                    elements: {
                        item: {
                            children: [],
                            props: {
                                text: { $template: itemTemplate },
                            },
                            type: 'Text',
                            visible: { $item: 'visible' },
                        },
                        list: {
                            children: ['item'],
                            on: {
                                press: {
                                    action: 'setState',
                                    params: {
                                        statePath: '/selected',
                                        value: { $state: '/items/0/id' },
                                    },
                                },
                            },
                            props: {},
                            repeat: { key: 'id', statePath: '/items' },
                            type: 'Stack',
                            watch: {
                                '/selected': {
                                    action: 'setState',
                                    params: { statePath: '/touched', value: true },
                                },
                            },
                        },
                    },
                    root: 'list',
                    state: {
                        items: [{ id: 'a', title: 'Today', units: 5, visible: true }],
                    },
                },
            },
            target: 'chat.inline',
        });

        expect(result.success).toBe(true);
    });
});
