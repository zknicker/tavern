import type { ToolSet } from '@ai-sdk/provider-utils';
import type { TavernChatMessage } from '@tavern/api';
import { tool } from 'ai';
import { z } from 'zod';
import { getMessage, listMessages, searchMessages } from './chat-api/index.ts';

const toolLimit = z.number().int().positive().max(50).optional();

export function createTavernChatTools(input: { chatId: string }): ToolSet {
    return {
        chat_message_get: tool({
            description:
                'Read one message from the current Tavern chat by message id. Use this for explicit reply or quote context.',
            inputSchema: z.object({
                messageId: z.string().min(1).describe('Tavern message id to read.'),
            }),
            execute: ({ messageId }) => {
                const message = getMessage(messageId);
                if (!message || message.chat_id !== input.chatId) {
                    return { error: 'Message is not available in the current chat.' };
                }
                return { message: toolMessage(message) };
            },
        }),
        chat_messages_list: tool({
            description:
                'List messages from the current Tavern chat by sequence cursor. Use this when more local chat history is needed.',
            inputSchema: z.object({
                afterSequence: z
                    .number()
                    .int()
                    .nonnegative()
                    .optional()
                    .describe('Only return messages after this Tavern sequence.'),
                beforeSequence: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe('Only return messages before this Tavern sequence.'),
                chatId: z
                    .string()
                    .min(1)
                    .optional()
                    .describe('Optional chat id. Only the current chat is readable.'),
                limit: toolLimit.describe('Maximum messages to return. Default 20, max 50.'),
            }),
            execute: ({ afterSequence, beforeSequence, chatId, limit }) => {
                if (chatId && chatId !== input.chatId) {
                    return { error: 'Only the current chat is readable by this tool.' };
                }
                const result = listMessages(input.chatId, {
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
                'Search messages in the current Tavern chat. Use this when the user refers to earlier channel context not already present.',
            inputSchema: z.object({
                chatId: z
                    .string()
                    .min(1)
                    .optional()
                    .describe('Optional chat id. Only the current chat is searchable.'),
                limit: toolLimit.describe('Maximum messages to return. Default 10, max 50.'),
                query: z.string().min(1).describe('Text to search for in message content.'),
            }),
            execute: ({ chatId, limit, query }) => {
                if (chatId && chatId !== input.chatId) {
                    return { error: 'Only the current chat is searchable by this tool.' };
                }
                const result = searchMessages(input.chatId, {
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
        parentMessageId: message.parent_message_id,
        role: message.role,
        sequence: message.sequence,
    };
}
