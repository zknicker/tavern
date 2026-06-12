import type {
    TavernArtifact,
    TavernChatMessage,
    TavernChatResponse,
    TavernResponseActivity,
} from '@tavern/sdk';
import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import { listAgents } from '../agents/catalog.ts';
import { sessionMessageAttachmentSchema } from '../sessions/contracts/messages.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import { buildToolSummaryFromValues } from '../tools/summary.ts';
import type { ChatLogPage } from './contracts.ts';
import { workerRowFromSubagentActivity } from './runtime-worker-rows.ts';

export interface RuntimeChatTimelinePage {
    activeReply: ChatLogPage['activeReply'];
    failedTurn: ChatLogPage['failedTurn'];
    nextBeforeSequence: number | null;
    rows: ChatLogPage['rows'];
    totalMessages: number;
}

export async function getRuntimeChatTimelinePage(
    chatId: string,
    input: { beforeSequence?: number; limit?: number } = {}
): Promise<RuntimeChatTimelinePage | null> {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        return null;
    }

    const isLatestPage = input.beforeSequence === undefined;
    const client = createTavernClientForConnection(connection);
    const [agents, page] = await Promise.all([
        listAgents(),
        client.chat.timeline(chatId, {
            beforeSequence: input.beforeSequence,
            limit: input.limit,
        }),
    ]);
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const responsesById = new Map(page.responses.map((response) => [response.id, response]));
    const responseIdByMessageId = new Map<string, string>();

    for (const response of page.responses) {
        if (response.request_message_id) {
            responseIdByMessageId.set(response.request_message_id, response.id);
        }
        if (response.response_message_id) {
            responseIdByMessageId.set(response.response_message_id, response.id);
        }
    }

    const finalReplyTextByRunId = new Map(
        page.messages
            .filter((message) => message.chat_id === chatId && message.role === 'assistant')
            .map((message) => [runtimeMetadataString(message, 'runId'), messageText(message)])
            .filter((entry): entry is [string, string] => Boolean(entry[0]))
    );
    const agentNamesById = new Map(agents.map((agent) => [agent.id, agent.name]));
    const messageRows = page.messages.flatMap((message) =>
        messageToChatRows(message, agentsById, responseIdByMessageId)
    );
    const activityRows = page.activity.flatMap((activity) =>
        activityToChatRows(activity, responsesById, finalReplyTextByRunId, agentNamesById)
    );
    const artifactRows = page.artifacts.map(artifactToChatRow);
    const rows = [...messageRows, ...activityRows, ...artifactRows];
    // Active and failed turn states describe the newest history; the latest
    // page is the only one whose responses can carry them.
    const activeReply = isLatestPage ? activeReplyFromResponses(page.responses) : null;
    const failedTurn = isLatestPage ? failedTurnFromResponses(page.responses) : null;
    const messageTimestampById = new Map(
        messageRows
            .filter(
                (row): row is Extract<ChatLogPage['rows'][number], { kind: 'message' }> =>
                    row.kind === 'message'
            )
            .map((row) => [row.id, row.message.timestamp])
    );
    const requestMessageIdByRowId = new Map<string, string>();

    for (const activity of page.activity) {
        const response = responsesById.get(activity.response_id);
        if (response?.request_message_id) {
            requestMessageIdByRowId.set(activity.id, response.request_message_id);
        }
    }

    for (const artifact of page.artifacts) {
        const response = artifact.response_id ? responsesById.get(artifact.response_id) : null;
        if (response?.request_message_id) {
            requestMessageIdByRowId.set(artifact.id, response.request_message_id);
        }
    }

    const sortedRows = rows.sort((left, right) => {
        const timestampDelta =
            rowTimestamp(left, { messageTimestampById, requestMessageIdByRowId }) -
            rowTimestamp(right, { messageTimestampById, requestMessageIdByRowId });

        return timestampDelta || rowSortRank(left) - rowSortRank(right);
    });

    return {
        activeReply,
        failedTurn,
        nextBeforeSequence: page.next_before_sequence,
        rows: sortedRows,
        totalMessages: page.total_messages,
    };
}

