import { randomUUID } from 'node:crypto';
import { agentRuntimeSaveDiscordBindingSchema } from '@tavern/api';
import { z } from 'zod';
import { saveOpenClawDiscordBinding } from '../../openclaw-settings/service.ts';
import { publicProcedure } from '../trpc.ts';

const saveMessagingBindingInputSchema = z.object({
    accountId: z.string().trim().optional(),
    agentId: z.string().trim().min(1),
    allowBots: z.union([z.boolean(), z.literal('mentions')]),
    bindingId: z.string().trim().min(1).optional(),
    enabled: z.boolean().optional(),
    groupPolicy: z.enum(['open', 'allowlist', 'disabled']),
    guilds: z
        .array(
            z.object({
                channelIds: z.array(z.string().trim().min(1)).default([]),
                id: z.string().trim().min(1),
                ignoreOtherMentions: z.boolean(),
                requireMention: z.boolean(),
            })
        )
        .default([]),
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
    mentionPatterns: z.array(z.string().trim().min(1)).default([]),
    metadata: z.record(z.string(), z.unknown()).optional(),
    name: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    replyToMode: z.enum(['off', 'first', 'all']),
    status: z.enum(['configured', 'disabled', 'error']).optional(),
    statusMessage: z.string().trim().min(1).nullable().optional(),
    token: z.string().trim().nullable().optional(),
});

export const saveMessagingBindingProcedure = publicProcedure
    .input(saveMessagingBindingInputSchema)
    .mutation(async ({ input }) => {
        if (input.platform !== 'discord') {
            throw new Error(`Unsupported messaging platform "${input.platform}".`);
        }

        return await saveOpenClawDiscordBinding(
            agentRuntimeSaveDiscordBindingSchema.parse({
                accountId: input.accountId || undefined,
                agentId: input.agentId,
                allowBots: input.allowBots,
                bindingId: input.bindingId ?? input.id ?? `discord:${randomUUID()}`,
                enabled: input.enabled ?? true,
                groupPolicy: input.groupPolicy,
                guilds: input.guilds,
                inboundMode: input.inboundMode ?? 'active',
                match: input.match
                    ? {
                          dmUserIds: input.match.dmUserIds,
                          parentChannelIds: input.match.parentChannelIds,
                      }
                    : undefined,
                mentionPatterns: input.mentionPatterns,
                metadata: input.metadata ?? {},
                name: input.name,
                replyToMode: input.replyToMode,
                token: input.token || null,
            })
        );
    });
