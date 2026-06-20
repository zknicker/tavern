import {
    type RichResponseBarChartProps,
    type RichResponseComposedChartProps,
    type RichResponseLineChartProps,
    type RichResponseRenderInput,
    richResponseComponentId,
    richResponseComposedChartPropsSchema,
} from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import { chartDemoProps, lineChartDemoProps } from './development-chat-demo-basic-definitions';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoTime,
    userMessage,
} from './development-chat-demo-types';

export function composedChartDemo(): DevelopmentChatDemo {
    const composedChartProps = richResponseComposedChartPropsSchema.parse(composedChartDemoProps());
    const chatId = developmentChatDemoIds.composedChart;
    const runId = 'run_demo_composed_chart';
    const requestMessageId = 'msg_demo_composed_chart_request';
    const responseMessageId = 'msg_demo_composed_chart_response';

    return {
        chatId,
        title: 'Demo: Composed Chart',
        messages: [
            userMessage({
                chatId,
                content: 'Show the units and royalties chart.',
                id: requestMessageId,
                nonce: 'demo-composed-chart-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here is the composed chart.',
                id: responseMessageId,
                nonce: 'demo-composed-chart-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_composed_chart',
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: 'Rendered a composed chart demo.',
                }),
                activities: [
                    {
                        completed_at: demoTime,
                        detail: composedChartProps.title,
                        id: 'act_demo_composed_chart_rich_response',
                        kind: 'rich_response',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_composed_chart_rich_response',
                                requestMessageId,
                                runId,
                                sequence: 1,
                                source: 'demo.rich_response',
                            }),
                            richResponse: composedChartOnlyDemoRenderInput(composedChartProps),
                        },
                        sequence: 1,
                        started_at: demoTime,
                        status: 'completed',
                        summary: composedChartProps.title,
                        title: 'Rich Response',
                    },
                ],
            },
        ],
    };
}

export function chartDemo(): DevelopmentChatDemo {
    const barChartProps = chartDemoProps();
    const lineChartProps = lineChartDemoProps();
    const composedChartProps = richResponseComposedChartPropsSchema.parse(composedChartDemoProps());
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
                content: 'Show all available chart Rich Responses.',
                id: requestMessageId,
                nonce: 'demo-charts-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here are all three chart displays.',
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
                    summary: 'Rendered all chart Rich Response demos.',
                }),
                activities: [
                    {
                        completed_at: demoTime,
                        detail: 'Bar, line, and composed charts.',
                        id: 'act_demo_charts_rich_response',
                        kind: 'rich_response',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_charts_rich_response',
                                requestMessageId,
                                runId,
                                sequence: 1,
                                source: 'demo.rich_response',
                            }),
                            richResponse: allChartsDemoRenderInput({
                                barChartProps,
                                composedChartProps,
                                lineChartProps,
                            }),
                        },
                        sequence: 1,
                        started_at: demoTime,
                        status: 'completed',
                        summary: 'Bar, line, and composed charts.',
                        title: 'Rich Response',
                    },
                ],
            },
        ],
    };
}

function allChartsDemoRenderInput(input: {
    barChartProps: RichResponseBarChartProps;
    composedChartProps: RichResponseComposedChartProps;
    lineChartProps: RichResponseLineChartProps;
}): RichResponseRenderInput {
    return {
        component: richResponseComponentId,
        fallback: { text: 'Bar, line, and composed charts.' },
        props: {
            spec: {
                elements: {
                    bar: {
                        props: input.barChartProps,
                        type: 'BarChart',
                    },
                    composed: {
                        props: input.composedChartProps,
                        type: 'ComposedChart',
                    },
                    line: {
                        props: input.lineChartProps,
                        type: 'LineChart',
                    },
                    root: {
                        children: ['heading', 'intro', 'bar', 'line', 'composed'],
                        props: { gap: 'lg' },
                        type: 'Stack',
                    },
                    heading: {
                        props: { text: 'Chart components' },
                        type: 'Heading',
                    },
                    intro: {
                        props: {
                            muted: true,
                            text: 'BarChart, LineChart, and ComposedChart rendered in one Rich Response.',
                        },
                        type: 'Text',
                    },
                },
                root: 'root',
                state: {},
            },
        },
        target: 'chat.inline',
    };
}

function composedChartOnlyDemoRenderInput(
    props: RichResponseComposedChartProps
): RichResponseRenderInput {
    return {
        component: richResponseComponentId,
        fallback: { text: props.title },
        props: {
            spec: {
                elements: {
                    display: {
                        props,
                        type: 'ComposedChart',
                    },
                },
                root: 'display',
                state: {},
            },
        },
        target: 'chat.inline',
    };
}

function composedChartDemoProps(): RichResponseComposedChartProps {
    return {
        barUnit: 'units',
        barSeries: [{ key: 'units', label: 'Units' }],
        data: [
            { month: '2026-01-01', royalties: 54.91, units: 19 },
            { month: '2026-02-01', royalties: 49.25, units: 17 },
            { month: '2026-03-01', royalties: 63.7, units: 23 },
            { month: '2026-04-01', royalties: 58.4, units: 21 },
            { month: '2026-05-01', royalties: 72.15, units: 26 },
            { month: '2026-06-01', royalties: 66.8, units: 24 },
        ],
        lineUnit: 'USD',
        lineSeries: [{ key: 'royalties', label: 'Royalties' }],
        title: 'Units and Royalties',
        xKey: 'month',
    };
}
