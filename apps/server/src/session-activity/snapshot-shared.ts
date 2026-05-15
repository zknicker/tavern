import type {
    sessionAccessEventsTable,
    sessionArtifactsTable,
    sessionDeliveriesTable,
    sessionLinksTable,
    sessionMessagePartsTable,
    sessionMessagesTable,
    sessionRunsTable,
    sessionToolCallsTable,
} from '../db/schema.ts';
import type { ChatHistoryMessage, LiveSession, LiveSessionMessage } from '../sessions/messages.ts';
import { deriveAgentId, resolveSessionMessageText } from '../sessions/messages.ts';
import { formatOptionalTimestamp, normalizeTimestamp } from '../utils/time.ts';

type SessionRunActivityInsert = typeof sessionRunsTable.$inferInsert;
type SessionMessageActivityInsert = typeof sessionMessagesTable.$inferInsert;
type SessionMessagePartActivityInsert = typeof sessionMessagePartsTable.$inferInsert;
type SessionToolCallActivityInsert = typeof sessionToolCallsTable.$inferInsert;
type SessionLinkActivityInsert = typeof sessionLinksTable.$inferInsert;
type SessionDeliveryActivityInsert = typeof sessionDeliveriesTable.$inferInsert;
type SessionAccessEventActivityInsert = typeof sessionAccessEventsTable.$inferInsert;
type SessionArtifactActivityInsert = typeof sessionArtifactsTable.$inferInsert;

export interface SessionActivitySnapshot {
    accessEvents: SessionAccessEventActivityInsert[];
    artifacts: SessionArtifactActivityInsert[];
    deliveries: SessionDeliveryActivityInsert[];
    links: SessionLinkActivityInsert[];
    messageParts: SessionMessagePartActivityInsert[];
    messages: SessionMessageActivityInsert[];
    runs: SessionRunActivityInsert[];
    toolCalls: SessionToolCallActivityInsert[];
}

interface SessionMessageActivitySource {
    api?: string;
    content: unknown;
    errorMessage?: string;
    externalMessageId?: string;
    model?: string;
    provider?: string;
    raw: Record<string, unknown>;
    role: string;
    senderLabel?: string;
    seq: number;
    stopReason?: string;
    timestamp: string;
    usage?: unknown;
}

export function deriveChannelFromSessionKey(sessionKey: string | null) {
    if (!sessionKey) {
        return null;
    }

    const match = /^agent:[^:]+:([^:]+):/.exec(sessionKey);
    return match?.[1] ?? null;
}

export function emptySessionActivitySnapshot(): SessionActivitySnapshot {
    return {
        accessEvents: [],
        artifacts: [],
        deliveries: [],
        links: [],
        messageParts: [],
        messages: [],
        runs: [],
        toolCalls: [],
    };
}

export function mergeSessionActivitySnapshots(
    left: SessionActivitySnapshot,
    right: SessionActivitySnapshot
): SessionActivitySnapshot {
    return {
        accessEvents: [...left.accessEvents, ...right.accessEvents],
        artifacts: [...left.artifacts, ...right.artifacts],
        deliveries: [...left.deliveries, ...right.deliveries],
        links: [...left.links, ...right.links],
        messageParts: [...left.messageParts, ...right.messageParts],
        messages: [...left.messages, ...right.messages],
        runs: [...left.runs, ...right.runs],
        toolCalls: [...left.toolCalls, ...right.toolCalls],
    };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function stringifyJson(value: unknown) {
    return JSON.stringify(value ?? null);
}

export function getString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function getNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function maybeParseJson(value: unknown) {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    if (
        !(
            (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))
        )
    ) {
        return undefined;
    }

    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return undefined;
    }
}

export function deriveRuntime(session: LiveSession) {
    const [, , runtime] = session.key.split(':');
    return runtime ?? session.kind;
}

export function getMessageActivitySource(
    session: LiveSession,
    message: ChatHistoryMessage | LiveSessionMessage,
    index: number
): SessionMessageActivitySource {
    const raw = message as Record<string, unknown>;
    const fallbackTimestamp = normalizeTimestamp(session.updatedAt, new Date(0).toISOString());
    const content = raw.content ?? raw.parts ?? raw.text;

    return {
        api: getString(raw.api),
        content,
        errorMessage: getString(raw.errorMessage),
        externalMessageId: getString(raw._meta && isRecord(raw._meta) ? raw._meta.id : raw.id),
        model: getString(raw.model),
        provider: getString(raw.provider),
        raw,
        role: getString(raw.role) ?? 'system',
        senderLabel: getString(raw.senderLabel ?? raw.sender ?? raw.author ?? raw.label),
        seq: getNumber(raw._meta && isRecord(raw._meta) ? raw._meta.seq : raw.seq) ?? index,
        stopReason: getString(raw.stopReason),
        timestamp: normalizeTimestamp(
            (raw.timestamp as number | string | undefined) ??
                (raw.createdAt as number | string | undefined),
            fallbackTimestamp
        ),
        usage: raw.usage,
    };
}

export function extractParts(content: unknown) {
    if (!Array.isArray(content)) {
        return [];
    }

    return content;
}

function extractStructuredToolResultPayload(candidate: unknown): unknown {
    if (isRecord(candidate)) {
        for (const key of ['result', 'payload', 'content', 'text', 'value']) {
            const nested = extractStructuredToolResultPayload(candidate[key]);

            if (typeof nested !== 'undefined') {
                return nested;
            }
        }

        return candidate;
    }

    if (Array.isArray(candidate)) {
        const parsed = maybeParseJson(resolveSessionMessageText(candidate));

        if (typeof parsed !== 'undefined') {
            return parsed;
        }

        for (const item of candidate) {
            const nested = extractStructuredToolResultPayload(item);

            if (typeof nested !== 'undefined') {
                return nested;
            }
        }

        return candidate;
    }

    const parsed = maybeParseJson(candidate);

    return typeof parsed !== 'undefined' ? parsed : undefined;
}

export function extractToolResultPayload(raw: Record<string, unknown>, content: unknown) {
    for (const candidate of [raw.result, raw.payload, content, raw.text]) {
        const payload = extractStructuredToolResultPayload(candidate);

        if (typeof payload !== 'undefined') {
            return payload;
        }
    }

    return undefined;
}

export function resolveIsError(raw: Record<string, unknown>, payload: unknown) {
    if (typeof raw.isError === 'boolean') {
        return raw.isError;
    }

    if (isRecord(payload) && getString(payload.status) === 'forbidden') {
        return true;
    }

    return undefined;
}

export function createToolCallRecord(input: {
    messageId: string;
    part: Record<string, unknown>;
    sessionKey: string;
    startedAt: string;
    syncedAt: string;
}) {
    const toolCallId = getString(input.part.id) ?? `${input.messageId}:tool`;
    const args = isRecord(input.part.arguments) ? input.part.arguments : null;

    return {
        agentId: args ? (getString(args.agentId) ?? null) : null,
        argumentsJson:
            typeof input.part.arguments === 'undefined'
                ? null
                : stringifyJson(input.part.arguments),
        childSessionKey: null,
        finishedAt: null,
        id: `${input.sessionKey}:tool:${toolCallId}`,
        isError: null,
        messageId: input.messageId,
        rawJson: stringifyJson(input.part),
        resultJson: null,
        runId: null,
        sessionKey: input.sessionKey,
        startedAt: input.startedAt,
        toolCallId,
        toolName: getString(input.part.name) ?? 'unknown',
        updatedAt: input.syncedAt,
    };
}

export { deriveAgentId, formatOptionalTimestamp };
export type { ChatHistoryMessage, LiveSession };
