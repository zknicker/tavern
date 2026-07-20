import {
    type WidgetBarChartProps,
    type WidgetCalendarDayProps,
    type WidgetCalendarEventProps,
    type WidgetLineChartProps,
    type WidgetName,
    type WidgetRenderInput,
    widgetCalendarDayPropsSchema,
    widgetCalendarEventPropsSchema,
    widgetComponentId,
    widgetLineChartPropsSchema,
    widgetRenderInputSchema,
} from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoTime,
    ownerMessage,
    userMessage,
} from './development-chat-demo-types';

const longPastedOAuthJson =
    '{"installed":{"client_id":"535034123734-jckkmfjk3qajgeo8mhcstmtkbdrt0gn2.apps.googleusercontent.com","project_id":"tavern-static-preview","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"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cret","redirect_uris":["http://localhost"]}}';
const longOAuthConsentUrl =
    'https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=535034123734-jckkmfjk3qajgeo8mhcstmtkbdrt0gn2.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A1&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events.readonly&access_type=offline&prompt=consent&state=tavern_static_preview_long_agent_response_token';

export function lineChartDemo(): DevelopmentChatDemo {
    const chartProps = widgetLineChartPropsSchema.parse(lineChartDemoProps());
    const chatId = developmentChatDemoIds.lineChart;
    const runId = 'run_demo_line_chart';
    const requestMessageId = 'msg_demo_line_chart_request';
    const responseMessageId = 'msg_demo_line_chart_response';

    return {
        chatId,
        title: 'Demo: Line Chart',
        messages: [
            userMessage({
                chatId,
                content: 'Show daily users and pageviews as a line chart.',
                id: requestMessageId,
                nonce: 'demo-line-chart-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here is the daily traffic trend.',
                id: responseMessageId,
                nonce: 'demo-line-chart-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_line_chart',
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: 'Rendered a line chart demo.',
                }),
                activities: [
                    {
                        completed_at: demoTime,
                        detail: chartProps.title,
                        id: 'act_demo_line_chart_widget',
                        kind: 'widget',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_line_chart_widget',
                                requestMessageId,
                                runId,
                                sequence: 1,
                                source: 'demo.widget',
                            }),
                            widget: lineChartDemoRenderInput(chartProps),
                        },
                        sequence: 1,
                        started_at: demoTime,
                        status: 'completed',
                        summary: chartProps.title,
                        title: 'Line chart',
                    },
                ],
            },
        ],
    };
}

export function artifactLinksDemo(): DevelopmentChatDemo {
    return completedTextDemo({
        chatId: developmentChatDemoIds.artifactLinks,
        request: 'Show me the inspectable outputs you created.',
        reply: [
            'Created two inspectable Memory notes:',
            '',
            '- [Artifact Panel brief](grotto://wiki/Demos/Panel%20Brief.md)',
            '- [Inspectable output rules](grotto://wiki/Demos/Output%20Rules.md)',
            '',
            'Workspace links use the same shape. This one opens the panel with the current unsupported state: [preview.html](grotto://workspace/out/preview.html).',
        ].join('\n'),
        slug: 'artifact_links',
        summary: 'Linked inspectable outputs for the Artifact Panel demo.',
        title: 'Demo: Artifact Links',
    });
}

