import {
    type AgentRuntimeChatStatus,
    type AgentRuntimeTurnProgressStep,
    agentRuntimeActiveChatReplySchema,
    agentRuntimeChatStatusListSchema,
    agentRuntimeChatStatusSchema,
} from '@tavern/api';
import { createTavernClient, type TavernChatActivity } from '@tavern/sdk';
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
    const response = await client.chat.activity();

    return chatStatusListSchema.parse({
        chats: response.activities.flatMap(activityToStatus),
    });
}

function activityToStatus(activity: TavernChatActivity): AgentRuntimeChatStatus[] {
    if (activity.status === 'completed' || activity.status === 'failed') {
        return [];
    }

    const metadata = readRuntimeMetadata(activity);
    const startedAt =
        metadata.startedAt ??
        activity.steps
            .map((step) => step.started_at)
            .sort((left, right) => left.localeCompare(right))[0] ??
        activity.updated_at;
    const activeReplySteps =
        activity.steps.length > 0
            ? activity.steps.map(activityStepToTurnStep)
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
                agentId: metadata.agentId ?? activity.agent_id,
                isThinking: true,
                runId: activity.run_id,
                sessionKey: metadata.sessionKey ?? activity.run_id,
                startedAt,
                text: activity.summary ?? '',
            },
            activeReplyProgressStartedAt: activity.steps[0]?.started_at ?? startedAt,
            activeReplySteps,
            chatId: activity.chat_id,
        }),
    ];
}

function activityStepToTurnStep(step: TavernChatActivity['steps'][number]) {
    return {
        detail: readStepDetail(step),
        id: step.id,
        kind: activityStepKind(step.kind),
        label: step.label,
        status: activityStepStatus(step.status),
    } satisfies AgentRuntimeTurnProgressStep;
}

function activityStepKind(kind: string): AgentRuntimeTurnProgressStep['kind'] {
    if (kind === 'thinking') {
        return 'reasoning';
    }
    if (kind === 'tool' || kind === 'command' || kind === 'message') {
        return kind;
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

function readRuntimeMetadata(activity: TavernChatActivity) {
    const runtime =
        typeof activity.metadata.runtime === 'object' &&
        activity.metadata.runtime !== null &&
        !Array.isArray(activity.metadata.runtime)
            ? (activity.metadata.runtime as Record<string, unknown>)
            : {};
    const sessionKey = runtime.sessionKey;
    const startedAt = runtime.startedAt;
    const agentId = runtime.agentId;

    return {
        agentId: typeof agentId === 'string' ? agentId : null,
        sessionKey: typeof sessionKey === 'string' ? sessionKey : null,
        startedAt: typeof startedAt === 'string' ? startedAt : null,
    };
}

function readStepDetail(step: TavernChatActivity['steps'][number]) {
    const detail = step.metadata.detail;
    return typeof detail === 'string' && detail.trim() ? detail : null;
}
