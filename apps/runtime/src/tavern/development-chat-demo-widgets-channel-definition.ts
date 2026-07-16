import {
    widgetCalendarDayPropsSchema,
    widgetCalendarEventPropsSchema,
    widgetComposedChartPropsSchema,
} from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import { merchbaseSalesChartDemoRenderInput } from '../plugins/merchbase/dev/merchbase-sales-chart.demo';
import {
    calendarDayDemoProps,
    calendarEventDemoProps,
    chartDemoProps,
    lineChartDemoProps,
    widgetDemoRenderInput,
} from './development-chat-demo-basic-definitions';
import { composedChartDemoProps } from './development-chat-demo-composed-chart-definition';
import { htmlPreviewDemoWorkspacePath } from './development-chat-demo-html-preview-definition';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    type DevelopmentDemoMessage,
    demoTime,
    userMessage,
} from './development-chat-demo-types';

/**
 * Widget gallery channel: one completed turn per rendered widget, in catalog
 * order, closing with the invalid-payload fallback state. A focused surface
 * for eyeballing every kit-rendered widget without the mixed demo content in
 * the main demo channel.
 */
export function widgetsChannelDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.widgets;
    const turns = widgetTurns().map((turn) => widgetTurn(chatId, turn));

    return {
        chatId,
        color: '#8b5cf6',
        messages: turns
            .flatMap((turn) => turn.messages)
            .map((message, index) => ({
                ...message,
                createdAt: new Date(Date.parse(demoTime) + index * 45_000).toISOString(),
            })),
        responses: turns.flatMap((turn) => turn.responses),
        title: 'widgets',
    };
}

interface WidgetTurnSpec {
    reply: string;
    request: string;
    slug: string;
    widgets: {
        fallbackText: string;
        title: string;
        widget: Record<string, unknown>;
    }[];
}

