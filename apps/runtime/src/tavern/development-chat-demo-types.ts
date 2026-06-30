import type {
    TavernCreateMessageRequest,
    TavernUpsertResponseActivityRequest,
    TavernUpsertResponseRequest,
} from '@tavern/api';

export interface DevelopmentChatDemo {
    chatId: string;
    messages: DevelopmentDemoMessage[];
    responses: DevelopmentDemoResponse[];
    title: string;
}

export type DevelopmentDemoMessage = TavernCreateMessageRequest & {
    createdAt: string;
};

export type DevelopmentDemoResponse = TavernUpsertResponseRequest & {
    activities?: TavernUpsertResponseActivityRequest[];
};

export const demoAgentId = 'agt_primary';
export const demoUserParticipantId = 'usr_demo';
export const demoTime = '2026-06-18T15:00:00.000Z';

export function userMessage(input: DemoMessageInput): DevelopmentDemoMessage {
    const { chatId, createdAt = demoTime, ...message } = input;

    return {
        ...message,
        author_id: demoUserParticipantId,
        createdAt,
        metadata: { runtime: { source: 'development-demo', sessionKey: sessionKey(chatId) } },
        role: 'user',
    };
}

export function assistantMessage(input: DemoMessageInput): DevelopmentDemoMessage {
    const { chatId, createdAt = demoTime, requestMessageId, runId, ...message } = input;

    return {
        ...message,
        author_id: demoAgentId,
        createdAt,
        metadata: responseRuntimeMetadata({
            chatId,
            requestMessageId: requestMessageId ?? message.id,
            runId: runId ?? `run_${message.id}`,
        }),
        role: 'assistant',
    };
}

type DemoMessageInput = Omit<TavernCreateMessageRequest, 'author_id' | 'metadata' | 'role'> & {
    chatId: string;
    createdAt?: string;
    requestMessageId?: string;
    runId?: string;
};

export function completedResponse(input: {
    chatId: string;
    id: string;
    requestMessageId: string;
    responseMessageId: string;
    runId: string;
    summary: string;
}): DevelopmentDemoResponse {
    return {
        completed_at: demoTime,
        id: input.id,
        metadata: responseRuntimeMetadata(input),
        participant_id: demoAgentId,
        request_message_id: input.requestMessageId,
        response_message_id: input.responseMessageId,
        status: 'completed',
        summary: input.summary,
    };
}

export function messageActivity(input: ActivityInput): TavernUpsertResponseActivityRequest {
    return {
        detail: input.detail,
        id: input.id,
        kind: 'message',
        metadata: { runtime: activityRuntimeMetadata(input) },
        sequence: input.sequence,
        started_at: demoTime,
        status: input.status ?? 'completed',
        summary: input.detail,
        title: 'Assistant update',
    };
}

export function reasoningActivity(input: ActivityInput): TavernUpsertResponseActivityRequest {
    return {
        detail: input.detail,
        id: input.id,
        kind: 'reasoning',
        metadata: { runtime: activityRuntimeMetadata(input) },
        sequence: input.sequence,
        started_at: demoTime,
        status: input.status ?? 'completed',
        summary: input.detail,
        title: 'Reasoning',
    };
}

export function toolActivity(
    input: ActivityInput & {
        title: string;
        toolArguments: Record<string, unknown>;
        toolCallId: string;
        toolName: string;
        toolResult?: Record<string, unknown>;
    }
): TavernUpsertResponseActivityRequest {
    return {
        completed_at: input.status === 'running' ? undefined : demoTime,
        id: input.id,
        kind: 'tool_call',
        metadata: {
            runtime: activityRuntimeMetadata(input),
            tool: {
                arguments: input.toolArguments,
                name: input.toolName,
                result: input.toolResult ?? { status: 'ok' },
            },
        },
        sequence: input.sequence,
        started_at: demoTime,
        status: input.status ?? 'completed',
        summary: input.title,
        title: input.title,
    };
}

export interface ActivityInput {
    chatId: string;
    detail?: string;
    id: string;
    requestMessageId: string;
    runId: string;
    sequence: number;
    source?: string;
    status?: 'completed' | 'running';
    toolCallId?: string;
    toolName?: string;
}

export function responseRuntimeMetadata(input: {
    chatId: string;
    requestMessageId: string;
    runId: string;
}) {
    return {
        runtime: {
            agentId: demoAgentId,
            messageId: input.requestMessageId,
            runId: input.runId,
            sessionKey: sessionKey(input.chatId),
            source: 'development-demo',
            startedAt: demoTime,
        },
    };
}

export function activityRuntimeMetadata(input: ActivityInput) {
    return {
        agentId: demoAgentId,
        messageId: input.requestMessageId,
        runId: input.runId,
        sessionKey: sessionKey(input.chatId),
        source: input.source ?? 'development-demo',
        toolCallId: input.toolCallId,
        toolName: input.toolName,
    };
}

export function sessionKey(chatId: string) {
    return `agent:${demoAgentId}:tavern:channel:${chatId}`;
}
