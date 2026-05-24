import {
    createTavernClient,
    type TavernArtifact,
    type TavernChatMessage,
    type TavernChatResponse,
    type TavernResponseActivity,
} from '@tavern/sdk';
import { listAgents } from '../agents/catalog.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import { buildToolSummaryFromValues } from '../tools/summary.ts';
import type { ChatLogPage } from './contracts.ts';

export async function listRuntimeChatRows(chatId: string): Promise<ChatLogPage['rows'] | null> {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        return null;
    }

    const client = createTavernClient({ baseUrl: connection.baseUrl });
    const [agents, page, responsePage] = await Promise.all([
        listAgents(),
        client.chat.messages(chatId, { limit: 500 }),
        client.chat.responses(chatId, { limit: 500 }),
    ]);
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const responsesById = new Map(
        responsePage.responses.map((response) => [response.id, response])
    );

    const finalReplyTextByRunId = new Map(
        page.messages
            .filter((message) => message.chat_id === chatId && message.role === 'assistant')
            .map((message) => [runtimeMetadataString(message, 'runId'), messageText(message)])
            .filter((entry): entry is [string, string] => Boolean(entry[0]))
    );
    const messageRows = page.messages.flatMap((message) => messageToChatRows(message, agentsById));
    const activityRows = responsePage.activity.flatMap((activity) =>
        activityToChatRows(activity, responsesById, finalReplyTextByRunId)
    );
    const artifactRows = responsePage.artifacts.map(artifactToChatRow);
    const rows = [...messageRows, ...activityRows, ...artifactRows];
    const messageTimestampById = new Map(
        messageRows
            .filter(
                (row): row is Extract<ChatLogPage['rows'][number], { kind: 'message' }> =>
                    row.kind === 'message'
            )
            .map((row) => [row.id, row.message.timestamp])
    );
    const requestMessageIdByRowId = new Map<string, string>();

    for (const activity of responsePage.activity) {
        const response = responsesById.get(activity.response_id);
        if (response?.request_message_id) {
            requestMessageIdByRowId.set(activity.id, response.request_message_id);
        }
    }

    for (const artifact of responsePage.artifacts) {
        const response = artifact.response_id ? responsesById.get(artifact.response_id) : null;
        if (response?.request_message_id) {
            requestMessageIdByRowId.set(artifact.id, response.request_message_id);
        }
    }

    return rows.sort((left, right) => {
        const timestampDelta =
            rowTimestamp(left, { messageTimestampById, requestMessageIdByRowId }) -
            rowTimestamp(right, { messageTimestampById, requestMessageIdByRowId });

        return timestampDelta || rowSortRank(left) - rowSortRank(right);
    });
}

function artifactToChatRow(artifact: TavernArtifact): ChatLogPage['rows'][number] {
    return {
        artifact: {
            artifactType: artifact.kind,
            createdAt: artifact.created_at,
            id: artifact.id,
            mimeType: artifact.mime_type,
            path: artifact.content_ref,
            payload: {
                contentRef: artifact.content_ref,
                contentText: artifact.content_text,
                metadata: artifact.metadata,
                title: artifact.title,
            },
        },
        id: artifact.id,
        kind: 'system',
        systemKind: 'artifact',
        timestamp: artifact.created_at,
    };
}

function messageToChatRows(
    message: TavernChatMessage,
    agentsById: Map<string, Awaited<ReturnType<typeof listAgents>>[number]>
): ChatLogPage['rows'] {
    const sourceAgentId = runtimeMetadataString(message, 'agentId') ?? message.author.id;
    const agent = message.author.kind === 'agent' ? agentsById.get(sourceAgentId) : null;
    const actor =
        message.author.kind === 'agent'
            ? { id: sourceAgentId, kind: 'agent' as const }
            : message.author.kind === 'user'
              ? { id: message.author.id, kind: 'participant' as const }
              : null;

    const row: ChatLogPage['rows'][number] = {
        actor,
        connectsToNext: false,
        connectsToPrevious: false,
        id: message.id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            actor,
            attachments: undefined,
            content: messageText(message),
            id: message.id,
            metadata: message.metadata,
            sender: agent?.name ?? message.author.label ?? message.author.id,
            senderType:
                message.role === 'assistant'
                    ? ('agent' as const)
                    : (message.role as 'system' | 'user'),
            sourceSessionId: runtimeMetadataString(message, 'sessionId'),
            sourceSessionKey: runtimeMetadataString(message, 'sessionKey') ?? '',
            tavernAgentId: message.author.kind === 'agent' ? sourceAgentId : null,
            timestamp: message.created_at,
        },
    };

    return [row];
}

