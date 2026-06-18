import { type WidgetRenderInput, widgetRenderInputSchema } from '@tavern/api/widgets';
import type { TavernResponseActivity } from '@tavern/sdk';
import type { ChatLogPage } from '../chat/contracts.ts';
import { chartWidgetFromParsedPayload } from './charts.ts';

type WidgetRow = Extract<ChatLogPage['rows'][number], { kind: 'widget' }>;
type WidgetPayloadAdapter = (
    block: WidgetRenderInput,
    activity: TavernResponseActivity
) => WidgetRow['widget'] | null;

const widgetPayloadAdapters: WidgetPayloadAdapter[] = [chartWidgetFromParsedPayload];

export function widgetRowFromActivity(input: {
    activity: TavernResponseActivity;
    actor: WidgetRow['actor'];
    sessionKey: string | null;
}): WidgetRow | null {
    if (input.activity.kind !== 'widget') {
        return null;
    }

    const payload = readRecord(input.activity.metadata).widget;

    if (payload === undefined) {
        return null;
    }

    const parsed = widgetRenderInputSchema.safeParse(payload);
    const widget = parsed.success
        ? widgetFromParsedPayload(parsed.data, input.activity)
        : widgetFromInvalidPayload(payload, input.activity, parsed.error.issues[0]?.message);

    return {
        actor: input.actor,
        completedAt: input.activity.completed_at,
        connectsToNext: false,
        connectsToPrevious: false,
        id: input.activity.id,
        isFirstInGroup: true,
        kind: 'widget',
        responseId: input.activity.response_id,
        sessionKey: input.sessionKey,
        startedAt: input.activity.started_at,
        widget,
    };
}

function widgetFromParsedPayload(
    block: WidgetRenderInput,
    activity: TavernResponseActivity
): WidgetRow['widget'] {
    for (const adapter of widgetPayloadAdapters) {
        const widget = adapter(block, activity);
        if (widget) {
            return widget;
        }
    }

    return {
        component: block.component,
        fallbackText: block.fallback.text,
        id: activity.id,
        props: null,
        target: block.target,
        validationError: 'Unknown widget component.',
    };
}

function widgetFromInvalidPayload(
    payload: unknown,
    activity: TavernResponseActivity,
    error: string | undefined
): WidgetRow['widget'] {
    const record = readRecord(payload);
    const component = readString(record.component);

    return {
        component,
        fallbackText:
            readFallbackText(record.fallback) ?? fallbackTextFromActivity(activity, component),
        id: activity.id,
        props: null,
        target: readString(record.target),
        validationError: error ?? 'Invalid widget.',
    };
}

function fallbackTextFromActivity(activity: TavernResponseActivity, component: string | null) {
    return (
        activity.summary?.trim() ||
        activity.detail?.trim() ||
        activity.title?.trim() ||
        component ||
        'Unable to render widget.'
    );
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
