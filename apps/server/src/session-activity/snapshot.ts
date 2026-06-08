import { normalizeModelIdentity } from '../model/identity.ts';
import type { ChatHistoryMessage, LiveSession } from '../sessions/messages.ts';
import { deriveAgentId, resolveSessionMessageText } from '../sessions/messages.ts';
import {
    createToolCallRecord,
    deriveRuntime,
    emptySessionActivitySnapshot,
    extractParts,
    extractToolResultPayload,
    formatOptionalTimestamp,
    getMessageActivitySource,
    getNumber,
    getString,
    isRecord,
    mergeSessionActivitySnapshots,
    resolveIsError,
    type SessionActivitySnapshot,
    stringifyJson,
} from './snapshot-shared.ts';
import { applyToolCallEffects } from './tool-effects.ts';

export { mergeSessionActivitySnapshots };
export type { SessionActivitySnapshot };

export function buildSessionActivitySnapshot(input: {
    tavernAgentId?: string | null;
    session: LiveSession;
    syncedAt: string;
    transcriptMessages?: ChatHistoryMessage[];
}) {
    const snapshot = emptySessionActivitySnapshot();
    const rawSession = input.session as unknown as Record<string, unknown>;
    const parentSessionKey = getString(rawSession.parentSessionKey);
    const sessionId = getString(rawSession.sessionId);
    const spawnedBy = getString(rawSession.spawnedBy);
    const sessionStatus = getString(rawSession.status);
    const startedAt = formatOptionalTimestamp(getNumber(rawSession.startedAt)) ?? null;
    const finishedAt = formatOptionalTimestamp(getNumber(rawSession.endedAt)) ?? null;
    const childSessions = Array.isArray(rawSession.childSessions)
        ? rawSession.childSessions.flatMap((value) => (typeof value === 'string' ? [value] : []))
        : [];
    const sources =
        input.transcriptMessages && input.transcriptMessages.length > 0
            ? input.transcriptMessages
            : (input.session.messages ?? []);
    const toolCalls = new Map<string, SessionActivitySnapshot['toolCalls'][number]>();

    if (!sessionId) {
        throw new Error(`Runtime session "${input.session.key}" is missing an Hermes sessionId.`);
    }

    snapshot.runs.push({
        agentId: input.tavernAgentId ?? deriveAgentId(input.session.key),
        deliveryContextJson:
            typeof input.session.deliveryContext === 'undefined'
                ? null
                : stringifyJson(input.session.deliveryContext),
        finishedAt,
        id: `session:${input.session.key}`,
        label: input.session.label ?? input.session.displayName ?? null,
        mode: null,
        parentSessionKey,
        payloadJson: stringifyJson(input.session),
        runtime: deriveRuntime(input.session) ?? null,
        sessionId,
        sessionKey: input.session.key,
        spawnedBy,
        spawnedByMessageId: null,
        spawnedByToolCallId: null,
        startedAt: startedAt ?? formatOptionalTimestamp(getNumber(input.session.updatedAt)) ?? null,
        status: sessionStatus,
        thinkingLevel: input.session.thinkingLevel ?? input.session.reasoningLevel ?? null,
        updatedAt: formatOptionalTimestamp(getNumber(input.session.updatedAt)) ?? input.syncedAt,
    });

    if (parentSessionKey) {
        snapshot.links.push({
            childSessionKey: input.session.key,
            createdAt: input.syncedAt,
            deliveryMode: null,
            id: `session-link:${parentSessionKey}:${input.session.key}`,
            linkType:
                deriveRuntime(input.session) === 'acp' ? 'spawned_acp_session' : 'session_parent',
            parentSessionKey,
            payloadJson: stringifyJson(input.session),
            runId: null,
            sourceMessageId: null,
            sourceToolCallId: null,
            updatedAt: input.syncedAt,
        });
    }

    for (const [index, childSessionKey] of childSessions.entries()) {
        snapshot.links.push({
            childSessionKey,
            createdAt: input.syncedAt,
            deliveryMode: null,
            id: `session-child:${input.session.key}:${index}`,
            linkType: 'session_child',
            parentSessionKey: input.session.key,
            payloadJson: stringifyJson(input.session.deliveryContext ?? null),
            runId: null,
            sourceMessageId: null,
            sourceToolCallId: null,
            updatedAt: input.syncedAt,
        });
    }

    for (const [index, message] of sources.entries()) {
        const source = getMessageActivitySource(input.session, message, index);
        const messageId = `${input.session.key}:message:${source.externalMessageId ?? source.seq}`;
        const contentText = resolveSessionMessageText(source.content);
        const modelInfo = normalizeModelIdentity({
            model: source.model,
            provider: source.provider,
        });

        snapshot.messages.push({
            api: source.api ?? null,
            actorId: null,
            actorKind: null,
            contentJson:
                typeof source.content === 'undefined' ? null : stringifyJson(source.content),
            contentText: contentText.length > 0 ? contentText : null,
            errorMessage: source.errorMessage ?? null,
            externalMessageId: source.externalMessageId ?? null,
            id: messageId,
            model: modelInfo?.model ?? null,
            provider: modelInfo?.provider ?? null,
            rawJson: stringifyJson(source.raw),
            role: source.role,
            senderLabel: source.senderLabel ?? null,
            seq: source.seq,
            sessionKey: input.session.key,
            stopReason: source.stopReason ?? null,
            syncedAt: input.syncedAt,
            timestamp: source.timestamp,
            usageJson: typeof source.usage === 'undefined' ? null : stringifyJson(source.usage),
        });

        for (const [partIndex, part] of extractParts(source.content).entries()) {
            const rawPart = isRecord(part)
                ? part
                : { text: resolveSessionMessageText(part), type: 'text' };
            const partType =
                getString(rawPart.type) ?? (typeof part === 'string' ? 'text' : 'other');

            snapshot.messageParts.push({
                argumentsJson:
                    typeof rawPart.arguments === 'undefined'
                        ? null
                        : stringifyJson(rawPart.arguments),
                id: `${messageId}:part:${partIndex}`,
                messageId,
                mimeType: getString(rawPart.mimeType ?? rawPart.mediaType) ?? null,
                partIndex,
                rawJson: stringifyJson(part),
                resultJson:
                    typeof rawPart.result === 'undefined' ? null : stringifyJson(rawPart.result),
                sessionKey: input.session.key,
                syncedAt: input.syncedAt,
                text: partType === 'text' ? resolveSessionMessageText(rawPart) || null : null,
                thinkingText:
                    partType === 'thinking' ? resolveSessionMessageText(rawPart) || null : null,
                toolCallId: getString(rawPart.id ?? rawPart.toolCallId) ?? null,
                toolName: getString(rawPart.name ?? rawPart.toolName) ?? null,
                type: partType,
            });

            if (partType === 'toolCall') {
                const record = createToolCallRecord({
                    messageId,
                    part: rawPart,
                    sessionKey: input.session.key,
                    startedAt: source.timestamp,
                    syncedAt: input.syncedAt,
                });
                toolCalls.set(record.toolCallId ?? record.id, record);
            }
        }

        if (source.role === 'toolResult' || source.senderLabel === 'toolresult') {
            const payload = extractToolResultPayload(source.raw, source.content);
            const toolCallId = getString(source.raw.toolCallId) ?? `${messageId}:tool-result`;
            const existing = toolCalls.get(toolCallId);
            const toolName = getString(source.raw.toolName) ?? existing?.toolName ?? 'unknown';

            toolCalls.set(toolCallId, {
                agentId: existing?.agentId ?? null,
                argumentsJson: existing?.argumentsJson ?? null,
                childSessionKey:
                    (isRecord(payload) ? getString(payload.childSessionKey) : undefined) ?? null,
                finishedAt: source.timestamp,
                id: existing?.id ?? `${input.session.key}:tool:${toolCallId}`,
                isError: resolveIsError(source.raw, payload) ?? existing?.isError ?? null,
                messageId: existing?.messageId ?? messageId,
                rawJson: stringifyJson(source.raw),
                resultJson:
                    typeof payload === 'undefined'
                        ? stringifyJson({ text: contentText })
                        : stringifyJson(payload),
                runId: (isRecord(payload) ? getString(payload.runId) : undefined) ?? null,
                sessionKey: input.session.key,
                startedAt: existing?.startedAt ?? source.timestamp,
                toolCallId,
                toolName,
                updatedAt: input.syncedAt,
            });
        }
    }

    snapshot.toolCalls.push(...toolCalls.values());

    applyToolCallEffects({
        session: input.session,
        snapshot,
        syncedAt: input.syncedAt,
    });

    return snapshot;
}
