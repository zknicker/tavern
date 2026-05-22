import { z } from 'zod';

export const mentionKindSchema = z.enum(['app', 'directory', 'file', 'image', 'plugin', 'skill']);
export const mentionProjectionSchema = z.enum([
    'capability-reference',
    'image-input',
    'path-reference',
    'skill-context',
]);

export const mentionOptionSchema = z.object({
    description: z.string().nullable().optional(),
    id: z.string().trim().min(1),
    insertText: z.string().trim().min(1),
    kind: mentionKindSchema,
    label: z.string().trim().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    projection: mentionProjectionSchema,
    sourceLabel: z.string().nullable().optional(),
});

export const listMentionInventoryInputSchema = z
    .object({
        agentId: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(200).default(120),
    })
    .optional();

export const listMentionPathOptionsInputSchema = z.object({
    agentId: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(40).default(12),
    query: z.string().default(''),
});

export const listMentionOptionsInputSchema = z
    .object({
        agentId: z.string().trim().min(1).optional(),
        limit: z.number().int().min(1).max(40).default(12),
        query: z.string().default(''),
    })
    .optional();

export const listMentionInventoryOutputSchema = z.object({
    options: z.array(mentionOptionSchema),
});

export const listMentionOptionsOutputSchema = z.object({
    options: z.array(mentionOptionSchema),
    query: z.string(),
});

export type MentionOptionResult = z.infer<typeof mentionOptionSchema>;
