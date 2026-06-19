import { z } from 'zod';

export const participantSchema = z.object({
    accountKey: z.string().nullable(),
    avatar: z.string(),
    externalId: z.string().nullable(),
    id: z.string(),
    labels: z.array(z.string()),
    name: z.string(),
    observedName: z.string(),
    primaryColor: z.string().nullable(),
    provider: z.string(),
    updatedAt: z.string().nullable(),
});

export const participantListSchema = z.object({
    participants: z.array(participantSchema),
});

export type Participant = z.infer<typeof participantSchema>;
export type ParticipantList = z.infer<typeof participantListSchema>;
