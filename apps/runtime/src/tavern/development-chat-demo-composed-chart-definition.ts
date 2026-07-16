import { type WidgetComposedChartProps, widgetComposedChartPropsSchema } from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    barChartDemoRenderInput,
    chartDemoProps,
    lineChartDemoProps,
    lineChartDemoRenderInput,
    widgetDemoRenderInput,
} from './development-chat-demo-basic-definitions';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoTime,
    userMessage,
} from './development-chat-demo-types';

export function composedChartDemo(): DevelopmentChatDemo {
    const composedChartProps = widgetComposedChartPropsSchema.parse(composedChartDemoProps());
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
                        id: 'act_demo_composed_chart_widget',
                        kind: 'widget',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_composed_chart_widget',
                                requestMessageId,
                                runId,
                                sequence: 1,
                                source: 'demo.widget',
                            }),
                            widget: widgetDemoRenderInput(
                                'composed-chart',
                                composedChartProps.title,
                                composedChartProps
                            ),
                        },
                        sequence: 1,
                        started_at: demoTime,
                        status: 'completed',
                        summary: composedChartProps.title,
                        title: 'Chart',
                    },
                ],
            },
        ],
    };
}

export function chartDemo(): DevelopmentChatDemo {
    const barChartProps = chartDemoProps();
    const lineChartProps = lineChartDemoProps();
    const composedChartProps = widgetComposedChartPropsSchema.parse(composedChartDemoProps());
    const chatId = developmentChatDemoIds.charts;
    const runId = 'run_demo_charts';
    const requestMessageId = 'msg_demo_charts_request';
    const responseMessageId = 'msg_demo_charts_response';

    const chartActivities = [
        {
            id: 'act_demo_charts_widget_1',
            summary: barChartProps.title,
            title: 'Bar chart',
            widget: barChartDemoRenderInput(barChartProps),
        },
        {
            id: 'act_demo_charts_widget_2',
            summary: lineChartProps.title,
            title: 'Line chart',
            widget: lineChartDemoRenderInput(lineChartProps),
        },
        {
            id: 'act_demo_charts_widget_3',
            summary: composedChartProps.title,
            title: 'Chart',
            widget: widgetDemoRenderInput(
                'composed-chart',
                composedChartProps.title,
                composedChartProps
            ),
        },
    ];

    return {
        chatId,
        title: 'Demo: Charts',
        messages: [
            userMessage({
                chatId,
                content: 'Show all available chart widgets.',
                id: requestMessageId,
                nonce: 'demo-charts-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here are all three chart widgets.',
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
                    summary: 'Rendered all chart widget demos.',
                }),
                activities: chartActivities.map((activity, index) => ({
                    completed_at: demoTime,
                    detail: activity.summary,
                    id: activity.id,
                    kind: 'widget',
                    metadata: {
                        runtime: activityRuntimeMetadata({
                            chatId,
                            id: activity.id,
                            requestMessageId,
                            runId,
                            sequence: index + 1,
                            source: 'demo.widget',
                        }),
                        widget: activity.widget,
                    },
                    sequence: index + 1,
                    started_at: demoTime,
                    status: 'completed',
                    summary: activity.summary,
                    title: activity.title,
                })),
            },
        ],
    };
}

export function composedChartDemoProps(): WidgetComposedChartProps {
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
