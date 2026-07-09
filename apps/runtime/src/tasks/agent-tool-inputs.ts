import { agentRuntimeTaskScheduledForSchema } from '@tavern/api';
import * as z from 'zod';

const statusSchema = z.enum([
    'backlog',
    'todo',
    'in_progress',
    'blocked',
    'review',
    'done',
    'canceled',
]);
const blockedReasonKindSchema = z.enum(['needs_input', 'error']);
const prioritySchema = z.enum(['none', 'urgent', 'high', 'medium', 'low']);
const kindSchema = z.enum(['task', 'epic']);
const tNumberSchema = z.number().int().positive();

export const listInputSchema = z
    .object({
        assignedToMe: z.boolean().optional(),
        epicId: z.string().trim().min(1).optional(),
        kind: kindSchema.optional(),
        status: statusSchema.optional(),
    })
    .strict();

export const getInputSchema = z
    .object({
        number: z.number().int().positive().optional(),
        taskId: z.string().trim().min(1).optional(),
    })
    .strict()
    .refine((value) => value.number !== undefined || value.taskId !== undefined, {
        message: 'Provide a T-number or task id.',
    });

export const createInputSchema = z
    .object({
        assignToMe: z.boolean().optional(),
        blockedBy: z.array(tNumberSchema).optional(),
        description: z.string().trim().min(1).nullable().optional(),
        epicId: z.string().trim().min(1).nullable().optional(),
        kind: kindSchema.optional(),
        labels: z.array(z.string().trim().min(1)).optional(),
        priority: prioritySchema.optional(),
        scheduledFor: agentRuntimeTaskScheduledForSchema.nullable().optional(),
        title: z.string().trim().min(1),
    })
    .strict();

export const updateInputSchema = z
    .object({
        assignToMe: z.boolean().optional(),
        attachments: z.array(z.string().trim().min(1)).optional(),
        blockedBy: z.array(tNumberSchema).optional(),
        blockedReason: z.string().trim().min(1).optional(),
        blockedReasonKind: blockedReasonKindSchema.optional(),
        description: z.string().trim().min(1).nullable().optional(),
        epicId: z.string().trim().min(1).nullable().optional(),
        labels: z.array(z.string().trim().min(1)).optional(),
        number: z.number().int().positive().optional(),
        priority: prioritySchema.optional(),
        scheduledFor: agentRuntimeTaskScheduledForSchema.nullable().optional(),
        status: statusSchema.optional(),
        summary: z.string().trim().min(1).optional(),
        taskId: z.string().trim().min(1).optional(),
        title: z.string().trim().min(1).optional(),
    })
    .strict()
    .refine((value) => value.number !== undefined || value.taskId !== undefined, {
        message: 'Provide a T-number or task id.',
    });

export type TaskToolUpdateInput = z.infer<typeof updateInputSchema>;
