import { agentRuntimeModelProviderIdSchema } from '@tavern/api';
import { z } from 'zod';
import { actorRefSchema } from '../../actors/contracts.ts';
import { dashboardSessionSenderTypeSchema } from '../../contracts/shared.ts';
import { normalizedModelSchema } from '../../model/identity.ts';

export const taskActorSchema = z.object({
    handle: z.string().nullable(),
    id: z.string(),
});

export const taskLabelSchema = z.object({
    color: z.enum(['red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink', 'gray']),
    id: z.string(),
    name: z.string(),
});

export const messageTaskSchema = z.object({
    assignee: taskActorSchema.nullable(),
    claimed_at: z.string().nullable(),
    created_at: z.string(),
    labels: z.array(taskLabelSchema),
    number: z.number().int().positive(),
    origin: z.enum(['composed', 'converted']),
    priority: z.enum(['none', 'urgent', 'high', 'medium', 'low']),
    status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'closed']),
    updated_at: z.string(),
});

export const messageReactionSchema = z.object({
    actors: z.array(taskActorSchema),
    emoji: z.string(),
});

export const sessionMessageMetadataSchema = z
    .object({
        api: z.string().optional(),
        isError: z.boolean().optional(),
        model: z.string().trim().min(1).optional(),
        modelInfo: normalizedModelSchema.optional(),
        agentApi: z.string().optional(),
        agentModel: z.string().optional(),
        agentProvider: z.string().optional(),
        parts: z.array(z.record(z.string(), z.unknown())).optional(),
        provider: agentRuntimeModelProviderIdSchema.optional(),
        stopReason: z.string().optional(),
        toolCallId: z.string().optional(),
        toolName: z.string().optional(),
        usage: z.unknown().optional(),
    })
    .passthrough()
    .superRefine((value, context) => {
        const hasModel = typeof value.model === 'string';
        const hasProvider = typeof value.provider === 'string';
        const hasModelInfo = typeof value.modelInfo !== 'undefined';

        if (hasModel !== hasProvider) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'Message metadata model identity must include model and provider together.',
                path: ['model'],
            });
        }

        if (!(hasModelInfo && value.modelInfo)) {
            return;
        }

        if (!(hasModel && hasProvider)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'Message metadata modelInfo requires the canonical model and provider tuple.',
                path: ['modelInfo'],
            });
            return;
        }

        if (value.modelInfo.model !== value.model) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Message metadata modelInfo.model must match metadata.model.',
                path: ['modelInfo', 'model'],
            });
        }

        if (value.modelInfo.provider !== value.provider) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Message metadata modelInfo.provider must match metadata.provider.',
                path: ['modelInfo', 'provider'],
            });
        }
    });

export const sessionMessageInlineAttachmentSchema = z.object({
    type: z.literal('inline'),
    dataBase64: z.string(),
    filename: z.string(),
    height: z.number().int().positive().nullable().optional(),
    mediaType: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable().optional(),
});

export const sessionMessageFileAttachmentSchema = z.object({
    type: z.literal('file'),
    filename: z.string(),
    mediaType: z.string().nullable().optional(),
    path: z.string(),
    sizeBytes: z.number().int().nonnegative().nullable().optional(),
    uri: z.string().nullable().optional(),
});

export const sessionMessageAttachmentSchema = z.discriminatedUnion('type', [
    sessionMessageInlineAttachmentSchema,
    sessionMessageFileAttachmentSchema,
]);

export const sessionMessageSchema = z.object({
    tavernAgentId: z.string().nullable().optional(),
    actor: actorRefSchema.nullable().optional(),
    attachments: z.array(sessionMessageAttachmentSchema).optional(),
    content: z.string(),
    id: z.string(),
    metadata: sessionMessageMetadataSchema.optional(),
    reactions: z.array(messageReactionSchema).optional(),
    sender: z.string(),
    senderType: dashboardSessionSenderTypeSchema,
    timestamp: z.string(),
    task: messageTaskSchema.nullable().optional(),
});

export const sessionThinkingSchema = z.object({
    id: z.string(),
    messageId: z.string(),
    sender: z.string(),
    text: z.string(),
    timestamp: z.string(),
});

export type SessionMessage = z.infer<typeof sessionMessageSchema>;
export type SessionMessageAttachment = z.infer<typeof sessionMessageAttachmentSchema>;
export type SessionThinking = z.infer<typeof sessionThinkingSchema>;
