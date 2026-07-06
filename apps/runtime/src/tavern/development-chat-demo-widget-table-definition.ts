import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import { widgetDemoRenderInput } from './development-chat-demo-basic-definitions';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoTime,
    userMessage,
} from './development-chat-demo-types';

export function widgetTableDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.widgetTable;
    const runId = 'run_demo_widget_table';
    const requestMessageId = 'msg_demo_widget_table_request';
    const responseMessageId = 'msg_demo_widget_table_response';
    const fallbackText = 'Table: Widget, Purpose, Demo rows';

    return {
        chatId,
        title: 'Demo: Table Widget',
        messages: [
            userMessage({
                chatId,
                content: 'Show the widget inventory as a table.',
                id: requestMessageId,
                nonce: 'demo-widget-table-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here is the widget inventory.',
                id: responseMessageId,
                nonce: 'demo-widget-table-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_widget_table',
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: 'Rendered a table widget demo.',
                }),
                activities: [
                    {
                        completed_at: demoTime,
                        detail: fallbackText,
                        id: 'act_demo_widget_table',
                        kind: 'widget',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_widget_table',
                                requestMessageId,
                                runId,
                                sequence: 1,
                                source: 'demo.widget',
                            }),
                            widget: widgetDemoRenderInput('table', fallbackText, {
                                columns: [
                                    { key: 'widget', label: 'Widget' },
                                    { key: 'purpose', label: 'Purpose' },
                                    { align: 'right', key: 'count', label: 'Demo rows' },
                                ],
                                rows: [
                                    {
                                        count: 1,
                                        purpose: 'Compact rows and columns',
                                        widget: 'table',
                                    },
                                    {
                                        count: 1,
                                        purpose: 'Nonnegative comparable series',
                                        widget: 'bar-chart',
                                    },
                                    {
                                        count: 1,
                                        purpose: 'Trend series',
                                        widget: 'line-chart',
                                    },
                                    {
                                        count: 1,
                                        purpose: 'Bars and lines on one x-axis',
                                        widget: 'composed-chart',
                                    },
                                    {
                                        count: 1,
                                        purpose: 'Single event card',
                                        widget: 'calendar-event',
                                    },
                                    {
                                        count: 1,
                                        purpose: 'Single-day agenda',
                                        widget: 'calendar-day',
                                    },
                                ],
                            }),
                        },
                        sequence: 1,
                        started_at: demoTime,
                        status: 'completed',
                        summary: fallbackText,
                        title: 'Table',
                    },
                ],
            },
        ],
    };
}
