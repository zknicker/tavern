import {
    agentRuntimeChatPlatformMetadataSchema,
    agentRuntimeTavernMessageMetadataSchema,
} from '@tavern/api';
import { z } from 'zod';
import {
    historyRowSchema,
    messageRowSchema,
    toolRowSchema,
    workerRowSchema,
} from '../rows/contracts.ts';
import { chatConversationKinds } from './conversation-kind.ts';
import { chatSourceKinds } from './source.ts';

export const chatScopeSchema = z.enum(['channel', 'dm', 'group', 'topic']).nullable();
export const chatConversationKindSchema = z.enum(chatConversationKinds);

export const chatBindingSchema = z.object({
    accountKey: z.string().nullable(),
    agentId: z.string(),
    id: z.string(),
});

export const chatParticipantSchema = z.object({
    actorId: z.string(),
    actorType: z.enum(['agent', 'participant']),
    avatar: z.string().nullable(),
    name: z.string(),
    primaryColor: z.string().nullable(),
    profileId: z.string().nullable().optional(),
});

export const chatTargetParticipantSchema = z
    .object({
        avatar: z.string().nullable(),
        id: z.string(),
        name: z.string(),
        observedName: z.string(),
        primaryColor: z.string().nullable(),
        profileId: z.string().nullable(),
    })
    .nullable();

export const chatLatestSessionSchema = z.object({
    agentId: z.string().nullable(),
    lastActivityAt: z.string().nullable(),
    platform: z.string().nullable(),
    sessionId: z.string().nullable(),
    sessionKey: z.string(),
    title: z.string().nullable(),
});

export const chatAgentRuntimeSyncSchema = z
    .object({
        lastAttemptedAt: z.string().datetime().nullable(),
        lastError: z.string().nullable(),
        lastSuccessfulAt: z.string().datetime().nullable(),
        status: z.enum(['error', 'pending', 'synced']),
    })
    .nullable();

export const chatTabAppearanceSchema = z.object({
    color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/u)
        .nullable(),
});

export const chatSystemPromptSchema = z.string().trim().max(8000).nullable();

export const chatSourceSchema = z.object({
    kind: z.enum(chatSourceKinds),
    label: z.string().trim().min(1),
});

export const chatSchema = z.object({
    boundAgentIds: z.array(z.string()),
    canSend: z.boolean(),
    conversationKind: chatConversationKindSchema,
    createdAt: z.string().nullable(),
    displayName: z.string(),
    externalId: z.string().nullable(),
    framework: z.string(),
    hasActiveTurn: z.boolean(),
    id: z.string(),
    isEnabled: z.boolean(),
    isPinned: z.boolean(),
    lastActivityAt: z.string().nullable(),
    latestSession: chatLatestSessionSchema.nullable(),
    participants: z.array(chatParticipantSchema),
    agentRuntimeSync: chatAgentRuntimeSyncSchema,
    platformMetadata: agentRuntimeChatPlatformMetadataSchema,
    scope: chatScopeSchema,
    sessionCount: z.number().int().nonnegative(),
    source: chatSourceSchema,
    systemPrompt: chatSystemPromptSchema,
    tabAppearance: chatTabAppearanceSchema,
    target: z.string().nullable(),
    targetParticipant: chatTargetParticipantSchema,
    title: z.string(),
    type: z.string(),
});

export const chatListItemSchema = chatSchema.pick({
    agentRuntimeSync: true,
    boundAgentIds: true,
    canSend: true,
    conversationKind: true,
    createdAt: true,
    displayName: true,
    framework: true,
    hasActiveTurn: true,
    id: true,
    isEnabled: true,
    isPinned: true,
    lastActivityAt: true,
    latestSession: true,
    participants: true,
    scope: true,
    sessionCount: true,
    source: true,
    systemPrompt: true,
    tabAppearance: true,
    targetParticipant: true,
    title: true,
    type: true,
});

export const chatListSchema = z.object({
    ids: z.array(z.string().trim().min(1)),
    itemsById: z.record(z.string().trim().min(1), chatListItemSchema),
});

export const getChatInputSchema = z.object({
    chatId: z.string().trim().min(1),
});

export const createChatInputSchema = z.object({
    agentIds: z.array(z.string().trim().min(1)).length(1).optional(),
    displayName: z.string().trim().min(1).max(120),
});

export const createChatResultSchema = z.object({
    chatId: z.string().trim().min(1),
});

export const sendChatMessageMetadataSchema = z
    .object({
        tavern: agentRuntimeTavernMessageMetadataSchema.optional(),
    })
    .strict();

export const startChatInputSchema = z.object({
    agentId: z.string().trim().min(1).optional(),
    clientMessageId: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1),
    metadata: sendChatMessageMetadataSchema.optional(),
});

