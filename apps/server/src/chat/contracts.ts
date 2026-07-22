import { agentRuntimeChatPlatformMetadataSchema } from '@tavern/api';
import { z } from 'zod';
import {
    historyRowSchema,
    messageRowSchema,
    toolRowSchema,
    workerRowSchema,
} from '../rows/contracts.ts';
import { sessionMessageAttachmentSchema } from '../sessions/contracts/messages.ts';
import { chatConversationKinds } from './conversation-kind.ts';
import { chatSourceKinds } from './source.ts';

export const chatScopeSchema = z.enum(['channel', 'dm', 'group', 'task', 'topic']).nullable();
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
});

export const chatTargetParticipantSchema = z
    .object({
        avatar: z.string().nullable(),
        id: z.string(),
        name: z.string(),
        observedName: z.string(),
        primaryColor: z.string().nullable(),
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

export const chatDescriptionSchema = z.string().trim().max(500).nullable();

export const chatSourceSchema = z.object({
    kind: z.enum(chatSourceKinds),
    label: z.string().trim().min(1),
});

export const chatSchema = z.object({
    activeTurnParticipantIds: z.array(z.string().trim().min(1)),
    archived: z.boolean(),
    boundAgentIds: z.array(z.string()),
    canSend: z.boolean(),
    conversationKind: chatConversationKindSchema,
    createdAt: z.string().nullable(),
    description: chatDescriptionSchema,
    displayName: z.string(),
    externalId: z.string().nullable(),
    framework: z.string(),
    id: z.string(),
    isEnabled: z.boolean(),
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
    // Messages the operator has not read yet (runtime read receipts).
    unreadCount: z.number().int().nonnegative(),
});

export const chatListItemSchema = chatSchema.pick({
    activeTurnParticipantIds: true,
    agentRuntimeSync: true,
    archived: true,
    boundAgentIds: true,
    canSend: true,
    conversationKind: true,
    createdAt: true,
    description: true,
    displayName: true,
    framework: true,
    id: true,
    isEnabled: true,
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
    unreadCount: true,
});

export const chatListSchema = z.object({
    ids: z.array(z.string().trim().min(1)),
    itemsById: z.record(z.string().trim().min(1), chatListItemSchema),
});

export const getChatInputSchema = z.object({
    chatId: z.string().trim().min(1),
});

export const createChatInputSchema = z.object({
    agentIds: z.array(z.string().trim().min(1)).min(1).optional(),
    displayName: z.string().trim().min(1).max(120),
});

export const createChatResultSchema = z.object({
    chatId: z.string().trim().min(1),
});

export const startChatInputSchema = z
    .object({
        agentId: z.string().trim().min(1).optional(),
        attachments: z.array(sessionMessageAttachmentSchema).optional(),
        clientMessageId: z.string().trim().min(1).optional(),
        content: z.string().trim(),
    })
    .strict()
    .refine((input) => input.content.trim().length > 0 || Boolean(input.attachments?.length), {
        message: 'A chat message requires text or attachments.',
        path: ['content'],
    });

export const updateChatInputSchema = z.object({
    agentIds: z.array(z.string().trim().min(1)).min(1),
    chatId: z.string().trim().min(1),
    // Omitted preserves the stored description; empty or null clears it.
    description: z.string().trim().max(500).nullish(),
    displayName: z.string().trim().min(1).max(120),
});

export const archiveChatInputSchema = z.object({
    chatId: z.string().trim().min(1),
});

export const unarchiveChatInputSchema = z.object({
    chatId: z.string().trim().min(1),
});

export const clearChatInputSchema = z.object({
    chatId: z.string().trim().min(1),
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

export const unarchiveChatResultSchema = z.object({
    archived: z.literal(false),
    chatId: z.string().trim().min(1),
});

export const updateChatTabAppearanceResultSchema = z.object({
    chatId: z.string().trim().min(1),
    tabAppearance: chatTabAppearanceSchema,
});

export const updateChatSystemPromptResultSchema = z.object({
    chatId: z.string().trim().min(1),
    systemPrompt: chatSystemPromptSchema,
});

export const sendChatMessageInputSchema = z
    .object({
        agentId: z.string().trim().min(1).optional(),
        attachments: z.array(sessionMessageAttachmentSchema).optional(),
        chatId: z.string().trim().min(1),
        clientMessageId: z.string().trim().min(1).optional(),
        content: z.string().trim(),
        thread: z
            .object({
                anchorMessageId: z.string().trim().min(1),
            })
            .strict()
            .optional(),
    })
    .strict()
    .refine((input) => input.content.trim().length > 0 || Boolean(input.attachments?.length), {
        message: 'A chat message requires text or attachments.',
        path: ['content'],
    });

export const sendChatMessageResultSchema = z.object({
    acceptedAt: z.string().datetime(),
    chatId: z.string().trim().min(1),
    clientMessageId: z.string().trim().min(1),
    threadChatId: z.string().trim().min(1).nullable(),
    turns: z.array(
        z.object({
            agentId: z.string().trim().min(1),
            runId: z.string().trim().min(1),
        })
    ),
    status: z.literal('accepted'),
});

export const stopChatTurnInputSchema = z.object({
    chatId: z.string().trim().min(1),
    runId: z.string().trim().min(1),
});

export const stopChatTurnResultSchema = z.object({
    runId: z.string().trim().min(1),
    stopped: z.boolean(),
});

export const chatLogMessageRowSchema = messageRowSchema;
export const chatLogToolRowSchema = toolRowSchema;
export const chatLogWorkerRowSchema = workerRowSchema;
export const chatLogRowSchema = historyRowSchema;

export const chatLogActiveReplySchema = z.object({
    agentId: z.string().trim().min(1),
    isThinking: z.boolean(),
    runId: z.string().trim().min(1),
    sessionKey: z.string().trim().min(1),
    startedAt: z.string().datetime(),
    text: z.string(),
    // Quiet peer-evaluation turns render no thinking row until text streams
    // (specs/addressing.md). Snapshots must carry the stamp or a refetch
    // un-hides the turn the live event stream is keeping quiet.
    trigger: z.literal('evaluation').optional(),
});

export const chatLogTurnFailureSchema = z.object({
    error: z.string().trim().min(1),
    // Live turn.failed events carry no durable response id; the durable
    // refetch fills it in, which is what enables dismissal.
    responseId: z.string().trim().min(1).nullable(),
    turn: z.object({
        agentId: z.string().trim().min(1),
        chatId: z.string().trim().min(1),
        runId: z.string().trim().min(1),
        sessionKey: z.string().trim().min(1),
        startedAt: z.string().datetime(),
    }),
});

export const dismissChatLogRowInputSchema = z.object({
    chatId: z.string().trim().min(1),
    responseId: z.string().trim().min(1),
});

export const chatLogPageSchema = z.object({
    // Each agent seat can run one turn at a time, so a multi-agent chat
    // carries several concurrent live replies; ordered by startedAt.
    activeReplies: z.array(chatLogActiveReplySchema),
    failedTurns: z.array(chatLogTurnFailureSchema),
    limit: z.number().int().positive(),
    // Cursor for the next older turn-aligned page; null at history start.
    nextBeforeSequence: z.number().int().positive().nullable(),
    rows: z.array(chatLogRowSchema),
    // Runs on this page whose responses have settled. A silent turn leaves
    // no durable reply or failure row to match, so a client that missed the
    // live completion clears its retained reply from this signal instead.
    settledRunIds: z.array(z.string().trim().min(1)),
    totalMessages: z.number().int().nonnegative(),
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
export type UnarchiveChatInput = z.infer<typeof unarchiveChatInputSchema>;
export type UnarchiveChatResult = z.infer<typeof unarchiveChatResultSchema>;
export type UpdateChatTabAppearanceInput = z.infer<typeof updateChatTabAppearanceInputSchema>;
export type UpdateChatTabAppearanceResult = z.infer<typeof updateChatTabAppearanceResultSchema>;
export type UpdateChatSystemPromptInput = z.infer<typeof updateChatSystemPromptInputSchema>;
export type UpdateChatSystemPromptResult = z.infer<typeof updateChatSystemPromptResultSchema>;
export type SendChatMessageInput = z.infer<typeof sendChatMessageInputSchema>;
export type SendChatMessageResult = z.infer<typeof sendChatMessageResultSchema>;
export type StopChatTurnInput = z.infer<typeof stopChatTurnInputSchema>;
export type StopChatTurnResult = z.infer<typeof stopChatTurnResultSchema>;
