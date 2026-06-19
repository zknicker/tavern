import {
    tavernRenderBarChartComponentId,
    tavernRenderBarChartToolInputSchema,
    tavernRenderBarChartToolName,
    tavernRenderComposedChartComponentId,
    tavernRenderComposedChartToolInputSchema,
    tavernRenderComposedChartToolName,
    tavernRenderLineChartComponentId,
    tavernRenderLineChartToolInputSchema,
    tavernRenderLineChartToolName,
    type WidgetRenderInput,
} from '@tavern/api';
import { widgetActivity } from './render';

export const renderBarChartToolName = tavernRenderBarChartToolName;
export const renderLineChartToolName = tavernRenderLineChartToolName;
export const renderComposedChartToolName = tavernRenderComposedChartToolName;

export function chartWidgetActivityFromRenderBarChartTool(input: {
    activityId: string;
    agentId: string;
    messageId: string;
    runId: string;
    sessionKey: string;
    startedAt: string;
    timestamp: string;
    toolInput: unknown;
}) {
    const parsed = tavernRenderBarChartToolInputSchema.safeParse(input.toolInput);

    if (!parsed.success) {
        return null;
    }

    const render: WidgetRenderInput = {
        component: tavernRenderBarChartComponentId,
        fallback: { text: parsed.data.title },
        props: parsed.data,
        target: 'chat.inline',
    };

    return widgetActivity({
        activityId: input.activityId,
        agentId: input.agentId,
        fallbackText: parsed.data.title,
        messageId: input.messageId,
        render,
        runId: input.runId,
        sessionKey: input.sessionKey,
        source: renderBarChartToolName,
        startedAt: input.startedAt,
        timestamp: input.timestamp,
        title: renderBarChartToolName,
    });
}

export function chartWidgetActivityFromRenderLineChartTool(input: {
    activityId: string;
    agentId: string;
    messageId: string;
    runId: string;
    sessionKey: string;
    startedAt: string;
    timestamp: string;
    toolInput: unknown;
}) {
    const parsed = tavernRenderLineChartToolInputSchema.safeParse(input.toolInput);

    if (!parsed.success) {
        return null;
    }

    const render: WidgetRenderInput = {
        component: tavernRenderLineChartComponentId,
        fallback: { text: parsed.data.title },
        props: parsed.data,
        target: 'chat.inline',
    };

    return widgetActivity({
        activityId: input.activityId,
        agentId: input.agentId,
        fallbackText: parsed.data.title,
        messageId: input.messageId,
        render,
        runId: input.runId,
        sessionKey: input.sessionKey,
        source: renderLineChartToolName,
        startedAt: input.startedAt,
        timestamp: input.timestamp,
        title: renderLineChartToolName,
    });
}

export function chartWidgetActivityFromRenderComposedChartTool(input: {
    activityId: string;
    agentId: string;
    messageId: string;
    runId: string;
    sessionKey: string;
    startedAt: string;
    timestamp: string;
    toolInput: unknown;
}) {
    const parsed = tavernRenderComposedChartToolInputSchema.safeParse(input.toolInput);

    if (!parsed.success) {
        return null;
    }

    const render: WidgetRenderInput = {
        component: tavernRenderComposedChartComponentId,
        fallback: { text: parsed.data.title },
        props: parsed.data,
        target: 'chat.inline',
    };

    return widgetActivity({
        activityId: input.activityId,
        agentId: input.agentId,
        fallbackText: parsed.data.title,
        messageId: input.messageId,
        render,
        runId: input.runId,
        sessionKey: input.sessionKey,
        source: renderComposedChartToolName,
        startedAt: input.startedAt,
        timestamp: input.timestamp,
        title: renderComposedChartToolName,
    });
}
