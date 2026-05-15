import { z } from 'zod';
import { normalizedModelSchema } from '../model/identity.ts';

export const toolFactSchema = z.object({
    label: z.string(),
    tone: z.enum(['default', 'success', 'danger']),
    value: z.string(),
});

export const toolCallSchema = z.object({
    callId: z.string().nullable(),
    facts: z.array(toolFactSchema),
    label: z.string().nullable(),
    model: normalizedModelSchema.optional(),
    name: z.string(),
    status: z.string().nullable(),
    summaryParts: z.array(z.string()),
});

export const toolActionSchema = z.object({
    kind: z.literal('open-session'),
    label: z.string(),
    sessionKey: z.string(),
    subtitle: z.string().nullable(),
    title: z.string(),
    tone: z.enum(['amber', 'neutral', 'sky']),
});

export const toolDetailSchema = z.object({
    actions: z.array(toolActionSchema),
    arguments: z.unknown().nullable(),
    completedAt: z.string().nullable(),
    result: z.unknown().nullable(),
    startedAt: z.string().nullable(),
    toolCall: toolCallSchema,
});

export type ToolCall = z.infer<typeof toolCallSchema>;
export type ToolDetail = z.infer<typeof toolDetailSchema>;
export type ToolFact = z.infer<typeof toolFactSchema>;
export type ToolAction = z.infer<typeof toolActionSchema>;
