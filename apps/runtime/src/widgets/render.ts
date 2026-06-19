import {
    type AgentRuntimeWidgetProgress,
    type TavernUpsertResponseActivityRequest,
    widgetRenderInputSchema,
} from '@tavern/api';

interface WidgetActivitySource {
    detail?: string | null;
    id: string;
    kind: string;
    metadata?: Record<string, unknown>;
    summary?: string | null;
    title: string;
}

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

export function widgetProgressFromActivity(
    activity: WidgetActivitySource
): AgentRuntimeWidgetProgress | null {
    if (activity.kind !== 'widget') {
        return null;
    }

    const payload = readRecord(activity.metadata).widget;

    if (payload === undefined) {
        return invalidWidgetProgress(activity, null, 'Missing widget payload.');
    }

    const parsed = widgetRenderInputSchema.safeParse(payload);

    if (parsed.success) {
        return {
            component: parsed.data.component,
            fallbackText: parsed.data.fallback.text,
            id: activity.id,
            props: parsed.data.props,
            target: parsed.data.target,
            validationError: null,
        };
    }

    const record = readRecord(payload);
    const component = readString(record.component);

    return invalidWidgetProgress(
        activity,
        {
            component,
            fallbackText: readFallbackText(record.fallback),
            target: readString(record.target),
        },
        parsed.error.issues[0]?.message ?? 'Invalid widget.'
    );
}

function fallbackTextFromRender(eventData: Record<string, unknown>, component: string) {
    const fallback = readRecord(eventData.fallback);

    return readString(fallback.text) ?? readString(eventData.title) ?? component;
}

function invalidWidgetProgress(
    activity: WidgetActivitySource,
    input: {
        component: string | null;
        fallbackText: string | null;
        target: string | null;
    } | null,
    error: string
): AgentRuntimeWidgetProgress {
    const component = input?.component ?? null;

    return {
        component,
        fallbackText:
            input?.fallbackText ??
            activity.summary?.trim() ??
            activity.detail?.trim() ??
            readString(activity.title) ??
            component ??
            'Unable to render widget.',
        id: activity.id,
        props: null,
        target: input?.target ?? null,
        validationError: error,
    };
}

function readFallbackText(value: unknown) {
    return readString(readRecord(value).text);
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
