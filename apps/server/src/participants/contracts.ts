import { z } from 'zod';

export const profileSchema = z.object({
    avatar: z.string().nullable(),
    displayName: z.string().nullable(),
    id: z.string(),
    primaryColor: z.string().nullable(),
});

export const participantSchema = z.object({
    accountKey: z.string().nullable(),
    avatar: z.string(),
    externalId: z.string().nullable(),
    id: z.string(),
    labels: z.array(z.string()),
    linkedProfileId: z.string().nullable(),
    name: z.string(),
    observedName: z.string(),
    primaryColor: z.string().nullable(),
    provider: z.string(),
    updatedAt: z.string().nullable(),
});

export const participantListSchema = z.object({
    participants: z.array(participantSchema),
    profile: profileSchema,
});

export type Participant = z.infer<typeof participantSchema>;
export type ParticipantList = z.infer<typeof participantListSchema>;
export type Profile = z.infer<typeof profileSchema>;
