import * as z from 'zod';

import { agentRuntimeModelProviderIdSchema } from './model-providers.js';

export const agentRuntimeProtocolVersion = 1 as const;

export const agentRuntimeCapabilitySchema = z.enum([
    'tavernPlugin',
    'agentTurns',
    'agentFiles',
    'agents',
    'chats',
    'chatTargets',
    'computerUse',
    'cron',
    'cronRuns',
    'codexOAuth',
    'cortexAgentTools',
    'cortexDatabase',
    'cortexImportProcessors',
    'cortexJobs',
    'cortexModelAccess',
    'cortexWiki',
    'embeddingModel',
    'events',
    'gateway',
    'knowledgebase',
    'logs',
    'memory',
    'mentions',
    'messages',
    'models',
    'sessionEvents',
    'sessions',
    'skills',
    'skillMaterialization',
    'status',
    'tasks',
]);

export const agentRuntimeCapabilityHealthIdSchema = agentRuntimeCapabilitySchema;

export const agentRuntimeCapabilityHealthStateSchema = z.enum([
    'degraded',
    'healthy',
    'unauthorized',
    'unavailable',
    'unknown',
]);

export const agentRuntimeCapabilityHealthSchema = z.object({
    checkedAt: z.string().datetime().nullable(),
    displayName: z.string().trim().min(1),
    healthy: z.boolean(),
    id: agentRuntimeCapabilityHealthIdSchema,
    lastHealthyAt: z.string().datetime().nullable(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    nextCheckAt: z.string().datetime().nullable(),
    reason: z.string().trim().min(1).nullable(),
    state: agentRuntimeCapabilityHealthStateSchema,
    technicalMessage: z.string().trim().min(1).nullable(),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeRefreshCapabilitiesSchema = z.object({
    capabilities: z.array(agentRuntimeCapabilityHealthIdSchema),
});

export const agentRuntimeInfoSchema = z.object({
    name: z.string().trim().min(1),
    protocolVersion: z.literal(agentRuntimeProtocolVersion),
    agentRuntimeId: z.string().trim().min(1),
    version: z.string().trim().min(1),
});

export const agentRuntimeHealthSchema = z.object({
    ok: z.boolean(),
    status: z.enum(['degraded', 'healthy', 'starting']),
    timestamp: z.string().datetime(),
});

export const agentRuntimeCapabilityHealthListSchema = z.object({
    capabilities: z.array(agentRuntimeCapabilityHealthSchema),
    health: agentRuntimeHealthSchema,
    info: agentRuntimeInfoSchema,
});

export const agentRuntimeUpdatePhaseSchema = z.enum([
    'idle',
    'installing',
    'staged',
    'restarting',
    'failed',
]);

export const agentRuntimeUpdateRequestSchema = z
    .object({
        targetVersion: z.string().trim().min(1).nullable().optional(),
    })
    .optional();

export const agentRuntimeUpdateSchema = z.object({
    currentVersion: z.string().trim().min(1),
    finishedAt: z.string().datetime().nullable(),
    message: z.string().trim().min(1).nullable(),
    phase: agentRuntimeUpdatePhaseSchema,
    startedAt: z.string().datetime().nullable(),
    targetVersion: z.string().trim().min(1).nullable(),
});

export const agentRuntimeAgentBindingSchema = z.object({
    agentId: z.string().trim().min(1),
});

export const agentRuntimeModelAccessIdSchema = z.enum(['codex', 'openai', 'openrouter']);
export const agentRuntimeModelAccessStateSchema = z.enum(['error', 'live', 'needs-auth']);

export const agentRuntimeModelAccessStatusSchema = z.object({
    description: z.string().trim().min(1),
    id: agentRuntimeModelAccessIdSchema,
    source: z.string().trim().min(1).nullable(),
    state: agentRuntimeModelAccessStateSchema,
});

export const agentRuntimeModelAccessSchema = z.object({
    providers: z.array(agentRuntimeModelAccessStatusSchema),
});

const agentRuntimeOpenRouterKeySchema = z
    .string()
    .trim()
    .min(20, 'Enter a valid OpenRouter key.')
    .regex(/^sk-or(?:-v1)?-[A-Za-z0-9_-]+$/u, 'Enter a valid OpenRouter key.');

function isOpenAiApiKey(value: string) {
    return /^sk-[A-Za-z0-9_-]{20,}$/u.test(value);
}

export const agentRuntimeOpenRouterSettingsSchema = z.object({
    apiKey: z.string(),
    hasApiKey: z.boolean(),
    hasManagementApiKey: z.boolean(),
    managementApiKey: z.string(),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeOpenAiSettingsSchema = z.object({
    apiKey: z.string(),
    hasApiKey: z.boolean(),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeSaveOpenAiSettingsSchema = z.object({
    apiKey: z.string().trim().refine(isOpenAiApiKey, 'Enter an OpenAI API key.'),
});

export const agentRuntimeSaveOpenRouterSettingsSchema = z
    .object({
        apiKey: agentRuntimeOpenRouterKeySchema.optional(),
        managementApiKey: agentRuntimeOpenRouterKeySchema.optional(),
    })
    .refine(
        (value) => value.apiKey !== undefined || value.managementApiKey !== undefined,
        'Enter an OpenRouter key.'
    );

export const agentRuntimeOpenClawHarnessSchema = z.enum(['pi', 'codex']);

export const agentRuntimeOpenClawModelNameSchema = z.object({
    harness: agentRuntimeOpenClawHarnessSchema,
    model: z.string().trim().min(1),
    provider: z.string().trim().min(1),
});

export const agentRuntimeThinkingLevelSchema = z.enum([
    'off',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'adaptive',
    'max',
]);

const agentRuntimeJsonRecordSchema = z.record(z.string(), z.unknown());

export const agentRuntimeOpenClawConfigSchema = z.record(z.string(), z.unknown());

export const agentRuntimeOpenClawConfigSnapshotSchema = z.object({
    config: agentRuntimeOpenClawConfigSchema,
    hash: z.string().trim().min(1),
    issues: z.array(z.unknown()).default([]),
    raw: z.string().nullable(),
    valid: z.boolean().nullable(),
});

export const agentRuntimeApplyOpenClawConfigSchema = z.object({
    baseHash: z.string().trim().min(1),
    config: agentRuntimeOpenClawConfigSchema,
});

const agentRuntimeOpenClawConfigMutationSchema = z.object({});

export const agentRuntimeUpdateAgentNameSchema = agentRuntimeOpenClawConfigMutationSchema.extend({
    name: z.string().trim().min(1),
});

export const agentRuntimeUpdateAgentModelSchema = agentRuntimeOpenClawConfigMutationSchema.extend({
    model: agentRuntimeOpenClawModelNameSchema,
});

export const agentRuntimeUpdateAgentThinkingDefaultSchema =
    agentRuntimeOpenClawConfigMutationSchema.extend({
        thinkingDefault: agentRuntimeThinkingLevelSchema.nullable(),
    });

export const agentRuntimeDiscordAllowBotsSchema = z.union([z.boolean(), z.literal('mentions')]);

export const agentRuntimeDiscordGroupPolicySchema = z.enum(['open', 'allowlist', 'disabled']);
export const agentRuntimeInboundModeSchema = z.enum(['active', 'mention-only', 'observe']);
export const agentRuntimeDiscordReplyToModeSchema = z.enum(['off', 'first', 'all']);

export const agentRuntimeDiscordBindingGuildSchema = z.object({
    channelIds: z.array(z.string().trim().min(1)).default([]),
    id: z.string().trim().min(1),
    ignoreOtherMentions: z.boolean(),
    requireMention: z.boolean(),
});

export const agentRuntimeSaveDiscordBindingSchema = agentRuntimeOpenClawConfigMutationSchema.extend(
    {
        accountId: z.string().trim().min(1).optional(),
        agentId: z.string().trim().min(1),
        allowBots: agentRuntimeDiscordAllowBotsSchema,
        bindingId: z.string().trim().min(1).optional(),
        enabled: z.boolean(),
        groupPolicy: agentRuntimeDiscordGroupPolicySchema,
        guilds: z.array(agentRuntimeDiscordBindingGuildSchema).default([]),
        inboundMode: agentRuntimeInboundModeSchema,
        match: z
            .object({
                dmUserIds: z.array(z.string().trim().min(1)).default([]),
                parentChannelIds: z.array(z.string().trim().min(1)).default([]),
            })
            .default({
                dmUserIds: [],
                parentChannelIds: [],
            }),
        mentionPatterns: z.array(z.string().trim().min(1)).default([]),
        metadata: agentRuntimeJsonRecordSchema.default({}),
        name: z.string().trim().min(1),
        replyToMode: agentRuntimeDiscordReplyToModeSchema,
        token: z.string().trim().min(1).nullable().optional(),
    }
);

export const agentRuntimeDeleteDiscordBindingSchema = agentRuntimeOpenClawConfigMutationSchema;

export const agentRuntimeDiscordBindingStatusSchema = z.enum(['configured', 'disabled', 'error']);
export const agentRuntimeDiscordTokenSourceSchema = z.enum([
    'missing',
    'plaintext',
    'redacted',
    'secret-ref',
]);

export const agentRuntimeDiscordBindingMatchSchema = z.object({
    channelIds: z.array(z.string().trim().min(1)).default([]),
    dmUserIds: z.array(z.string().trim().min(1)).default([]),
    guildIds: z.array(z.string().trim().min(1)).default([]),
    parentChannelIds: z.array(z.string().trim().min(1)).default([]),
});

export const agentRuntimeDiscordBindingSchema = z.object({
    accountId: z.string().trim().min(1),
    agentId: z.string().trim().min(1),
    allowBots: agentRuntimeDiscordAllowBotsSchema,
    enabled: z.boolean(),
    groupPolicy: agentRuntimeDiscordGroupPolicySchema,
    guilds: z.array(agentRuntimeDiscordBindingGuildSchema).default([]),
    id: z.string().trim().min(1),
    inboundMode: agentRuntimeInboundModeSchema,
    match: agentRuntimeDiscordBindingMatchSchema,
    mentionPatterns: z.array(z.string().trim().min(1)).default([]),
    metadata: agentRuntimeJsonRecordSchema,
    name: z.string().trim().min(1),
    platform: z.literal('discord'),
    replyToMode: agentRuntimeDiscordReplyToModeSchema,
    status: agentRuntimeDiscordBindingStatusSchema,
    statusMessage: z.string().trim().min(1).nullable(),
    tokenConfigured: z.boolean(),
    tokenSource: agentRuntimeDiscordTokenSourceSchema,
});

export const agentRuntimeDiscordBindingListSchema = z.object({
    bindings: z.array(agentRuntimeDiscordBindingSchema),
});

export const agentRuntimeAgentSchema = z.object({
    avatar: z.string().trim().min(1).nullable(),
    enabledSkillIds: z.array(z.string().trim().min(1)),
    emoji: z.string().trim().min(1).nullable(),
    id: z.string().trim().min(1),
    isAdmin: z.boolean(),
    name: z.string().trim().min(1),
    openClawModelName: agentRuntimeOpenClawModelNameSchema.nullable().optional(),
    primaryColor: z.string().trim().min(1).nullable(),
    thinkingDefault: agentRuntimeThinkingLevelSchema.nullable().optional(),
    workspaceFolder: z.string().trim().min(1),
});

export const agentRuntimeAgentListSchema = z.object({
    agents: z.array(agentRuntimeAgentSchema),
});

export const agentRuntimeArchiveAgentSchema = z.object({
    archived: z.literal(true),
    id: z.string().trim().min(1),
});

export const agentRuntimeCreateAgentSchema = z.object({
    avatar: z.string().trim().min(1).nullable().optional(),
    enabledSkillIds: z.array(z.string().trim().min(1)).optional(),
    emoji: z.string().trim().min(1).nullable().optional(),
    id: z.string().trim().min(1),
    isAdmin: z.boolean().optional(),
    name: z.string().trim().min(1),
    primaryColor: z.string().trim().min(1).nullable().optional(),
    workspaceFolder: z.string().trim().min(1),
});

export const agentRuntimeUpdateAgentSchema = z.object({
    avatar: z.string().trim().min(1).nullable().optional(),
    enabledSkillIds: z.array(z.string().trim().min(1)).optional(),
    emoji: z.string().trim().min(1).nullable().optional(),
    isAdmin: z.boolean().optional(),
    name: z.string().trim().min(1).optional(),
    primaryColor: z.string().trim().min(1).nullable().optional(),
    workspaceFolder: z.string().trim().min(1).optional(),
});

export const agentRuntimeAgentFileSchema = z.object({
    content: z.string().nullable().optional(),
    mediaType: z.string().trim().min(1).nullable().optional(),
    path: z.string().trim().min(1),
    sizeBytes: z.number().int().nonnegative().nullable().optional(),
    updatedAt: z.string().datetime().nullable().optional(),
});

export const agentRuntimeAgentFileListSchema = z.object({
    files: z.array(agentRuntimeAgentFileSchema.omit({ content: true })),
});

export const agentRuntimeAgentFileContentSchema = agentRuntimeAgentFileSchema.extend({
    content: z.string(),
});

export const agentRuntimeSaveAgentFileSchema = z.object({
    content: z.string(),
});

export const agentRuntimeSaveWorkspaceInstructionsSchema = z.object({
    agentName: z.string().trim().min(1).optional(),
    userInstructions: z.string().optional(),
    workspaceDir: z.string().trim().min(1),
});

export const agentRuntimeWorkspaceInstructionsSchema = z.object({
    agentId: z.string().trim().min(1),
    renderedAt: z.string().datetime(),
    sha256: z.string().trim().min(1),
    updatedAt: z.string().datetime(),
});

export const agentRuntimeRenderedWorkspaceInstructionsSchema = z.object({
    agentId: z.string().trim().min(1),
    content: z.string(),
    path: z.string().trim().min(1),
    renderedAt: z.string().datetime().nullable(),
    sha256: z.string().trim().min(1).nullable(),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeSkillFileSchema = z.object({
    path: z.string().trim().min(1),
    sizeBytes: z.number().int().nonnegative(),
});

export const agentRuntimeSkillSourceSchema = z.enum(['builtin', 'installed']);
export const agentRuntimeSkillInstallSourceSchema = z.discriminatedUnion('source', [
    z.object({
        source: z.literal('clawhub'),
        spec: z.string().trim().min(1),
        version: z.string().trim().min(1).nullable().optional(),
    }),
    z.object({
        source: z.literal('github'),
        spec: z.string().trim().min(1),
        ref: z.string().trim().min(1).nullable().optional(),
    }),
]);

export const agentRuntimeSkillRequirementsSchema = z
    .object({
        anyBins: z.array(z.string().trim().min(1)).default([]),
        bins: z.array(z.string().trim().min(1)).default([]),
        config: z.array(z.string().trim().min(1)).default([]),
        env: z.array(z.string().trim().min(1)).default([]),
        os: z.array(z.string().trim().min(1)).default([]),
    })
    .default({
        anyBins: [],
        bins: [],
        config: [],
        env: [],
        os: [],
    });

export const agentRuntimeSkillConfigCheckSchema = z.object({
    path: z.string().trim().min(1),
    satisfied: z.boolean(),
});

export const agentRuntimeSkillInstallOptionSchema = z.object({
    bins: z.array(z.string().trim().min(1)).default([]),
    id: z.string().trim().min(1),
    kind: z.string().trim().min(1),
    label: z.string().trim().min(1),
});

export const agentRuntimeSkillSummarySchema = z.object({
    allowedTools: z.string().nullable(),
    baseDir: z.string().trim().min(1).nullable().optional(),
    blockedByAllowlist: z.boolean().optional(),
    bundled: z.boolean().optional(),
    commandVisible: z.boolean().optional(),
    configChecks: z.array(agentRuntimeSkillConfigCheckSchema).default([]),
    description: z.string().nullable(),
    disabled: z.boolean().optional(),
    eligible: z.boolean().optional(),
    filePath: z.string().trim().min(1).nullable().optional(),
    id: z.string().trim().min(1),
    install: z.array(agentRuntimeSkillInstallOptionSchema).default([]),
    missing: agentRuntimeSkillRequirementsSchema,
    modelVisible: z.boolean().optional(),
    name: z.string().trim().min(1),
    primaryEnv: z.string().trim().min(1).nullable().optional(),
    requirements: agentRuntimeSkillRequirementsSchema,
    runtimeSource: z.string().trim().min(1).nullable().optional(),
    skillKey: z.string().trim().min(1).nullable().optional(),
    source: agentRuntimeSkillSourceSchema,
    updatedAt: z.string().datetime().nullable(),
    userInvocable: z.boolean().optional(),
});

export const agentRuntimeSkillListSchema = z.object({
    skills: z.array(agentRuntimeSkillSummarySchema),
});

export const agentRuntimeMacAppSchema = z.object({
    bundleId: z.string().trim().min(1).optional(),
    iconDataUrl: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1),
    lastUsedAt: z.string().trim().min(1).optional(),
    running: z.boolean().optional(),
    usageCount: z.number().int().nonnegative().optional(),
});

export const agentRuntimeMacAppListSchema = z.object({
    apps: z.array(agentRuntimeMacAppSchema),
});

export const agentRuntimeSkillSchema = agentRuntimeSkillSummarySchema.extend({
    contentMarkdown: z.string(),
    files: z.array(agentRuntimeSkillFileSchema).default([]),
    installSource: agentRuntimeSkillInstallSourceSchema.nullable(),
});

export const agentRuntimeInstallSkillSchema = z.object({
    source: z.enum(['clawhub', 'github']).default('clawhub'),
    spec: z.string().trim().min(1),
    version: z.string().trim().min(1).nullable().optional(),
});

export const agentRuntimeArchiveSkillSchema = z.object({
    archived: z.literal(true),
    id: z.string().trim().min(1),
});

export const agentRuntimeChatBindingSchema = z.object({
    agentId: z.string().trim().min(1),
});

export const agentRuntimeChatScopeSchema = z.enum(['channel', 'dm', 'group', 'topic']).nullable();

export const agentRuntimeDiscordChatSourceRecordSchema = z.object({
    chatType: z.string().trim().min(1).nullable(),
    deliveryContext: agentRuntimeJsonRecordSchema.nullable(),
    displayName: z.string().trim().min(1).nullable(),
    kind: z.string().trim().min(1).nullable(),
    lastChannel: z.string().trim().min(1).nullable(),
    lastTo: z.string().trim().min(1).nullable(),
    origin: agentRuntimeJsonRecordSchema.nullable(),
    sessionKey: z.string().trim().min(1),
});

export const agentRuntimeDiscordChatMetadataSchema = z.object({
    accountIds: z.array(z.string().trim().min(1)),
    channel: z
        .object({
            id: z.string().trim().min(1),
            name: z.string().trim().min(1).nullable(),
        })
        .nullable(),
    dm: z
        .object({
            userId: z.string().trim().min(1),
        })
        .nullable(),
    guild: z
        .object({
            id: z.string().trim().min(1),
            name: z.string().trim().min(1).nullable(),
        })
        .nullable(),
    observedLabels: z.array(z.string().trim().min(1)),
    provider: z.literal('discord'),
    sourceRecords: z.array(agentRuntimeDiscordChatSourceRecordSchema),
    thread: z
        .object({
            id: z.string().trim().min(1),
            name: z.string().trim().min(1).nullable(),
        })
        .nullable(),
});

export const agentRuntimeTavernChatSourceRecordSchema = z.object({
    chatId: z.string().trim().min(1),
    clientMessageId: z.string().trim().min(1).nullable(),
    conversationId: z.string().trim().min(1).nullable(),
    deliveryId: z.string().trim().min(1).nullable(),
    runId: z.string().trim().min(1).nullable(),
    sessionKey: z.string().trim().min(1),
    source: agentRuntimeJsonRecordSchema.nullable(),
});

export const agentRuntimeTavernChatMetadataSchema = z.object({
    chatId: z.string().trim().min(1),
    conversationId: z.string().trim().min(1).nullable(),
    observedLabels: z.array(z.string().trim().min(1)),
    provider: z.literal('tavern'),
    sourceRecords: z.array(agentRuntimeTavernChatSourceRecordSchema),
});

export const agentRuntimeChatPlatformMetadataSchema = z
    .discriminatedUnion('provider', [
        agentRuntimeTavernChatMetadataSchema,
        agentRuntimeDiscordChatMetadataSchema,
    ])
    .nullable();

export const agentRuntimeChatAgentParticipantSchema = z.object({
    agentId: z.string().trim().min(1),
    type: z.literal('agent'),
});

export const agentRuntimeChatObservedParticipantSchema = z.object({
    accountKey: z.string().trim().min(1).nullable(),
    externalId: z.string().trim().min(1).nullable(),
    name: z.string().trim().min(1),
    observedLabels: z.array(z.string().trim().min(1)),
    participantId: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    type: z.literal('participant'),
});

export const agentRuntimeChatParticipantSchema = z.discriminatedUnion('type', [
    agentRuntimeChatAgentParticipantSchema,
    agentRuntimeChatObservedParticipantSchema,
]);

export const agentRuntimeChatSchema = z.object({
    bindingId: z.string().trim().min(1).nullable(),
    bindings: z.array(agentRuntimeChatBindingSchema),
    id: z.string().trim().min(1),
    inboundMode: agentRuntimeInboundModeSchema,
    metadata: agentRuntimeJsonRecordSchema,
    parentTarget: z.string().trim().min(1).nullable(),
    participants: z.array(agentRuntimeChatParticipantSchema),
    platform: z.string().trim().min(1),
    platformMetadata: agentRuntimeChatPlatformMetadataSchema,
    requiresTrigger: z.boolean(),
    scope: agentRuntimeChatScopeSchema,
    target: z.string().trim().min(1).nullable(),
    trigger: z.string().trim().min(1).nullable(),
});

export const agentRuntimeChatListSchema = z.object({
    chats: z.array(agentRuntimeChatSchema),
});

export const agentRuntimeBindingStatusSchema = z.enum(['configured', 'disabled', 'error']);

export const agentRuntimeBindingMatchSchema = z.record(
    z.string(),
    z.array(z.string().trim().min(1)).default([])
);

export const agentRuntimeBindingSchema = z.object({
    agentId: z.string().trim().min(1),
    enabled: z.boolean(),
    id: z.string().trim().min(1),
    inboundMode: agentRuntimeInboundModeSchema,
    match: agentRuntimeBindingMatchSchema,
    metadata: agentRuntimeJsonRecordSchema,
    name: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    status: agentRuntimeBindingStatusSchema,
    statusMessage: z.string().trim().min(1).nullable(),
    token: z.string(),
    updatedAt: z.string().datetime(),
});

export const agentRuntimeBindingListSchema = z.object({
    bindings: z.array(agentRuntimeBindingSchema),
});

export const agentRuntimeUpsertBindingSchema = z.object({
    agentId: z.string().trim().min(1),
    enabled: z.boolean().optional(),
    id: z.string().trim().min(1),
    inboundMode: agentRuntimeInboundModeSchema.optional(),
    match: agentRuntimeBindingMatchSchema.optional(),
    metadata: agentRuntimeJsonRecordSchema.optional(),
    name: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    status: agentRuntimeBindingStatusSchema.optional(),
    statusMessage: z.string().trim().min(1).nullable().optional(),
    token: z.string(),
});

export const agentRuntimeArchiveBindingSchema = z.object({
    archived: z.literal(true),
    id: z.string().trim().min(1),
});

export const agentRuntimeModelCatalogEntrySchema = z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1).nullable(),
    provider: z.string().trim().min(1).nullable(),
});

export const agentRuntimeModelsSchema = z.object({
    models: z.array(agentRuntimeModelCatalogEntrySchema),
    updatedAt: z.string().datetime().nullable(),
});

export const cortexJobNameSchema = z.enum([
    'chat-ingestion',
    'dream',
    'generate-embeddings',
    'lint',
    'repair-derived-state',
    'sync',
]);

export const cortexPageStatusSchema = z.enum(['active', 'archived', 'deleted', 'stale']);
export const cortexPageTypeSchema = z.string().trim().min(1);
export const cortexAuditStatusSchema = z.enum(['error', 'skipped', 'success']);
export const cortexEmbeddingProviderSchema = z.enum(['openai']);

export const cortexEmbeddingModelSchema = z.enum([
    'text-embedding-3-small',
    'text-embedding-3-large',
]);

export const cortexEmbeddingModelRefSchema = z.enum(['openai/text-embedding-3-small']);
export const cortexChatModelRefSchema = z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*\/[A-Za-z0-9._:/-]+$/u, 'Enter a provider/model ref.');

export const cortexSourceRefSchema = z.object({
    id: z.string().trim().min(1),
    kind: z.string().trim().min(1),
    locator: z.string().trim().min(1).nullable().default(null),
});

export const cortexSchemaLinkTypeSchema = z.object({
    name: z.string().trim().min(1),
});

export const cortexSchemaFrontmatterMappingSchema = z.object({
    fields: z.array(z.string().trim().min(1)).min(1),
    linkType: z.string().trim().min(1),
    pageType: z.string().trim().min(1).optional(),
});

export const cortexSchemaDefinitionSchema = z.object({
    frontmatterMappings: z.array(cortexSchemaFrontmatterMappingSchema).default([]),
    linkTypes: z.array(cortexSchemaLinkTypeSchema).min(1),
    name: z.string().trim().min(1),
    pageTypes: z.array(z.string().trim().min(1)).min(1),
    version: z.number().int().positive(),
});

export const cortexSchemaValidationIssueSchema = z.object({
    affectedCount: z.number().int().nonnegative(),
    kind: z.enum(['invalid-frontmatter-mapping', 'removed-active-link-type']),
    message: z.string().trim().min(1),
    severity: z.enum(['error', 'warning']),
    value: z.string().trim().min(1),
});

export const cortexSchemaRecordSchema = z.object({
    createdAt: z.string().datetime(),
    id: z.string().trim().min(1),
    schema: cortexSchemaDefinitionSchema,
    status: z.enum(['active', 'archived']),
    updatedAt: z.string().datetime(),
    validation: z.array(cortexSchemaValidationIssueSchema).default([]),
});

export const cortexSaveSchemaInputSchema = z.object({
    schema: cortexSchemaDefinitionSchema,
});

export const cortexSchemaAdditionKindSchema = z.enum(['link-type', 'page-type']);

export const cortexSchemaAdditionSchema = z.object({
    createdAt: z.string().datetime(),
    example: z.record(z.string(), z.unknown()).default({}),
    id: z.string().trim().min(1),
    kind: cortexSchemaAdditionKindSchema,
    name: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    sourceRefs: z.array(cortexSourceRefSchema).default([]),
    updatedAt: z.string().datetime(),
    usageCount: z.number().int().nonnegative(),
});

export const cortexSchemaAdditionListSchema = z.object({
    additions: z.array(cortexSchemaAdditionSchema),
});

export const cortexAddSchemaTermInputSchema = z.object({
    example: z.record(z.string(), z.unknown()).default({}),
    kind: cortexSchemaAdditionKindSchema,
    name: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    sourceRefs: z.array(cortexSourceRefSchema).default([]),
});

export const cortexPageSummarySchema = z.object({
    aliases: z.array(z.string().trim().min(1)).default([]),
    id: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    status: cortexPageStatusSchema,
    tags: z.array(z.string().trim().min(1)).default([]),
    title: z.string().trim().min(1),
    type: cortexPageTypeSchema,
    updatedAt: z.string().datetime(),
});

export const cortexTimelineEntrySchema = z.object({
    body: z.string(),
    createdAt: z.string().datetime(),
    id: z.string().trim().min(1),
    sourceRefs: z.array(cortexSourceRefSchema).default([]),
});

export const cortexLinkSchema = z.object({
    fromPageId: z.string().trim().min(1),
    heading: z.string().trim().min(1).nullable().default(null),
    id: z.string().trim().min(1),
    label: z.string().trim().min(1).nullable().default(null),
    linkKind: z.string().trim().min(1),
    sourceLocation: z.string().trim().min(1).nullable().default(null),
    targetPageId: z.string().trim().min(1).nullable().default(null),
    targetSlug: z.string().trim().min(1),
});

export const cortexClaimSchema = z.object({
    confidence: z.number().min(0).max(1).nullable().default(null),
    id: z.string().trim().min(1),
    pageId: z.string().trim().min(1),
    predicate: z.string().trim().min(1),
    sourceRefs: z.array(cortexSourceRefSchema).default([]),
    status: z.enum(['active', 'contradicted', 'stale', 'superseded']),
    subject: z.string().trim().min(1),
    supersedesClaimId: z.string().trim().min(1).nullable().default(null),
    value: z.string().trim().min(1),
});

export const cortexPageWriteSourceSchema = z.object({
    actorId: z.string().trim().min(1),
    actorKind: z.enum(['agent', 'runtime', 'system', 'user']),
    agentId: z.string().trim().min(1).nullable().optional(),
    chatId: z.string().trim().min(1).nullable().optional(),
    fileId: z.string().trim().min(1).nullable().optional(),
    messageId: z.string().trim().min(1).nullable().optional(),
    participantId: z.string().trim().min(1).nullable().optional(),
    profileId: z.string().trim().min(1).nullable().optional(),
    sessionKey: z.string().trim().min(1).nullable().optional(),
    turnId: z.string().trim().min(1).nullable().optional(),
    url: z.string().trim().min(1).nullable().optional(),
});

export const cortexPageEditLinkInputSchema = z.object({
    label: z.string().trim().min(1).nullable().optional(),
    linkKind: z.string().trim().min(1),
    targetSlug: z.string().trim().min(1),
});

export const cortexPageEditClaimInputSchema = z.object({
    confidence: z.number().min(0).max(1).nullable().optional(),
    predicate: z.string().trim().min(1),
    status: z.enum(['active', 'contradicted', 'stale', 'superseded']).default('active'),
    subject: z.string().trim().min(1),
    supersedesClaimId: z.string().trim().min(1).nullable().optional(),
    value: z.string().trim().min(1),
});

export const cortexPageEditTimelineEntryInputSchema = z.union([
    z.string().trim().min(1),
    z.object({
        body: z.string().trim().min(1),
        createdAt: z.string().datetime(),
    }),
]);

const cortexPageEditBaseSchema = z.object({
    source: cortexPageWriteSourceSchema,
    summary: z.string().trim().min(1).optional(),
});

export const cortexUpsertPageInputSchema = cortexPageEditBaseSchema.extend({
    action: z.literal('upsert'),
    aliases: z.array(z.string().trim().min(1)).optional(),
    body: z.string().optional(),
    claims: z.array(cortexPageEditClaimInputSchema).optional(),
    compiledTruth: z.string().optional(),
    frontmatter: z.record(z.string(), z.unknown()).optional(),
    links: z.array(cortexPageEditLinkInputSchema).optional(),
    slug: z.string().trim().min(1).optional(),
    status: cortexPageStatusSchema.optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    timelineEntries: z.array(cortexPageEditTimelineEntryInputSchema).optional(),
    title: z.string().trim().min(1),
    type: cortexPageTypeSchema.default('note'),
});

export const cortexArchivePageInputSchema = cortexPageEditBaseSchema.extend({
    action: z.literal('archive'),
    slugOrId: z.string().trim().min(1),
});

export const cortexDeletePageInputSchema = cortexPageEditBaseSchema.extend({
    action: z.literal('delete'),
    slugOrId: z.string().trim().min(1),
});

export const cortexMergePageInputSchema = cortexPageEditBaseSchema.extend({
    action: z.literal('merge'),
    sourceSlugOrId: z.string().trim().min(1),
    targetSlugOrId: z.string().trim().min(1),
});

export const cortexSplitPageInputSchema = cortexPageEditBaseSchema.extend({
    action: z.literal('split'),
    sourceSlugOrId: z.string().trim().min(1),
    pages: z.array(cortexUpsertPageInputSchema.omit({ action: true, source: true })).min(1),
});

export const cortexNoopPageInputSchema = cortexPageEditBaseSchema.extend({
    action: z.literal('noop'),
    reason: z.string().trim().min(1),
});

export const cortexEditPageInputSchema = z.discriminatedUnion('action', [
    cortexArchivePageInputSchema,
    cortexDeletePageInputSchema,
    cortexMergePageInputSchema,
    cortexNoopPageInputSchema,
    cortexSplitPageInputSchema,
    cortexUpsertPageInputSchema,
]);

export const cortexPageIndexingStatusSchema = z.enum(['ready', 'needs-indexing', 'not-indexed']);

export const cortexPageIndexingSchema = z.object({
    chunkCount: z.number().int().nonnegative(),
    currentEmbeddingCount: z.number().int().nonnegative(),
    embeddingModel: cortexEmbeddingModelSchema,
    embeddingProvider: cortexEmbeddingProviderSchema,
    lastEmbeddedAt: z.string().datetime().nullable(),
    missingEmbeddingCount: z.number().int().nonnegative(),
    staleEmbeddingCount: z.number().int().nonnegative(),
    status: cortexPageIndexingStatusSchema,
});

export const cortexPageSchema = cortexPageSummarySchema.extend({
    body: z.string(),
    compiledTruth: z.string(),
    claims: z.array(cortexClaimSchema).default([]),
    createdAt: z.string().datetime(),
    frontmatter: z.record(z.string(), z.unknown()).default({}),
    indexing: cortexPageIndexingSchema,
    links: z.array(cortexLinkSchema).default([]),
    sourceRefs: z.array(cortexSourceRefSchema).default([]),
    timeline: z.array(cortexTimelineEntrySchema).default([]),
});

export const cortexEditPageResultSchema = z.object({
    auditId: z.string().trim().min(1),
    pages: z.array(cortexPageSchema),
});

export const cortexPageVersionSummarySchema = z.object({
    contentHash: z.string(),
    createdAt: z.string().datetime(),
    id: z.string().trim().min(1),
    pageId: z.string().trim().min(1),
    pageUpdatedAt: z.string().datetime(),
    slug: z.string().trim().min(1),
    status: cortexPageStatusSchema,
    title: z.string().trim().min(1),
    type: cortexPageTypeSchema,
    versionNumber: z.number().int().positive(),
});

export const cortexPageVersionSchema = cortexPageVersionSummarySchema.extend({
    body: z.string(),
    compiledTruth: z.string(),
    frontmatter: z.record(z.string(), z.unknown()).default({}),
    sourceRefs: z.array(cortexSourceRefSchema).default([]),
});

export const cortexPageVersionListSchema = z.object({
    slug: z.string().trim().min(1),
    versions: z.array(cortexPageVersionSummarySchema),
});

export const cortexRevertPageInputSchema = z.object({
    source: cortexPageWriteSourceSchema,
    versionId: z.string().trim().min(1),
});

export const cortexPageListSchema = z.object({
    pages: z.array(
        cortexPageSummarySchema.extend({
            links: z.array(cortexLinkSchema).default([]),
        })
    ),
});

export const cortexSearchInputSchema = z.object({
    explain: z.boolean().default(false),
    limit: z.number().int().positive().max(50).default(10),
    offset: z.number().int().nonnegative().default(0),
    query: z.string().trim().min(1),
    scope: z
        .object({
            agentId: z.string().trim().min(1).nullable().optional(),
            chatId: z.string().trim().min(1).nullable().optional(),
            participantId: z.string().trim().min(1).nullable().optional(),
            profileId: z.string().trim().min(1).nullable().optional(),
        })
        .optional(),
});

export const cortexSearchHitDiagnosticsSchema = z.object({
    createSafety: z.enum(['exists', 'probable', 'unknown']),
    evidence: z.array(z.enum(['alias', 'lexical', 'title', 'vector'])).default([]),
    finalScore: z.number().nonnegative(),
    lexicalScore: z.number().nonnegative(),
    matchedAliases: z.array(z.string().trim().min(1)).default([]),
    rank: z.number().int().positive(),
    vectorScore: z.number().nonnegative().nullable(),
});

export const cortexSearchHitSchema = z.object({
    diagnostics: cortexSearchHitDiagnosticsSchema.optional(),
    page: cortexPageSummarySchema,
    score: z.number().nonnegative(),
    snippet: z.string().default(''),
});

export const cortexSearchResultSchema = z.object({
    diagnostics: z
        .object({
            explain: z.boolean(),
            limit: z.number().int().positive(),
            offset: z.number().int().nonnegative(),
            returnedCount: z.number().int().nonnegative(),
            totalHitCount: z.number().int().nonnegative(),
        })
        .optional(),
    hits: z.array(cortexSearchHitSchema),
    limit: z.number().int().positive().default(10),
    offset: z.number().int().nonnegative().default(0),
    query: z.string().trim().min(1),
    vectorDegradedReason: z.string().nullable().default(null),
});

export const cortexRecallModeSchema = z.enum(['conservative', 'balanced', 'tokenmax']);

export const cortexRecallInputSchema = cortexSearchInputSchema.extend({
    limit: z.number().int().positive().max(50).optional(),
    mode: cortexRecallModeSchema.optional(),
});

export const cortexRecallHitSchema = cortexSearchHitSchema.extend({
    evidence: z.array(cortexSourceRefSchema).default([]),
});

export const cortexRecallResultSchema = z.object({
    auditId: z.string().trim().min(1),
    hits: z.array(cortexRecallHitSchema),
    mode: cortexRecallModeSchema,
    query: z.string().trim().min(1),
    requestedMode: cortexRecallModeSchema.nullable(),
    vectorDegradedReason: z.string().nullable().default(null),
});

export const cortexCaptureInputSchema = z.object({
    content: z.string().trim().min(1),
    source: z.object({
        actorId: z.string().trim().min(1),
        actorKind: z.enum(['agent', 'runtime', 'system', 'user']),
        agentId: z.string().trim().min(1).nullable().optional(),
        chatId: z.string().trim().min(1).nullable().optional(),
        fileId: z.string().trim().min(1).nullable().optional(),
        messageId: z.string().trim().min(1).nullable().optional(),
        participantId: z.string().trim().min(1).nullable().optional(),
        profileId: z.string().trim().min(1).nullable().optional(),
        sessionKey: z.string().trim().min(1).nullable().optional(),
        turnId: z.string().trim().min(1).nullable().optional(),
        url: z.string().trim().min(1).nullable().optional(),
    }),
    tags: z.array(z.string().trim().min(1)).default([]),
    title: z.string().trim().min(1),
    type: cortexPageTypeSchema.default('note'),
});

export const cortexCaptureResultSchema = z.object({
    auditId: z.string().trim().min(1),
    page: cortexPageSchema,
});

export const cortexIngestInputSchema = z.object({
    actor: cortexPageWriteSourceSchema.optional(),
    content: z.string().trim().min(1),
    kind: z.string().trim().min(1),
    locator: z.string().trim().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    tags: z.array(z.string().trim().min(1)).default([]),
    title: z.string().trim().min(1).optional(),
    type: cortexPageTypeSchema.default('source'),
});

export const cortexIngestResultSchema = z.object({
    auditId: z.string().trim().min(1),
    page: cortexPageSchema,
    sourceRef: cortexSourceRefSchema,
});

export const cortexImportKindSchema = z.enum([
    'article',
    'audio',
    'book',
    'document',
    'image',
    'pdf',
    'podcast',
    'repo',
    'screenshot',
    'transcript',
    'video',
    'x-post',
]);

export const cortexImportFileSchema = z.object({
    hash: z.string().trim().min(1),
    id: z.string().trim().min(1),
    mediaType: z.string().trim().min(1).nullable(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    path: z.string().trim().min(1),
});

export const cortexImportInputSchema = z
    .object({
        actor: cortexPageWriteSourceSchema.optional(),
        content: z.string().trim().min(1).optional(),
        kind: cortexImportKindSchema,
        locator: z.string().trim().min(1).optional(),
        mediaType: z.string().trim().min(1).optional(),
        metadata: z.record(z.string(), z.unknown()).default({}),
        rawContentBase64: z.string().trim().min(1).optional(),
        rawFileName: z.string().trim().min(1).optional(),
        tags: z.array(z.string().trim().min(1)).default([]),
        title: z.string().trim().min(1).optional(),
        type: cortexPageTypeSchema.optional(),
    })
    .refine(
        (input) => Boolean(input.content || input.locator || input.rawContentBase64),
        'Provide content, locator, or rawContentBase64.'
    );

export const cortexImportResultSchema = cortexIngestResultSchema.extend({
    files: z.array(cortexImportFileSchema).default([]),
    importKind: cortexImportKindSchema,
    normalizedContent: z.string().trim().min(1),
});

export const cortexBacklinkListSchema = z.object({
    links: z.array(cortexLinkSchema),
    target: z.string().trim().min(1),
});

export const cortexGraphDirectionSchema = z.enum(['both', 'in', 'out']);

export const cortexGraphPathSchema = z.object({
    context: z.string().default(''),
    depth: z.number().int().positive(),
    fromSlug: z.string().trim().min(1),
    linkKind: z.string().trim().min(1),
    toSlug: z.string().trim().min(1),
});

export const cortexGraphTraversalSchema = z.object({
    depth: z.number().int().positive(),
    direction: cortexGraphDirectionSchema,
    paths: z.array(cortexGraphPathSchema),
    root: z.string().trim().min(1),
    type: z.string().trim().min(1).nullable().default(null),
});

export const cortexJobRunSchema = z.object({
    auditId: z.string().trim().min(1),
    completedAt: z.string().datetime(),
    job: cortexJobNameSchema,
    status: cortexAuditStatusSchema,
    summary: z.string().trim().min(1),
});

export const cortexDreamReportStatusSchema = z.enum(['error', 'running', 'skipped', 'success']);

export const cortexDreamReportItemKindSchema = z.enum([
    'citation-added',
    'health',
    'issue-fixed',
    'issue-remaining',
    'noop',
    'page-created',
    'page-updated',
    'pattern-created',
    'phase',
    'relationship-added',
    'summary',
    'warning',
]);

export const cortexDreamReportHealthSchema = z.object({
    counts: z.record(z.string(), z.number().int().nonnegative()).default({}),
    issueCount: z.number().int().nonnegative(),
    score: z.number().int().min(0).max(100),
});

export const cortexDreamReportPhaseSchema = z.object({
    durationMs: z.number().int().nonnegative().nullable().default(null),
    metadata: z.record(z.string(), z.unknown()).default({}),
    name: z.string().trim().min(1),
    status: z.enum(['error', 'skipped', 'success']),
    summary: z.string().trim().min(1),
});

export const cortexDreamReportItemSchema = z.object({
    createdAt: z.string().datetime(),
    id: z.string().trim().min(1),
    kind: cortexDreamReportItemKindSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
    pageId: z.string().trim().min(1).nullable().default(null),
    pageSlug: z.string().trim().min(1).nullable().default(null),
    summary: z.string().trim().min(1),
    title: z.string().trim().min(1),
});

export const cortexDreamReportSchema = z.object({
    completedAt: z.string().datetime().nullable().default(null),
    durationMs: z.number().int().nonnegative().nullable().default(null),
    estimatedCostUsd: z.number().nonnegative().nullable().default(null),
    healthAfter: cortexDreamReportHealthSchema.nullable().default(null),
    healthBefore: cortexDreamReportHealthSchema.nullable().default(null),
    id: z.string().trim().min(1),
    items: z.array(cortexDreamReportItemSchema).default([]),
    model: z.string().trim().min(1).nullable().default(null),
    noops: z.array(z.string()).default([]),
    phases: z.array(cortexDreamReportPhaseSchema).default([]),
    provider: z.string().trim().min(1).nullable().default(null),
    startedAt: z.string().datetime(),
    status: cortexDreamReportStatusSchema,
    summary: z.string().trim().min(1),
    warnings: z.array(z.string()).default([]),
});

export const cortexDreamReportListSchema = z.object({
    reports: z.array(cortexDreamReportSchema),
});

export const cortexRecommendationSchema = z.object({
    action: z.enum([
        'configure-embeddings',
        'inspect-lint',
        'run-cortex-generate-embeddings',
        'run-cortex-repair-derived-state',
        'run-cortex-sync',
    ]),
    count: z.number().int().nonnegative(),
    kind: z.string().trim().min(1),
    severity: z.enum(['error', 'info', 'warning']),
    summary: z.string().trim().min(1),
});

export const cortexSettingsSchema = z.object({
    embedding: z.object({
        apiKey: z.string().nullable(),
        apiKeyConfigured: z.boolean(),
        apiKeySource: z.enum(['environment', 'runtime-settings']).nullable(),
        dimensions: z.number().int().positive(),
        model: cortexEmbeddingModelSchema,
        modelRef: cortexEmbeddingModelRefSchema,
        provider: cortexEmbeddingProviderSchema,
        updatedAt: z.string().datetime().nullable(),
    }),
    models: z.object({
        audioTranscription: cortexChatModelRefSchema,
        chatIngestion: cortexChatModelRefSchema,
        dream: cortexChatModelRefSchema,
        embedding: cortexEmbeddingModelRefSchema,
        ocr: cortexChatModelRefSchema,
        queryExpansion: cortexChatModelRefSchema,
    }),
    recall: z.object({
        mode: cortexRecallModeSchema,
        updatedAt: z.string().datetime().nullable(),
    }),
});

export const cortexSaveSettingsSchema = z.object({
    embedding: z.object({
        apiKey: z
            .string()
            .trim()
            .min(1)
            .refine(isOpenAiApiKey, 'Enter an OpenAI API key.')
            .optional(),
        model: cortexEmbeddingModelSchema.default('text-embedding-3-small'),
        modelRef: cortexEmbeddingModelRefSchema.optional(),
        provider: cortexEmbeddingProviderSchema.default('openai'),
    }),
    models: z
        .object({
            audioTranscription: cortexChatModelRefSchema.optional(),
            chatIngestion: cortexChatModelRefSchema.optional(),
            dream: cortexChatModelRefSchema.optional(),
            embedding: cortexEmbeddingModelRefSchema.optional(),
            ocr: cortexChatModelRefSchema.optional(),
            queryExpansion: cortexChatModelRefSchema.optional(),
        })
        .optional(),
    recall: z
        .object({
            mode: cortexRecallModeSchema.default('balanced'),
        })
        .optional(),
});

export const cortexStatusSchema = z.object({
    auditCount: z.number().int().nonnegative(),
    captureCount: z.number().int().nonnegative(),
    chunkCount: z.number().int().nonnegative(),
    claimCount: z.number().int().nonnegative(),
    databasePath: z.string().trim().min(1),
    encoding: z.object({
        currentCount: z.number().int().nonnegative(),
        dimensions: z.number().int().positive(),
        model: z.string().trim().min(1),
        provider: z.string().trim().min(1),
        staleCount: z.number().int().nonnegative(),
        totalCount: z.number().int().nonnegative(),
    }),
    jobRuns: z.array(cortexJobRunSchema).default([]),
    lastCaptureAt: z.string().datetime().nullable(),
    lastRecallAt: z.string().datetime().nullable(),
    lastRepairAt: z.string().datetime().nullable(),
    linkCount: z.number().int().nonnegative(),
    pageCount: z.number().int().nonnegative(),
    recommendations: z.array(cortexRecommendationSchema).default([]),
    sourceCount: z.number().int().nonnegative(),
    timelineEntryCount: z.number().int().nonnegative(),
    vectorIndex: z.object({
        backend: z.string().trim().min(1),
        degradedReason: z.string().trim().min(1).nullable(),
        indexedCount: z.number().int().nonnegative(),
        path: z.string().trim().min(1),
        table: z.string().trim().min(1),
    }),
    wikiPath: z.string().trim().min(1),
});

export const agentRuntimeCronDeliverySchema = z.object({
    chatId: z.string().trim().min(1),
});

export const agentRuntimeExecutionStatusSchema = z.enum([
    'queued',
    'running',
    'success',
    'error',
    'skipped',
]);

export const agentRuntimeExecutionErrorCodeSchema = z.enum([
    'agent_not_found',
    'execution_failed',
    'control_plane_restarted',
]);

export const agentRuntimeExecutionErrorSchema = z.object({
    code: agentRuntimeExecutionErrorCodeSchema,
    message: z.string().trim().min(1),
});

export const agentRuntimeCronStateSchema = z.object({
    consecutiveErrors: z.number().int().nonnegative().optional(),
    lastDelivered: z.boolean().optional(),
    lastClaimedAtMs: z.number().int().nonnegative().optional(),
    lastDeliveryError: z.string().optional(),
    lastDeliveryStatus: z
        .enum([
            'pending',
            'delivered',
            'session_queued',
            'failed',
            'parent_missing',
            'not_applicable',
        ])
        .optional(),
    lastDurationMs: z.number().int().nonnegative().optional(),
    lastErrorCode: agentRuntimeExecutionErrorSchema.shape.code.optional(),
    lastErrorMessage: agentRuntimeExecutionErrorSchema.shape.message.optional(),
    lastRunAtMs: z.number().int().nonnegative().optional(),
    lastRunStatus: agentRuntimeExecutionStatusSchema.optional(),
    lastScheduledAtMs: z.number().int().nonnegative().optional(),
    lastStatus: agentRuntimeExecutionStatusSchema.optional(),
    nextRunAtMs: z.number().int().nonnegative().optional(),
    runningAtMs: z.number().int().nonnegative().optional(),
});

export const agentRuntimeCronPayloadSchema = z.union([
    z.object({
        kind: z.literal('systemEvent'),
        text: z.string().trim().min(1),
    }),
    z.object({
        fallbacks: z.array(z.string().trim().min(1)).optional(),
        kind: z.literal('agentTurn'),
        lightContext: z.boolean().optional(),
        message: z.string().trim().min(1),
        model: z.string().trim().min(1).optional(),
        thinking: z.string().nullable().optional(),
        timeoutSeconds: z.number().nonnegative().optional(),
    }),
]);

export const agentRuntimeCronScheduleSchema = z.union([
    z.object({
        at: z.string().trim().min(1),
        kind: z.literal('at'),
    }),
    z.object({
        everyMs: z.number().int().positive(),
        kind: z.literal('every'),
    }),
    z.object({
        expr: z.string().trim().min(1),
        kind: z.literal('cron'),
        tz: z.string().trim().min(1).optional(),
    }),
]);

export const agentRuntimeCronWakeModeSchema = z.enum(['next-heartbeat', 'now']);

export const agentRuntimeCronSummarySchema = z.object({
    agentId: z.string().trim().min(1).nullable(),
    description: z.string().nullable(),
    enabled: z.boolean(),
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    schedule: agentRuntimeCronScheduleSchema,
    state: agentRuntimeCronStateSchema,
    updatedAt: z.string().datetime(),
});

export const agentRuntimeCronSchema = agentRuntimeCronSummarySchema.extend({
    createdAt: z.string().datetime(),
    deleteAfterRun: z.boolean(),
    delivery: agentRuntimeCronDeliverySchema.nullable(),
    payload: agentRuntimeCronPayloadSchema,
    wakeMode: agentRuntimeCronWakeModeSchema,
});

export const agentRuntimeCronListSchema = z.object({
    jobs: z.array(agentRuntimeCronSummarySchema),
});

export const agentRuntimeCreateCronSchema = z.object({
    agentId: z.string().trim().min(1).nullable().optional(),
    deleteAfterRun: z.boolean().optional(),
    delivery: agentRuntimeCronDeliverySchema.nullable().optional(),
    description: z.string().trim().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    payload: agentRuntimeCronPayloadSchema,
    schedule: agentRuntimeCronScheduleSchema,
    wakeMode: agentRuntimeCronWakeModeSchema,
});

export const agentRuntimeUpdateCronSchema = z.object({
    agentId: z.string().trim().min(1).nullable().optional(),
    deleteAfterRun: z.boolean().optional(),
    delivery: agentRuntimeCronDeliverySchema.nullable().optional(),
    description: z.string().trim().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    name: z.string().trim().min(1).optional(),
    payload: agentRuntimeCronPayloadSchema.optional(),
    schedule: agentRuntimeCronScheduleSchema.optional(),
    state: agentRuntimeCronStateSchema.partial().optional(),
    wakeMode: agentRuntimeCronWakeModeSchema.optional(),
});

export const agentRuntimeArchiveCronSchema = z.object({
    archived: z.literal(true),
    id: z.string().trim().min(1),
});

export const agentRuntimeCronRunStatusSchema = agentRuntimeExecutionStatusSchema;

export const agentRuntimeCronRunTriggerSchema = z.enum(['manual', 'recovery', 'retry', 'schedule']);

export const agentRuntimeCronRunSchema = z.object({
    deliveryError: z.string().nullable(),
    deliveryStatus: agentRuntimeCronStateSchema.shape.lastDeliveryStatus.nullable(),
    executionErrorCode: agentRuntimeExecutionErrorSchema.shape.code.nullable(),
    executionErrorMessage: agentRuntimeExecutionErrorSchema.shape.message.nullable(),
    finishedAt: z.string().datetime().nullable(),
    id: z.string().trim().min(1),
    jobId: z.string().trim().min(1),
    scheduledFor: z.string().datetime(),
    sessionId: z.string().trim().min(1).nullable(),
    sessionKey: z.string().trim().min(1).nullable(),
    startedAt: z.string().datetime().nullable(),
    status: agentRuntimeCronRunStatusSchema,
    summary: z.string().nullable(),
    trigger: agentRuntimeCronRunTriggerSchema,
});

export const agentRuntimeCronRunListSchema = z.object({
    runs: z.array(agentRuntimeCronRunSchema),
});

export const agentRuntimeRunCronSchema = z.object({
    mode: z.enum(['enqueue', 'force']).default('force'),
});

export const agentRuntimeJobSlugSchema = z.enum([
    'cortex-dream',
    'cortex-generate-embeddings',
    'cortex-lint',
    'cortex-repair-derived-state',
    'cortex-chat-ingestion',
    'cortex-sync',
    'refresh-runtime-capabilities',
    'tavern-highlights',
]);

export const agentRuntimeJobAvailabilitySchema = z.enum(['disabled', 'enabled']);

export const agentRuntimeJobRunStateSchema = z.enum([
    'active',
    'completed',
    'delayed',
    'failed',
    'unknown',
    'waiting',
]);

export const agentRuntimeJobCountsSchema = z.object({
    active: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    delayed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    waiting: z.number().int().nonnegative(),
});

export const agentRuntimeJobScheduleSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('manual'),
    }),
    z.object({
        everyMs: z.number().int().positive(),
        kind: z.literal('interval'),
        nextRunAt: z.string().datetime().nullable(),
        runOnStart: z.boolean(),
    }),
]);

export const agentRuntimeJobRunSummarySchema = z.object({
    attemptsMade: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    durationMs: z.number().int().nonnegative().nullable(),
    error: z.string().nullable(),
    finishedAt: z.string().datetime().nullable(),
    id: z.string().trim().min(1),
    progress: z.number().int().nonnegative(),
    startedAt: z.string().datetime().nullable(),
    state: agentRuntimeJobRunStateSchema,
});

export const agentRuntimeJobRunDetailSchema = agentRuntimeJobRunSummarySchema.extend({
    logs: z.array(z.string()),
});

export const agentRuntimeJobSummarySchema = z.object({
    availability: agentRuntimeJobAvailabilitySchema,
    counts: agentRuntimeJobCountsSchema,
    description: z.string().trim().min(1),
    disabledReason: z.string().trim().min(1).nullable().default(null),
    displayName: z.string().trim().min(1),
    latestRun: agentRuntimeJobRunSummarySchema.nullable(),
    queueName: z.string().trim().min(1),
    schedule: agentRuntimeJobScheduleSchema,
    slug: agentRuntimeJobSlugSchema,
});

export const agentRuntimeJobDetailSchema = agentRuntimeJobSummarySchema.extend({
    recentRuns: z.array(agentRuntimeJobRunDetailSchema),
});

export const agentRuntimeJobListSchema = z.object({
    jobs: z.array(agentRuntimeJobSummarySchema),
});

export const agentRuntimeRunJobInputSchema = z
    .object({
        payload: z.record(z.string(), z.unknown()).optional(),
    })
    .default({});

export const agentRuntimeRunJobSchema = z.object({
    jobId: z.string().trim().min(1),
});

export const agentRuntimeHighlightCategorySchema = z.enum([
    'memory_saved',
    'quest_finished',
    'scheduled_run',
    'tool_volume',
    'trouble',
]);

export const agentRuntimeHighlightSourceRefSchema = z.object({
    id: z.string().trim().min(1),
    type: z.enum(['chatResponse', 'cortexAudit', 'cortexCapture', 'cronRun', 'responseActivity']),
});

export const agentRuntimeHighlightSchema = z.object({
    category: agentRuntimeHighlightCategorySchema,
    expiresAt: z.string().datetime(),
    generatedAt: z.string().datetime(),
    headline: z.string().trim().min(1),
    id: z.string().trim().min(1),
    metric: z.record(z.string(), z.unknown()).default({}),
    receipt: z.string().trim().min(1),
    sourceRefs: z.array(agentRuntimeHighlightSourceRefSchema).default([]),
    windowEnd: z.string().datetime(),
    windowStart: z.string().datetime(),
});

export const agentRuntimeHighlightFreshnessSchema = z.object({
    generatedAt: z.string().datetime().nullable(),
    nextRefreshAt: z.string().datetime().nullable(),
    staleReason: z.string().trim().min(1).nullable(),
    status: z.enum(['degraded', 'empty', 'fresh', 'stale']),
});

export const agentRuntimeHighlightListSchema = z.object({
    freshness: agentRuntimeHighlightFreshnessSchema,
    highlights: z.array(agentRuntimeHighlightSchema),
});

export const agentRuntimeSessionRoleSchema = z.enum(['main', 'worker']);

export const agentRuntimeSessionSchema = z.object({
    agentId: z.string().trim().min(1),
    chatId: z.string().trim().min(1),
    key: z.string().trim().min(1),
    lastActivityAt: z.string().datetime().nullable(),
    messageCount: z.number().int().nonnegative(),
    parentSessionKey: z.string().trim().min(1).nullable(),
    platform: z.string().trim().min(1),
    sessionId: z.string().trim().min(1),
    sessionRole: agentRuntimeSessionRoleSchema,
    startedAt: z.string().datetime().nullable(),
    title: z.string().trim().min(1).nullable(),
});

export const agentRuntimeSessionListSchema = z.object({
    sessions: z.array(agentRuntimeSessionSchema),
});

export const agentRuntimeSessionLinkSchema = z.object({
    childSessionKey: z.string().trim().min(1),
    createdAt: z.string().datetime(),
    id: z.string().trim().min(1),
    linkType: z.string().trim().min(1),
    parentSessionKey: z.string().trim().min(1),
    sourceToolCallId: z.string().trim().min(1).nullable(),
});

export const agentRuntimeSessionToolCallSchema = z.object({
    arguments: z.unknown().nullable(),
    childSessionKey: z.string().trim().min(1).nullable(),
    finishedAt: z.string().datetime().nullable(),
    id: z.string().trim().min(1),
    isError: z.boolean().nullable(),
    messageId: z.string().trim().min(1).nullable(),
    result: z.unknown().nullable(),
    sessionKey: z.string().trim().min(1),
    startedAt: z.string().datetime().nullable(),
    toolCallId: z.string().trim().min(1).nullable(),
    toolName: z.string().trim().min(1),
});

export const agentRuntimeSessionArtifactSchema = z.object({
    artifactType: z.string().trim().min(1),
    createdAt: z.string().datetime(),
    id: z.string().trim().min(1),
    messageId: z.string().trim().min(1).nullable(),
    mimeType: z.string().trim().min(1).nullable(),
    path: z.string().trim().min(1).nullable(),
    payload: z.unknown().nullable(),
    runId: z.string().trim().min(1).nullable(),
    sessionKey: z.string().trim().min(1),
    toolCallId: z.string().trim().min(1).nullable(),
});

export const agentRuntimeMentionProjectionSchema = z.enum([
    'capability-reference',
    'image-input',
    'path-reference',
    'skill-context',
]);

export const agentRuntimeMentionSchema = z
    .object({
        end: z.number().int().nonnegative(),
        id: z.string().trim().min(1),
        kind: z.enum(['app', 'directory', 'file', 'image', 'plugin', 'skill']),
        label: z.string().trim().min(1),
        metadata: z.record(z.string(), z.unknown()).optional(),
        projection: agentRuntimeMentionProjectionSchema,
        start: z.number().int().nonnegative(),
        text: z.string().min(1),
    })
    .refine((value) => value.end > value.start, {
        message: 'Mention end offset must be greater than start offset.',
        path: ['end'],
    });

export const agentRuntimeTavernMessageMetadataSchema = z
    .object({
        mentions: z.array(agentRuntimeMentionSchema).optional(),
    })
    .passthrough();

export const agentRuntimeMessageMetadataSchema = z
    .object({
        api: z.string().trim().min(1).nullable().optional(),
        tavern: agentRuntimeTavernMessageMetadataSchema.optional(),
        cacheReadTokens: z.number().int().nonnegative().nullable().optional(),
        cacheWriteTokens: z.number().int().nonnegative().nullable().optional(),
        inputTokens: z.number().int().nonnegative().nullable().optional(),
        isError: z.boolean().nullable().optional(),
        model: z.string().trim().min(1).optional(),
        openClawApi: z.string().trim().min(1).optional(),
        openClawHarness: z.enum(['pi', 'codex']).optional(),
        openClawModel: z.string().trim().min(1).optional(),
        openClawProvider: z.string().trim().min(1).optional(),
        outputTokens: z.number().int().nonnegative().nullable().optional(),
        parts: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
        provider: agentRuntimeModelProviderIdSchema.optional(),
        stopReason: z.string().trim().min(1).nullable().optional(),
        totalTokens: z.number().int().nonnegative().nullable().optional(),
        toolCallId: z.string().trim().min(1).nullable().optional(),
        toolName: z.string().trim().min(1).nullable().optional(),
        toolResult: z.unknown().optional(),
        usage: z.unknown().optional(),
    })
    .superRefine((value, context) => {
        const hasModel = typeof value.model === 'string';
        const hasProvider = typeof value.provider === 'string';

        if (hasModel === hasProvider) {
            return;
        }

        context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
                'Agent Runtime message metadata model identity must include model and provider together.',
            path: ['model'],
        });
    });