export function calendarEventDemo(): DevelopmentChatDemo {
    const eventProps = widgetCalendarEventPropsSchema.parse(calendarEventDemoProps());
    const chatId = developmentChatDemoIds.calendarEvent;
    const runId = 'run_demo_calendar_event';
    const requestMessageId = 'msg_demo_calendar_event_request';
    const responseMessageId = 'msg_demo_calendar_event_response';

    return {
        chatId,
        title: 'Demo: Calendar Event',
        messages: [
            userMessage({
                chatId,
                content: 'Show my roadmap review as a calendar event.',
                id: requestMessageId,
                nonce: 'demo-calendar-event-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here is the calendar event.',
                id: responseMessageId,
                nonce: 'demo-calendar-event-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_calendar_event',
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: 'Rendered a calendar event demo.',
                }),
                activities: [
                    {
                        completed_at: demoTime,
                        detail: eventProps.title,
                        id: 'act_demo_calendar_event_widget',
                        kind: 'widget',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_calendar_event_widget',
                                requestMessageId,
                                runId,
                                sequence: 1,
                                source: 'demo.widget',
                            }),
                            widget: calendarEventDemoRenderInput(eventProps),
                        },
                        sequence: 1,
                        started_at: demoTime,
                        status: 'completed',
                        summary: eventProps.title,
                        title: 'Calendar event',
                    },
                ],
            },
        ],
    };
}

export function calendarDayDemo(): DevelopmentChatDemo {
    const dayProps = widgetCalendarDayPropsSchema.parse(calendarDayDemoProps());
    const chatId = developmentChatDemoIds.calendarDay;
    const runId = 'run_demo_calendar_day';
    const requestMessageId = 'msg_demo_calendar_day_request';
    const responseMessageId = 'msg_demo_calendar_day_response';

    return {
        chatId,
        title: 'Demo: Calendar Day',
        messages: [
            userMessage({
                chatId,
                content: 'Show my Saturday schedule as a calendar day.',
                id: requestMessageId,
                nonce: 'demo-calendar-day-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here is the calendar day.',
                id: responseMessageId,
                nonce: 'demo-calendar-day-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_calendar_day',
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: 'Rendered a calendar day demo.',
                }),
                activities: [
                    {
                        completed_at: demoTime,
                        detail: dayProps.title ?? dayProps.date,
                        id: 'act_demo_calendar_day_widget',
                        kind: 'widget',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_calendar_day_widget',
                                requestMessageId,
                                runId,
                                sequence: 1,
                                source: 'demo.widget',
                            }),
                            widget: calendarDayDemoRenderInput(dayProps),
                        },
                        sequence: 1,
                        started_at: demoTime,
                        status: 'completed',
                        summary: dayProps.title ?? dayProps.date,
                        title: 'Agenda',
                    },
                ],
            },
        ],
    };
}

export function longContentDemo(): DevelopmentChatDemo {
    return completedTextDemo({
        chatId: developmentChatDemoIds.longContent,
        title: 'Demo: Long Content',
        request: longPastedOAuthJson,
        reply: `Auth URL created. Open this URL:\n\n${longOAuthConsentUrl}\n\nAfter authorizing, copy the localhost callback URL and paste it here.`,
        slug: 'long_content',
        summary: 'Shows long pasted JSON and a long URL in chat.',
    });
}

export function attachmentDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.attachment;
    const runId = 'run_demo_attachment';
    const requestMessageId = 'msg_demo_attachment_request';
    const responseMessageId = 'msg_demo_attachment_response';

    return {
        chatId,
        title: 'Demo: Attachment',
        messages: [
            userMessage({
                attachments: [
                    {
                        filename: 'weather-request.txt',
                        mediaType: 'text/plain',
                        path: '/attachments/weather-request.txt',
                        sizeBytes: 184,
                        type: 'file',
                    },
                ],
                chatId,
                content: 'hi dude, can you please fetch the weather in the 5 biggest us cities',
                id: requestMessageId,
                nonce: 'demo-attachment-request',
            }),
            assistantMessage({
                chatId,
                content: 'Yep. I can use the attached brief and keep the response compact.',
                id: responseMessageId,
                nonce: 'demo-attachment-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            completedResponse({
                chatId,
                id: 'rsp_demo_attachment',
                requestMessageId,
                responseMessageId,
                runId,
                summary: 'Answered a message with a file attachment.',
            }),
        ],
    };
}

