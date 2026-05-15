import * as z from 'zod';

type OpenClawConfig = Record<string, unknown>;

const bindingMatchSchema = z
    .object({
        accountId: z.string().trim().min(1).optional(),
        channel: z.string().trim().min(1),
        guildId: z.string().trim().min(1).optional(),
        peer: z
            .object({
                id: z.string().trim().min(1),
                kind: z.enum(['direct', 'group', 'channel', 'dm']),
            })
            .strict()
            .optional(),
        roles: z.array(z.string().trim().min(1)).optional(),
        teamId: z.string().trim().min(1).optional(),
    })
    .strict();

const bindingSessionSchema = z
    .object({
        dmScope: z
            .enum(['main', 'per-peer', 'per-channel-peer', 'per-account-channel-peer'])
            .optional(),
    })
    .strict();

const routeBindingSchema = z
    .object({
        agentId: z.string().trim().min(1),
        comment: z.string().optional(),
        match: bindingMatchSchema,
        session: bindingSessionSchema.optional(),
        type: z.literal('route').optional(),
    })
    .strict();

const acpBindingSchema = z
    .object({
        acp: z
            .object({
                backend: z.string().optional(),
                cwd: z.string().optional(),
                label: z.string().optional(),
                mode: z.enum(['persistent', 'oneshot']).optional(),
            })
            .strict()
            .optional(),
        agentId: z.string().trim().min(1),
        comment: z.string().optional(),
        match: bindingMatchSchema,
        type: z.literal('acp'),
    })
    .strict()
    .superRefine((binding, context) => {
        if (!binding.match.peer?.id.trim()) {
            context.addIssue({
                code: 'custom',
                message: 'ACP bindings require a concrete peer target.',
                path: ['match', 'peer'],
            });
        }
    });

const bindingsSchema = z.array(z.union([routeBindingSchema, acpBindingSchema])).optional();

const discordChannelSchema = z
    .object({
        enabled: z.boolean().optional(),
        requireMention: z.boolean().optional(),
    })
    .passthrough();

const discordGuildSchema = z
    .object({
        channels: z.record(z.string().trim().min(1), discordChannelSchema).optional(),
        ignoreOtherMentions: z.boolean().optional(),
        requireMention: z.boolean().optional(),
    })
    .passthrough();

const discordAccountSchema = z
    .object({
        allowBots: z.union([z.boolean(), z.literal('mentions')]).optional(),
        enabled: z.boolean().optional(),
        groupPolicy: z.enum(['open', 'allowlist', 'disabled']).optional(),
        guilds: z.record(z.string().trim().min(1), discordGuildSchema).optional(),
        name: z.string().trim().min(1).optional(),
        replyToMode: z.enum(['off', 'first', 'all']).optional(),
        token: z.unknown().optional(),
    })
    .passthrough();

const discordConfigSchema = z
    .object({
        accounts: z.record(z.string().trim().min(1), discordAccountSchema).optional(),
        groupPolicy: z.enum(['open', 'allowlist', 'disabled']).optional(),
    })
    .passthrough()
    .optional();

const openClawConfigDraftSchema = z
    .object({
        bindings: bindingsSchema,
        channels: z
            .object({
                discord: discordConfigSchema,
            })
            .passthrough()
            .optional(),
    })
    .passthrough();

export function validateOpenClawConfigDraft(config: OpenClawConfig): string | null {
    const result = openClawConfigDraftSchema.safeParse(config);

    if (result.success) {
        return null;
    }

    const issue = result.error.issues[0];
    const path = issue?.path.length ? issue.path.join('.') : 'config';
    const message = issue?.message ?? 'Invalid OpenClaw settings draft.';

    return `Invalid OpenClaw settings at ${path}: ${message}`;
}