export const agentRuntimeInlineAttachmentSchema = z.object({
    type: z.literal('inline'),
    dataBase64: z.string(),
    filename: z.string().trim().min(1),
    height: z.number().int().positive().nullable().optional(),
    mediaType: z.string().trim().min(1),
    sizeBytes: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable().optional(),
});

export const agentRuntimeFileAttachmentSchema = z.object({
    type: z.literal('file'),
    filename: z.string().trim().min(1),
    mediaType: z.string().trim().min(1).nullable().optional(),
    path: z.string().trim().min(1),
    sizeBytes: z.number().int().nonnegative().nullable().optional(),
    uri: z.string().trim().min(1).nullable().optional(),
});

export const agentRuntimeSessionMessageAttachmentSchema = z.discriminatedUnion('type', [
    agentRuntimeInlineAttachmentSchema,
    agentRuntimeFileAttachmentSchema,
]);

export const agentRuntimeSessionMessageSchema = z.object({
    agentId: z.string().trim().min(1).nullable(),
    attachments: z.array(agentRuntimeSessionMessageAttachmentSchema).optional(),
    chatId: z.string().trim().min(1),
    content: z.string(),
    id: z.string().trim().min(1),
    metadata: agentRuntimeMessageMetadataSchema.nullable().optional(),
    participant: agentRuntimeChatObservedParticipantSchema.nullable().optional(),
    sender: z.string().trim().min(1),
    senderName: z.string().trim().min(1),
    senderType: z.enum(['agent', 'system', 'user']),
    sessionKey: z.string().trim().min(1),
    timestamp: z.string().datetime(),
});

