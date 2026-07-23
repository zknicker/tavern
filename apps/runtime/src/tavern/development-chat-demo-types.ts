import type { TavernCreateMessageRequest } from '@tavern/api';

export interface DevelopmentChatDemo {
    // Agent seats in the chat, primary-first. Defaults to the primary demo
    // agent when omitted.
    agentIds?: string[];
    chatId: string;
    color?: string | null;
    messages: DevelopmentDemoMessage[];
    title: string;
}

export type DevelopmentDemoMessage = TavernCreateMessageRequest & {
    createdAt: string;
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

export function sessionKey(chatId: string, agentId: string = demoAgentId) {
    return `agent:${agentId}:tavern:channel:${chatId}`;
}
