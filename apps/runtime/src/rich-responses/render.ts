import {
    type AgentRuntimeRichResponseProgress,
    type RichResponsePatch,
    richResponseComponentId,
    richResponsePatchSchema,
    richResponseRenderInputSchema,
    richResponseSpecSchema,
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
    patches: RichResponsePatch[];
    render: unknown;
}

export function parseRichResponseFromAssistantContent(content: string): ParsedRichResponse | null {
    const match = specFencePattern.exec(content);

    if (!match) {
        return null;
    }

    const [fence, body] = match;
    const displayContent = content
        .replace(fence, '')
        .replace(/\n{3,}/gu, '\n\n')
        .trim();

    try {
        const patches = parsePatchLines(body);
        const spec = applyRichResponsePatches(patches);
        const parsed = richResponseSpecSchema.safeParse(spec);

        if (!parsed.success) {
            throw new Error(parsed.error.issues[0]?.message ?? 'Invalid Rich Response spec.');
        }

        const fallbackText = richResponseFallbackText(parsed.data);

        return {
            displayContent,
            fallbackText,
            patches,
            render: {
                component: richResponseComponentId,
                fallback: { text: fallbackText },
                props: { spec: parsed.data },
                target: 'chat.inline',
            },
        };
    } catch (error) {
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

function parsePatchLines(body: string): RichResponsePatch[] {
    const patches: RichResponsePatch[] = [];

    for (const [index, line] of body.split(/\r?\n/u).entries()) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }

        let value: unknown;
        try {
            value = JSON.parse(trimmed);
        } catch {
            throw new Error(`Rich Response spec line ${index + 1} is not valid JSON.`);
        }

        const parsed = richResponsePatchSchema.safeParse(value);
        if (!parsed.success) {
            throw new Error(
                parsed.error.issues[0]?.message ??
                    `Rich Response spec line ${index + 1} is not a valid patch.`
            );
        }
        patches.push(parsed.data);
    }

    if (patches.length === 0) {
        throw new Error('Rich Response spec is empty.');
    }

    if (patches.length > 300) {
        throw new Error('Rich Response specs support at most 300 patches.');
    }

    return patches;
}

function applyRichResponsePatches(patches: RichResponsePatch[]) {
    const document: Record<string, unknown> = {};

    for (const patch of patches) {
        setJsonPointerValue(document, patch.path, patch.value);
    }

    return document;
}

function setJsonPointerValue(document: Record<string, unknown>, path: string, value: unknown) {
    if (!path.startsWith('/')) {
        throw new Error('Rich Response patch paths must be JSON pointers.');
    }

    const parts = path
        .slice(1)
        .split('/')
        .filter(Boolean)
        .map((part) => part.replace(/~1/gu, '/').replace(/~0/gu, '~'));

    if (parts.length === 0) {
        throw new Error('Rich Response patches cannot replace the document root.');
    }

    let target: Record<string, unknown> | unknown[] = document;
    for (const [index, part] of parts.entries()) {
        const isLast = index === parts.length - 1;

        if (isLast) {
            setContainerValue(target, part, value);
            return;
        }

        const next = getContainerValue(target, part);
        if (!(next && typeof next === 'object')) {
            const nextPart = parts[index + 1];
            const container: Record<string, unknown> | unknown[] = isArrayIndex(nextPart) ? [] : {};
            setContainerValue(target, part, container);
        }
        const stored = getContainerValue(target, part);
        if (!(stored && typeof stored === 'object')) {
            throw new Error('Rich Response patch path cannot traverse a primitive value.');
        }
        target = stored as Record<string, unknown> | unknown[];
    }
}

function getContainerValue(container: Record<string, unknown> | unknown[], key: string) {
    if (Array.isArray(container)) {
        return isArrayIndex(key) ? container[Number(key)] : undefined;
    }

    return container[key];
}

function setContainerValue(
    container: Record<string, unknown> | unknown[],
    key: string,
    value: unknown
) {
    if (Array.isArray(container)) {
        if (key === '-') {
            container.push(value);
            return;
        }

        if (!isArrayIndex(key)) {
            throw new Error('Rich Response array patch paths must use numeric indexes.');
        }

        container[Number(key)] = value;
        return;
    }

    container[key] = value;
}

function isArrayIndex(value: string | undefined) {
    return Boolean(value && /^(?:0|[1-9]\d*)$/u.test(value));
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