export const agentRuntimeSessionMessageListSchema = z.object({
    messages: z.array(agentRuntimeSessionMessageSchema),
});

export const agentRuntimeSessionPreviewItemSchema = z.object({
    role: z.string().trim().min(1),
    text: z.string(),
});

export const agentRuntimeSessionPreviewSchema = z.object({
    items: z.array(agentRuntimeSessionPreviewItemSchema),
    key: z.string().trim().min(1),
    status: z.enum(['empty', 'error', 'missing', 'ok']),
});

export const agentRuntimeSessionPreviewListSchema = z.object({
    previews: z.array(agentRuntimeSessionPreviewSchema),
    ts: z.number().int().nonnegative().optional(),
});

export const agentRuntimeSessionPromptSectionSchema = z.object({
    content: z.string(),
    id: z.string().trim().min(1),
    kind: z.enum(['base', 'identity', 'mcp', 'module', 'project', 'routing', 'skill']),
    label: z.string().trim().min(1),
});

export const agentRuntimeSessionPromptSchema = z.object({
    assistantName: z.string().trim().min(1).nullable(),
    fullText: z.string(),
    generatedAt: z.string().datetime(),
    provider: z.string().trim().min(1),
    sections: z.array(agentRuntimeSessionPromptSectionSchema),
});

