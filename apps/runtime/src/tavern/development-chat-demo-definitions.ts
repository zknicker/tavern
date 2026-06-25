import {
    activityTurnDemo,
    approvalFlowDemo,
    streamingStackDemo,
} from './development-chat-demo-activity-definitions';
import {
    artifactLinksDemo,
    attachmentDemo,
    calendarDayDemo,
    calendarEventDemo,
    lineChartDemo,
    longContentDemo,
} from './development-chat-demo-basic-definitions';
import { chartDemo, composedChartDemo } from './development-chat-demo-composed-chart-definition';
import { merchbaseSalesChartDemo } from './development-chat-demo-merchbase-sales-chart-definition';
import { richResponseCatalogDemo } from './development-chat-demo-rich-response-catalog-definition';
import { toolHeadersDemo } from './development-chat-demo-tool-header-definitions';
import type { DevelopmentChatDemo } from './development-chat-demo-types';

export const developmentChatDemos: DevelopmentChatDemo[] = [
    chartDemo(),
    lineChartDemo(),
    composedChartDemo(),
    calendarDayDemo(),
    calendarEventDemo(),
    merchbaseSalesChartDemo(),
    richResponseCatalogDemo(),
    artifactLinksDemo(),
    longContentDemo(),
    attachmentDemo(),
    activityTurnDemo(),
    streamingStackDemo(),
    approvalFlowDemo(),
    toolHeadersDemo(),
];