function completedTextDemo(input: {
    chatId: string;
    request: string;
    reply: string;
    slug: string;
    summary: string;
    title: string;
}): DevelopmentChatDemo {
    const runId = `run_demo_${input.slug}`;
    const requestMessageId = `msg_demo_${input.slug}_request`;
    const responseMessageId = `msg_demo_${input.slug}_response`;

    return {
        chatId: input.chatId,
        title: input.title,
        messages: [
            userMessage({
                chatId: input.chatId,
                content: input.request,
                id: requestMessageId,
                nonce: `demo-${input.slug}-request`,
            }),
            assistantMessage({
                chatId: input.chatId,
                content: input.reply,
                id: responseMessageId,
                nonce: `demo-${input.slug}-response`,
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            completedResponse({
                chatId: input.chatId,
                id: `rsp_demo_${input.slug}`,
                requestMessageId,
                responseMessageId,
                runId,
                summary: input.summary,
            }),
        ],
    };
}

export function barChartDemoRenderInput(props: WidgetBarChartProps): WidgetRenderInput {
    return widgetDemoRenderInput('bar-chart', props.title, props);
}

export function lineChartDemoRenderInput(props: WidgetLineChartProps): WidgetRenderInput {
    return widgetDemoRenderInput('line-chart', props.title, props);
}

function calendarEventDemoRenderInput(props: WidgetCalendarEventProps): WidgetRenderInput {
    return widgetDemoRenderInput('calendar-event', props.title, props);
}

function calendarDayDemoRenderInput(props: WidgetCalendarDayProps): WidgetRenderInput {
    return widgetDemoRenderInput('calendar-day', props.title ?? props.date, props);
}

export function widgetDemoRenderInput(
    name: WidgetName,
    fallbackText: string,
    props: Record<string, unknown>
): WidgetRenderInput {
    return widgetRenderInputSchema.parse({
        component: widgetComponentId(name),
        fallback: { text: fallbackText },
        props,
        target: 'chat.inline',
    });
}

export function chartDemoProps(): WidgetBarChartProps {
    return {
        data: [
            { quarter: 'Q1', revenue: 12_000, expenses: 7600 },
            { quarter: 'Q2', revenue: 15_500, expenses: 8900 },
            { quarter: 'Q3', revenue: 18_200, expenses: 10_100 },
            { quarter: 'Q4', revenue: 22_400, expenses: 11_800 },
        ],
        series: [
            { key: 'revenue', label: 'Revenue' },
            { key: 'expenses', label: 'Expenses' },
        ],
        title: 'Quarterly Revenue',
        unit: 'USD',
        xKey: 'quarter',
    };
}

export function calendarEventDemoProps(): WidgetCalendarEventProps {
    return {
        calendar: 'Product',
        date: '2026-06-20',
        endTime: '14:00',
        location: 'Design room',
        notes: 'Review roadmap priorities and launch risks.',
        startTime: '13:00',
        timezone: 'America/New_York',
        title: 'Q1 roadmap review',
    };
}

export function calendarDayDemoProps(): WidgetCalendarDayProps {
    return {
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
                location: 'Design room',
                notes: 'Review roadmap priorities and launch risks.',
                startTime: '13:00',
                title: 'Q1 roadmap review',
            },
            {
                calendar: 'Team',
                endTime: '16:00',
                startTime: '15:30',
                title: 'Team standup',
            },
        ],
        timezone: 'America/New_York',
        title: 'Saturday schedule',
    };
}