function artifactToChatRow(artifact: TavernArtifact): ChatLogPage['rows'][number] {
    return {
        responseId: artifact.response_id ?? undefined,
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
    agentsById: Map<string, Awaited<ReturnType<typeof listAgents>>[number]>,
    responseIdByMessageId: ReadonlyMap<string, string>
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
        responseId: responseIdByMessageId.get(message.id),
        message: {
            actor,
            attachments: messageAttachments(message),
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

function messageAttachments(message: TavernChatMessage) {
    if (message.attachments.length === 0) {
        return undefined;
    }

    const attachments = message.attachments.flatMap((attachment) => {
        const result = sessionMessageAttachmentSchema.safeParse(attachment);
        return result.success ? [result.data] : [];
    });
    return attachments.length > 0 ? attachments : undefined;
}

function activityToChatRows(
    activity: TavernResponseActivity,
    responsesById: ReadonlyMap<string, TavernChatResponse>,
    finalReplyTextByRunId: ReadonlyMap<string, string>,
    agentNamesById: ReadonlyMap<string, string>
): ChatLogPage['rows'] {
    const response = responsesById.get(activity.response_id) ?? null;
    const sessionKey = runtimeMetadataString(response, 'sessionKey');
    const actor = {
        id: runtimeMetadataString(response, 'agentId') ?? response?.participant_id ?? 'agt_unknown',
        kind: 'agent' as const,
    };
    const runtimeNotice = runtimeNoticeFromActivity(activity);

    if (runtimeNotice) {
        return [
            {
                id: activity.id,
                kind: 'system' as const,
                responseId: activity.response_id,
                runtimeNotice,
                systemKind: 'runtimeNotice' as const,
                timestamp: activity.started_at,
            },
        ];
    }

    const workerRow = workerRowFromSubagentActivity({
        activity,
        actor,
        agentName: agentNamesById.get(actor.id) ?? null,
        sessionKey,
    });

    if (workerRow) {
        return [workerRow];
    }

    if (!isRenderableActivity(activity, response, finalReplyTextByRunId)) {
        return [];
    }

    if (activity.kind === 'planning' || activity.kind === 'reasoning') {
        return activityToThinkingRows(activity, response, finalReplyTextByRunId);
    }

    if (activity.kind === 'message') {
        return activityToMessageRows(activity, response, actor);
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
        summaryParts:
            toolCall.summaryParts.length > 0
                ? toolCall.summaryParts
                : activitySummaryParts(activity),
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
            clarification: clarificationFromActivity(activity),
            responseId: activity.response_id,
            sessionKey,
            spawnedRelationships: [],
            startedAt: activity.started_at,
            toolCall: titledToolCall,
        },
    ];
}

function activityToMessageRows(
    activity: TavernResponseActivity,
    response: TavernChatResponse | null,
    actor: { id: string; kind: 'agent' }
): ChatLogPage['rows'] {
    const content = activity.detail?.trim() || activity.summary?.trim() || '';

    if (!content) {
        return [];
    }

    return [
        {
            actor,
            connectsToNext: false,
            connectsToPrevious: false,
            id: activity.id,
            isFirstInGroup: true,
            kind: 'message' as const,
            responseId: activity.response_id,
            message: {
                actor,
                content,
                id: activity.id,
                metadata: activity.metadata,
                sender: actor.id,
                senderType: 'agent' as const,
                sourceSessionId: runtimeMetadataString(response, 'sessionId'),
                sourceSessionKey: runtimeMetadataString(response, 'sessionKey') ?? '',
                tavernAgentId: actor.id,
                timestamp: activity.started_at,
            },
        },
    ];
}

function activityToThinkingRows(
    activity: TavernResponseActivity,
    response: TavernChatResponse | null,
    finalReplyTextByRunId: ReadonlyMap<string, string>
): ChatLogPage['rows'] {
    if (isFinalAssistantReplyStep(activity, response, finalReplyTextByRunId)) {
        return [];
    }

    const text = activity.detail?.trim() || activity.summary?.trim() || '';

    if (!text) {
        return [];
    }

    return [
        {
            id: activity.id,
            kind: 'system' as const,
            responseId: activity.response_id,
            systemKind: 'thinking' as const,
            thinking: {
                id: activity.id,
                messageId: response?.response_message_id ?? activity.response_id,
                sender: response?.participant_id ?? 'agt_unknown',
                text,
                timestamp: activity.started_at,
            },
            timestamp: activity.started_at,
        },
    ];
}

function runtimeNoticeFromActivity(
    activity: TavernResponseActivity
):
    | Extract<
          ChatLogPage['rows'][number],
          { kind: 'system'; systemKind: 'runtimeNotice' }
      >['runtimeNotice']
    | null {
    const runtime = readRecord(activity.metadata.runtime);
    const notice = readRecord(runtime.notice);
    const kind = runtimeNoticeKind(notice.kind);

    if (!kind) {
        return null;
    }

    const title = readString(notice.title) ?? runtimeNoticeFallbackTitle(kind);
    const text = readString(notice.text) ?? readString(activity.detail) ?? title;
    const compactionCount =
        kind === 'auto_compaction' && typeof notice.compactionCount === 'number'
            ? notice.compactionCount
            : null;

    return {
        compactionCount,
        detail: readString(notice.detail) ?? readString(activity.detail),
        kind,
        sessionId: readString(notice.sessionId),
        text,
        title,
    };
}

function runtimeNoticeKind(value: unknown) {
    return value === 'new_session' || value === 'auto_compaction' || value === 'status'
        ? value
        : null;
}

function runtimeNoticeFallbackTitle(kind: 'auto_compaction' | 'new_session' | 'status') {
    switch (kind) {
        case 'auto_compaction':
            return 'Compacted context';
        case 'new_session':
            return 'Started new session';
        case 'status':
            return 'Runtime notice';
    }
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

    if (detail && readRecord(activity.metadata.clarification).requestId) {
        return [detail];
    }

    if (
        detail &&
        (activity.kind === 'approval' ||
            activity.kind === 'message' ||
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

function readOptionalString(value: unknown) {
    return typeof value === 'string' ? value : null;
}

function readStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
}

function readClarificationDisposition(value: unknown): 'answered' | 'skipped' | 'timeout' | null {
    if (value === 'answered' || value === 'skipped' || value === 'timeout') {
        return value;
    }

    return null;
}

function readIsoString(value: unknown) {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        return null;
    }

    return new Date(Date.parse(value)).toISOString();
}

function clarificationFromActivity(activity: TavernResponseActivity) {
    const clarification = readRecord(activity.metadata.clarification);
    const requestId = readString(clarification.requestId);
    const question = readString(clarification.question);

    if (!(requestId && question)) {
        return null;
    }

    return {
        answer: readOptionalString(clarification.answer),
        choices: readStringArray(clarification.choices),
        deadlineAt: readIsoString(clarification.deadlineAt),
        disposition: readClarificationDisposition(clarification.disposition),
        question,
        requestId,
    };
}

function messageText(message: TavernChatMessage) {
    return message.content;
}

function activeReplyFromResponses(
    responses: readonly TavernChatResponse[]
): ChatLogPage['activeReply'] {
    const activeResponses = responses
        .filter(
            (response) =>
                (response.status === 'queued' || response.status === 'running') &&
                !response.response_message_id
        )
        .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
    const response = activeResponses[0];

    if (!response) {
        return null;
    }

    return {
        agentId: runtimeMetadataString(response, 'agentId') ?? response.participant_id,
        isThinking: true,
        runId: runtimeMetadataString(response, 'runId') ?? response.id,
        sessionKey: runtimeMetadataString(response, 'sessionKey') ?? response.id,
        startedAt: runtimeMetadataString(response, 'startedAt') ?? response.created_at,
        text: response.summary ?? '',
    };
}

export function failedTurnFromResponses(
    responses: readonly TavernChatResponse[]
): ChatLogPage['failedTurn'] {
    const latestResponse = [...responses].sort(
        (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at)
    );

    if (!(latestResponse[0]?.status === 'failed' && !latestResponse[0].response_message_id)) {
        return null;
    }

    const failedResponse = latestResponse[0];

    return {
        error:
            runtimeMetadataString(failedResponse, 'error') ??
            readString(failedResponse.metadata.error) ??
            'Agent failed to produce a reply.',
        turn: {
            agentId:
                runtimeMetadataString(failedResponse, 'agentId') ?? failedResponse.participant_id,
            chatId: failedResponse.chat_id,
            runId: runtimeMetadataString(failedResponse, 'runId') ?? failedResponse.id,
            sessionKey: runtimeMetadataString(failedResponse, 'sessionKey') ?? failedResponse.id,
            startedAt:
                runtimeMetadataString(failedResponse, 'startedAt') ?? failedResponse.created_at,
        },
    };
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
        if (isActivityMessageRow(row)) {
            return 1;
        }
        return row.message.senderType === 'user' ? 0 : 2;
    }

    return 1;
}

function isActivityMessageRow(row: Extract<ChatLogPage['rows'][number], { kind: 'message' }>) {
    return row.id.startsWith('act_');
}
