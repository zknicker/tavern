import type { LiveSession } from '../sessions/messages.ts';
import type { SessionActivitySnapshot } from './snapshot-shared.ts';
import { getString, isRecord, maybeParseJson, stringifyJson } from './snapshot-shared.ts';

export function applyToolCallEffects(input: {
    session: LiveSession;
    snapshot: SessionActivitySnapshot;
    syncedAt: string;
}) {
    for (const toolCall of input.snapshot.toolCalls) {
        const args = maybeParseJson(toolCall.argumentsJson);
        const result = maybeParseJson(toolCall.resultJson);
        const targetSessionKey =
            (isRecord(args) ? getString(args.sessionKey) : undefined) ??
            toolCall.childSessionKey ??
            null;

        if (toolCall.toolName === 'sessions_spawn' && toolCall.childSessionKey) {
            input.snapshot.links.push({
                childSessionKey: toolCall.childSessionKey,
                createdAt: toolCall.finishedAt ?? toolCall.startedAt ?? input.syncedAt,
                deliveryMode:
                    (isRecord(result) ? getString(result.mode) : undefined) ??
                    (isRecord(args) ? getString(args.mode) : undefined) ??
                    null,
                id: `${toolCall.id}:link`,
                linkType:
                    (isRecord(args) ? getString(args.runtime) : undefined) === 'acp' ||
                    toolCall.childSessionKey.includes(':acp:')
                        ? 'spawned_acp_session'
                        : 'spawned_session',
                parentSessionKey: input.session.key,
                payloadJson: stringifyJson({ arguments: args ?? null, result: result ?? null }),
                runId: toolCall.runId ?? null,
                sourceMessageId: toolCall.messageId ?? null,
                sourceToolCallId: toolCall.toolCallId ?? null,
                updatedAt: input.syncedAt,
            });

            if (toolCall.runId) {
                const sessionId = isRecord(result) ? getString(result.sessionId) : null;

                if (!sessionId) {
                    continue;
                }

                input.snapshot.runs.push({
                    agentId: isRecord(args) ? (getString(args.agentId) ?? null) : null,
                    deliveryContextJson: null,
                    finishedAt: toolCall.finishedAt ?? null,
                    id: `run:${toolCall.runId}`,
                    label: isRecord(args) ? (getString(args.label) ?? null) : null,
                    mode:
                        (isRecord(result) ? getString(result.mode) : undefined) ??
                        (isRecord(args) ? getString(args.mode) : undefined) ??
                        null,
                    parentSessionKey: input.session.key,
                    payloadJson: stringifyJson({ arguments: args ?? null, result: result ?? null }),
                    runtime: isRecord(args) ? (getString(args.runtime) ?? null) : null,
                    sessionId,
                    sessionKey: toolCall.childSessionKey,
                    spawnedBy: input.session.key,
                    spawnedByMessageId: toolCall.messageId ?? null,
                    spawnedByToolCallId: toolCall.toolCallId ?? null,
                    startedAt: toolCall.startedAt ?? null,
                    status: isRecord(result) ? (getString(result.status) ?? null) : null,
                    thinkingLevel: null,
                    updatedAt: input.syncedAt,
                });
            }
        }

        if (
            toolCall.toolName.startsWith('sessions_') &&
            toolCall.resultJson &&
            (toolCall.isError ||
                (isRecord(result) &&
                    ['forbidden', 'denied', 'unauthorized'].includes(
                        getString(result.status) ?? ''
                    )) ||
                toolCall.resultJson.includes('visibility is restricted'))
        ) {
            let errorCode: string | null = null;
            if (toolCall.resultJson.includes('visibility is restricted')) {
                errorCode = 'visibility_restricted';
            } else if (isRecord(result)) {
                errorCode = getString(result.errorCode) ?? null;
            }

            input.snapshot.accessEvents.push({
                errorCode,
                errorMessage: isRecord(result)
                    ? (getString(result.error) ?? getString(result.errorMessage) ?? null)
                    : toolCall.resultJson,
                id: `${toolCall.id}:access`,
                occurredAt: toolCall.finishedAt ?? toolCall.startedAt ?? input.syncedAt,
                payloadJson: toolCall.resultJson,
                sessionKey: input.session.key,
                sourceMessageId: toolCall.messageId ?? null,
                sourceToolCallId: toolCall.toolCallId ?? null,
                status: isRecord(result) ? (getString(result.status) ?? 'error') : 'error',
                targetSessionKey,
                toolName: toolCall.toolName,
            });
        }

        for (const [artifactType, path] of [
            ['transcript', isRecord(result) ? getString(result.transcriptPath) : undefined],
            ['stream-log', isRecord(result) ? getString(result.streamLogPath) : undefined],
        ] as const) {
            if (!path) {
                continue;
            }

            input.snapshot.artifacts.push({
                artifactType,
                createdAt: toolCall.finishedAt ?? toolCall.startedAt ?? input.syncedAt,
                id: `${toolCall.id}:artifact:${artifactType}`,
                messageId: toolCall.messageId ?? null,
                mimeType: null,
                path,
                payloadJson: toolCall.resultJson,
                runId: toolCall.runId ?? null,
                sessionKey: toolCall.childSessionKey ?? input.session.key,
                sizeBytes: null,
                toolCallId: toolCall.toolCallId ?? null,
                updatedAt: input.syncedAt,
            });
        }
    }
}
