import { expect, test } from 'bun:test';
import type { TavernResponseActivity } from '@tavern/sdk';
import { widgetRowFromActivity } from './widgets.ts';

test('projects calendar event widget activity metadata into a widget row', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'tavern.render_calendar_event',
                    fallback: { text: 'Q1 roadmap review' },
                    props: {
                        calendar: 'Product',
                        date: '2026-06-20',
                        endTime: '14:00',
                        location: 'Design room',
                        startTime: '13:00',
                        title: 'Q1 roadmap review',
                    },
                    target: 'chat.inline',
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
            component: 'tavern.render_calendar_event',
            fallbackText: 'Q1 roadmap review',
            id: 'act_run_1_ui_1',
            target: 'chat.inline',
            validationError: null,
        },
    });
    expect(row?.widget.props).toMatchObject({
        date: '2026-06-20',
        title: 'Q1 roadmap review',
    });
});

test('projects calendar day widget activity metadata into a widget row', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'tavern.render_calendar_day',
                    fallback: { text: 'Friday, June 20' },
                    props: {
                        date: '2026-06-20',
                        events: [
                            {
                                endTime: '12:45',
                                startTime: '12:00',
                                title: 'Lunch',
                            },
                            {
                                endTime: '14:00',
                                startTime: '13:00',
                                title: 'Q1 roadmap review',
                            },
                        ],
                        timezone: 'America/New_York',
                    },
                    target: 'chat.inline',
                },
            },
        }),
        actor: { id: 'main', kind: 'agent' },
        sessionKey: 'agent:main:tavern:cht_1',
    });

    expect(row).toMatchObject({
        kind: 'widget',
        widget: {
            component: 'tavern.render_calendar_day',
            fallbackText: 'Friday, June 20',
            target: 'chat.inline',
            validationError: null,
        },
    });
    expect(row?.widget.props).toMatchObject({
        date: '2026-06-20',
        events: [{ title: 'Lunch' }, { title: 'Q1 roadmap review' }],
    });
});

test('uses fallback rendering for invalid calendar event props', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'tavern.render_calendar_event',
                    fallback: { text: 'Broken calendar event' },
                    props: {
                        date: '2026-02-31',
                        title: 'Broken calendar event',
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
            component: 'tavern.render_calendar_event',
            fallbackText: 'Broken calendar event',
            props: null,
            target: 'chat.inline',
        },
    });
    expect(row?.widget.validationError).toBeTruthy();
});

test('uses fallback rendering for invalid calendar day props', () => {
    const row = widgetRowFromActivity({
        activity: activity({
            metadata: {
                widget: {
                    component: 'tavern.render_calendar_day',
                    fallback: { text: 'Broken calendar day' },
                    props: {
                        date: '2026-02-31',
                        events: [],
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
            component: 'tavern.render_calendar_day',
            fallbackText: 'Broken calendar day',
            props: null,
            target: 'chat.inline',
        },
    });
    expect(row?.widget.validationError).toBeTruthy();
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
