import {
    activityTurnDemo,
    approvalFlowDemo,
    streamingStackDemo,
} from './development-chat-demo-activity-definitions';
import {
    attachmentDemo,
    calendarDayDemo,
    calendarEventDemo,
    chartDemo,
    lineChartDemo,
    longContentDemo,
} from './development-chat-demo-basic-definitions';
import { toolHeadersDemo } from './development-chat-demo-tool-header-definitions';
import type { DevelopmentChatDemo } from './development-chat-demo-types';

export const developmentChatDemos: DevelopmentChatDemo[] = [
    chartDemo(),
    lineChartDemo(),
    calendarDayDemo(),
    calendarEventDemo(),
    longContentDemo(),
    attachmentDemo(),
    activityTurnDemo(),
    streamingStackDemo(),
    approvalFlowDemo(),
    toolHeadersDemo(),
];
