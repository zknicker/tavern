import type { TavernUpsertResponseActivityRequest } from '@tavern/api';

export function widgetActivityFromHermesRender(input: {
    activityId: string;
    agentId: string;
    eventData: Record<string, unknown>;
    messageId: string;
    runId: string;
    sessionKey: string;
    startedAt: string;
    timestamp: string;
}): TavernUpsertResponseActivityRequest {
    const component = readString(input.eventData.component) ?? 'Widget';
    const fallbackText = fallbackTextFromRender(input.eventData, component);

    return widgetActivity({
        activityId: input.activityId,
        agentId: input.agentId,
        fallbackText,
        messageId: input.messageId,
        render: input.eventData,
        runId: input.runId,
        sessionKey: input.sessionKey,
        source: 'ui.render',
        startedAt: input.startedAt,
        timestamp: input.timestamp,
        title: component,
    });
}

export function widgetActivity(input: {
    activityId: string;
    agentId: string;
    fallbackText: string;
    messageId: string;
    render: unknown;
    runId: string;
    sessionKey: string;
    source: string;
    startedAt: string;
    timestamp: string;
    title: string;
}): TavernUpsertResponseActivityRequest {
    return {
        completed_at: input.timestamp,
        detail: input.fallbackText,
        id: input.activityId,
        kind: 'widget',
        metadata: {
            runtime: {
                agentId: input.agentId,
                messageId: input.messageId,
                runId: input.runId,
                sessionKey: input.sessionKey,
                source: input.source,
                startedAt: input.startedAt,
            },
            widget: input.render,
        },
        started_at: input.timestamp,
        status: 'completed',
        summary: input.fallbackText,
        title: input.title,
    };
}

function fallbackTextFromRender(eventData: Record<string, unknown>, component: string) {
    const fallback = readRecord(eventData.fallback);

    return readString(fallback.text) ?? readString(eventData.title) ?? component;
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