function activityToChatRows(
    activity: TavernResponseActivity,
    responsesById: ReadonlyMap<string, TavernChatResponse>,
    finalReplyTextByRunId: ReadonlyMap<string, string>
): ChatLogPage['rows'] {
    const response = responsesById.get(activity.response_id) ?? null;
    const sessionKey = runtimeMetadataString(response, 'sessionKey');
    const actor = {
        id: runtimeMetadataString(response, 'agentId') ?? response?.participant_id ?? 'agt_unknown',
        kind: 'agent' as const,
    };

    if (!isRenderableActivity(activity, response, finalReplyTextByRunId)) {
        return [];
    }

    const toolMetadata = readRecord(activity.metadata.tool);
    const runtime = readRecord(activity.metadata.runtime);
    const toolName =
        readString(runtime.toolName) ?? readString(toolMetadata.name) ?? activityName(activity);
    const toolCallId = readString(runtime.toolCallId);
    const toolCall = buildToolSummaryFromValues({
        argumentsValue: Object.hasOwn(toolMetadata, 'arguments') ? toolMetadata.arguments : null,
        callId: toolCallId,
        isError: activity.status === 'failed',
        name: toolName,
        resultValue: Object.hasOwn(toolMetadata, 'result') ? toolMetadata.result : null,
    });
    const titledToolCall = {
        ...toolCall,
        label: activity.title,
        summaryParts: activitySummaryParts(activity),
    };

    return [
        {
            actor,
            completedAt: activity.completed_at,
            connectsToNext: false,
            connectsToPrevious: false,
            id: activity.id,
            isFirstInGroup: true,
            kind: 'tool' as const,
            sessionKey,
            spawnedRelationships: [],
            startedAt: activity.started_at,
            toolCall: titledToolCall,
        },
    ];
}

function isFinalAssistantReplyStep(
    activity: TavernResponseActivity,
    response: TavernChatResponse | null,
    finalReplyTextByRunId: ReadonlyMap<string, string>
) {
    const detail = activity.detail?.trim() ?? '';
    const runId = runtimeMetadataString(response, 'runId');
    const finalReplyText = runId ? (finalReplyTextByRunId.get(runId)?.trim() ?? '') : '';

    return detail.length > 0 && detail === finalReplyText;
}

function isRenderableActivity(
    activity: TavernResponseActivity,
    response: TavernChatResponse | null,
    finalReplyTextByRunId: ReadonlyMap<string, string>
) {
    if (activity.kind === 'message') {
        return !isFinalAssistantReplyStep(activity, response, finalReplyTextByRunId);
    }

    return (
        activity.kind === 'tool_call' ||
        activity.kind === 'tool_result' ||
        activity.kind === 'command' ||
        activity.kind === 'approval' ||
        activity.kind === 'artifact' ||
        activity.kind === 'custom' ||
        activity.kind === 'reasoning' ||
        activity.kind === 'planning'
    );
}

function activityName(activity: TavernResponseActivity) {
    if (activity.kind === 'command') {
        return 'command';
    }
    if (activity.kind === 'approval') {
        return 'approval';
    }
    if (activity.kind === 'artifact') {
        return 'artifact';
    }
    if (activity.kind === 'planning' || activity.kind === 'reasoning') {
        return 'reasoning';
    }
    if (activity.kind === 'message') {
        return 'message';
    }
    return 'tool';
}

function activitySummaryParts(activity: TavernResponseActivity) {
    const detail = activity.detail?.trim() ?? '';

    if (
        detail &&
        (activity.kind === 'message' ||
            activity.kind === 'reasoning' ||
            activity.kind === 'planning')
    ) {
        return [detail];
    }

    return [activity.title];
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function messageText(message: TavernChatMessage) {
    return message.content;
}

function runtimeMetadataString(
    message: TavernChatMessage | TavernChatResponse | null,
    key: string
) {
    const runtime = message?.metadata.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return null;
    }

    const value = (runtime as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
}

function rowTimestamp(
    row: ChatLogPage['rows'][number],
    context: {
        messageTimestampById?: ReadonlyMap<string, string>;
        requestMessageIdByRowId?: ReadonlyMap<string, string>;
    } = {}
) {
    const requestMessageId = context.requestMessageIdByRowId?.get(row.id);
    const requestMessageTimestamp = requestMessageId
        ? context.messageTimestampById?.get(requestMessageId)
        : null;
    const timestamp =
        requestMessageTimestamp ??
        (row.kind === 'message'
            ? row.message.timestamp
            : row.kind === 'tool'
              ? (row.startedAt ?? row.completedAt)
              : row.kind === 'worker'
                ? (row.startedAt ?? row.completedAt ?? row.worker.lastEventAt)
                : row.timestamp);
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function rowSortRank(row: ChatLogPage['rows'][number]) {
    if (row.kind === 'message') {
        return row.message.senderType === 'user' ? 0 : 2;
    }

    return 1;
}
