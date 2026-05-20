import * as z from 'zod';

import { agentRuntimeModelIdentitySchema } from './model-identity.js';
import { agentRuntimeModelProviderIdSchema } from './model-providers.js';

export const agentRuntimeProtocolVersion = 1 as const;

export const agentRuntimeCapabilitySchema = z.enum([
    'tavernPlugin',
    'agentTurns',
    'agentFiles',
    'agents',
    'skills',
    'cron',
    'chats',
    'chatTargets',
    'cronRuns',
    'logs',
    'knowledgebase',
    'memory',
    'models',
    'sessionEvents',
    'tasks',
]);

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

export const agentRuntimeAgentBindingSchema = z.object({
    agentId: z.string().trim().min(1),
});

export const agentRuntimeIdentitySchema = z.object({
    capabilities: z.array(agentRuntimeCapabilitySchema).min(1),
    info: agentRuntimeInfoSchema,
});

export const agentRuntimeStatusSchema = z.object({
    health: agentRuntimeHealthSchema,
    identity: agentRuntimeIdentitySchema,
});

export const agentRuntimeModelAccessIdSchema = z.enum(['claude-code', 'codex']);
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

export const agentRuntimeSaveClaudeCredentialSchema = z.object({
    credential: z
        .string()
        .trim()
        .min(1, 'Enter a Claude setup token or Anthropic API key.')
        .refine(
            (value) => value.startsWith('sk-ant-oat') || value.startsWith('sk-ant-api'),
            'Enter a Claude setup token or Anthropic API key.'
        ),
});

export const agentRuntimeSaveCodexCredentialSchema = z.object({
    credential: z
        .string()
        .trim()
        .min(1, 'Enter a Codex auth.json payload or OpenAI API key.')
        .refine(isCodexCredentialInput, 'Enter a Codex auth.json payload or OpenAI API key.'),
});

const agentRuntimeOpenRouterKeySchema = z
    .string()
    .trim()
    .min(20, 'Enter a valid OpenRouter key.')
    .regex(/^sk-or(?:-v1)?-[A-Za-z0-9_-]+$/u, 'Enter a valid OpenRouter key.');

export const agentRuntimeOpenRouterSettingsSchema = z.object({
    apiKey: z.string(),
    hasApiKey: z.boolean(),
    hasManagementApiKey: z.boolean(),
    managementApiKey: z.string(),
    updatedAt: z.string().datetime().nullable(),
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
    soul: z.string().optional(),
    workspaceDir: z.string().trim().min(1),
});

