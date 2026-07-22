import type { ToolSet } from '@ai-sdk/provider-utils';
import type { TavernChatMessage } from '@tavern/api';
import { tool } from 'ai';
import * as z from 'zod';
import { isAgentChatParticipant } from './chat-actions-tools.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import {
    getChat,
    getMessage,
    listMessages,
    membershipChat,
    searchMessages,
} from './chat-api/index.ts';

// Target-scoped history reads for the agent's global session
// (specs/sessions.md): every chat where the agent holds a seat is readable,
// defaulting to the current chat. Reads never advance the seen ledger — the
// ledger tracks Runtime-delivered content (catch-up, busy delivery, holds),
// so a pulled row may appear again in a hold; that duplication is bounded
// and honest.

const toolLimit = z.number().int().positive().max(50).optional();

const chatIdInput = z
    .string()
    .min(1)
    .optional()
    .describe('Chat to read. Defaults to the current chat; any chat where you hold a seat works.');

export function createTavernChatTools(input: { agentId: string; chatId: string }): ToolSet {
    const participantId = createAgentParticipantId(input.agentId);

    const resolveChat = (chatId: string | undefined) => {
        const targetChatId = chatId ?? input.chatId;
        const chat = getChat(targetChatId);
        const accessChat = chat ? membershipChat(chat) : null;
        if (!(accessChat && isAgentChatParticipant(accessChat, input.agentId, participantId))) {
            return null;
        }
        return targetChatId;
    };

    return {
        chat_message_get: tool({
            description:
                'Read one message by id from a Grotto chat you participate in. Use this for explicit reply or quote context.',
            inputSchema: z.object({
                chatId: chatIdInput,
                messageId: z.string().min(1).describe('Grotto message id to read.'),
            }),
            execute: ({ chatId, messageId }) => {
                const targetChatId = resolveChat(chatId);
                if (!targetChatId) {
                    return { error: 'You are not a participant of that chat.' };
                }
                const message = getMessage(messageId);
                if (!message || message.chat_id !== targetChatId) {
                    return { error: 'Message is not available in that chat.' };
                }
                return { message: toolMessage(message) };
            },
        }),
        chat_messages_list: tool({
            description:
                'List messages from a Grotto chat you participate in, by sequence cursor. Use this to read chat history — including chats flagged as unread elsewhere.',
            inputSchema: z.object({
                afterSequence: z
                    .number()
                    .int()
                    .nonnegative()
                    .optional()
                    .describe('Only return messages after this Grotto sequence.'),
                beforeSequence: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe('Only return messages before this Grotto sequence.'),
                chatId: chatIdInput,
                limit: toolLimit.describe('Maximum messages to return. Default 20, max 50.'),
            }),
            execute: ({ afterSequence, beforeSequence, chatId, limit }) => {
                const targetChatId = resolveChat(chatId);
                if (!targetChatId) {
                    return { error: 'You are not a participant of that chat.' };
                }
                const result = listMessages(targetChatId, {
                    afterSequence,
                    beforeSequence,
                    limit: limit ?? 20,
                });
                return {
                    messages: result.messages.map(toolMessage),
                    nextSequence: result.next_sequence,
                };
            },
        }),
        chat_messages_search: tool({
            description:
                'Search messages in a Grotto chat you participate in. Use this when someone refers to earlier context not already present.',
            inputSchema: z.object({
                chatId: chatIdInput,
                limit: toolLimit.describe('Maximum messages to return. Default 10, max 50.'),
                query: z.string().min(1).describe('Text to search for in message content.'),
            }),
            execute: ({ chatId, limit, query }) => {
                const targetChatId = resolveChat(chatId);
                if (!targetChatId) {
                    return { error: 'You are not a participant of that chat.' };
                }
                const result = searchMessages(targetChatId, {
                    limit: limit ?? 10,
                    query,
                });
                return {
                    messages: result.messages.map(toolMessage),
                    nextSequence: result.next_sequence,
                };
            },
        }),
    };
}

function toolMessage(message: TavernChatMessage) {
    return {
        author: {
            id: message.author.id,
            kind: message.author.kind,
            label: message.author.label,
        },
        content: message.content,
        createdAt: message.created_at,
        deletedAt: message.deleted_at,
        id: message.id,
        role: message.role,
        sequence: message.sequence,
    };
}