function widgetTurns(): WidgetTurnSpec[] {
    const barChartProps = chartDemoProps();
    const lineChartProps = lineChartDemoProps();
    const composedChartProps = widgetComposedChartPropsSchema.parse(composedChartDemoProps());
    const eventProps = widgetCalendarEventPropsSchema.parse(calendarEventDemoProps());
    const dayProps = widgetCalendarDayPropsSchema.parse(calendarDayDemoProps());

    return [
        {
            reply: 'Here is the release checklist.',
            request: 'Show the release checklist as a table.',
            slug: 'table',
            widgets: [
                {
                    fallbackText: 'Table: Task, Owner, Done',
                    title: 'Table',
                    widget: widgetDemoRenderInput('table', 'Table: Task, Owner, Done', {
                        columns: [
                            { key: 'task', label: 'Task' },
                            { key: 'owner', label: 'Owner' },
                            { align: 'right', key: 'done', label: 'Done' },
                        ],
                        rows: [
                            { done: true, owner: 'Zach', task: 'Sign build' },
                            { done: false, owner: 'Wren', task: 'Update changelog' },
                            { done: false, owner: null, task: 'Tag release' },
                        ],
                    }),
                },
            ],
        },
        {
            reply: 'Same table widget, authored with the matrix shorthand.',
            request: 'Now a table from plain rows and columns.',
            slug: 'table_matrix',
            widgets: [
                {
                    fallbackText: 'Table: State, Population',
                    title: 'Table',
                    widget: widgetDemoRenderInput('table', 'Table: State, Population', {
                        columns: ['State', 'Population'],
                        rows: [
                            ['California', '39,538,223'],
                            ['Texas', '29,145,505'],
                            ['Florida', '23,372,215'],
                        ],
                    }),
                },
            ],
        },
        {
            reply: 'Here is the bar chart.',
            request: 'Chart quarterly revenue against expenses.',
            slug: 'bar_chart',
            widgets: [
                {
                    fallbackText: barChartProps.title,
                    title: 'Bar chart',
                    widget: widgetDemoRenderInput('bar-chart', barChartProps.title, barChartProps),
                },
            ],
        },
        {
            reply: 'Here is the daily traffic trend.',
            request: 'Show daily users and pageviews as a line chart.',
            slug: 'line_chart',
            widgets: [
                {
                    fallbackText: lineChartProps.title,
                    title: 'Line chart',
                    widget: widgetDemoRenderInput(
                        'line-chart',
                        lineChartProps.title,
                        lineChartProps
                    ),
                },
            ],
        },
        {
            reply: 'Here are units as bars with royalties as a line.',
            request: 'Combine units and royalties in one chart.',
            slug: 'composed_chart',
            widgets: [
                {
                    fallbackText: composedChartProps.title,
                    title: 'Chart',
                    widget: widgetDemoRenderInput(
                        'composed-chart',
                        composedChartProps.title,
                        composedChartProps
                    ),
                },
            ],
        },
        {
            reply: 'Here is the calendar event.',
            request: 'Show the roadmap review as a calendar event.',
            slug: 'calendar_event',
            widgets: [
                {
                    fallbackText: eventProps.title,
                    title: 'Calendar event',
                    widget: widgetDemoRenderInput('calendar-event', eventProps.title, eventProps),
                },
            ],
        },
        {
            reply: 'Here is the day view.',
            request: 'Show my Saturday schedule.',
            slug: 'calendar_day',
            widgets: [
                {
                    fallbackText: dayProps.title ?? dayProps.date,
                    title: 'Agenda',
                    widget: widgetDemoRenderInput(
                        'calendar-day',
                        dayProps.title ?? dayProps.date,
                        dayProps
                    ),
                },
            ],
        },
        {
            reply: 'Wrote a self-contained page in my workbench; preview below.',
            request: 'Build a tiny animated page and show it inline.',
            slug: 'html_preview',
            widgets: [
                {
                    fallbackText: 'Starfield demo',
                    title: 'HTML preview',
                    widget: widgetDemoRenderInput('html-preview', 'Starfield demo', {
                        height: 360,
                        path: htmlPreviewDemoWorkspacePath,
                        title: 'Starfield demo',
                    }),
                },
            ],
        },
        {
            reply: 'Here is the MerchBase sales trend.',
            request: 'Show 10 days of MerchBase sales.',
            slug: 'merchbase',
            widgets: [
                {
                    fallbackText: 'MerchBase sales',
                    title: 'MerchBase sales chart',
                    widget: merchbaseSalesChartDemoRenderInput(),
                },
            ],
        },
        {
            reply: 'This widget kind is unknown, so the fallback row renders instead.',
            request: 'Render a widget the catalog does not know.',
            slug: 'fallback',
            widgets: [
                {
                    fallbackText: 'Orbit map of tracked satellites',
                    title: 'Widget',
                    // Intentionally invalid: unknown component id. Seeds the
                    // stored-payload failure path so the gallery shows the
                    // visible fallback state.
                    widget: {
                        component: 'tavern.widget.orbit-map',
                        fallback: { text: 'Orbit map of tracked satellites' },
                        props: {},
                        target: 'chat.inline',
                    },
                },
            ],
        },
    ];
}

function widgetTurn(
    chatId: string,
    spec: WidgetTurnSpec
): {
    messages: DevelopmentDemoMessage[];
    responses: DevelopmentChatDemo['responses'];
} {
    const runId = `run_demo_widgets_${spec.slug}`;
    const requestMessageId = `msg_demo_widgets_${spec.slug}_request`;
    const responseMessageId = `msg_demo_widgets_${spec.slug}_response`;

    return {
        messages: [
            userMessage({
                chatId,
                content: spec.request,
                id: requestMessageId,
                nonce: `demo-widgets-${spec.slug}-request`,
            }),
            assistantMessage({
                chatId,
                content: spec.reply,
                id: responseMessageId,
                nonce: `demo-widgets-${spec.slug}-response`,
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: `rsp_demo_widgets_${spec.slug}`,
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: spec.reply,
                }),
                activities: spec.widgets.map((entry, index) => ({
                    completed_at: demoTime,
                    detail: entry.fallbackText,
                    id: `act_demo_widgets_${spec.slug}_${index + 1}`,
                    kind: 'widget' as const,
                    metadata: {
                        runtime: activityRuntimeMetadata({
                            chatId,
                            id: `act_demo_widgets_${spec.slug}_${index + 1}`,
                            requestMessageId,
                            runId,
                            sequence: index + 1,
                            source: 'demo.widget',
                        }),
                        widget: entry.widget,
                    },
                    sequence: index + 1,
                    started_at: demoTime,
                    status: 'completed' as const,
                    summary: entry.fallbackText,
                    title: entry.title,
                })),
            },
        ],
    };
}
