import {
    type AgentRuntimeWidgetProgress,
    parseWidgetPayload,
    type TavernUpsertResponseActivityRequest,
    type WidgetName,
    type WidgetRenderInput,
    widgetDisplayName,
    widgetRenderInputSchema,
} from '@tavern/api';
import { closedVisualFencePattern, openVisualFencePattern } from '@tavern/api/widgets/visual';

interface WidgetActivitySource {
    detail?: string | null;
    id: string;
    kind: string;
    metadata?: Record<string, unknown>;
    summary?: string | null;
    title: string;
}

// Two fence languages funnel into the widget machinery: `widget:<name>` for
// inline widgets and the bare `artifact` language for the durable artifact
// tier (its widget name is also `artifact`).
const widgetFencePattern = /```(widget:[a-z][a-z0-9-]*|artifact)[ \t]*\n([\s\S]*?)\n```/gu;
const openWidgetFencePattern = /```(?:widget:[a-z][a-z0-9-]*|artifact)[ \t]*(?:\n[\s\S]*)?$/u;
const maxWidgetBodyChars = 20_000;

function widgetNameFromFenceLanguage(language: string): string {
    return language === 'artifact' ? 'artifact' : language.slice('widget:'.length);
}

export interface ParsedWidget {
    fallbackText: string;
    name: WidgetName;
    render: WidgetRenderInput;
}

export interface InvalidWidgetFence {
    error: string;
    name: string;
}

export interface ParsedAssistantWidgets {
    displayContent: string;
    invalid: InvalidWidgetFence[];
    widgets: ParsedWidget[];
}

/**
 * Extract every closed `widget:<name>` JSON fence and every closed ```visual
 * body fence from final assistant content, in fence order. Returns null when
 * the content has no fences at all. Invalid fences are stripped from the
 * display content but produce no renderable widget.
 */
export function parseWidgetsFromAssistantContent(content: string): ParsedAssistantWidgets | null {
    const matches = [
        ...[...content.matchAll(widgetFencePattern)].map((match) => ({
            body: match[2] ?? '',
            index: match.index ?? 0,
            kind: 'widget' as const,
            language: match[1] ?? '',
        })),
        ...[...content.matchAll(closedVisualFencePattern)].map((match) => ({
            body: match[2] ?? '',
            index: match.index ?? 0,
            kind: 'visual' as const,
            title: match[1]?.trim() ?? '',
        })),
    ].sort((a, b) => a.index - b.index);
    const strippedClosed = stripClosedVisualFences(stripClosedWidgetFences(content));
    const hasOpenFence =
        openWidgetFencePattern.test(strippedClosed) || openVisualFencePattern.test(strippedClosed);

    if (matches.length === 0 && !hasOpenFence) {
        return null;
    }

    const widgets: ParsedWidget[] = [];
    const invalid: InvalidWidgetFence[] = [];

    for (const match of matches) {
        try {
            widgets.push(
                match.kind === 'visual'
                    ? parseVisualFenceBody(match.title, match.body)
                    : parseWidgetFenceBody(
                          match.language,
                          widgetNameFromFenceLanguage(match.language),
                          match.body
                      )
            );
        } catch (error) {
            invalid.push({
                error: errorMessage(error),
                name:
                    match.kind === 'visual'
                        ? 'visual'
                        : widgetNameFromFenceLanguage(match.language),
            });
        }
    }

    return {
        displayContent: widgetDisplayContent(content),
        invalid,
        widgets,
    };
}

/**
 * Assistant content with widget and visual fences removed: closed fences are
 * stripped everywhere, and a trailing unclosed fence (mid-stream) is hidden.
 */
export function widgetDisplayContent(content: string): string {
    return stripClosedVisualFences(stripClosedWidgetFences(content))
        .replace(openWidgetFencePattern, '')
        .replace(openVisualFencePattern, '')
        .replace(/\n{3,}/gu, '\n\n')
        .trim();
}

export function widgetActivityIdForRun(runId: string, index: number): string {
    return `act_${sanitizeWidgetActivityId(runId)}_widget_${index + 1}`;
}

export function widgetActivity(input: {
    activityId: string;
    agentId: string;
    messageId: string;
    runId: string;
    sessionKey: string;
    source: string;
    startedAt: string;
    timestamp: string;
    widget: ParsedWidget;
}): TavernUpsertResponseActivityRequest {
    return {
        completed_at: input.timestamp,
        detail: input.widget.fallbackText,
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
            widget: input.widget.render,
        },
        started_at: input.timestamp,
        status: 'completed',
        summary: input.widget.fallbackText,
        title: widgetDisplayName(input.widget.name),
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
        readString(record.validationError) ??
            parsed.error.issues[0]?.message ??
            'Invalid widget payload.'
    );
}

function parseWidgetFenceBody(language: string, name: string, body: string): ParsedWidget {
    const trimmed = body.trim();

    if (!trimmed) {
        throw new Error(`${language} fence is empty.`);
    }

    if (trimmed.length > maxWidgetBodyChars) {
        throw new Error(`${language} props exceed ${maxWidgetBodyChars} characters.`);
    }

    let payload: unknown;
    try {
        payload = JSON.parse(trimmed);
    } catch {
        throw new Error(`${language} props are not valid JSON.`);
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(`${language} props must be one JSON object.`);
    }

    return parseWidgetPayload(name, payload);
}

// The visual fence body is raw HTML, not JSON: size and shape validation
// happen in the visual props schema via the shared payload parser.
function parseVisualFenceBody(title: string, body: string): ParsedWidget {
    const html = body.trim();

    if (!html) {
        throw new Error('visual fence is empty.');
    }

    return parseWidgetPayload('visual', { html, ...(title ? { title } : {}) });
}

function stripClosedWidgetFences(content: string): string {
    return content.replace(widgetFencePattern, '');
}

function stripClosedVisualFences(content: string): string {
    return content.replace(closedVisualFencePattern, '');
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

function sanitizeWidgetActivityId(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/gu, '_');
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

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Invalid widget payload.';
}
