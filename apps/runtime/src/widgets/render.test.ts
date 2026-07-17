import { describe, expect, it } from 'vitest';
import {
    parseWidgetsFromAssistantContent,
    widgetActivity,
    widgetActivityIdForRun,
    widgetDisplayContent,
    widgetProgressFromActivity,
} from './render';

describe('Widget rendering', () => {
    it('parses a widget fence out of assistant content', () => {
        const parsed = parseWidgetsFromAssistantContent(
            [
                'Here is the chart.',
                '',
                '```widget:bar-chart',
                '{"title":"Sales today","xKey":"day","series":[{"key":"sold","label":"Sold"}],"data":[{"day":"Mon","sold":4}]}',
                '```',
                '',
                'Done.',
            ].join('\n')
        );

        expect(parsed).toMatchObject({
            displayContent: 'Here is the chart.\n\nDone.',
            invalid: [],
            widgets: [
                {
                    fallbackText: 'Sales today',
                    name: 'bar-chart',
                    render: {
                        component: 'tavern.widget.bar-chart',
                        fallback: { text: 'Sales today' },
                        target: 'chat.inline',
                    },
                },
            ],
        });
    });

    it('parses multiple widget fences in order', () => {
        const parsed = parseWidgetsFromAssistantContent(
            [
                'Schedule and stats:',
                '',
                '```widget:calendar-day',
                '{"date":"2026-07-06","events":[]}',
                '```',
                '',
                '```widget:table',
                '{"columns":["State","Population"],"rows":[["California","39,538,223"]]}',
                '```',
            ].join('\n')
        );

        expect(parsed?.widgets.map((widget) => widget.name)).toEqual(['calendar-day', 'table']);
        expect(parsed?.displayContent).toBe('Schedule and stats:');
    });

    it('strips invalid widget fences without creating a render payload', () => {
        const parsed = parseWidgetsFromAssistantContent(
            ['Here is the chart.', '', '```widget:bar-chart', 'not json', '```', '', 'Done.'].join(
                '\n'
            )
        );

        expect(parsed).toMatchObject({
            displayContent: 'Here is the chart.\n\nDone.',
            invalid: [{ error: 'widget:bar-chart props are not valid JSON.', name: 'bar-chart' }],
            widgets: [],
        });
    });

    it('parses an html-preview fence with a workspace path', () => {
        const parsed = parseWidgetsFromAssistantContent(
            [
                'Interactive demo below.',
                '',
                '```widget:html-preview',
                '{"path":"workbench/demos/orbit.html","height":600}',
                '```',
            ].join('\n')
        );

        expect(parsed).toMatchObject({
            displayContent: 'Interactive demo below.',
            invalid: [],
            widgets: [
                {
                    fallbackText: 'HTML preview: workbench/demos/orbit.html',
                    name: 'html-preview',
                    render: {
                        component: 'tavern.widget.html-preview',
                        props: { height: 600, path: 'workbench/demos/orbit.html' },
                        target: 'chat.inline',
                    },
                },
            ],
        });
    });

    it('strips html-preview fences with traversal or non-html paths', () => {
        const parsed = parseWidgetsFromAssistantContent(
            [
                'Look:',
                '',
                '```widget:html-preview',
                '{"path":"../outside.html"}',
                '```',
                '',
                '```widget:html-preview',
                '{"path":"notes.md"}',
                '```',
            ].join('\n')
        );

        expect(parsed?.widgets).toEqual([]);
        expect(parsed?.invalid).toHaveLength(2);
        expect(parsed?.displayContent).toBe('Look:');
    });

    it('parses a bare artifact fence with a workspace html path', () => {
        const parsed = parseWidgetsFromAssistantContent(
            [
                'Built the report page.',
                '',
                '```artifact',
                '{"path":"workbench/pages/report.html","title":"Q3 report"}',
                '```',
            ].join('\n')
        );

        expect(parsed).toMatchObject({
            displayContent: 'Built the report page.',
            invalid: [],
            widgets: [
                {
                    fallbackText: 'Q3 report',
                    name: 'artifact',
                    render: {
                        component: 'tavern.widget.artifact',
                        props: { path: 'workbench/pages/report.html', title: 'Q3 report' },
                        target: 'chat.inline',
                    },
                },
            ],
        });
    });

    it('strips invalid artifact fences and hides an in-flight one', () => {
        const parsed = parseWidgetsFromAssistantContent(
            ['Look:', '', '```artifact', '{"path":"notes.md"}', '```'].join('\n')
        );

        expect(parsed?.widgets).toEqual([]);
        expect(parsed?.invalid).toMatchObject([{ name: 'artifact' }]);
        expect(parsed?.displayContent).toBe('Look:');

        expect(
            widgetDisplayContent(
                ['Building it now.', '', '```artifact', '{"path":"work'].join('\n')
            )
        ).toBe('Building it now.');
    });

    it('rejects unknown widget names as invalid fences', () => {
        const parsed = parseWidgetsFromAssistantContent(
            ['```widget:sparkline', '{"values":[1,2]}', '```'].join('\n')
        );

        expect(parsed).toMatchObject({
            displayContent: '',
            invalid: [{ error: 'Unknown widget "sparkline".', name: 'sparkline' }],
            widgets: [],
        });
    });

    it('returns null for content without widget fences', () => {
        expect(parseWidgetsFromAssistantContent('Plain text with ```ts\ncode\n``` block.')).toBe(
            null
        );
    });

    it('hides an in-flight widget fence from visible reply text', () => {
        expect(
            widgetDisplayContent(
                ['Here is the chart.', '', '```widget:bar-chart', '{"title":"Sal'].join('\n')
            )
        ).toBe('Here is the chart.');
    });

    it('builds durable widget activity with fallback text', () => {
        const parsed = parseWidgetsFromAssistantContent(
            [
                '```widget:calendar-event',
                '{"title":"Q1 roadmap review","date":"2026-06-20","startTime":"13:00","endTime":"14:00"}',
                '```',
            ].join('\n')
        );
        const widget = parsed?.widgets[0];

        if (!widget) {
            throw new Error('Expected one parsed widget.');
        }

        const activity = widgetActivity({
            activityId: widgetActivityIdForRun('run_1', 0),
            agentId: 'main',
            messageId: 'msg_1',
            runId: 'run_1',
            sessionKey: 'session_1',
            source: 'agent-engine',
            startedAt: '2026-06-20T12:00:00.000Z',
            timestamp: '2026-06-20T12:00:01.000Z',
            widget,
        });

        expect(activity).toMatchObject({
            detail: 'Q1 roadmap review',
            id: 'act_run_1_widget_1',
            kind: 'widget',
            status: 'completed',
            title: 'Calendar event',
        });
        expect(activity.metadata).toMatchObject({
            widget: { component: 'tavern.widget.calendar-event' },
        });
    });

    it('projects widget activity into renderable progress', () => {
        const progress = widgetProgressFromActivity({
            id: 'act_widget_1',
            kind: 'widget',
            metadata: {
                widget: {
                    component: 'tavern.widget.table',
                    fallback: { text: 'Table: State' },
                    props: {
                        columns: [{ key: 'state', label: 'State' }],
                        rows: [{ state: 'California' }],
                    },
                    target: 'chat.inline',
                },
            },
            title: 'Table',
        });

        expect(progress).toMatchObject({
            component: 'tavern.widget.table',
            fallbackText: 'Table: State',
            validationError: null,
        });
    });

    it('surfaces invalid persisted widget payloads with fallback text', () => {
        const progress = widgetProgressFromActivity({
            id: 'act_widget_1',
            kind: 'widget',
            metadata: { widget: { component: 'tavern.widget.table' } },
            summary: 'Table: State',
            title: 'Table',
        });

        expect(progress).toMatchObject({
            component: 'tavern.widget.table',
            fallbackText: 'Table: State',
            props: null,
        });
        expect(progress?.validationError).toBeTruthy();
    });
});