export const agentRuntimeSessionGraphSchema = z.object({
    artifacts: z.array(agentRuntimeSessionArtifactSchema),
    links: z.array(agentRuntimeSessionLinkSchema),
    messages: z.array(agentRuntimeSessionMessageSchema),
    rootSessionKey: z.string().trim().min(1),
    sessions: z.array(agentRuntimeSessionSchema),
    toolCalls: z.array(agentRuntimeSessionToolCallSchema),
});

export const agentRuntimeSessionResyncSchema = z.object({
    resynced: z.literal(true),
    rootSessionKey: z.string().trim().min(1),
    sessionKey: z.string().trim().min(1),
});

export const chatTargetSchema = z.object({
    externalId: z.string().trim().min(1).nullable(),
    sessionKey: z.string().trim().min(1).nullable().optional(),
    target: z.string().trim().min(1),
    type: z.string().trim().min(1),
});

export const agentRuntimeCreateMessageSchema = z.object({
    agent: agentRuntimeAgentBindingSchema,
    message: z.object({
        content: z.string().trim().min(1),
        id: z.string().trim().min(1),
        metadata: agentRuntimeMessageMetadataSchema.optional(),
        nonce: z.string().trim().min(1).optional(),
        parentMessageId: z.string().trim().min(1).nullable().optional(),
        threadRootId: z.string().trim().min(1).nullable().optional(),
    }),
    target: chatTargetSchema,
});

