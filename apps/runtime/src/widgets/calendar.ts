import {
    tavernRenderCalendarDayComponentId,
    tavernRenderCalendarDayToolInputSchema,
    tavernRenderCalendarDayToolName,
    tavernRenderCalendarEventComponentId,
    tavernRenderCalendarEventToolInputSchema,
    tavernRenderCalendarEventToolName,
    type WidgetRenderInput,
} from '@tavern/api';
import { widgetActivity } from './render';

export const renderCalendarDayToolName = tavernRenderCalendarDayToolName;
export const renderCalendarEventToolName = tavernRenderCalendarEventToolName;

export function calendarWidgetActivityFromRenderCalendarEventTool(input: {
    activityId: string;
    agentId: string;
    messageId: string;
    runId: string;
    sessionKey: string;
    startedAt: string;
    timestamp: string;
    toolInput: unknown;
}) {
    const parsed = tavernRenderCalendarEventToolInputSchema.safeParse(input.toolInput);

    if (!parsed.success) {
        return null;
    }

    const render: WidgetRenderInput = {
        component: tavernRenderCalendarEventComponentId,
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
        source: renderCalendarEventToolName,
        startedAt: input.startedAt,
        timestamp: input.timestamp,
        title: renderCalendarEventToolName,
    });
}

export function calendarWidgetActivityFromRenderCalendarDayTool(input: {
    activityId: string;
    agentId: string;
    messageId: string;
    runId: string;
    sessionKey: string;
    startedAt: string;
    timestamp: string;
    toolInput: unknown;
}) {
    const parsed = tavernRenderCalendarDayToolInputSchema.safeParse(input.toolInput);

    if (!parsed.success) {
        return null;
    }

    const fallbackText = parsed.data.title ?? calendarDayFallbackText(parsed.data.date);
    const render: WidgetRenderInput = {
        component: tavernRenderCalendarDayComponentId,
        fallback: { text: fallbackText },
        props: parsed.data,
        target: 'chat.inline',
    };

    return widgetActivity({
        activityId: input.activityId,
        agentId: input.agentId,
        fallbackText,
        messageId: input.messageId,
        render,
        runId: input.runId,
        sessionKey: input.sessionKey,
        source: renderCalendarDayToolName,
        startedAt: input.startedAt,
        timestamp: input.timestamp,
        title: renderCalendarDayToolName,
    });
}

function calendarDayFallbackText(date: string) {
    return `Calendar day ${date}`;
}
