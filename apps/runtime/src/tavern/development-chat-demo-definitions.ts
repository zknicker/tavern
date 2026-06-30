import { developmentChatDemoId } from '@tavern/api/development-chat-demos';
import { activityTurnDemo, streamingStackDemo } from './development-chat-demo-activity-definitions';
import {
    artifactLinksDemo,
    attachmentDemo,
    calendarDayDemo,
    calendarEventDemo,
    longContentDemo,
} from './development-chat-demo-basic-definitions';
import { chartDemo } from './development-chat-demo-composed-chart-definition';
import { merchbaseSalesChartDemo } from './development-chat-demo-merchbase-sales-chart-definition';
import { richResponseCatalogDemo } from './development-chat-demo-rich-response-catalog-definition';
import { toolHeadersDemo } from './development-chat-demo-tool-header-definitions';
import { turnTimelineDemo } from './development-chat-demo-turn-timeline-definition';
import {
    type DevelopmentChatDemo,
    type DevelopmentDemoMessage,
    demoTime,
} from './development-chat-demo-types';

export const developmentChatDemos: DevelopmentChatDemo[] = [
    demoChannel([
        chartDemo(),
        merchbaseSalesChartDemo(),
        richResponseCatalogDemo(),
        calendarDayDemo(),
        calendarEventDemo(),
        artifactLinksDemo(),
        longContentDemo(),
        attachmentDemo(),
        activityTurnDemo(),
        completedOnly(toolHeadersDemo(), ['rsp_demo_tool_headers_completed']),
        firstCompletedTurns(turnTimelineDemo(), 8),
        streamingStackDemo(),
    ]),
];

function demoChannel(demos: DevelopmentChatDemo[]): DevelopmentChatDemo {
    return {
        chatId: developmentChatDemoId,
        color: '#0ea5e9',
        messages: demos.flatMap((demo) => demo.messages).map(sequenceDemoMessage),
        responses: demos.flatMap((demo) => demo.responses),
        title: 'demo',
    };
}

function completedOnly(demo: DevelopmentChatDemo, responseIds: string[]): DevelopmentChatDemo {
    const responseIdSet = new Set(responseIds);
    const responses = demo.responses.filter((response) => responseIdSet.has(response.id));
    const messageIds = new Set<string>();

    for (const response of responses) {
        if (response.request_message_id) {
            messageIds.add(response.request_message_id);
        }

        if (response.response_message_id) {
            messageIds.add(response.response_message_id);
        }
    }

    return {
        ...demo,
        messages: demo.messages.filter((message) => messageIds.has(message.id)),
        responses,
    };
}

function firstCompletedTurns(demo: DevelopmentChatDemo, count: number): DevelopmentChatDemo {
    const responses = demo.responses.slice(0, count);
    const messageIds = new Set<string>();

    for (const response of responses) {
        if (response.request_message_id) {
            messageIds.add(response.request_message_id);
        }

        if (response.response_message_id) {
            messageIds.add(response.response_message_id);
        }
    }

    return {
        ...demo,
        messages: demo.messages.filter((message) => messageIds.has(message.id)),
        responses,
    };
}

function sequenceDemoMessage(
    message: DevelopmentDemoMessage,
    index: number
): DevelopmentDemoMessage {
    return {
        ...message,
        createdAt: demoTimestamp(index),
    };
}

function demoTimestamp(index: number) {
    return new Date(Date.parse(demoTime) + index * 45_000).toISOString();
}