export const agentRuntimeMessageAcceptedSchema = z.object({
    acceptedAt: z.string().datetime(),
    cursor: z.number().int().positive().optional(),
    messageId: z.string().trim().min(1).optional(),
    nonce: z.string().trim().min(1).optional(),
    runId: z.string().trim().min(1),
    sequence: z.number().int().positive().optional(),
    sessionKey: z.string().trim().min(1).nullable(),
    status: z.literal('accepted'),
});

export const tavernChannelConversationSchema = z.object({
    id: z.string().trim().min(1),
    kind: z.enum(['channel', 'dm', 'thread']),
    label: z.string().trim().min(1).nullable(),
    parentId: z.string().trim().min(1).nullable().optional(),
    threadRootId: z.string().trim().min(1).nullable().optional(),
});

export const tavernChannelMessageSchema = z.object({
    attachments: z.array(z.unknown()).default([]),
    author: z
        .object({
            id: z.string().trim().min(1),
            name: z.string().trim().min(1),
        })
        .optional(),
    id: z.string().trim().min(1),
    metadata: agentRuntimeMessageMetadataSchema.optional(),
    nonce: z.string().trim().min(1).optional(),
    parentMessageId: z.string().trim().min(1).nullable().optional(),
    senderId: z.string().trim().min(1),
    senderName: z.string().trim().min(1),
    sequence: z.number().int().positive().optional(),
    text: z.string().trim().min(1),
    threadRootId: z.string().trim().min(1).nullable().optional(),
    timestamp: z.string().datetime(),
});