export function lineChartDemoProps(): WidgetLineChartProps {
    return {
        data: [
            { date: 'May 20', users: 1320, pageviews: 5200 },
            { date: 'May 21', users: 1400, pageviews: 5450 },
            { date: 'May 22', users: 1260, pageviews: 5050 },
            { date: 'May 23', users: 1480, pageviews: 5700 },
            { date: 'May 24', users: 1420, pageviews: 5580 },
            { date: 'May 25', users: 1540, pageviews: 6100 },
            { date: 'May 26', users: 1680, pageviews: 6480 },
            { date: 'May 27', users: 1500, pageviews: 5900 },
            { date: 'May 28', users: 1600, pageviews: 6220 },
            { date: 'May 29', users: 1460, pageviews: 5800 },
            { date: 'May 30', users: 1730, pageviews: 6900 },
            { date: 'May 31', users: 1840, pageviews: 7250 },
            { date: 'Jun 1', users: 1780, pageviews: 7050 },
            { date: 'Jun 2', users: 1710, pageviews: 6750 },
            { date: 'Jun 3', users: 1810, pageviews: 7200 },
            { date: 'Jun 4', users: 1930, pageviews: 7550 },
            { date: 'Jun 5', users: 1880, pageviews: 7300 },
            { date: 'Jun 6', users: 1740, pageviews: 6900 },
            { date: 'Jun 7', users: 2010, pageviews: 7850 },
            { date: 'Jun 8', users: 1940, pageviews: 7600 },
            { date: 'Jun 9', users: 1750, pageviews: 6400 },
            { date: 'Jun 10', users: 1880, pageviews: 7200 },
            { date: 'Jun 11', users: 2020, pageviews: 8100 },
            { date: 'Jun 12', users: 1960, pageviews: 7900 },
            { date: 'Jun 13', users: 2050, pageviews: 8300 },
            { date: 'Jun 14', users: 2110, pageviews: 8500 },
            { date: 'Jun 15', users: 2090, pageviews: 8450 },
            { date: 'Jun 16', users: 2140, pageviews: 8700 },
            { date: 'Jun 17', users: 2160, pageviews: 8820 },
            { date: 'Jun 18', users: 2180, pageviews: 8950 },
        ],
        series: [
            { key: 'users', label: 'Users' },
            { key: 'pageviews', label: 'Pageviews' },
        ],
        title: 'Daily Traffic',
        xKey: 'date',
    };
}

// A short exchange authored by the app owner (`usr_tavern`) rather than the
// other demo participant, so the consolidated demo shows the viewer's own
// right-anchored, avatar-less bubbles alongside the left roster.
const selfDemoTurns = [
    {
        ask: 'Can you give me a quick status on the launch?',
        reply: 'All green — the last deploy passed and there are no open incidents.',
    },
    {
        ask: 'Nice. Anything I should double-check before I sign off?',
        reply: 'Just confirm the release note reads cleanly; everything else is verified.',
    },
] as const;

export function selfMessagesDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.demo;

    return {
        chatId,
        title: 'Demo: Your Messages',
        messages: selfDemoTurns.flatMap((turn, index) => {
            const ids = selfDemoTurnIds(index);

            return [
                ownerMessage({
                    chatId,
                    content: turn.ask,
                    id: ids.requestMessageId,
                    nonce: `${ids.slug}-request`,
                }),
                assistantMessage({
                    chatId,
                    content: turn.reply,
                    id: ids.responseMessageId,
                    nonce: `${ids.slug}-response`,
                    requestMessageId: ids.requestMessageId,
                    runId: ids.runId,
                }),
            ];
        }),
        responses: selfDemoTurns.map((turn, index) => {
            const ids = selfDemoTurnIds(index);

            return completedResponse({
                chatId,
                id: ids.responseId,
                requestMessageId: ids.requestMessageId,
                responseMessageId: ids.responseMessageId,
                runId: ids.runId,
                summary: turn.reply,
            });
        }),
    };
}

function selfDemoTurnIds(index: number) {
    const number = String(index + 1).padStart(2, '0');
    const slug = `demo-self-${number}`;

    return {
        requestMessageId: `msg_demo_self_${number}_request`,
        responseId: `rsp_demo_self_${number}`,
        responseMessageId: `msg_demo_self_${number}_response`,
        runId: `run_demo_self_${number}`,
        slug,
    };
}
