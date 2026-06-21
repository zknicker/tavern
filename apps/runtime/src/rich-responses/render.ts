import {
    type AgentRuntimeRichResponseProgress,
    compileRichResponseSpecStream,
    parseRichResponseSpecStreamLines,
    richResponseComponentId,
    richResponseRenderInputSchema,
    type TavernUpsertResponseActivityRequest,
} from '@tavern/api';

interface RichResponseActivitySource {
    detail?: string | null;
    id: string;
    kind: string;
    metadata?: Record<string, unknown>;
    summary?: string | null;
    title: string;
}

const specFencePattern = /```spec\s*\n([\s\S]*?)\n```/u;

export interface ParsedRichResponse {
    displayContent: string;
    fallbackText: string;
    patches: unknown[];
    render: unknown;
}

export function parseRichResponseFromAssistantContent(content: string): ParsedRichResponse | null {
    const fence = splitRichResponseSpecFence(content);
    if (!fence?.closed) {
        return null;
    }

    const displayContent = richResponseDisplayContent(content);
    return parseRichResponseSpecBody(fence.body, displayContent, true);
}

export function parseStreamingRichResponseFromAssistantContent(
    content: string
): ParsedRichResponse | null {
    const fence = splitRichResponseSpecFence(content);
    if (!fence) {
        return null;
    }

    const body = completedSpecBody(fence.body, fence.closed);
    if (!body.trim()) {
        return null;
    }

    try {
        return parseRichResponseSpecBody(body, richResponseDisplayContent(content), false);
    } catch {
        return null;
    }
}

export function richResponseDisplayContent(content: string) {
    const fence = splitRichResponseSpecFence(content);
    if (!fence) {
        return content;
    }

    return `${fence.before}${fence.closed ? fence.after : ''}`.replace(/\n{3,}/gu, '\n\n').trim();
}

function parseRichResponseSpecBody(
    body: string,
    displayContent: string,
    includeInvalidPayload: boolean
): ParsedRichResponse | null {
    try {
        const patches = parseRichResponseSpecStreamLines(body);
        const spec = compileRichResponseSpecStream(body);
        const fallbackText = richResponseFallbackText(spec);

        return {
            displayContent,
            fallbackText,
            patches,
            render: {
                component: richResponseComponentId,
                fallback: { text: fallbackText },
                props: { spec },
                target: 'chat.inline',
            },
        };
    } catch (error) {
        if (!includeInvalidPayload) {
            throw error;
        }

        const fallbackText = fallbackTextFromDisplayContent(displayContent);

        return {
            displayContent,
            fallbackText,
            patches: [],
            render: {
                component: richResponseComponentId,
                fallback: { text: fallbackText },
                props: {},
                target: 'chat.inline',
                validationError: errorMessage(error),
            },
        };
    }
}

interface RichResponseSpecFence {
    after: string;
    before: string;
    body: string;
    closed: boolean;
}

function splitRichResponseSpecFence(content: string): RichResponseSpecFence | null {
    const match = specFencePattern.exec(content);

    if (match) {
        const [fence, body] = match;
        const start = match.index;
        const end = start + fence.length;

        return {
            after: content.slice(end),
            before: content.slice(0, start),
            body,
            closed: true,
        };
    }

    const start = /```spec\s*\n?/u.exec(content);
    if (!start) {
        return null;
    }

    const bodyStart = start.index + start[0].length;
    return {
        after: '',
        before: content.slice(0, start.index),
        body: content.slice(bodyStart),
        closed: false,
    };
}

function completedSpecBody(body: string, closed: boolean) {
    if (closed || /\r?\n$/u.test(body)) {
        return body;
    }

    const lines = body.split(/\r?\n/u);
    lines.pop();
    return lines.join('\n');
}

export function richResponseActivity(input: {
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
}): TavernUpsertResponseActivityRequest {
    return {
        completed_at: input.timestamp,
        detail: input.fallbackText,
        id: input.activityId,
        kind: 'rich_response',
        metadata: {
            richResponse: input.render,
            runtime: {
                agentId: input.agentId,
                messageId: input.messageId,
                runId: input.runId,
                sessionKey: input.sessionKey,
                source: input.source,
                startedAt: input.startedAt,
            },
        },
        started_at: input.timestamp,
        status: 'completed',
        summary: input.fallbackText,
        title: 'Rich Response',
    };
}

export function richResponseProgressFromActivity(
    activity: RichResponseActivitySource
): AgentRuntimeRichResponseProgress | null {
    if (activity.kind !== 'rich_response') {
        return null;
    }

    const payload = readRecord(activity.metadata).richResponse;

    if (payload === undefined) {
        return invalidRichResponseProgress(activity, null, 'Missing Rich Response payload.');
    }

    const parsed = richResponseRenderInputSchema.safeParse(payload);

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

    return invalidRichResponseProgress(
        activity,
        {
            component,
            fallbackText: readFallbackText(record.fallback),
            target: readString(record.target),
        },
        readString(record.validationError) ??
            parsed.error.issues[0]?.message ??
            'Invalid Rich Response.'
    );
}

function richResponseFallbackText(spec: {
    elements: Record<string, { props: unknown; type: string }>;
    root: string;
}) {
    const root = spec.elements[spec.root];
    const rootTitle = textProp(root?.props);

    if (rootTitle) {
        return rootTitle;
    }

    for (const element of Object.values(spec.elements)) {
        if (element.type === 'Heading') {
            const text = textProp(element.props);
            if (text) {
                return text;
            }
        }
    }

    return 'Rich Response';
}

function fallbackTextFromDisplayContent(content: string) {
    return (
        content
            .split(/\r?\n/u)
            .find((line) => line.trim().length > 0)
            ?.trim()
            .slice(0, 500) ?? 'Rich Response'
    );
}

function textProp(value: unknown) {
    const record = readRecord(value);
    const text = readString(record.text) ?? readString(record.title);
    return text?.slice(0, 500) ?? null;
}

function invalidRichResponseProgress(
    activity: RichResponseActivitySource,
    input: {
        component: string | null;
        fallbackText: string | null;
        target: string | null;
    } | null,
    error: string
): AgentRuntimeRichResponseProgress {
    const component = input?.component ?? null;

    return {
        component,
        fallbackText:
            input?.fallbackText ??
            activity.summary?.trim() ??
            activity.detail?.trim() ??
            readString(activity.title) ??
            component ??
            'Unable to render Rich Response.',
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

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Invalid Rich Response spec.';
}