export const tavernChannelInboundMessageSchema = z.object({
    accountId: z.string().trim().min(1),
    agentId: z.string().trim().min(1),
    conversation: tavernChannelConversationSchema,
    cursor: z.number().int().nonnegative(),
    kind: z.literal('inbound-message'),
    message: tavernChannelMessageSchema,
    requestId: z.string().trim().min(1),
    sessionKey: z.string().trim().min(1),
    turnId: z.string().trim().min(1).optional(),
});

export const tavernChannelMessageAcceptedFrameSchema = z.object({
    accepted: agentRuntimeMessageAcceptedSchema,
    kind: z.literal('message-accepted'),
    requestId: z.string().trim().min(1),
});

export const tavernChannelRuntimeLogFrameSchema = z.object({
    event: z.string().trim().min(1),
    kind: z.literal('runtime-log'),
    payload: z.record(z.string(), z.unknown()).default({}),
});

export const tavernChannelClientFrameSchema = z.discriminatedUnion('kind', [
    tavernChannelMessageAcceptedFrameSchema,
    tavernChannelRuntimeLogFrameSchema,
]);

export const agentRuntimeTurnSchema = z.object({
    agentId: z.string().trim().min(1),
    chatId: z.string().trim().min(1),
    runId: z.string().trim().min(1),
    sessionKey: z.string().trim().min(1),
    startedAt: z.string().datetime(),
});

export const agentRuntimeTurnProgressStatusSchema = z.enum(['active', 'completed', 'failed']);

export const agentRuntimeTurnProgressStepSchema = z.object({
    detail: z.string().trim().min(1).nullable().optional(),
    id: z.string().trim().min(1),
    kind: z.enum(['approval', 'artifact', 'command', 'message', 'plan', 'reasoning', 'tool']),
    label: z.string().trim().min(1),
    status: agentRuntimeTurnProgressStatusSchema,
    toolCallId: z.string().trim().min(1).nullable().optional(),
    toolName: z.string().trim().min(1).nullable().optional(),
});

export const agentRuntimeEventTypeSchema = z.enum([
    'agent.updated',
    'chat.messageAccepted',
    'chat.read',
    'model.updated',
    'workspace.instructions.updated',
    'skill.updated',
    'skill.deleted',
    'cron.updated',
    'cron.deleted',
    'cron.runStarted',
    'cron.runFinished',
    'turn.started',
    'turn.progress',
    'turn.replyUpdated',
    'turn.steered',
    'turn.completed',
    'turn.failed',
    'session.invalidated',
    'session.updated',
]);

export const agentRuntimeAgentUpdatedEventSchema = z.object({
    agentId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('agent.updated'),
});

export const agentRuntimeChatAcceptedMessageSchema = z.object({
    id: z.string().trim().min(1),
    nonce: z.string().trim().min(1).optional(),
    parentMessageId: z.string().trim().min(1).nullable().optional(),
    senderId: z.string().trim().min(1),
    senderName: z.string().trim().min(1),
    sequence: z.number().int().positive(),
    text: z.string().trim().min(1),
    threadRootId: z.string().trim().min(1).nullable().optional(),
    timestamp: z.string().datetime(),
});

export const agentRuntimeChatMessageAcceptedEventSchema = z.object({
    agentId: z.string().trim().min(1),
    chatId: z.string().trim().min(1),
    message: agentRuntimeChatAcceptedMessageSchema,
    runId: z.string().trim().min(1),
    sessionKey: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('chat.messageAccepted'),
});

export const agentRuntimeChatReadEventSchema = z.object({
    agentId: z.string().trim().min(1).nullable().optional(),
    chatId: z.string().trim().min(1),
    lastReadSequence: z.number().int().positive(),
    readerId: z.string().trim().min(1),
    sessionKey: z.string().trim().min(1).nullable().optional(),
    timestamp: z.string().datetime(),
    type: z.literal('chat.read'),
});

export const agentRuntimeModelUpdatedEventSchema = z.object({
    timestamp: z.string().datetime(),
    type: z.literal('model.updated'),
});

export const agentRuntimeWorkspaceInstructionsUpdatedEventSchema = z.object({
    agentId: z.string().trim().min(1),
    path: z.literal('AGENTS.md'),
    renderedAt: z.string().datetime(),
    sha256: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('workspace.instructions.updated'),
});

export const agentRuntimeSkillUpdatedEventSchema = z.object({
    skillId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('skill.updated'),
});

