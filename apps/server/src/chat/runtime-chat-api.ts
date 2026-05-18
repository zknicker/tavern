import { createTavernClient, type TavernChatActivity, type TavernChatMessage } from '@tavern/sdk';
import { listAgents } from '../agents/catalog.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import type { ChatLogPage } from './contracts.ts';

export async function listRuntimeChatRows(chatId: string): Promise<ChatLogPage['rows'] | null> {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        return null;
    }

    const client = createTavernClient({ baseUrl: connection.baseUrl });
    const [agents, page, activityPage] = await Promise.all([
        listAgents(),
        client.chat.messages(chatId, { limit: 500 }),
        client.chat.activity(),
    ]);
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

    const finalReplyTextByRunId = new Map(
        page.messages
            .filter((message) => message.chat_id === chatId && message.role === 'assistant')
            .map((message) => [runtimeMetadataString(message, 'runId'), messageText(message)])
            .filter((entry): entry is [string, string] => Boolean(entry[0]))
    );
    const messageRows = page.messages.flatMap((message) => messageToChatRows(message, agentsById));
    const activityRows = activityPage.activities
        .filter((activity) => activity.chat_id === chatId)
        .flatMap((activity) => activityToChatRows(activity, finalReplyTextByRunId));
    const rows = [...messageRows, ...activityRows];

    return rows.sort((left, right) => {
        const timestampDelta = rowTimestamp(left) - rowTimestamp(right);

        return timestampDelta || rowSortRank(left) - rowSortRank(right);
    });
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

    return [...reasoningRows(message), row];
}

function activityToChatRows(
    activity: TavernChatActivity,
    finalReplyTextByRunId: ReadonlyMap<string, string>
): ChatLogPage['rows'] {
    if (activity.status !== 'completed' && activity.status !== 'failed') {
        return [];
    }

    const sessionKey = activityMetadataString(activity, 'sessionKey');
    const actor = {
        id: activityMetadataString(activity, 'agentId') ?? activity.agent_id,
        kind: 'agent' as const,
    };

    return activity.steps
        .filter(
            (step) =>
                step.kind === 'tool' ||
                step.kind === 'command' ||
                (step.kind === 'message' &&
                    !isFinalAssistantReplyStep(activity, step, finalReplyTextByRunId)) ||
                step.kind === 'custom' ||
                step.kind === 'thinking'
        )
        .map((step) => {
            const detail = typeof step.metadata.detail === 'string' ? step.metadata.detail : null;
            const summaryParts = [step.label, detail].filter((part): part is string =>
                Boolean(part?.trim())
            );

            return {
                actor,
                completedAt: step.completed_at,
                connectsToNext: false,
                connectsToPrevious: false,
                id: `activity:${activity.run_id}:${step.id}`,
                isFirstInGroup: true,
                kind: 'tool' as const,
                sessionKey,
                spawnedRelationships: [],
                startedAt: step.started_at,
                toolCall: {
                    callId: activityStepMetadataString(step, 'toolCallId'),
                    facts: detail
                        ? [{ label: 'Detail', tone: 'default' as const, value: detail }]
                        : [],
                    label: step.label,
                    name:
                        activityStepMetadataString(step, 'toolName') ??
                        (step.kind === 'command'
                            ? 'command'
                            : step.kind === 'thinking'
                              ? 'reasoning'
                              : step.kind === 'message'
                                ? 'message'
                                : 'tool'),
                    status: step.status === 'failed' ? 'error' : step.status,
                    summaryParts,
                },
            };
        });
}

function isFinalAssistantReplyStep(
    activity: TavernChatActivity,
    step: TavernChatActivity['steps'][number],
    finalReplyTextByRunId: ReadonlyMap<string, string>
) {
    const detail = typeof step.metadata.detail === 'string' ? step.metadata.detail.trim() : '';
    const finalReplyText = finalReplyTextByRunId.get(activity.run_id)?.trim() ?? '';

    return detail.length > 0 && detail === finalReplyText;
}

function activityStepMetadataString(step: TavernChatActivity['steps'][number], key: string) {
    const value = step.metadata[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function reasoningRows(message: TavernChatMessage): ChatLogPage['rows'] {
    return message.parts
        .filter((part) => part.kind === 'reasoning' && part.content.trim().length > 0)
        .map((part) => ({
            id: `${message.id}:reasoning:${part.id}`,
            kind: 'system' as const,
            systemKind: 'thinking' as const,
            thinking: {
                id: `${message.id}:reasoning:${part.id}`,
                messageId: message.id,
                sender: message.author.label ?? message.author.id,
                text: part.content,
                timestamp: message.created_at,
            },
            timestamp: message.created_at,
        }));
}

function messageText(message: TavernChatMessage) {
    return message.parts
        .filter((part) => part.kind === 'text')
        .map((part) => part.content)
        .join('\n');
}

function activityMetadataString(activity: TavernChatActivity, key: string) {
    const runtime = activity.metadata.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return null;
    }

    const value = (runtime as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
}

function runtimeMetadataString(message: TavernChatMessage, key: string) {
    const runtime = message.metadata.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return null;
    }

    const value = (runtime as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
}

function rowTimestamp(row: ChatLogPage['rows'][number]) {
    const timestamp =
        row.kind === 'message'
            ? row.message.timestamp
            : row.kind === 'tool'
              ? (row.startedAt ?? row.completedAt)
              : row.kind === 'worker'
                ? (row.startedAt ?? row.completedAt ?? row.worker.lastEventAt)
                : row.timestamp;
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function rowSortRank(row: ChatLogPage['rows'][number]) {
    if (row.kind === 'message') {
        return row.message.senderType === 'user' ? 0 : 2;
    }

    return 1;
}
