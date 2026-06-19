import {
    type TavernRenderComposedChartProps,
    tavernRenderBarChartToolInputSchema,
    tavernRenderBarChartToolName,
    tavernRenderComposedChartComponentId,
    tavernRenderComposedChartToolInputSchema,
    tavernRenderComposedChartToolName,
    tavernRenderLineChartToolInputSchema,
    tavernRenderLineChartToolName,
    type WidgetRenderInput,
} from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    chartDemoRenderInput,
    chartDemoToolInput,
    lineChartDemoRenderInput,
    lineChartDemoToolInput,
} from './development-chat-demo-basic-definitions';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoTime,
    toolActivity,
    userMessage,
} from './development-chat-demo-types';

export function composedChartDemo(): DevelopmentChatDemo {
    const barChartToolInput = chartDemoToolInput();
    const barChartProps = tavernRenderBarChartToolInputSchema.parse(barChartToolInput);
    const lineChartToolInput = lineChartDemoToolInput();
    const lineChartProps = tavernRenderLineChartToolInputSchema.parse(lineChartToolInput);
    const composedChartToolInput = composedChartDemoToolInput();
    const composedChartProps =
        tavernRenderComposedChartToolInputSchema.parse(composedChartToolInput);
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
                content: 'Show the bar, line, and composed chart demos.',
                id: requestMessageId,
                nonce: 'demo-composed-chart-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here are the chart demos.',
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
                    summary: 'Rendered bar, line, and composed chart demos.',
                }),
                activities: [
                    toolActivity({
                        chatId,
                        id: 'act_demo_composed_chart_bar_tool',
                        requestMessageId,
                        runId,
                        sequence: 1,
                        title: tavernRenderBarChartToolName,
                        toolArguments: barChartToolInput,
                        toolCallId: 'call_demo_composed_chart_bar_tool',
                        toolName: tavernRenderBarChartToolName,
                        toolResult: { status: 'rendered' },
                    }),
                    {
                        completed_at: demoTime,
                        detail: barChartProps.title,
                        id: 'act_demo_composed_chart_bar_widget',
                        kind: 'widget',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_composed_chart_bar_widget',
                                requestMessageId,
                                runId,
                                sequence: 2,
                                source: tavernRenderBarChartToolName,
                            }),
                            widget: chartDemoRenderInput(barChartProps),
                        },
                        sequence: 2,
                        started_at: demoTime,
                        status: 'completed',
                        summary: barChartProps.title,
                        title: tavernRenderBarChartToolName,
                    },
                    toolActivity({
                        chatId,
                        id: 'act_demo_composed_chart_line_tool',
                        requestMessageId,
                        runId,
                        sequence: 3,
                        title: tavernRenderLineChartToolName,
                        toolArguments: lineChartToolInput,
                        toolCallId: 'call_demo_composed_chart_line_tool',
                        toolName: tavernRenderLineChartToolName,
                        toolResult: { status: 'rendered' },
                    }),
                    {
                        completed_at: demoTime,
                        detail: lineChartProps.title,
                        id: 'act_demo_composed_chart_line_widget',
                        kind: 'widget',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_composed_chart_line_widget',
                                requestMessageId,
                                runId,
                                sequence: 4,
                                source: tavernRenderLineChartToolName,
                            }),
                            widget: lineChartDemoRenderInput(lineChartProps),
                        },
                        sequence: 4,
                        started_at: demoTime,
                        status: 'completed',
                        summary: lineChartProps.title,
                        title: tavernRenderLineChartToolName,
                    },
                    toolActivity({
                        chatId,
                        id: 'act_demo_composed_chart_tool',
                        requestMessageId,
                        runId,
                        sequence: 5,
                        title: tavernRenderComposedChartToolName,
                        toolArguments: composedChartToolInput,
                        toolCallId: 'call_demo_composed_chart_tool',
                        toolName: tavernRenderComposedChartToolName,
                        toolResult: { status: 'rendered' },
                    }),
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
                                sequence: 6,
                                source: tavernRenderComposedChartToolName,
                            }),
                            widget: composedChartDemoRenderInput(composedChartProps),
                        },
                        sequence: 6,
                        started_at: demoTime,
                        status: 'completed',
                        summary: composedChartProps.title,
                        title: tavernRenderComposedChartToolName,
                    },
                ],
            },
        ],
    };
}

function composedChartDemoRenderInput(props: TavernRenderComposedChartProps): WidgetRenderInput {
    return {
        component: tavernRenderComposedChartComponentId,
        fallback: { text: props.title },
        props,
        target: 'chat.inline',
    };
}

function composedChartDemoToolInput() {
    return {
        barUnit: 'units',
        barY: 'units',
        data: [
            { month: '2026-01-01', royalties: 54.91, units: 19 },
            { month: '2026-02-01', royalties: 49.25, units: 17 },
            { month: '2026-03-01', royalties: 63.7, units: 23 },
            { month: '2026-04-01', royalties: 58.4, units: 21 },
            { month: '2026-05-01', royalties: 72.15, units: 26 },
            { month: '2026-06-01', royalties: 66.8, units: 24 },
        ],
        lineUnit: 'USD',
        lineY: 'royalties',
        title: 'Units and Royalties',
        x: 'month',
    };
}
