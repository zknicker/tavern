import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { saveMessagingBinding } from '../../messaging-platform/service.ts';
import { publicProcedure } from '../trpc.ts';

const saveMessagingBindingInputSchema = z.object({
    agentId: z.string().trim().min(1),
    enabled: z.boolean().optional(),
    id: z.string().trim().min(1).optional(),
    inboundMode: z.enum(['active', 'mention-only', 'observe']).optional(),
    match: z
        .object({
            channelIds: z.array(z.string().trim().min(1)).default([]),
            dmUserIds: z.array(z.string().trim().min(1)).default([]),
            guildIds: z.array(z.string().trim().min(1)).default([]),
            parentChannelIds: z.array(z.string().trim().min(1)).default([]),
        })
        .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    name: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    status: z.enum(['configured', 'disabled', 'error']).optional(),
    statusMessage: z.string().trim().min(1).nullable().optional(),
    token: z.string(),
});

export const saveMessagingBindingProcedure = publicProcedure
    .input(saveMessagingBindingInputSchema)
    .mutation(async ({ input }) => {
        return await saveMessagingBinding({
            ...input,
            id: input.id ?? `${input.platform}:${randomUUID()}`,
        });
    });
