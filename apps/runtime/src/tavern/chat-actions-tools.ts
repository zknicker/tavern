import type { ToolSet } from '@ai-sdk/provider-utils';
import type { TavernChat } from '@tavern/api';
import { tool } from 'ai';
import * as z from 'zod';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { createDelivery, getChat, listChatsForAgentParticipant } from './chat-api/index.ts';

// Cross-chat surface: an agent can see the chats it participates in and post
// a message, as itself, into one of them. Posting is gated to chats where the
// agent already holds a seat — Runtime never invents a target. The post
// itself starts no turn for its author; once the posting turn completes,
// every agent seat of the target chat gets an evaluation turn, bounded by
// the shared chain guards (specs/addressing.md). Busy seats also receive the
// post mid-turn through busy delivery (specs/steering.md).
const maxChatSendLength = 4000;

let sendSequence = 0;

export function createTavernChatActionTools(input: {
    agentId: string;
    chatId: string;
    runId: string;
}): ToolSet {
    const participantId = createAgentParticipantId(input.agentId);

    return {
        chat_send: tool({
            description:
                'Post a message, as yourself, into another Tavern chat you participate in. Every agent of that chat evaluates the post once your turn completes; mention an agent as [Name](agent://<agentId>) when you need that specific agent to act — this is how you consult an agent who is not in the current chat. Use chats_list for targets. Post when the user asked or the task requires it; confirm self-initiated posts first.',
            inputSchema: z.object({
                chatId: z.string().min(1).describe('Target chat id from chats_list.'),
                message: z
                    .string()
                    .min(1)
                    .max(maxChatSendLength)
                    .describe('Message text to post in the target chat.'),
            }),
            execute: ({ chatId, message }) => {
                if (chatId === input.chatId) {
                    return { error: 'This is the current chat. Reply normally instead.' };
                }
                const chat = getChat(chatId);
                if (!(chat && isAgentChatParticipant(chat, input.agentId, participantId))) {
                    return { error: 'You are not a participant of that chat.' };
                }
                if (isArchivedChat(chat)) {
                    return { error: 'That chat is archived.' };
                }

                const content = message.trim();
                if (!content) {
                    return { error: 'Message text is empty.' };
                }

                sendSequence += 1;
                const messageId = crossChatId('msg', input.runId, sendSequence);
                const runtime = {
                    agentId: input.agentId,
                    crossChat: { fromChatId: input.chatId },
                    engine: 'agent-engine',
                    runId: input.runId,
                    source: 'agent-engine',
                };
                const receipt = createDelivery(chatId, {
                    agent_id: participantId,
                    id: crossChatId('del', input.runId, sendSequence),
                    message: {
                        attachments: [],
                        author_id: participantId,
                        content,
                        id: messageId,
                        metadata: { runtime },
                        role: 'assistant',
                    },
                    metadata: { runtime },
                    turn_id: input.runId,
                });

                return {
                    chatId,
                    messageId: receipt.message.id,
                    sent: true,
                };
            },
        }),
        chats_list: tool({
            description:
                'List the Tavern chats you participate in. Use this to find a target chat id for chat_send.',
            inputSchema: z.object({}),
            execute: () => ({
                chats: listChatsForAgentParticipant(participantId)
                    .filter((chat) => !isArchivedChat(chat))
                    .map((chat) => ({
                        current: chat.id === input.chatId,
                        id: chat.id,
                        kind: chat.kind,
                        title: chat.title,
                    })),
            }),
        }),
    };
}

export function isAgentChatParticipant(chat: TavernChat, agentId: string, participantId: string) {
    return chat.participants.some((participant) => {
        if (participant.kind !== 'agent') {
            return false;
        }
        const metadataAgentId = (participant.metadata as Record<string, unknown>).agentId;
        return (
            participant.id === participantId ||
            (typeof metadataAgentId === 'string' && metadataAgentId === agentId)
        );
    });
}

function isArchivedChat(chat: TavernChat) {
    const tavern = (chat.metadata as Record<string, unknown>).tavern;
    if (!tavern || typeof tavern !== 'object' || Array.isArray(tavern)) {
        return false;
    }
    return (tavern as Record<string, unknown>).archived === true;
}

function crossChatId(prefix: string, runId: string, sequence: number) {
    return `${prefix}_xchat_${runId}_${sequence}`.replace(/[^A-Za-z0-9_-]/g, '_');
}
