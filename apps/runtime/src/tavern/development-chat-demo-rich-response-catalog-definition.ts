import { type RichResponseRenderInput, richResponseComponentId } from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoTime,
    userMessage,
} from './development-chat-demo-types';

export function richResponseCatalogDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.richResponseCatalog;
    const runId = 'run_demo_rich_response_catalog';
    const requestMessageId = 'msg_demo_rich_response_catalog_request';
    const responseMessageId = 'msg_demo_rich_response_catalog_response';

    return {
        chatId,
        title: 'Demo: Rich Response Catalog',
        messages: [
            userMessage({
                chatId,
                content: 'Show the basic Rich Response layout components.',
                id: requestMessageId,
                nonce: 'demo-rich-response-catalog-request',
            }),
            assistantMessage({
                chatId,
                content: 'Here is the Rich Response catalog sample.',
                id: responseMessageId,
                nonce: 'demo-rich-response-catalog-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_rich_response_catalog',
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: 'Rendered a Rich Response catalog demo.',
                }),
                activities: [
                    {
                        completed_at: demoTime,
                        detail: 'Rich Response catalog sample.',
                        id: 'act_demo_rich_response_catalog',
                        kind: 'rich_response',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_rich_response_catalog',
                                requestMessageId,
                                runId,
                                sequence: 1,
                                source: 'demo.rich_response',
                            }),
                            richResponse: richResponseCatalogRenderInput(),
                        },
                        sequence: 1,
                        started_at: demoTime,
                        status: 'completed',
                        summary: 'Rich Response catalog sample.',
                        title: 'Rich Response',
                    },
                ],
            },
        ],
    };
}

function richResponseCatalogRenderInput(): RichResponseRenderInput {
    return {
        component: richResponseComponentId,
        fallback: { text: 'Rich Response catalog sample.' },
        props: {
            spec: {
                elements: {
                    root: {
                        children: ['title', 'intro', 'separator', 'tableTitle', 'table', 'note'],
                        props: { gap: 'md' },
                        type: 'Stack',
                    },
                    title: {
                        props: { text: 'Rich Response catalog' },
                        type: 'Heading',
                    },
                    intro: {
                        props: {
                            text: 'Heading, Text, Separator, Table, and Stack share normal chat typography and spacing.',
                        },
                        type: 'Text',
                    },
                    separator: {
                        props: {},
                        type: 'Separator',
                    },
                    tableTitle: {
                        props: { text: 'Primitive coverage' },
                        type: 'Heading',
                    },
                    table: {
                        props: {
                            columns: [
                                { key: 'component', label: 'Component' },
                                { key: 'purpose', label: 'Purpose' },
                                { align: 'right', key: 'count', label: 'Demo rows' },
                            ],
                            rows: [
                                {
                                    component: 'Heading',
                                    count: 2,
                                    purpose: 'Section labels',
                                },
                                {
                                    component: 'Text',
                                    count: 2,
                                    purpose: 'Chat-sized prose',
                                },
                                {
                                    component: 'Separator',
                                    count: 1,
                                    purpose: 'Visual break',
                                },
                                {
                                    component: 'Table',
                                    count: 1,
                                    purpose: 'Compact rows and columns',
                                },
                                {
                                    component: 'Stack',
                                    count: 1,
                                    purpose: 'Vertical composition',
                                },
                            ],
                        },
                        type: 'Table',
                    },
                    note: {
                        props: {
                            muted: true,
                            text: 'This demo intentionally uses only high-level components, not model-authored layout classes.',
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
