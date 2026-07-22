import type {
    TavernCreateMessageRequest,
    TavernUpsertResponseActivityRequest,
    TavernUpsertResponseRequest,
} from '@tavern/api';

export interface DevelopmentChatDemo {
    // Agent seats in the chat, primary-first. Defaults to the primary demo
    // agent when omitted.
    agentIds?: string[];
    chatId: string;
    color?: string | null;
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
// Second demo seat for multi-agent chats. The id hashes to the bird default
// character, so Wren wears a wren without a stored appearance override.
export const demoSecondAgentId = 'agt_wren';
export const demoSecondAgentName = 'Wren';
export const demoUserParticipantId = 'usr_demo';
// The seeded human's handle (D2: names ARE the handles). Distinct from the
// operator's "You" seat so grotto CLI reads and the server-info roster never
// collapse the two.
export const demoUserHandle = 'Sam';
// The app owner (local human participant, see the server's
// `localHumanParticipantId`). Messages authored here render as the viewer's own
// right-anchored, avatar-less bubbles instead of the left roster.
export const demoOwnerParticipantId = 'usr_tavern';
export const demoTime = '2026-06-18T15:00:00.000Z';

export function userMessage(input: DemoMessageInput): DevelopmentDemoMessage {
    return humanMessage(input, demoUserParticipantId);
}

export function ownerMessage(input: DemoMessageInput): DevelopmentDemoMessage {
    return humanMessage(input, demoOwnerParticipantId);
}

function humanMessage(input: DemoMessageInput, authorId: string): DevelopmentDemoMessage {
    const { chatId, createdAt = demoTime, ...message } = input;

    return {
        ...message,
        author_id: authorId,
        createdAt,
        metadata: { runtime: { source: 'development-demo', sessionKey: sessionKey(chatId) } },
        role: 'user',
    };
}

export function assistantMessage(input: DemoMessageInput): DevelopmentDemoMessage {
    const {
        agentId = demoAgentId,
        chatId,
        createdAt = demoTime,
        requestMessageId,
        runId,
        ...message
    } = input;

    return {
        ...message,
        author_id: agentId,
        createdAt,
        metadata: responseRuntimeMetadata({
            agentId,
            chatId,
            requestMessageId: requestMessageId ?? message.id,
            runId: runId ?? `run_${message.id}`,
        }),
        role: 'assistant',
    };
}

type DemoMessageInput = Omit<TavernCreateMessageRequest, 'author_id' | 'metadata' | 'role'> & {
    agentId?: string;
    chatId: string;
    createdAt?: string;
    requestMessageId?: string;
    runId?: string;
};

export function completedResponse(input: {
    agentId?: string;
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
        participant_id: input.agentId ?? demoAgentId,
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
    agentId?: string;
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
    agentId?: string;
    chatId: string;
    requestMessageId: string;
    runId: string;
}) {
    const agentId = input.agentId ?? demoAgentId;

    return {
        runtime: {
            agentId,
            messageId: input.requestMessageId,
            runId: input.runId,
            sessionKey: sessionKey(input.chatId, agentId),
            source: 'development-demo',
            startedAt: demoTime,
        },
    };
}

export function activityRuntimeMetadata(input: ActivityInput) {
    const agentId = input.agentId ?? demoAgentId;

    return {
        agentId,
        messageId: input.requestMessageId,
        runId: input.runId,
        sessionKey: sessionKey(input.chatId, agentId),
        source: input.source ?? 'development-demo',
        toolCallId: input.toolCallId,
        toolName: input.toolName,
    };
}

export function sessionKey(chatId: string, agentId: string = demoAgentId) {
    return `agent:${agentId}:tavern:channel:${chatId}`;
}
