import type { AgentRuntimeSessionArtifact } from '@tavern/api';
import { buildToolActions } from '../tools/actions.ts';
import { toolDetailSchema } from '../tools/contracts.ts';
import { buildToolSummaryFromValues } from '../tools/summary.ts';
import {
    type AgentRuntimeSessionSnapshot,
    buildAgentRuntimeSessionMetadata,
    buildAgentRuntimeSessionRelationships,
    listAgentRuntimeSessionMessages,
} from './agent-runtime-shared.ts';
import { type SessionDetail, sessionDetailSchema, sessionMessagesPageSchema } from './contracts.ts';
import { buildSessionLogEntries } from './log.ts';
import { mergeToolCalls } from './tool-call-sync.ts';
import { buildSessionThinking } from './thinking.ts';

function mapAgentRuntimeArtifact(artifact: AgentRuntimeSessionArtifact) {
    return {
        artifactType: artifact.artifactType,
        createdAt: artifact.createdAt,
        id: artifact.id,
        mimeType: artifact.mimeType,
        path: artifact.path,
        payload: artifact.payload,
    };
}

function buildAgentRuntimeSessionLogEntries(snapshot: AgentRuntimeSessionSnapshot) {
    const messages = listAgentRuntimeSessionMessages(snapshot);
    const artifacts = snapshot.graph.artifacts
        .filter((artifact) => artifact.sessionKey === snapshot.targetSession.key)
        .map(mapAgentRuntimeArtifact);

    return buildSessionLogEntries({
        accessEvents: [],
        artifacts,
        deliveries: [],
        messages,
        thinking: buildSessionThinking(messages),
    });
}

export function buildAgentRuntimeSessionLogPage(input: {
    limit: number;
    offset: number;
    snapshot: AgentRuntimeSessionSnapshot;
}) {
    const entries = buildAgentRuntimeSessionLogEntries(input.snapshot);
    const offset = Math.min(input.offset, entries.length);

    return {
        entries: entries.slice(offset, offset + input.limit),
        limit: input.limit,
        offset,
        total: entries.length,
    };
}

export function buildAgentRuntimeSessionDetail(input: {
    limit: number;
    offset: number;
    snapshot: AgentRuntimeSessionSnapshot;
}): SessionDetail {
    const messages = listAgentRuntimeSessionMessages(input.snapshot);
    const offset = Math.min(input.offset, messages.length);
    const logEntries = buildAgentRuntimeSessionLogEntries(input.snapshot);
    const logOffset = Math.max(logEntries.length - input.limit, 0);

    return sessionDetailSchema.parse({
        deliveries: [],
        log: {
            entries: logEntries.slice(logOffset, logOffset + input.limit),
            limit: input.limit,
            offset: logOffset,
            total: logEntries.length,
        },
        messages: sessionMessagesPageSchema.parse({
            limit: input.limit,
            messages: messages.slice(offset, offset + input.limit),
            offset,
            total: messages.length,
        }),
        relationships: buildAgentRuntimeSessionRelationships(input.snapshot),
        session: buildAgentRuntimeSessionMetadata(input.snapshot),
    });
}

export function buildAgentRuntimeSessionToolDetail(input: {
    snapshot: AgentRuntimeSessionSnapshot;
    toolCallId: string;
}) {
    const toolCalls = mergeToolCalls({
        messages: input.snapshot.graph.messages.map((message) => ({
            content: message.content,
            id: message.id,
            metadata: message.metadata,
            sender: message.sender,
            senderName: message.senderName,
            senderType: message.senderType,
            sessionKey: message.sessionKey,
            timestamp: message.timestamp,
        })),
        toolCalls: input.snapshot.graph.toolCalls,
    });
    const record =
        toolCalls.find(
            (toolCall) =>
                toolCall.sessionKey === input.snapshot.targetSession.key &&
                (toolCall.id === input.toolCallId || toolCall.toolCallId === input.toolCallId)
        ) ?? null;

    if (!record) {
        return null;
    }

    const resultValue =
        record.childSessionKey && record.result && typeof record.result === 'object'
            ? {
                  ...(record.result as Record<string, unknown>),
                  childSessionKey: record.childSessionKey,
              }
            : (record.result ??
              (record.childSessionKey ? { childSessionKey: record.childSessionKey } : null));

    return toolDetailSchema.parse({
        actions: buildToolActions({
            argumentsValue: record.arguments,
            resultValue,
            toolName: record.toolName,
        }),
        arguments: record.arguments,
        completedAt: record.finishedAt,
        result: resultValue,
        startedAt: record.startedAt,
        toolCall: buildToolSummaryFromValues({
            argumentsValue: record.arguments,
            callId: record.toolCallId ?? input.toolCallId,
            isError: record.isError,
            name: record.toolName,
            resultValue,
        }),
    });
}