export const updateChatInputSchema = z.object({
    agentIds: z.array(z.string().trim().min(1)).length(1),
    chatId: z.string().trim().min(1),
    displayName: z.string().trim().min(1).max(120),
});

export const archiveChatInputSchema = z.object({
    chatId: z.string().trim().min(1),
});

export const setChatPinnedInputSchema = z.object({
    chatId: z.string().trim().min(1),
    pinned: z.boolean(),
});

export const updateChatTabAppearanceInputSchema = z.object({
    chatId: z.string().trim().min(1),
    color: chatTabAppearanceSchema.shape.color,
});

export const updateChatSystemPromptInputSchema = z.object({
    chatId: z.string().trim().min(1),
    systemPrompt: chatSystemPromptSchema,
});

export const archiveChatResultSchema = z.object({
    archived: z.literal(true),
    chatId: z.string().trim().min(1),
});

export const setChatPinnedResultSchema = z.object({
    chatId: z.string().trim().min(1),
    pinned: z.boolean(),
});

export const updateChatTabAppearanceResultSchema = z.object({
    chatId: z.string().trim().min(1),
    tabAppearance: chatTabAppearanceSchema,
});

export const updateChatSystemPromptResultSchema = z.object({
    chatId: z.string().trim().min(1),
    systemPrompt: chatSystemPromptSchema,
});

export const sendChatMessageInputSchema = z.object({
    agentId: z.string().trim().min(1).optional(),
    chatId: z.string().trim().min(1),
    clientMessageId: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1),
    metadata: sendChatMessageMetadataSchema.optional(),
});

export const sendChatMessageResultSchema = z.object({
    acceptedAt: z.string().datetime(),
    chatId: z.string().trim().min(1),
    clientMessageId: z.string().trim().min(1),
    runId: z.string().trim().min(1),
    sessionKey: z.string().trim().min(1).nullable(),
    status: z.literal('accepted'),
});

export const chatLogMessageRowSchema = messageRowSchema;
export const chatLogToolRowSchema = toolRowSchema;
export const chatLogWorkerRowSchema = workerRowSchema;
export const chatLogRowSchema = historyRowSchema;

export const chatLogActiveReplySchema = z
    .object({
        agentId: z.string().trim().min(1),
        isThinking: z.boolean(),
        runId: z.string().trim().min(1),
        sessionKey: z.string().trim().min(1),
        startedAt: z.string().datetime(),
        text: z.string(),
    })
    .nullable();

export const chatLogTurnFailureSchema = z
    .object({
        error: z.string().trim().min(1),
        turn: z.object({
            agentId: z.string().trim().min(1),
            chatId: z.string().trim().min(1),
            runId: z.string().trim().min(1),
            sessionKey: z.string().trim().min(1),
            startedAt: z.string().datetime(),
        }),
    })
    .nullable();

export const chatLogPageSchema = z.object({
    activeReply: chatLogActiveReplySchema,
    failedTurn: chatLogTurnFailureSchema.optional(),
    limit: z.number().int().positive(),
    rows: z.array(chatLogRowSchema),
    offset: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
});

export type Chat = z.infer<typeof chatSchema>;
export type ChatListItem = z.infer<typeof chatListItemSchema>;
export type ChatList = z.infer<typeof chatListSchema>;
export type GetChatInput = z.infer<typeof getChatInputSchema>;
export type ChatLogPage = z.infer<typeof chatLogPageSchema>;
export type CreateChatInput = z.infer<typeof createChatInputSchema>;
export type CreateChatResult = z.infer<typeof createChatResultSchema>;
export type StartChatInput = z.infer<typeof startChatInputSchema>;
export type UpdateChatInput = z.infer<typeof updateChatInputSchema>;
export type ArchiveChatInput = z.infer<typeof archiveChatInputSchema>;
export type ArchiveChatResult = z.infer<typeof archiveChatResultSchema>;
export type SetChatPinnedInput = z.infer<typeof setChatPinnedInputSchema>;
export type SetChatPinnedResult = z.infer<typeof setChatPinnedResultSchema>;
export type UpdateChatTabAppearanceInput = z.infer<typeof updateChatTabAppearanceInputSchema>;
export type UpdateChatTabAppearanceResult = z.infer<typeof updateChatTabAppearanceResultSchema>;
export type UpdateChatSystemPromptInput = z.infer<typeof updateChatSystemPromptInputSchema>;
export type UpdateChatSystemPromptResult = z.infer<typeof updateChatSystemPromptResultSchema>;
export type SendChatMessageInput = z.infer<typeof sendChatMessageInputSchema>;
export type SendChatMessageResult = z.infer<typeof sendChatMessageResultSchema>;
