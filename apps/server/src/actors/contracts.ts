import { z } from 'zod';

export const actorRefSchema = z.discriminatedUnion('kind', [
    z.object({
        id: z.string(),
        kind: z.literal('agent'),
    }),
    z.object({
        id: z.string(),
        kind: z.literal('participant'),
    }),
    z.object({
        id: z.string(),
        kind: z.literal('profile'),
    }),
]);

export type ActorRef = z.infer<typeof actorRefSchema>;
