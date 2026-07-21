import { describe, expect, it } from 'vitest';
import {
    parseWidgetsFromAssistantContent,
    widgetActivity,
    widgetActivityIdForRun,
    widgetDisplayContent,
    widgetProgressFromActivity,
} from './render';

describe('Widget rendering', () => {
    it('parses a visual body fence into the visual render envelope', () => {
        const parsed = parseWidgetsFromAssistantContent(
            [
                'Here is the layout.',
                '',
                '```visual Weekly sales',
                '<div><h1>Weekly sales</h1><svg viewBox="0 0 10 10"></svg></div>',
                '```',
                '',
                'Done.',
            ].join('\n')
        );

        expect(parsed).toMatchObject({
            displayContent: 'Here is the layout.\n\nDone.',
            invalid: [],
            widgets: [
                {
                    fallbackText: 'Weekly sales',
                    name: 'visual',
                    render: {
                        component: 'tavern.widget.visual',
                        fallback: { text: 'Weekly sales' },
                        props: {
                            html: '<div><h1>Weekly sales</h1><svg viewBox="0 0 10 10"></svg></div>',
                            title: 'Weekly sales',
                        },
                        target: 'chat.inline',
                    },
                },
            ],
        });
    });

    it('keeps visual and artifact fences in document order', () => {
        const parsed = parseWidgetsFromAssistantContent(
            [
                '```visual',
                '<h2>Flow</h2>',
                '```',
                '',
                '```artifact',
                '{"path":"workbench/pages/report.html","title":"Q3 report"}',
                '```',
            ].join('\n')
        );

        expect(parsed?.widgets.map((widget) => widget.name)).toEqual(['visual', 'artifact']);
    });

    it('strips an empty visual fence as invalid', () => {
        const parsed = parseWidgetsFromAssistantContent(
            ['Before.', '', '```visual', '   ', '```', '', 'After.'].join('\n')
        );

        expect(parsed).toMatchObject({
            displayContent: 'Before.\n\nAfter.',
            invalid: [{ error: 'visual fence is empty.', name: 'visual' }],
            widgets: [],
        });
    });

    it('hides an in-flight visual fence from visible reply text', () => {
        expect(widgetDisplayContent('Drawing now.\n\n```visual\n<div><h1>Part')).toBe(
            'Drawing now.'
        );
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

    it('strips retired catalog widget fences as invalid', () => {
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
            invalid: [{ error: 'Unknown widget "bar-chart".', name: 'bar-chart' }],
            widgets: [],
        });
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
            ['```visual Q1 roadmap', '<h2>Q1 roadmap</h2>', '```'].join('\n')
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
            detail: 'Q1 roadmap',
            id: 'act_run_1_widget_1',
            kind: 'widget',
            status: 'completed',
            title: 'Visual',
        });
        expect(activity.metadata).toMatchObject({
            widget: { component: 'tavern.widget.visual' },
        });
    });

    it('projects visual activity into renderable progress', () => {
        const progress = widgetProgressFromActivity({
            id: 'act_widget_1',
            kind: 'widget',
            metadata: {
                widget: {
                    component: 'tavern.widget.visual',
                    fallback: { text: 'Weekly sales' },
                    props: { html: '<h2>Weekly sales</h2>', title: 'Weekly sales' },
                    target: 'chat.inline',
                },
            },
            title: 'Visual',
        });

        expect(progress).toMatchObject({
            component: 'tavern.widget.visual',
            fallbackText: 'Weekly sales',
            validationError: null,
        });
    });

    it('surfaces retired stored widget payloads with fallback text', () => {
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