export const agentRuntimeSkillDeletedEventSchema = z.object({
    skillId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('skill.deleted'),
});

export const agentRuntimeCronUpdatedEventSchema = z.object({
    cronJobId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('cron.updated'),
});

export const agentRuntimeCronDeletedEventSchema = z.object({
    cronJobId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('cron.deleted'),
});

export const agentRuntimeCronRunStartedEventSchema = z.object({
    cronJobId: z.string().trim().min(1),
    runId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('cron.runStarted'),
});

export const agentRuntimeCronRunFinishedEventSchema = z.object({
    cronJobId: z.string().trim().min(1),
    runId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('cron.runFinished'),
});

export const agentRuntimeCapabilityUpdatedEventSchema = z.object({
    capability: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('capability.updated'),
});

export const agentRuntimeTurnStartedEventSchema = z.object({
    timestamp: z.string().datetime(),
    turn: agentRuntimeTurnSchema,
    type: z.literal('turn.started'),
});

export const agentRuntimeTurnReplyUpdatedEventSchema = z.object({
    delta: z.string().optional(),
    isThinking: z.boolean().optional(),
    replace: z.boolean().optional(),
    text: z.string(),
    timestamp: z.string().datetime(),
    turn: agentRuntimeTurnSchema,
    type: z.literal('turn.replyUpdated'),
});

export const agentRuntimeTurnCompletedEventSchema = z.object({
    timestamp: z.string().datetime(),
    turn: agentRuntimeTurnSchema,
    type: z.literal('turn.completed'),
});

export const agentRuntimeTurnSteeredEventSchema = z.object({
    message: z.string().trim().min(1).nullable().optional(),
    requestMessageId: z.string().trim().min(1).nullable().optional(),
    timestamp: z.string().datetime(),
    turn: agentRuntimeTurnSchema,
    type: z.literal('turn.steered'),
});

export const agentRuntimeTurnProgressEventSchema = z.object({
    step: agentRuntimeTurnProgressStepSchema,
    timestamp: z.string().datetime(),
    turn: agentRuntimeTurnSchema,
    type: z.literal('turn.progress'),
});

export const agentRuntimeTurnFailedEventSchema = z.object({
    error: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    turn: agentRuntimeTurnSchema,
    type: z.literal('turn.failed'),
});

export const agentRuntimeSessionInvalidatedEventSchema = z.object({
    sessionKey: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('session.invalidated'),
});

export const agentRuntimeSessionUpdatedEventSchema = z.object({
    session: agentRuntimeSessionSchema,
    timestamp: z.string().datetime(),
    type: z.literal('session.updated'),
});

export const agentRuntimeEventSchema = z.discriminatedUnion('type', [
    agentRuntimeAgentUpdatedEventSchema,
    agentRuntimeChatMessageAcceptedEventSchema,
    agentRuntimeChatReadEventSchema,
    agentRuntimeModelUpdatedEventSchema,
    agentRuntimeWorkspaceInstructionsUpdatedEventSchema,
    agentRuntimeSkillUpdatedEventSchema,
    agentRuntimeSkillDeletedEventSchema,
    agentRuntimeCronUpdatedEventSchema,
    agentRuntimeCronDeletedEventSchema,
    agentRuntimeCronRunStartedEventSchema,
    agentRuntimeCronRunFinishedEventSchema,
    agentRuntimeCapabilityUpdatedEventSchema,
    agentRuntimeTurnStartedEventSchema,
    agentRuntimeTurnProgressEventSchema,
    agentRuntimeTurnReplyUpdatedEventSchema,
    agentRuntimeTurnSteeredEventSchema,
    agentRuntimeTurnCompletedEventSchema,
    agentRuntimeTurnFailedEventSchema,
    agentRuntimeSessionInvalidatedEventSchema,
    agentRuntimeSessionUpdatedEventSchema,
]);

export const agentRuntimeEventListSchema = z.object({
    events: z.array(agentRuntimeEventSchema),
});

export const agentRuntimeErrorSchema = z.object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    retryable: z.boolean(),
});

export type ChatTarget = z.infer<typeof chatTargetSchema>;
export type AgentRuntimeAgent = z.infer<typeof agentRuntimeAgentSchema>;
export type AgentRuntimeAgentBinding = z.infer<typeof agentRuntimeAgentBindingSchema>;
export type AgentRuntimeAgentList = z.infer<typeof agentRuntimeAgentListSchema>;
export type AgentRuntimeArchiveAgent = z.infer<typeof agentRuntimeArchiveAgentSchema>;
export type AgentRuntimeArchiveBinding = z.infer<typeof agentRuntimeArchiveBindingSchema>;
export type AgentRuntimeArchiveCron = z.infer<typeof agentRuntimeArchiveCronSchema>;
export type AgentRuntimeArchiveSkill = z.infer<typeof agentRuntimeArchiveSkillSchema>;
export type AgentRuntimeCapability = z.infer<typeof agentRuntimeCapabilitySchema>;
export type AgentRuntimeCreateAgent = z.infer<typeof agentRuntimeCreateAgentSchema>;
export type AgentRuntimeAgentFile = z.infer<typeof agentRuntimeAgentFileSchema>;
export type AgentRuntimeAgentFileContent = z.infer<typeof agentRuntimeAgentFileContentSchema>;
export type AgentRuntimeAgentFileList = z.infer<typeof agentRuntimeAgentFileListSchema>;
export type AgentRuntimeSaveAgentFile = z.infer<typeof agentRuntimeSaveAgentFileSchema>;
export type AgentRuntimeCreateCron = z.infer<typeof agentRuntimeCreateCronSchema>;
export type AgentRuntimeAgentUpdatedEvent = z.infer<typeof agentRuntimeAgentUpdatedEventSchema>;
export type AgentRuntimeChatMessageAcceptedEvent = z.infer<
    typeof agentRuntimeChatMessageAcceptedEventSchema
>;
export type AgentRuntimeChatReadEvent = z.infer<typeof agentRuntimeChatReadEventSchema>;
export type AgentRuntimeCron = z.infer<typeof agentRuntimeCronSchema>;
export type AgentRuntimeCronDeletedEvent = z.infer<typeof agentRuntimeCronDeletedEventSchema>;
export type AgentRuntimeCronList = z.infer<typeof agentRuntimeCronListSchema>;
export type AgentRuntimeCronPayload = z.infer<typeof agentRuntimeCronPayloadSchema>;
export type AgentRuntimeCronRun = z.infer<typeof agentRuntimeCronRunSchema>;
export type AgentRuntimeCronRunFinishedEvent = z.infer<
    typeof agentRuntimeCronRunFinishedEventSchema
>;
export type AgentRuntimeCronRunList = z.infer<typeof agentRuntimeCronRunListSchema>;
export type AgentRuntimeCronRunStartedEvent = z.infer<typeof agentRuntimeCronRunStartedEventSchema>;
export type AgentRuntimeCronRunStatus = z.infer<typeof agentRuntimeCronRunStatusSchema>;
export type AgentRuntimeCronRunTrigger = z.infer<typeof agentRuntimeCronRunTriggerSchema>;
export type AgentRuntimeCronSchedule = z.infer<typeof agentRuntimeCronScheduleSchema>;
export type AgentRuntimeCronState = z.infer<typeof agentRuntimeCronStateSchema>;
export type AgentRuntimeCronSummary = z.infer<typeof agentRuntimeCronSummarySchema>;
export type AgentRuntimeCronUpdatedEvent = z.infer<typeof agentRuntimeCronUpdatedEventSchema>;
export type AgentRuntimeExecutionError = z.infer<typeof agentRuntimeExecutionErrorSchema>;
export type AgentRuntimeExecutionErrorCode = z.infer<typeof agentRuntimeExecutionErrorCodeSchema>;
export type AgentRuntimeExecutionStatus = z.infer<typeof agentRuntimeExecutionStatusSchema>;
export type AgentRuntimeEvent = z.infer<typeof agentRuntimeEventSchema>;
export type AgentRuntimeEventList = z.infer<typeof agentRuntimeEventListSchema>;
export type AgentRuntimeEventType = z.infer<typeof agentRuntimeEventTypeSchema>;
export type AgentRuntimeError = z.infer<typeof agentRuntimeErrorSchema>;
export type AgentRuntimeChat = z.infer<typeof agentRuntimeChatSchema>;
export type AgentRuntimeChatBinding = z.infer<typeof agentRuntimeChatBindingSchema>;
export type AgentRuntimeChatList = z.infer<typeof agentRuntimeChatListSchema>;
export type AgentRuntimeChatParticipant = z.infer<typeof agentRuntimeChatParticipantSchema>;
export type AgentRuntimeChatPlatformMetadata = z.infer<
    typeof agentRuntimeChatPlatformMetadataSchema
>;
export type AgentRuntimeTavernChatMetadata = z.infer<typeof agentRuntimeTavernChatMetadataSchema>;
export type AgentRuntimeTavernChatSourceRecord = z.infer<
    typeof agentRuntimeTavernChatSourceRecordSchema
>;
export type AgentRuntimeDiscordChatMetadata = z.infer<typeof agentRuntimeDiscordChatMetadataSchema>;
export type AgentRuntimeDiscordChatSourceRecord = z.infer<
    typeof agentRuntimeDiscordChatSourceRecordSchema
>;
export type PlatformChatScope = z.infer<typeof agentRuntimeChatScopeSchema>;
export type AgentRuntimeHealth = z.infer<typeof agentRuntimeHealthSchema>;
export type AgentRuntimeCapabilityHealth = z.infer<typeof agentRuntimeCapabilityHealthSchema>;
export type AgentRuntimeCapabilityHealthId = z.infer<typeof agentRuntimeCapabilityHealthIdSchema>;
export type AgentRuntimeCapabilityHealthList = z.infer<
    typeof agentRuntimeCapabilityHealthListSchema
>;
export type AgentRuntimeUpdate = z.infer<typeof agentRuntimeUpdateSchema>;
export type AgentRuntimeUpdatePhase = z.infer<typeof agentRuntimeUpdatePhaseSchema>;
export type AgentRuntimeUpdateRequest = z.infer<typeof agentRuntimeUpdateRequestSchema>;
export type AgentRuntimeCapabilityHealthState = z.infer<
    typeof agentRuntimeCapabilityHealthStateSchema
