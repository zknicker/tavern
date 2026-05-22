import {
    type AgentRuntimeChatStatus,
    type AgentRuntimeTurnProgressStep,
    agentRuntimeActiveChatReplySchema,
    agentRuntimeChatStatusListSchema,
    agentRuntimeChatStatusSchema,
} from '@tavern/api';
import { createTavernClient, type TavernChatResponse, type TavernResponseActivity } from '@tavern/sdk';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';

export const activeChatReplySchema = agentRuntimeActiveChatReplySchema;
export const chatStatusSchema = agentRuntimeChatStatusSchema;
export const chatStatusListSchema = agentRuntimeChatStatusListSchema;

const emptyChatStatuses = chatStatusListSchema.parse({
    chats: [],
});

export async function listChatStatuses() {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        return emptyChatStatuses;
    }

    const client = createTavernClient({ baseUrl: connection.baseUrl });
    const chatPage = await client.chat.list({ limit: 500 });
    const responsePages = await Promise.all(
        chatPage.chats.map((chat) => client.chat.responses(chat.id, { limit: 500 }))
    );
    const responses = responsePages.flatMap((page) => page.responses);
    const activity = responsePages.flatMap((page) => page.activity);
    const activityByResponseId = new Map<string, TavernResponseActivity[]>();
    for (const item of activity) {
        const existing = activityByResponseId.get(item.response_id) ?? [];
        existing.push(item);
        activityByResponseId.set(item.response_id, existing);
    }

    return chatStatusListSchema.parse({
        chats: responses.flatMap((chatResponse) =>
            responseToStatus(chatResponse, activityByResponseId.get(chatResponse.id) ?? [])
        ),
    });
}

function responseToStatus(
    response: TavernChatResponse,
    activity: TavernResponseActivity[]
): AgentRuntimeChatStatus[] {
    if (
        response.status === 'completed' ||
        response.status === 'failed' ||
        response.status === 'cancelled'
    ) {
        return [];
    }

    const metadata = readRuntimeMetadata(response);
    const startedAt =
        metadata.startedAt ??
        activity
            .map((step) => step.started_at)
            .sort((left, right) => left.localeCompare(right))[0] ??
        response.created_at;
    const activeReplySteps =
        activity.length > 0
            ? activity.map(activityStepToTurnStep)
            : [
                  {
                      detail: null,
                      id: 'planning',
                      kind: 'plan' as const,
                      label: 'Planning',
                      status: 'active' as const,
                  },
              ];

    return [
        chatStatusSchema.parse({
            activeReply: {
                agentId: metadata.agentId ?? response.participant_id,
                isThinking: true,
                runId: metadata.runId ?? response.id,
                sessionKey: metadata.sessionKey ?? response.id,
                startedAt,
                text: response.summary ?? '',
            },
            activeReplyProgressStartedAt: activity[0]?.started_at ?? startedAt,
            activeReplySteps,
            chatId: response.chat_id,
        }),
    ];
}

function activityStepToTurnStep(step: TavernResponseActivity) {
    return {
        detail: readStepDetail(step),
        id: step.id,
        kind: activityStepKind(step.kind),
        label: step.title,
        status: activityStepStatus(step.status),
        toolCallId: readStepString(step, 'toolCallId'),
        toolName: readStepString(step, 'toolName'),
    } satisfies AgentRuntimeTurnProgressStep;
}

function activityStepKind(kind: TavernResponseActivity['kind']): AgentRuntimeTurnProgressStep['kind'] {
    if (kind === 'approval' || kind === 'artifact') {
        return kind;
    }
    if (kind === 'reasoning') {
        return 'reasoning';
    }
    if (kind === 'command' || kind === 'message') {
        return kind;
    }
    if (kind === 'planning') {
        return 'plan';
    }
    return 'tool';
}

function activityStepStatus(status: string): AgentRuntimeTurnProgressStep['status'] {
    if (status === 'completed') {
        return 'completed';
    }
    if (status === 'failed') {
        return 'failed';
    }
    return 'active';
}

function readRuntimeMetadata(response: TavernChatResponse) {
    const runtime =
        typeof response.metadata.runtime === 'object' &&
        response.metadata.runtime !== null &&
        !Array.isArray(response.metadata.runtime)
            ? (response.metadata.runtime as Record<string, unknown>)
            : {};
    const sessionKey = runtime.sessionKey;
    const startedAt = runtime.startedAt;
    const agentId = runtime.agentId;
    const runId = runtime.runId;

    return {
        agentId: typeof agentId === 'string' ? agentId : null,
        runId: typeof runId === 'string' ? runId : null,
        sessionKey: typeof sessionKey === 'string' ? sessionKey : null,
        startedAt: typeof startedAt === 'string' ? startedAt : null,
    };
}

function readStepDetail(step: TavernResponseActivity) {
    return step.detail?.trim() ? step.detail : null;
}

function readStepString(step: TavernResponseActivity, key: string) {
    const runtime =
        typeof step.metadata.runtime === 'object' &&
        step.metadata.runtime !== null &&
        !Array.isArray(step.metadata.runtime)
            ? (step.metadata.runtime as Record<string, unknown>)
            : step.metadata;
    const value = runtime[key];
    return typeof value === 'string' && value.trim() ? value : null;
}
