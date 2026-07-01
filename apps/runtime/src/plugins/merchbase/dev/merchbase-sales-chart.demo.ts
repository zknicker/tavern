import { type RichResponseRenderInput, richResponseComponentId } from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import { richResponseMerchBaseSalesChartComponentType } from '@tavern/api/rich-responses/merchbase';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoTime,
    userMessage,
} from '../../../tavern/development-chat-demo-types';

export function merchbaseSalesChartDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.merchbaseSalesChart;
    const runId = 'run_demo_merchbase_sales_chart';
    const requestMessageId = 'msg_demo_merchbase_sales_chart_request';
    const responseMessageId = 'msg_demo_merchbase_sales_chart_response';

    return {
        chatId,
        messages: [
            userMessage({
                chatId,
                content: 'Show 10 days of MerchBase sales history with sales and royalties.',
                id: requestMessageId,
                nonce: 'demo-merchbase-sales-chart-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here is the MerchBase sales trend.',
                id: responseMessageId,
                nonce: 'demo-merchbase-sales-chart-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_merchbase_sales_chart',
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: 'Rendered a MerchBase sales chart.',
                }),
                activities: [
                    {
                        completed_at: demoTime,
                        detail: 'MerchBase sales trend.',
                        id: 'act_demo_merchbase_sales_chart',
                        kind: 'rich_response',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_merchbase_sales_chart',
                                requestMessageId,
                                runId,
                                sequence: 1,
                                source: 'demo.merchbase',
                            }),
                            richResponse: merchbaseSalesChartRenderInput(),
                        },
                        sequence: 1,
                        started_at: demoTime,
                        status: 'completed',
                        summary: 'MerchBase sales trend.',
                        title: 'Rich Response',
                    },
                ],
            },
        ],
        title: 'Demo: MerchBase Sales Chart',
    };
}

function merchbaseSalesChartRenderInput(): RichResponseRenderInput {
    return {
        component: richResponseComponentId,
        fallback: { text: 'MerchBase sales chart.' },
        props: {
            spec: {
                elements: {
                    chart: {
                        children: [],
                        props: {
                            endDate: '2026-06-23',
                            rangeDays: 10,
                            title: 'MerchBase sales',
                        },
                        type: richResponseMerchBaseSalesChartComponentType,
                    },
                },
                root: 'chart',
                state: {},
            },
        },
        target: 'chat.inline',
    };
}
