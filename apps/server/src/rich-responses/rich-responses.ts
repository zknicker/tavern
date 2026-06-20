import { richResponseRenderInputSchema } from '@tavern/api/rich-responses';
import type { TavernResponseActivity } from '@tavern/sdk';
import type { ChatLogPage } from '../chat/contracts.ts';

type RichResponseRow = Extract<ChatLogPage['rows'][number], { kind: 'rich_response' }>;

export function richResponseRowFromActivity(input: {
    activity: TavernResponseActivity;
    actor: RichResponseRow['actor'];
    sessionKey: string | null;
}): RichResponseRow | null {
    if (input.activity.kind !== 'rich_response') {
        return null;
    }

    const payload = readRecord(input.activity.metadata).richResponse;

    if (payload === undefined) {
        return null;
    }

    const parsed = richResponseRenderInputSchema.safeParse(payload);
    const richResponse = parsed.success
        ? {
              component: parsed.data.component,
              fallbackText: parsed.data.fallback.text,
              id: input.activity.id,
              props: parsed.data.props,
              target: parsed.data.target,
              validationError: null,
          }
        : richResponseFromInvalidPayload(payload, input.activity, parsed.error.issues[0]?.message);

    return {
        actor: input.actor,
        completedAt: input.activity.completed_at,
        connectsToNext: false,
        connectsToPrevious: false,
        id: input.activity.id,
        isFirstInGroup: true,
        kind: 'rich_response',
        responseId: input.activity.response_id,
        richResponse,
        sessionKey: input.sessionKey,
        startedAt: input.activity.started_at,
    };
}

function richResponseFromInvalidPayload(
    payload: unknown,
    activity: TavernResponseActivity,
    error: string | undefined
): RichResponseRow['richResponse'] {
    const record = readRecord(payload);
    const component = readString(record.component);

    return {
        component,
        fallbackText:
            readFallbackText(record.fallback) ?? fallbackTextFromActivity(activity, component),
        id: activity.id,
        props: null,
        target: readString(record.target),
        validationError: readString(record.validationError) ?? error ?? 'Invalid Rich Response.',
    };
}

function fallbackTextFromActivity(activity: TavernResponseActivity, component: string | null) {
    return (
        activity.summary?.trim() ||
        activity.detail?.trim() ||
        activity.title?.trim() ||
        component ||
        'Unable to render Rich Response.'
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
