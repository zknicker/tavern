import {
    type TavernRenderBarChartProps,
    type TavernRenderLineChartProps,
    tavernRenderBarChartComponentId,
    tavernRenderBarChartToolName,
    tavernRenderLineChartComponentId,
    tavernRenderLineChartToolName,
    type WidgetRenderInput,
} from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoTime,
    toolActivity,
    userMessage,
} from './development-chat-demo-types';

const longPastedOAuthJson =
    '{"installed":{"client_id":"535034123734-jckkmfjk3qajgeo8mhcstmtkbdrt0gn2.apps.googleusercontent.com","project_id":"tavern-static-preview","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"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cret","redirect_uris":["http://localhost"]}}';
const longOAuthConsentUrl =
    'https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=535034123734-jckkmfjk3qajgeo8mhcstmtkbdrt0gn2.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A1&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events.readonly&access_type=offline&prompt=consent&state=tavern_static_preview_long_agent_response_token';

export function chartDemo(): DevelopmentChatDemo {
    const chartProps = chartDemoProps();
    const chatId = developmentChatDemoIds.charts;
    const runId = 'run_demo_charts';
    const requestMessageId = 'msg_demo_charts_request';
    const responseMessageId = 'msg_demo_charts_response';

    return {
        chatId,
        title: 'Demo: Charts',
        messages: [
            userMessage({
                chatId,
                content: 'Show quarterly revenue as a chart.',
                id: requestMessageId,
                nonce: 'demo-charts-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here is the quarterly revenue chart.',
                id: responseMessageId,
                nonce: 'demo-charts-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_charts',
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: 'Rendered a chart demo.',
                }),
                activities: [
                    toolActivity({
                        chatId,
                        id: 'act_demo_charts_tool',
                        requestMessageId,
                        runId,
                        sequence: 1,
                        title: tavernRenderBarChartToolName,
                        toolArguments: chartProps,
                        toolCallId: 'call_demo_charts_tool',
                        toolName: tavernRenderBarChartToolName,
                        toolResult: { status: 'rendered' },
                    }),
                    {
                        completed_at: demoTime,
                        detail: chartProps.title,
                        id: 'act_demo_charts_widget',
                        kind: 'widget',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_charts_widget',
                                requestMessageId,
                                runId,
                                sequence: 2,
                                source: tavernRenderBarChartToolName,
                            }),
                            widget: chartDemoRenderInput(chartProps),
                        },
                        sequence: 2,
                        started_at: demoTime,
                        status: 'completed',
                        summary: chartProps.title,
                        title: tavernRenderBarChartToolName,
                    },
                ],
            },
        ],
    };
}

export function lineChartDemo(): DevelopmentChatDemo {
    const chartProps = lineChartDemoProps();
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
                    toolActivity({
                        chatId,
                        id: 'act_demo_line_chart_tool',
                        requestMessageId,
                        runId,
                        sequence: 1,
                        title: tavernRenderLineChartToolName,
                        toolArguments: chartProps,
                        toolCallId: 'call_demo_line_chart_tool',
                        toolName: tavernRenderLineChartToolName,
                        toolResult: { status: 'rendered' },
                    }),
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
                                sequence: 2,
                                source: tavernRenderLineChartToolName,
                            }),
                            widget: lineChartDemoRenderInput(chartProps),
                        },
                        sequence: 2,
                        started_at: demoTime,
                        status: 'completed',
                        summary: chartProps.title,
                        title: tavernRenderLineChartToolName,
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
        reply: `Auth URL created. Open this URL:\n\n${longOAuthConsentUrl}\n\nAfter approval, copy the localhost callback URL and paste it here.`,
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

function chartDemoRenderInput(props: TavernRenderBarChartProps): WidgetRenderInput {
    return {
        component: tavernRenderBarChartComponentId,
        fallback: { text: props.title },
        props,
        target: 'chat.inline',
    };
}

function lineChartDemoRenderInput(props: TavernRenderLineChartProps): WidgetRenderInput {
    return {
        component: tavernRenderLineChartComponentId,
        fallback: { text: props.title },
        props,
        target: 'chat.inline',
    };
}

function chartDemoProps(): TavernRenderBarChartProps {
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
        xKey: 'quarter',
    };
}

function lineChartDemoProps(): TavernRenderLineChartProps {
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
            { key: 'users', label: 'users' },
            { key: 'pageviews', label: 'pageviews' },
        ],
        title: 'Daily Traffic',
        xKey: 'date',
    };
}
