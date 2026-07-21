import * as z from 'zod';

export const agentMessageSchema = z.looseObject({
    chat_id: z.string().min(1),
    content: z.string(),
    created_at: z.string().min(1),
    id: z.string().min(1),
    replyCount: z.number().int().nonnegative().optional(),
    replyTarget: z.string().min(1).optional(),
    sender: z.object({
        description: z.string().nullable(),
        handle: z.string().nullable(),
        type: z.enum(['human', 'agent', 'system']),
    }),
    sequence: z.number().int().positive(),
    threadId: z.string().min(1).optional(),
});

export type AgentCliMessage = z.infer<typeof agentMessageSchema>;

export const agentSendResponseSchema = z.discriminatedUnion('state', [
    z.object({
        message: agentMessageSchema,
        recentUnread: z.array(agentMessageSchema),
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
]);

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
    humans: z.array(directoryPersonSchema),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
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
export const agentMessageListSchema = z.object({ messages: z.array(agentMessageSchema) });