>;
export type AgentRuntimeRefreshCapabilities = z.infer<typeof agentRuntimeRefreshCapabilitiesSchema>;
export type PlatformInboundMode = z.infer<typeof agentRuntimeInboundModeSchema>;
export type AgentRuntimeInfo = z.infer<typeof agentRuntimeInfoSchema>;
export type AgentRuntimeBinding = z.infer<typeof agentRuntimeBindingSchema>;
export type AgentRuntimeBindingList = z.infer<typeof agentRuntimeBindingListSchema>;
export type AgentRuntimeBindingMatch = z.infer<typeof agentRuntimeBindingMatchSchema>;
export type PlatformBindingStatus = z.infer<typeof agentRuntimeBindingStatusSchema>;
export type CortexBacklinkList = z.infer<typeof cortexBacklinkListSchema>;
export type CortexAddSchemaTermInput = z.infer<typeof cortexAddSchemaTermInputSchema>;
export type CortexCaptureInput = z.infer<typeof cortexCaptureInputSchema>;
export type CortexCaptureResult = z.infer<typeof cortexCaptureResultSchema>;
export type CortexIngestInput = z.input<typeof cortexIngestInputSchema>;
export type CortexIngestResult = z.infer<typeof cortexIngestResultSchema>;
export type CortexImportFile = z.infer<typeof cortexImportFileSchema>;
export type CortexImportInput = z.input<typeof cortexImportInputSchema>;
export type CortexImportKind = z.infer<typeof cortexImportKindSchema>;
export type CortexImportResult = z.infer<typeof cortexImportResultSchema>;
export type CortexClaim = z.infer<typeof cortexClaimSchema>;
export type CortexEditPageInput = z.infer<typeof cortexEditPageInputSchema>;
export type CortexEditPageResult = z.infer<typeof cortexEditPageResultSchema>;
export type CortexGraphDirection = z.infer<typeof cortexGraphDirectionSchema>;
export type CortexGraphPath = z.infer<typeof cortexGraphPathSchema>;
export type CortexGraphTraversal = z.infer<typeof cortexGraphTraversalSchema>;
export type CortexDreamReport = z.infer<typeof cortexDreamReportSchema>;
export type CortexDreamReportHealth = z.infer<typeof cortexDreamReportHealthSchema>;
export type CortexDreamReportItem = z.infer<typeof cortexDreamReportItemSchema>;
export type CortexDreamReportItemKind = z.infer<typeof cortexDreamReportItemKindSchema>;
export type CortexDreamReportList = z.infer<typeof cortexDreamReportListSchema>;
export type CortexDreamReportPhase = z.infer<typeof cortexDreamReportPhaseSchema>;
export type CortexDreamReportStatus = z.infer<typeof cortexDreamReportStatusSchema>;
export type CortexJobName = z.infer<typeof cortexJobNameSchema>;
export type CortexJobRun = z.infer<typeof cortexJobRunSchema>;
export type CortexLink = z.infer<typeof cortexLinkSchema>;
export type CortexPage = z.infer<typeof cortexPageSchema>;
export type CortexPageList = z.infer<typeof cortexPageListSchema>;
export type CortexPageSummary = z.infer<typeof cortexPageSummarySchema>;
export type CortexPageVersion = z.infer<typeof cortexPageVersionSchema>;
export type CortexPageVersionList = z.infer<typeof cortexPageVersionListSchema>;
export type CortexRecallInput = z.input<typeof cortexRecallInputSchema>;
export type CortexRecallResult = z.infer<typeof cortexRecallResultSchema>;
export type CortexRecommendation = z.infer<typeof cortexRecommendationSchema>;
export type CortexRevertPageInput = z.infer<typeof cortexRevertPageInputSchema>;
export type CortexSaveSettings = z.infer<typeof cortexSaveSettingsSchema>;
export type CortexSaveSchemaInput = z.infer<typeof cortexSaveSchemaInputSchema>;
export type CortexSchemaAddition = z.infer<typeof cortexSchemaAdditionSchema>;
export type CortexSchemaAdditionKind = z.infer<typeof cortexSchemaAdditionKindSchema>;
export type CortexSchemaAdditionList = z.infer<typeof cortexSchemaAdditionListSchema>;
export type CortexSchemaDefinition = z.infer<typeof cortexSchemaDefinitionSchema>;
export type CortexSchemaRecord = z.infer<typeof cortexSchemaRecordSchema>;
export type CortexSchemaValidationIssue = z.infer<typeof cortexSchemaValidationIssueSchema>;
export type CortexSearchInput = z.input<typeof cortexSearchInputSchema>;
export type CortexSearchResult = z.infer<typeof cortexSearchResultSchema>;
export type CortexSettings = z.infer<typeof cortexSettingsSchema>;
export type CortexSourceRef = z.infer<typeof cortexSourceRefSchema>;
export type CortexStatus = z.infer<typeof cortexStatusSchema>;
export type CortexTimelineEntry = z.infer<typeof cortexTimelineEntrySchema>;
export type CortexUpsertPageInput = z.infer<typeof cortexUpsertPageInputSchema>;
export type AgentRuntimeModelAccess = z.infer<typeof agentRuntimeModelAccessSchema>;
export type AgentRuntimeModelAccessId = z.infer<typeof agentRuntimeModelAccessIdSchema>;
export type AgentRuntimeModelAccessState = z.infer<typeof agentRuntimeModelAccessStateSchema>;
export type AgentRuntimeModelAccessStatus = z.infer<typeof agentRuntimeModelAccessStatusSchema>;
export type AgentRuntimeOpenAiSettings = z.infer<typeof agentRuntimeOpenAiSettingsSchema>;
export type AgentRuntimeSaveOpenAiSettings = z.infer<typeof agentRuntimeSaveOpenAiSettingsSchema>;
export type AgentRuntimeOpenRouterSettings = z.infer<typeof agentRuntimeOpenRouterSettingsSchema>;
export type AgentRuntimeOpenClawHarness = z.infer<typeof agentRuntimeOpenClawHarnessSchema>;
export type AgentRuntimeOpenClawModelName = z.infer<typeof agentRuntimeOpenClawModelNameSchema>;
export type AgentRuntimeOpenClawConfig = z.infer<typeof agentRuntimeOpenClawConfigSchema>;
export type AgentRuntimeOpenClawConfigSnapshot = z.infer<
    typeof agentRuntimeOpenClawConfigSnapshotSchema
>;
export type AgentRuntimeApplyOpenClawConfig = z.infer<typeof agentRuntimeApplyOpenClawConfigSchema>;
export type AgentRuntimeUpdateAgentName = z.infer<typeof agentRuntimeUpdateAgentNameSchema>;
export type AgentRuntimeUpdateAgentModel = z.infer<typeof agentRuntimeUpdateAgentModelSchema>;
export type AgentRuntimeUpdateAgentThinkingDefault = z.infer<
    typeof agentRuntimeUpdateAgentThinkingDefaultSchema
>;
export type AgentRuntimeSaveDiscordBinding = z.infer<typeof agentRuntimeSaveDiscordBindingSchema>;
export type AgentRuntimeDeleteDiscordBinding = z.infer<
    typeof agentRuntimeDeleteDiscordBindingSchema
>;
export type AgentRuntimeDiscordBinding = z.infer<typeof agentRuntimeDiscordBindingSchema>;
export type AgentRuntimeDiscordBindingList = z.infer<typeof agentRuntimeDiscordBindingListSchema>;
export type AgentRuntimeModelCatalogEntry = z.infer<typeof agentRuntimeModelCatalogEntrySchema>;
export type AgentRuntimeModels = z.infer<typeof agentRuntimeModelsSchema>;
export type AgentRuntimeSkillFile = z.infer<typeof agentRuntimeSkillFileSchema>;
export type AgentRuntimeSaveWorkspaceInstructions = z.infer<
    typeof agentRuntimeSaveWorkspaceInstructionsSchema
>;
export type AgentRuntimeRenderedWorkspaceInstructions = z.infer<
    typeof agentRuntimeRenderedWorkspaceInstructionsSchema
>;
export type AgentRuntimeWorkspaceInstructions = z.infer<
    typeof agentRuntimeWorkspaceInstructionsSchema
>;
export type AgentRuntimeWorkspaceInstructionsUpdatedEvent = z.infer<
    typeof agentRuntimeWorkspaceInstructionsUpdatedEventSchema
>;
export type AgentRuntimeInstallSkill = z.infer<typeof agentRuntimeInstallSkillSchema>;
export type AgentRuntimeSkill = z.infer<typeof agentRuntimeSkillSchema>;
export type AgentRuntimeSkillDeletedEvent = z.infer<typeof agentRuntimeSkillDeletedEventSchema>;
export type AgentRuntimeSkillList = z.infer<typeof agentRuntimeSkillListSchema>;
export type AgentRuntimeSkillSummary = z.infer<typeof agentRuntimeSkillSummarySchema>;
export type AgentRuntimeMacApp = z.infer<typeof agentRuntimeMacAppSchema>;
export type AgentRuntimeMacAppList = z.infer<typeof agentRuntimeMacAppListSchema>;
export type AgentRuntimeSkillUpdatedEvent = z.infer<typeof agentRuntimeSkillUpdatedEventSchema>;
export type AgentRuntimeSaveOpenRouterSettings = z.infer<
    typeof agentRuntimeSaveOpenRouterSettingsSchema
>;
export type AgentRuntimeSession = z.infer<typeof agentRuntimeSessionSchema>;
export type AgentRuntimeSessionList = z.infer<typeof agentRuntimeSessionListSchema>;
export type AgentRuntimeSessionLink = z.infer<typeof agentRuntimeSessionLinkSchema>;
export type AgentRuntimeSessionToolCall = z.infer<typeof agentRuntimeSessionToolCallSchema>;
export type AgentRuntimeSessionArtifact = z.infer<typeof agentRuntimeSessionArtifactSchema>;
export type AgentRuntimeSessionMessageAttachment = z.infer<
    typeof agentRuntimeSessionMessageAttachmentSchema
>;
export type AgentRuntimeSessionMessage = z.infer<typeof agentRuntimeSessionMessageSchema>;
export type AgentRuntimeSessionMessageList = z.infer<typeof agentRuntimeSessionMessageListSchema>;
export type AgentRuntimeSessionPreview = z.infer<typeof agentRuntimeSessionPreviewSchema>;
export type AgentRuntimeSessionPreviewItem = z.infer<typeof agentRuntimeSessionPreviewItemSchema>;
export type AgentRuntimeSessionPreviewList = z.infer<typeof agentRuntimeSessionPreviewListSchema>;
export type AgentRuntimeSessionPrompt = z.infer<typeof agentRuntimeSessionPromptSchema>;
export type AgentRuntimeSessionPromptSection = z.infer<
    typeof agentRuntimeSessionPromptSectionSchema
>;
export type AgentRuntimeSessionGraph = z.infer<typeof agentRuntimeSessionGraphSchema>;
export type AgentRuntimeSessionResync = z.infer<typeof agentRuntimeSessionResyncSchema>;
export type AgentRuntimeSessionUpdatedEvent = z.infer<typeof agentRuntimeSessionUpdatedEventSchema>;
export type AgentRuntimeThinkingLevel = z.infer<typeof agentRuntimeThinkingLevelSchema>;
export type AgentRuntimeCreateMessage = z.infer<typeof agentRuntimeCreateMessageSchema>;
export type AgentRuntimeMessageAccepted = z.infer<typeof agentRuntimeMessageAcceptedSchema>;
export type TavernChannelConversation = z.infer<typeof tavernChannelConversationSchema>;
export type TavernChannelMessage = z.infer<typeof tavernChannelMessageSchema>;
export type TavernChannelInboundMessage = z.infer<typeof tavernChannelInboundMessageSchema>;
export type TavernChannelClientFrame = z.infer<typeof tavernChannelClientFrameSchema>;
export type TavernChannelMessageAcceptedFrame = z.infer<
    typeof tavernChannelMessageAcceptedFrameSchema
>;
export type AgentRuntimeRunCron = z.infer<typeof agentRuntimeRunCronSchema>;
export type AgentRuntimeJobDetail = z.infer<typeof agentRuntimeJobDetailSchema>;
export type AgentRuntimeJobList = z.infer<typeof agentRuntimeJobListSchema>;
export type AgentRuntimeJobSlug = z.infer<typeof agentRuntimeJobSlugSchema>;
export type AgentRuntimeJobSummary = z.infer<typeof agentRuntimeJobSummarySchema>;
export type AgentRuntimeRunJobInput = z.infer<typeof agentRuntimeRunJobInputSchema>;
export type AgentRuntimeRunJob = z.infer<typeof agentRuntimeRunJobSchema>;
export type AgentRuntimeHighlight = z.infer<typeof agentRuntimeHighlightSchema>;
export type AgentRuntimeHighlightCategory = z.infer<typeof agentRuntimeHighlightCategorySchema>;
export type AgentRuntimeHighlightFreshness = z.infer<typeof agentRuntimeHighlightFreshnessSchema>;
export type AgentRuntimeHighlightList = z.infer<typeof agentRuntimeHighlightListSchema>;
export type AgentRuntimeHighlightSourceRef = z.infer<typeof agentRuntimeHighlightSourceRefSchema>;
export type AgentRuntimeTurn = z.infer<typeof agentRuntimeTurnSchema>;
export type AgentRuntimeTurnProgressStep = z.infer<typeof agentRuntimeTurnProgressStepSchema>;
export type AgentRuntimeTurnCompletedEvent = z.infer<typeof agentRuntimeTurnCompletedEventSchema>;
export type AgentRuntimeTurnFailedEvent = z.infer<typeof agentRuntimeTurnFailedEventSchema>;
export type AgentRuntimeTurnStartedEvent = z.infer<typeof agentRuntimeTurnStartedEventSchema>;
export type AgentRuntimeUpsertBinding = z.infer<typeof agentRuntimeUpsertBindingSchema>;
export type AgentRuntimeUpdateAgent = z.infer<typeof agentRuntimeUpdateAgentSchema>;
export type AgentRuntimeUpdateCron = z.infer<typeof agentRuntimeUpdateCronSchema>;
