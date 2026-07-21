import { z } from 'zod';
import { actorRefSchema } from '../actors/contracts.ts';

export const chatFileEntrySchema = z.object({
    actor: actorRefSchema.nullable(),
    at: z.string(),
    filename: z.string(),
    id: z.string(),
    kind: z.enum(['inline', 'file']),
    mediaType: z.string().nullable(),
    messageId: z.string(),
    senderName: z.string(),
    sizeBytes: z.number().int().nonnegative().nullable(),
});

export const chatFileListSchema = z.object({
    files: z.array(chatFileEntrySchema),
});

export type ChatFileEntry = z.infer<typeof chatFileEntrySchema>;