export const agentRuntimeWorkspaceInstructionsSchema = z.object({
    agentId: z.string().trim().min(1),
    renderedAt: z.string().datetime(),
    sha256: z.string().trim().min(1),
    updatedAt: z.string().datetime(),
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

export const agentRuntimeInboundModeSchema = z.enum(['active', 'mention-only', 'observe']);

const agentRuntimeJsonRecordSchema = z.record(z.string(), z.unknown());

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

export const agentRuntimeModelSelectionSchema = z.object({
    fallbackModels: z.array(agentRuntimeModelIdentitySchema),
    primaryModel: agentRuntimeModelIdentitySchema.nullable(),
});

export const agentRuntimeAgentModelSchema = z.object({
    agentId: z.string().trim().min(1),
    fallbackModels: z.array(agentRuntimeModelIdentitySchema),
    isOverridden: z.boolean(),
    primaryModel: agentRuntimeModelIdentitySchema.nullable(),
    subAgentModel: agentRuntimeModelIdentitySchema.nullable(),
});

export const agentRuntimeSaveAgentModelSchema = agentRuntimeAgentModelSchema.extend({
    openClawModelName: agentRuntimeOpenClawModelNameSchema,
});

export const agentRuntimeModelsSchema = z.object({
    agents: z.array(agentRuntimeAgentModelSchema),
    configuredModels: z.array(agentRuntimeModelIdentitySchema),
    defaults: agentRuntimeModelSelectionSchema,
    defaultsThinkingLevel: agentRuntimeThinkingLevelSchema.nullable(),
    subAgentDefaultModel: agentRuntimeModelIdentitySchema.nullable(),
    subAgentThinkingLevel: agentRuntimeThinkingLevelSchema.nullable(),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeSaveModelsSchema = agentRuntimeModelsSchema
    .omit({
        updatedAt: true,
    })
    .extend({
        agents: z.array(agentRuntimeSaveAgentModelSchema),
    });

export const agentRuntimeMemorySettingsSchema = z.object({
    dreamModel: agentRuntimeModelIdentitySchema.nullable(),
    knowledgeModel: agentRuntimeModelIdentitySchema.nullable(),
    memoryEnabled: z.boolean(),
    persistenceModel: agentRuntimeModelIdentitySchema.nullable(),
    updatedAt: z.string().datetime().nullable(),
    workingModel: agentRuntimeModelIdentitySchema.nullable(),
});

export const agentRuntimeSaveMemorySettingsSchema = agentRuntimeMemorySettingsSchema.omit({
    updatedAt: true,
});

export const agentRuntimeMemoryEmbedderStatusSchema = z.enum(['disabled', 'not-ready', 'ready']);

export const agentRuntimeMemoryStatusSchema = z.object({
    embedderStatus: agentRuntimeMemoryEmbedderStatusSchema,
    lanceDbPath: z.string().trim().min(1),
    lastBulletinBuildAt: z.string().datetime().nullable(),
    lastCaptureAt: z.string().datetime().nullable(),
    lastDreamRunAt: z.string().datetime().nullable(),
    lastWorkingSynthesisAt: z.string().datetime().nullable(),
});

export const cortexJobNameSchema = z.enum([
    'ingest',
    'recall-index',
    'lint',
    'repair',
    'export',
    'health',
]);

export const cortexPageStatusSchema = z.enum(['active', 'archived', 'deleted', 'stale']);
export const cortexPageTypeSchema = z.enum([
    'agent',
    'chat',
    'decision',
    'fact',
    'file',
    'note',
    'person',
    'project',
    'source',
    'task',
]);
export const cortexAuditStatusSchema = z.enum(['error', 'skipped', 'success']);

export const cortexSourceRefSchema = z.object({
    id: z.string().trim().min(1),
    kind: z.string().trim().min(1),
    locator: z.string().trim().min(1).nullable().default(null),
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
    value: z.string().trim().min(1),
});

export const cortexPageSchema = cortexPageSummarySchema.extend({
    body: z.string(),
    compiledTruth: z.string(),
    claims: z.array(cortexClaimSchema).default([]),
    createdAt: z.string().datetime(),
    frontmatter: z.record(z.string(), z.unknown()).default({}),
    links: z.array(cortexLinkSchema).default([]),
    sourceRefs: z.array(cortexSourceRefSchema).default([]),
    timeline: z.array(cortexTimelineEntrySchema).default([]),
});

export const cortexPageListSchema = z.object({
    pages: z.array(
        cortexPageSummarySchema.extend({
            links: z.array(cortexLinkSchema).default([]),
        })
    ),
});

export const cortexSearchInputSchema = z.object({
    limit: z.number().int().positive().max(50).default(10),
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

export const cortexSearchHitSchema = z.object({
    page: cortexPageSummarySchema,
    score: z.number().nonnegative(),
    snippet: z.string().default(''),
});

export const cortexSearchResultSchema = z.object({
    hits: z.array(cortexSearchHitSchema),
    query: z.string().trim().min(1),
});

export const cortexRecallInputSchema = cortexSearchInputSchema;

export const cortexRecallHitSchema = cortexSearchHitSchema.extend({
    evidence: z.array(cortexSourceRefSchema).default([]),
});

export const cortexRecallResultSchema = z.object({
    auditId: z.string().trim().min(1),
    hits: z.array(cortexRecallHitSchema),
    query: z.string().trim().min(1),
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

export const cortexBacklinkListSchema = z.object({
    links: z.array(cortexLinkSchema),
    target: z.string().trim().min(1),
});

export const cortexJobRunSchema = z.object({
    auditId: z.string().trim().min(1),
    completedAt: z.string().datetime(),
    job: cortexJobNameSchema,
    status: cortexAuditStatusSchema,
    summary: z.string().trim().min(1),
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
    sourceCount: z.number().int().nonnegative(),
    timelineEntryCount: z.number().int().nonnegative(),
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

export const agentRuntimeToolMentionSchema = z
    .object({
        end: z.number().int().nonnegative(),
        id: z.string().trim().min(1),
        kind: z.enum(['app', 'skill', 'tool']),
        label: z.string().trim().min(1),
        start: z.number().int().nonnegative(),
        text: z.string().min(1),
    })
    .refine((value) => value.end > value.start, {
        message: 'Tool mention end offset must be greater than start offset.',
        path: ['end'],
    });

export const agentRuntimeTavernMessageMetadataSchema = z
    .object({
        toolMentions: z.array(agentRuntimeToolMentionSchema).optional(),
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
    kind: z.enum(['command', 'message', 'plan', 'reasoning', 'tool']),
    label: z.string().trim().min(1),
    status: agentRuntimeTurnProgressStatusSchema,
});

export const agentRuntimeActiveChatReplySchema = z.object({
    agentId: z.string().trim().min(1),
    isThinking: z.boolean().optional(),
    runId: z.string().trim().min(1),
    sessionKey: z.string().trim().min(1),
    startedAt: z.string().datetime(),
    text: z.string().optional(),
});

export const agentRuntimeChatStatusSchema = z.object({
    activeReply: agentRuntimeActiveChatReplySchema,
    activeReplyProgressStartedAt: z.string().datetime().nullable().optional(),
    activeReplySteps: z.array(agentRuntimeTurnProgressStepSchema).optional(),
    chatId: z.string().trim().min(1),
});

export const agentRuntimeChatStatusListSchema = z.object({
    chats: z.array(agentRuntimeChatStatusSchema),
});

export const agentRuntimeEventTypeSchema = z.enum([
    'agent.updated',
    'chat.messageAccepted',
    'chat.read',
    'skill.updated',
    'skill.deleted',
    'cron.updated',
    'cron.deleted',
    'cron.runStarted',
    'cron.runFinished',
    'turn.started',
    'turn.progress',
    'turn.replyUpdated',
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
    agentRuntimeSkillUpdatedEventSchema,
    agentRuntimeSkillDeletedEventSchema,
    agentRuntimeCronUpdatedEventSchema,
    agentRuntimeCronDeletedEventSchema,
    agentRuntimeCronRunStartedEventSchema,
    agentRuntimeCronRunFinishedEventSchema,
    agentRuntimeTurnStartedEventSchema,
    agentRuntimeTurnProgressEventSchema,
    agentRuntimeTurnReplyUpdatedEventSchema,
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
export type AgentRuntimeAgentModel = z.infer<typeof agentRuntimeAgentModelSchema>;
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
export type AgentRuntimeIdentity = z.infer<typeof agentRuntimeIdentitySchema>;
export type PlatformInboundMode = z.infer<typeof agentRuntimeInboundModeSchema>;
export type AgentRuntimeInfo = z.infer<typeof agentRuntimeInfoSchema>;
export type AgentRuntimeBinding = z.infer<typeof agentRuntimeBindingSchema>;
export type AgentRuntimeBindingList = z.infer<typeof agentRuntimeBindingListSchema>;
export type AgentRuntimeBindingMatch = z.infer<typeof agentRuntimeBindingMatchSchema>;
export type PlatformBindingStatus = z.infer<typeof agentRuntimeBindingStatusSchema>;
export type AgentRuntimeMemoryEmbedderStatus = z.infer<
    typeof agentRuntimeMemoryEmbedderStatusSchema
>;
export type AgentRuntimeMemorySettings = z.infer<typeof agentRuntimeMemorySettingsSchema>;
export type AgentRuntimeMemoryStatus = z.infer<typeof agentRuntimeMemoryStatusSchema>;
export type CortexBacklinkList = z.infer<typeof cortexBacklinkListSchema>;
export type CortexCaptureInput = z.infer<typeof cortexCaptureInputSchema>;
export type CortexCaptureResult = z.infer<typeof cortexCaptureResultSchema>;
export type CortexClaim = z.infer<typeof cortexClaimSchema>;
export type CortexJobName = z.infer<typeof cortexJobNameSchema>;
export type CortexJobRun = z.infer<typeof cortexJobRunSchema>;
export type CortexLink = z.infer<typeof cortexLinkSchema>;
export type CortexPage = z.infer<typeof cortexPageSchema>;
export type CortexPageList = z.infer<typeof cortexPageListSchema>;
export type CortexPageSummary = z.infer<typeof cortexPageSummarySchema>;
export type CortexRecallInput = z.infer<typeof cortexRecallInputSchema>;
export type CortexRecallResult = z.infer<typeof cortexRecallResultSchema>;
export type CortexSearchInput = z.infer<typeof cortexSearchInputSchema>;
export type CortexSearchResult = z.infer<typeof cortexSearchResultSchema>;
export type CortexSourceRef = z.infer<typeof cortexSourceRefSchema>;
export type CortexStatus = z.infer<typeof cortexStatusSchema>;
export type CortexTimelineEntry = z.infer<typeof cortexTimelineEntrySchema>;
export type AgentRuntimeModelAccess = z.infer<typeof agentRuntimeModelAccessSchema>;
export type AgentRuntimeModelAccessId = z.infer<typeof agentRuntimeModelAccessIdSchema>;
export type AgentRuntimeModelAccessState = z.infer<typeof agentRuntimeModelAccessStateSchema>;
export type AgentRuntimeModelAccessStatus = z.infer<typeof agentRuntimeModelAccessStatusSchema>;
export type AgentRuntimeOpenRouterSettings = z.infer<typeof agentRuntimeOpenRouterSettingsSchema>;
export type AgentRuntimeOpenClawHarness = z.infer<typeof agentRuntimeOpenClawHarnessSchema>;
export type AgentRuntimeOpenClawModelName = z.infer<typeof agentRuntimeOpenClawModelNameSchema>;
export type AgentRuntimeOpenClawConfig = z.infer<typeof agentRuntimeOpenClawConfigSchema>;
export type AgentRuntimeOpenClawConfigSnapshot = z.infer<
    typeof agentRuntimeOpenClawConfigSnapshotSchema
>;
export type AgentRuntimeApplyOpenClawConfig = z.infer<typeof agentRuntimeApplyOpenClawConfigSchema>;
export type AgentRuntimeSaveClaudeCredential = z.infer<
    typeof agentRuntimeSaveClaudeCredentialSchema
>;
export type AgentRuntimeSaveCodexCredential = z.infer<typeof agentRuntimeSaveCodexCredentialSchema>;
export type AgentRuntimeModelSelection = z.infer<typeof agentRuntimeModelSelectionSchema>;
export type AgentRuntimeModels = z.infer<typeof agentRuntimeModelsSchema>;
export type AgentRuntimeSkillFile = z.infer<typeof agentRuntimeSkillFileSchema>;
export type AgentRuntimeSaveWorkspaceInstructions = z.infer<
    typeof agentRuntimeSaveWorkspaceInstructionsSchema
>;
export type AgentRuntimeWorkspaceInstructions = z.infer<
    typeof agentRuntimeWorkspaceInstructionsSchema
>;
export type AgentRuntimeInstallSkill = z.infer<typeof agentRuntimeInstallSkillSchema>;
export type AgentRuntimeSkill = z.infer<typeof agentRuntimeSkillSchema>;
export type AgentRuntimeSkillDeletedEvent = z.infer<typeof agentRuntimeSkillDeletedEventSchema>;
export type AgentRuntimeSkillList = z.infer<typeof agentRuntimeSkillListSchema>;
export type AgentRuntimeSkillSummary = z.infer<typeof agentRuntimeSkillSummarySchema>;
export type AgentRuntimeSkillUpdatedEvent = z.infer<typeof agentRuntimeSkillUpdatedEventSchema>;
export type AgentRuntimeStatus = z.infer<typeof agentRuntimeStatusSchema>;
export type AgentRuntimeSaveMemorySettings = z.infer<typeof agentRuntimeSaveMemorySettingsSchema>;
export type AgentRuntimeSaveModels = z.infer<typeof agentRuntimeSaveModelsSchema>;
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
export type AgentRuntimeTurn = z.infer<typeof agentRuntimeTurnSchema>;
export type AgentRuntimeTurnProgressStep = z.infer<typeof agentRuntimeTurnProgressStepSchema>;
export type AgentRuntimeActiveChatReply = z.infer<typeof agentRuntimeActiveChatReplySchema>;
export type AgentRuntimeChatStatus = z.infer<typeof agentRuntimeChatStatusSchema>;
export type AgentRuntimeChatStatusList = z.infer<typeof agentRuntimeChatStatusListSchema>;
export type AgentRuntimeTurnCompletedEvent = z.infer<typeof agentRuntimeTurnCompletedEventSchema>;
export type AgentRuntimeTurnFailedEvent = z.infer<typeof agentRuntimeTurnFailedEventSchema>;
export type AgentRuntimeTurnStartedEvent = z.infer<typeof agentRuntimeTurnStartedEventSchema>;
export type AgentRuntimeUpsertBinding = z.infer<typeof agentRuntimeUpsertBindingSchema>;
export type AgentRuntimeUpdateAgent = z.infer<typeof agentRuntimeUpdateAgentSchema>;
export type AgentRuntimeUpdateCron = z.infer<typeof agentRuntimeUpdateCronSchema>;

function isCodexCredentialInput(value: string): boolean {
    return isOpenAiApiKey(value) || isCodexAuthJson(value);
}

function isOpenAiApiKey(value: string): boolean {
    return value.startsWith('sk-') && !(value.startsWith('sk-ant-') || value.startsWith('sk-or-'));
}

function isCodexAuthJson(value: string): boolean {
    try {
        const parsed = JSON.parse(value) as { tokens?: { access_token?: unknown } };
        return (
            typeof parsed === 'object' &&
            parsed !== null &&
            typeof parsed.tokens?.access_token === 'string' &&
            parsed.tokens.access_token.trim().length > 0
        );
    } catch {
        return false;
    }
}
