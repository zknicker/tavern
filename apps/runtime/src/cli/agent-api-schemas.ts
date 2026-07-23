import type { TavernAgentMessage, TavernAgentSendResponse } from '@tavern/api';
import * as z from 'zod';

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const agentMessageSchema = z.object({
    attachments: z.array(jsonObjectSchema),
    author: z.object({
        id: z.string().min(1),
        kind: z.enum(['user', 'agent', 'system', 'external', 'plugin']),
        label: z.string().nullable(),
        metadata: jsonObjectSchema,
    }),
    chat_id: z.string().min(1),
    content: z.string(),
    created_at: z.string().min(1),
    deleted_at: z.string().nullable(),
    delivery_id: z.string().nullable(),
    id: z.string().min(1),
    metadata: jsonObjectSchema,
    nonce: z.string().nullable(),
    replyCount: z.number().int().nonnegative().optional(),
    replyTarget: z.string().min(1).optional(),
    role: z.enum(['user', 'assistant', 'system']),
    sender: z.object({
        description: z.string().nullable(),
        handle: z.string().nullable(),
        type: z.enum(['human', 'agent', 'system']),
    }),
    sequence: z.number().int().positive(),
    threadId: z.string().min(1).optional(),
}) satisfies z.ZodType<TavernAgentMessage>;

export type AgentCliMessage = TavernAgentMessage;

export const agentSendResponseSchema: z.ZodType<TavernAgentSendResponse> = z.discriminatedUnion(
    'state',
    [
        z.object({
            message: agentMessageSchema,
            recentUnread: z.array(
                z.object({ message: agentMessageSchema, target: z.string().min(1) })
            ),
            state: z.literal('sent'),
        }),
        z.object({
            continueAnywaySuggested: z.boolean(),
            formalMentionCount: z.number().int().nonnegative(),
            newMessageCount: z.number().int().positive(),
            omittedMessageCount: z.number().int().nonnegative(),
            reholdCount: z.number().int().positive(),
            shownMessages: z.array(agentMessageSchema).max(12),
            state: z.literal('held'),
        }),
    ]
);

export const agentMessageCheckResponseSchema = z.object({
    messages: z.array(z.object({ message: agentMessageSchema, target: z.string().min(1) })),
    more: z.boolean(),
});

export const agentInboxCheckResponseSchema = z.object({
    rows: z.array(
        z.object({
            chatId: z.string().min(1),
            dm: z.boolean(),
            firstShortId: z.string().min(1),
            latestSender: z.string().min(1),
            latestShortId: z.string().min(1),
            mentioned: z.boolean(),
            pendingCount: z.number().int().positive(),
            target: z.string().min(1),
            thread: z.boolean(),
        })
    ),
    totalPending: z.number().int().nonnegative(),
});

export const agentChannelActionResponseSchema = z.object({
    joined: z.boolean().optional(),
    left: z.boolean().optional(),
    muted: z.boolean().optional(),
    target: z.string().min(1),
});

export const agentHistoryResponseSchema = z.object({
    has_more: z.boolean(),
    has_newer: z.boolean(),
    has_older: z.boolean(),
    last_read: z.object({ after: z.number().int().nonnegative(), unread_after: z.number().int() }),
    messages: z.array(agentMessageSchema),
    target: z.string().min(1),
});

const directoryPersonSchema = z.object({
    description: z.string().nullable(),
    handle: z.string().min(1),
});

export const agentChannelSchema = z.object({
    description: z.string().nullable(),
    handle: z.string().min(1),
    joined: z.boolean(),
    memberCount: z.number().int().nonnegative(),
});

export const agentServerInfoSchema = z.object({
    agents: z.array(directoryPersonSchema),
    channels: z.array(agentChannelSchema),
    hasMore: z.object({ agents: z.boolean(), channels: z.boolean(), humans: z.boolean() }),
    humans: z.array(directoryPersonSchema),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    total: z.object({
        agents: z.number().int().nonnegative(),
        channels: z.number().int().nonnegative(),
        humans: z.number().int().nonnegative(),
    }),
});

export const agentChannelMembersSchema = z.object({
    members: z.array(
        z.object({
            description: z.string().nullable(),
            handle: z.string().nullable(),
            role: z.enum(['human', 'agent']),
        })
    ),
    target: z.string().min(1),
});

export const resolvedAgentMessageSchema = z.object({ message: agentMessageSchema });
export const agentSearchResponseSchema = z.object({
    messages: z.array(agentMessageSchema.extend({ target: z.string().min(1) })),
});
