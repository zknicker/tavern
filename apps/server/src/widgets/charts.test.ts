import { expect, test } from 'bun:test';
import type { TavernResponseActivity } from '@tavern/sdk';
import { widgetRowFromActivity } from './widgets.ts';

test('projects widget activity metadata into a chart row', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'tavern.render_bar_chart',
                    fallback: { text: 'Quarterly Revenue' },
                    target: 'chat.inline',
                    props: {
                        data: [{ quarter: 'Q1', revenue: 12_000 }],
                        series: [{ key: 'revenue', label: 'Revenue' }],
                        title: 'Quarterly Revenue',
                        xKey: 'quarter',
                    },
                },
            },
        }),
        actor: { id: 'main', kind: 'agent' },
        sessionKey: 'agent:main:tavern:cht_1',
    });

    expect(row).toMatchObject({
        actor: { id: 'main', kind: 'agent' },
        id: 'act_run_1_ui_1',
        kind: 'widget',
        sessionKey: 'agent:main:tavern:cht_1',
        widget: {
            component: 'tavern.render_bar_chart',
            fallbackText: 'Quarterly Revenue',
            id: 'act_run_1_ui_1',
            target: 'chat.inline',
            validationError: null,
        },
    });
    expect(row?.widget.props).toMatchObject({
        data: [{ quarter: 'Q1', revenue: 12_000 }],
        title: 'Quarterly Revenue',
    });
});

test('projects line chart widget activity metadata into a chart row', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'tavern.render_line_chart',
                    fallback: { text: 'Monthly Signups' },
                    target: 'chat.inline',
                    props: {
                        data: [
                            { month: 'Jan', net: -12 },
                            { month: 'Feb', net: 18 },
                        ],
                        series: [{ key: 'net', label: 'Net' }],
                        title: 'Monthly Signups',
                        xKey: 'month',
                    },
                },
            },
        }),
        actor: { id: 'main', kind: 'agent' },
        sessionKey: 'agent:main:tavern:cht_1',
    });

    expect(row).toMatchObject({
        kind: 'widget',
        widget: {
            component: 'tavern.render_line_chart',
            fallbackText: 'Monthly Signups',
            target: 'chat.inline',
            validationError: null,
        },
    });
    expect(row?.widget.props).toMatchObject({
        data: [
            { month: 'Jan', net: -12 },
            { month: 'Feb', net: 18 },
        ],
        title: 'Monthly Signups',
    });
});

test('projects composed chart widget activity metadata into a chart row', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'tavern.render_composed_chart',
                    fallback: { text: 'Revenue and Profit' },
                    target: 'chat.inline',
                    props: {
                        barSeries: [{ key: 'revenue', label: 'Revenue' }],
                        barUnit: 'USD',
                        data: [
                            { month: '2026-01-01', profit: 31, revenue: 120 },
                            { month: '2026-02-01', profit: 34, revenue: 138 },
                        ],
                        lineUnit: '%',
                        lineSeries: [{ key: 'profit', label: 'Profit' }],
                        title: 'Revenue and Profit',
                        xKey: 'month',
                    },
                },
            },
        }),
        actor: { id: 'main', kind: 'agent' },
        sessionKey: 'agent:main:tavern:cht_1',
    });

    expect(row).toMatchObject({
        kind: 'widget',
        widget: {
            component: 'tavern.render_composed_chart',
            fallbackText: 'Revenue and Profit',
            target: 'chat.inline',
            validationError: null,
        },
    });
    expect(row?.widget.props).toMatchObject({
        barSeries: [{ key: 'revenue', label: 'Revenue' }],
        barUnit: 'USD',
        lineSeries: [{ key: 'profit', label: 'Profit' }],
        lineUnit: '%',
        title: 'Revenue and Profit',
    });
});

test('uses fallback rendering for invalid line chart props', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'tavern.render_line_chart',
                    fallback: { text: 'Broken line chart' },
                    props: {
                        data: [{ month: 'Jan', net: 'nope' }],
                        series: [{ key: 'net', label: 'Net' }],
                        title: 'Broken line chart',
                        xKey: 'month',
                    },
                    target: 'chat.inline',
                },
            },
        }),
        actor: { id: 'main', kind: 'agent' },
        sessionKey: null,
    });

    expect(row).toMatchObject({
        kind: 'widget',
        widget: {
            component: 'tavern.render_line_chart',
            fallbackText: 'Broken line chart',
            props: null,
            target: 'chat.inline',
        },
    });
    expect(row?.widget.validationError).toBeTruthy();
});

test('keeps invalid widget payloads renderable through fallback text', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'missing.target',
                    fallback: { text: 'Fallback chart' },
                    props: {},
                },
            },
        }),
        actor: { id: 'main', kind: 'agent' },
        sessionKey: null,
    });

    expect(row).toMatchObject({
        kind: 'widget',
        widget: {
            component: 'missing.target',
            fallbackText: 'Fallback chart',
            props: null,
            target: null,
        },
    });
    expect(row?.widget.validationError).toBeTruthy();
});

test('uses fallback when ui.render carries a model-authored widget id', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'tavern.render_bar_chart',
                    fallback: { text: 'Fallback chart' },
                    id: 'model-owned-id',
                    props: {
                        data: [{ quarter: 'Q1', revenue: 12_000 }],
                        series: [{ key: 'revenue', label: 'Revenue' }],
                        title: 'Quarterly Revenue',
                        xKey: 'quarter',
                    },
                    target: 'chat.inline',
                },
            },
        }),
        actor: { id: 'main', kind: 'agent' },
        sessionKey: null,
    });

    expect(row).toMatchObject({
        kind: 'widget',
        widget: {
            component: 'tavern.render_bar_chart',
            fallbackText: 'Fallback chart',
            props: null,
        },
    });
    expect(row?.widget.validationError).toBeTruthy();
});

test('uses fallback rendering for unknown widget components', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'tavern.render_weather',
                    fallback: { text: 'Weather unavailable' },
                    props: { city: 'New York' },
                    target: 'chat.inline',
                },
            },
        }),
        actor: { id: 'main', kind: 'agent' },
        sessionKey: null,
    });

    expect(row).toMatchObject({
        kind: 'widget',
        widget: {
            component: 'tavern.render_weather',
            fallbackText: 'Weather unavailable',
            props: null,
            target: 'chat.inline',
            validationError: 'Unknown widget component.',
        },
    });
});

test('ignores non-widget activity', () => {
    expect(
        widgetRowFromActivity({
            activity: activity({ kind: 'custom', metadata: {} }),
            actor: { id: 'main', kind: 'agent' },
            sessionKey: null,
        })
    ).toBeNull();
});

function activity(overrides: Partial<TavernResponseActivity>): TavernResponseActivity {
    return {
        artifact_ids: [],
        chat_id: 'cht_1',
        completed_at: '2026-06-17T18:00:01.000Z',
        detail: null,
        id: 'act_run_1_ui_1',
        kind: 'widget',
        metadata: {},
        response_id: 'rsp_1',
        sequence: 1,
        started_at: '2026-06-17T18:00:00.000Z',
        status: 'completed',
        summary: null,
        title: 'Widget',
        updated_at: '2026-06-17T18:00:01.000Z',
        ...overrides,
    };
}
