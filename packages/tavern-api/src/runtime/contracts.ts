import * as z from 'zod';

import { tavernPluginCapabilityIds, tavernPluginIds } from '../plugins/ids.ts';
import { agentRuntimeModelProviderIdSchema } from './model-providers.ts';

export const agentRuntimeProtocolVersion = 1 as const;

const agentRuntimeCoreCapabilityIds = [
    'codexOAuth',
    'memory',
    'wiki',
    'wikiRecall',
    'memoryExtraction',
    'memoryDreaming',
    'dashboardServer',
    'apiServer',
    'gateway',
    'modelExecution',
    'skills',
    'cron',
    'devToolkit',
] as const;

export const agentRuntimeCapabilitySchema = z.enum([
    ...agentRuntimeCoreCapabilityIds,
    ...tavernPluginCapabilityIds,
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

export const agentRuntimeSaveModelProviderApiKeySchema = z.object({
    apiKey: z.string().trim().min(1, 'Enter an API key.'),
    keyEnv: z.string().trim().min(1),
});

export const agentRuntimeModelProviderApiKeyResultSchema = z.object({
    ok: z.boolean(),
});

export const agentRuntimeModelProviderOAuthCancelSchema = z.object({
    ok: z.boolean(),
});

export const agentRuntimeStartModelProviderOAuthSchema = z.object({
    providerId: z.string().trim().min(1),
});

export const agentRuntimePollModelProviderOAuthSchema = z.object({
    providerId: z.string().trim().min(1),
    sessionId: z.string().trim().min(1),
});

export const agentRuntimeCancelModelProviderOAuthSchema = z.object({
    sessionId: z.string().trim().min(1),
});

export const agentRuntimeSubmitModelProviderOAuthSchema =
    agentRuntimePollModelProviderOAuthSchema.extend({
        code: z.string().trim().min(1, 'Enter the authorization code.'),
    });

export const agentRuntimeModelProviderOAuthStartSchema = z.union([
    z.object({
        authUrl: z.string().url(),
        expiresIn: z.number().int().positive(),
        flow: z.literal('pkce'),
        sessionId: z.string().trim().min(1),
    }),
    z.object({
        expiresIn: z.number().int().positive(),
        flow: z.literal('device_code'),
        pollInterval: z.number().int().positive(),
        sessionId: z.string().trim().min(1),
        userCode: z.string().trim().min(1),
        verificationUrl: z.string().url(),
    }),
    z.object({
        authUrl: z.string().url(),
        expiresIn: z.number().int().positive(),
        flow: z.literal('loopback'),
        sessionId: z.string().trim().min(1),
    }),
]);

export const agentRuntimeModelProviderOAuthPollSchema = z.object({
    errorMessage: z.string().trim().min(1).nullable(),
    expiresAt: z.number().nullable(),
    sessionId: z.string().trim().min(1),
    status: z.enum(['approved', 'denied', 'error', 'expired', 'pending']),
});

export const agentRuntimeModelProviderOAuthSubmitSchema = z.object({
    message: z.string().trim().min(1).nullable(),
    ok: z.boolean(),
    status: z.enum(['approved', 'denied', 'error', 'expired', 'pending']),
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

export const agentRuntimeModelNameSchema = z.object({
    baseUrl: z.string().trim().url().optional(),
    model: z.string().trim().min(1),
    provider: z.string().trim().min(1),
});

export const agentRuntimeModelCategorySchema = z.enum(['fast', 'standard', 'deep', 'visual']);

export const agentRuntimeModelCategorySelectionSchema = z.object({
    fast: agentRuntimeModelNameSchema.nullable(),
    standard: agentRuntimeModelNameSchema.nullable(),
    deep: agentRuntimeModelNameSchema.nullable(),
    visual: agentRuntimeModelNameSchema.nullable(),
});

export const agentRuntimeModelCategorySettingsSchema = z.object({
    categories: agentRuntimeModelCategorySelectionSchema,
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeSaveModelCategorySettingsSchema = z.object({
    categories: agentRuntimeModelCategorySelectionSchema.partial(),
});

export const agentRuntimeSaveModelCategorySettingsResultSchema =
    agentRuntimeModelCategorySettingsSchema.extend({
        restartScheduled: z.boolean(),
    });

export const agentRuntimeTimezoneSettingsSchema = z.object({
    resolvedTimezone: z.string().trim().min(1),
    timezone: z.string().nullable(),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeSaveTimezoneSettingsSchema = z.object({
    timezone: z.string().trim().min(1).nullable().optional(),
});

export const agentRuntimeSaveTimezoneSettingsResultSchema =
    agentRuntimeTimezoneSettingsSchema.extend({
        restartScheduled: z.boolean(),
    });

export const agentRuntimeMemorySettingsSchema = z.object({
    enabled: z.boolean(),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeSaveMemorySettingsSchema = z.object({
    enabled: z.boolean().optional(),
});

export const agentRuntimeSaveMemorySettingsResultSchema = agentRuntimeMemorySettingsSchema.extend({
    restartScheduled: z.boolean(),
});

export const memoryJobKindSchema = z.enum(['curation', 'dream', 'extraction', 'skill_review']);
export const memoryJobStatusSchema = z.enum([
    'completed',
    'failed',
    'queued',
    'running',
    'skipped',
]);

export const memoryJobFileChangeSchema = z.object({
    afterHash: z.string().trim().min(1).nullable(),
    beforeHash: z.string().trim().min(1).nullable(),
    path: z.string().trim().min(1),
});

export const memoryJobSummarySchema = z.object({
    agentId: z.string().trim().min(1),
    agentParticipantId: z.string().trim().min(1).nullable(),
    chatId: z.string().trim().min(1).nullable(),
    completedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    error: z.string().trim().min(1).nullable(),
    fileChangeCount: z.number().int().nonnegative(),
    id: z.string().trim().min(1),
    kind: memoryJobKindSchema,
    modelCategory: agentRuntimeModelCategorySchema.nullable(),
    outputPath: z.string().trim().min(1).nullable(),
    sourceEndSequence: z.number().int().nonnegative().nullable(),
    sourceStartSequence: z.number().int().nonnegative().nullable(),
    status: memoryJobStatusSchema,
    updatedAt: z.string().datetime(),
});

export const memoryJobDetailSchema = memoryJobSummarySchema.extend({
    fileChanges: z.array(memoryJobFileChangeSchema),
    metadata: z.record(z.string(), z.unknown()),
    model: agentRuntimeModelNameSchema.nullable(),
    transcript: z.unknown(),
    usage: z.unknown(),
});

export const memoryJobListSchema = z.object({
    jobs: z.array(memoryJobSummarySchema),
});

export const memoryActivityNextRunSchema = z.union([
    z.object({ at: z.string().datetime(), kind: z.literal('scheduled') }),
    z.object({ kind: z.literal('waiting'), waitingOn: z.string().trim().min(1) }),
]);

export const memoryActivitySchema = z.object({
    enabled: z.boolean(),
    kind: memoryJobKindSchema,
    lastRun: z
        .object({
            completedAt: z.string().datetime().nullable(),
            durationMs: z.number().int().nonnegative().nullable(),
            error: z.string().nullable(),
            id: z.string().trim().min(1),
            startedAt: z.string().datetime().nullable(),
            status: memoryJobStatusSchema,
        })
        .nullable(),
    nextRun: memoryActivityNextRunSchema.nullable(),
});

export const memoryActivityListSchema = z.object({
    activities: z.array(memoryActivitySchema),
});

export const memoryDreamRequestSchema = z.object({
    agentId: z.string().trim().min(1),
});

export const memoryDreamResultSchema = z.object({
    job: memoryJobDetailSchema,
});

const agentRuntimeReservedEnvPrefixes = ['TAVERN_'] as const;
const agentRuntimeReservedEnvNames = new Set(['OPENAI_API_KEY', 'OPENROUTER_API_KEY']);

function isAgentRuntimeReservedEnvName(name: string) {
    return (
        agentRuntimeReservedEnvNames.has(name) ||
        agentRuntimeReservedEnvPrefixes.some((prefix) => name.startsWith(prefix))
    );
}

const agentRuntimeAgentEnvNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Z_][A-Z0-9_]*$/u, 'Use uppercase letters, digits, and underscores.')
    .refine((name) => !isAgentRuntimeReservedEnvName(name), 'This name is managed by Tavern.');

export const agentRuntimeAgentEnvVariableSchema = z.object({
    hasValue: z.boolean(),
    name: agentRuntimeAgentEnvNameSchema,
    value: z.string().min(1).max(8192).optional(),
});

export const agentRuntimeAgentEnvSchema = z.object({
    updatedAt: z.string().datetime().nullable(),
    variables: z.array(agentRuntimeAgentEnvVariableSchema),
});

export const agentRuntimeSaveAgentEnvVariableSchema = z.object({
    name: agentRuntimeAgentEnvNameSchema,
    value: z.string().min(1).max(8192).optional(),
});

export const agentRuntimeSaveAgentEnvSchema = z.object({
    variables: z.array(agentRuntimeSaveAgentEnvVariableSchema).max(64),
});

export const agentRuntimeSaveAgentEnvResultSchema = agentRuntimeAgentEnvSchema.extend({
    restartScheduled: z.boolean(),
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

export const agentRuntimePluginIdSchema = z.enum(tavernPluginIds);

const agentRuntimePluginSecretFieldSchema = z
    .object({
        hasValue: z.boolean(),
        name: z.string().trim().min(1).max(128),
    })
    .strict();

const agentRuntimePluginServiceSchema = z
    .object({
        description: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        enabled: z.boolean(),
        healthCapabilities: z.array(agentRuntimeCapabilityHealthIdSchema),
        id: z.string().trim().min(1).max(128),
        scopes: z.array(z.string().trim().min(1)),
    })
    .strict();

export const agentRuntimePluginSchema = z
    .object({
        config: agentRuntimeJsonRecordSchema,
        description: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        enabled: z.boolean(),
        id: agentRuntimePluginIdSchema,
        secrets: z.array(agentRuntimePluginSecretFieldSchema),
        services: z.array(agentRuntimePluginServiceSchema),
        updatedAt: z.string().datetime().nullable(),
    })
    .strict();

export const agentRuntimePluginListSchema = z
    .object({
        plugins: z.array(agentRuntimePluginSchema),
    })
    .strict();

export const agentRuntimeAgentPluginGrantSchema = z
    .object({
        agentId: z.string().trim().min(1),
        enabled: z.boolean(),
        pluginId: agentRuntimePluginIdSchema,
        updatedAt: z.string().datetime().nullable(),
    })
    .strict();

export const agentRuntimeAgentPluginGrantListSchema = z
    .object({
        grants: z.array(agentRuntimeAgentPluginGrantSchema),
    })
    .strict();

export const agentRuntimeUpdateAgentPluginGrantSchema = z
    .object({
        enabled: z.boolean(),
    })
    .strict();

export const agentRuntimeMerchbaseSettingsSchema = z
    .object({
        apiKey: z.string(),
        apiKeyConfigured: z.boolean(),
        baseUrl: z.string().trim().url(),
        defaultAccount: z.string().trim().min(1).max(160).nullable(),
        defaultMarketplace: z.string().trim().min(1).max(40).nullable(),
        enabled: z.boolean(),
        enablementSource: z.enum(['environment', 'settings']),
        skillConflict: z
            .object({
                skillName: z.literal('merchbase'),
                skillPath: z.string().trim().min(1),
            })
            .strict()
            .nullable(),
        updatedAt: z.string().datetime().nullable(),
    })
    .strict();

export const agentRuntimeSaveMerchbaseSettingsSchema = z
    .object({
        apiKey: z.string().trim().min(1).max(4096).nullable().optional(),
        baseUrl: z.string().trim().url().optional(),
        defaultAccount: z.string().trim().min(1).max(160).nullable().optional(),
        defaultMarketplace: z.string().trim().min(1).max(40).nullable().optional(),
        enabled: z.boolean().optional(),
    })
    .strict();

export const agentRuntimeGoogleSettingsSchema = z
    .object({
        calendarEnabled: z.boolean(),
        connected: z.boolean(),
        connectedAccountEmail: z.string().trim().min(1).nullable(),
        enabled: z.boolean(),
        grantedScopes: z.array(z.string().trim().min(1)),
        missingCalendarScopes: z.array(z.string().trim().min(1)),
        updatedAt: z.string().datetime().nullable(),
    })
    .strict();

export const agentRuntimeSaveGoogleSettingsSchema = z
    .object({
        calendarEnabled: z.boolean().optional(),
        enabled: z.boolean().optional(),
    })
    .strict();

export const agentRuntimeStartGoogleOAuthSchema = z
    .object({
        redirectUri: z.string().url().optional(),
    })
    .strict();

export const agentRuntimeGoogleOAuthStartSchema = z
    .object({
        authUrl: z.string().url(),
        expiresAt: z.string().datetime(),
        sessionId: z.string().trim().min(1),
    })
    .strict();

export const agentRuntimeGoogleOAuthPollInputSchema = z
    .object({
        sessionId: z.string().trim().min(1),
    })
    .strict();

export const agentRuntimeCompleteGoogleOAuthSchema = z
    .object({
        code: z.string().trim().min(1).optional(),
        error: z.string().trim().min(1).optional(),
        state: z.string().trim().min(1),
    })
    .strict();

export const agentRuntimeGoogleOAuthPollSchema = z
    .object({
        errorMessage: z.string().trim().min(1).nullable(),
        sessionId: z.string().trim().min(1),
        status: z.enum(['approved', 'error', 'expired', 'pending']),
    })
    .strict();

export const agentRuntimeGoogleCalendarEventSchema = z
    .object({
        description: z.string().nullable(),
        end: z.string().nullable(),
        htmlLink: z.string().url().nullable(),
        id: z.string().trim().min(1),
        location: z.string().nullable(),
        start: z.string().nullable(),
        status: z.string().nullable(),
        summary: z.string().nullable(),
    })
    .strict();

export const agentRuntimeGoogleCalendarEventsListInputSchema = z
    .object({
        calendarId: z.string().trim().min(1).default('primary'),
        maxResults: z.number().int().min(1).max(50).default(10),
        query: z.string().trim().min(1).max(512).optional(),
        timeMax: z.string().datetime().optional(),
        timeMin: z.string().datetime().optional(),
        timeZone: z.string().trim().min(1).max(128).optional(),
    })
    .strict();

export const agentRuntimeGoogleCalendarEventsListSchema = z
    .object({
        events: z.array(agentRuntimeGoogleCalendarEventSchema),
    })
    .strict();

export const agentRuntimeGoogleCalendarEventCreateInputSchema = z
    .object({
        calendarId: z.string().trim().min(1).default('primary'),
        description: z.string().trim().min(1).max(8192).optional(),
        endDateTime: z.string().datetime(),
        location: z.string().trim().min(1).max(1024).optional(),
        startDateTime: z.string().datetime(),
        summary: z.string().trim().min(1).max(1024),
        timeZone: z.string().trim().min(1).max(128).optional(),
    })
    .strict();

export const agentRuntimeGoogleCalendarEventCreateSchema = z
    .object({
        event: agentRuntimeGoogleCalendarEventSchema,
    })
    .strict();

export const agentRuntimeMerchbaseSalesBucketSchema = z.enum(['day', 'week', 'month']);

const optionalMerchbaseFilterSchema = z.string().trim().min(1).max(160).optional();
const merchbasePaginationDefaults = { limit: 25, offset: 0 } as const;
const merchbaseSalesFilterDefaults = { range: '30d' } as const;
const merchbaseSalesSeriesInputDefault = { bucket: 'day', range: '30d' } as const;
const merchbasePaginatedSalesDefaults = {
    ...merchbaseSalesFilterDefaults,
    ...merchbasePaginationDefaults,
} as const;
const merchbaseSalesBreakdownGroupBySchema = z.enum([
    'marketplace',
    'asin',
    'productType',
    'fit',
    'color',
    'facet',
]);

export const agentRuntimeMerchbaseSalesSeriesInputSchema = z
    .object({
        asin: optionalMerchbaseFilterSchema,
        bucket: agentRuntimeMerchbaseSalesBucketSchema.default('day'),
        color: optionalMerchbaseFilterSchema,
        facet: optionalMerchbaseFilterSchema,
        facetName: optionalMerchbaseFilterSchema,
        fit: optionalMerchbaseFilterSchema,
        marketplace: optionalMerchbaseFilterSchema,
        productType: optionalMerchbaseFilterSchema,
        range: z.string().trim().min(1).max(80).default('30d'),
    })
    .strict();

export const agentRuntimeMerchbaseSalesPointSchema = z
    .object({
        bucketEnd: z.string().trim().min(1),
        bucketStart: z.string().trim().min(1),
        currencyCode: z.string().trim().min(1),
        netUnits: z.number(),
        revenue: z.number(),
        royalties: z.number(),
        unitsCancelled: z.number(),
        unitsReturned: z.number(),
        unitsSold: z.number(),
    })
    .strict();

const merchbaseChartValueSchema = z.union([z.string(), z.number(), z.null()]);

export const agentRuntimeMerchbaseSalesSeriesSchema = z
    .object({
        chartData: z
            .object({
                data: z.array(z.record(z.string(), merchbaseChartValueSchema)),
                title: z.string().trim().min(1),
                unit: z.string().trim().min(1),
                x: z.string().trim().min(1),
                y: z.string().trim().min(1),
            })
            .strict(),
        query: agentRuntimeMerchbaseSalesSeriesInputSchema,
        series: z.array(agentRuntimeMerchbaseSalesPointSchema),
    })
    .strict();

const merchbaseEmptyInputSchema = z.object({}).strict();
const merchbasePaginationSchema = z
    .object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
    })
    .strict();
const merchbaseSalesFiltersSchema = z
    .object({
        asin: optionalMerchbaseFilterSchema,
        color: optionalMerchbaseFilterSchema,
        facet: optionalMerchbaseFilterSchema,
        facetName: optionalMerchbaseFilterSchema,
        fit: optionalMerchbaseFilterSchema,
        marketplace: optionalMerchbaseFilterSchema,
        productType: optionalMerchbaseFilterSchema,
        range: z.string().trim().min(1).max(80).default('30d'),
    })
    .strict();

export const agentRuntimeMerchbaseActionNameSchema = z.enum([
    'accounts.get',
    'setup.status',
    'merchAccount.get',
    'merchAccount.statusCounts.get',
    'products.list',
    'products.search',
    'products.get',
    'products.metadata',
    'products.catalog.get',
    'products.catalog.options',
    'products.catalog.product',
    'designs.list',
    'designs.get',
    'designs.facets.get',
    'designs.facets.status',
    'sales.summary',
    'sales.records',
    'sales.series',
    'sales.breakdown',
]);

export const agentRuntimeMerchbaseActionInputSchema = z.discriminatedUnion('action', [
    z
        .object({
            action: z.literal('accounts.get'),
            input: merchbaseEmptyInputSchema.default({}),
        })
        .strict(),
    z
        .object({
            action: z.literal('setup.status'),
            input: merchbaseEmptyInputSchema.default({}),
        })
        .strict(),
    z
        .object({
            action: z.literal('merchAccount.get'),
            input: merchbaseEmptyInputSchema.default({}),
        })
        .strict(),
    z
        .object({
            action: z.literal('merchAccount.statusCounts.get'),
            input: merchbaseEmptyInputSchema.default({}),
        })
        .strict(),
    z
        .object({
            action: z.literal('products.list'),
            input: merchbasePaginationSchema
                .extend({
                    marketplace: optionalMerchbaseFilterSchema,
                    status: optionalMerchbaseFilterSchema,
                })
                .default(merchbasePaginationDefaults),
        })
        .strict(),
    z
        .object({
            action: z.literal('products.search'),
            input: merchbasePaginationSchema
                .extend({
                    facet: optionalMerchbaseFilterSchema,
                    facetName: optionalMerchbaseFilterSchema,
                    marketplace: optionalMerchbaseFilterSchema,
                    query: optionalMerchbaseFilterSchema,
                })
                .default(merchbasePaginationDefaults),
        })
        .strict(),
    z
        .object({
            action: z.literal('products.get'),
            input: z
                .object({
                    asin: z.string().trim().min(1).max(40),
                    marketplace: optionalMerchbaseFilterSchema,
                })
                .strict(),
        })
        .strict(),
    z
        .object({
            action: z.literal('products.metadata'),
            input: z
                .object({
                    asin: optionalMerchbaseFilterSchema,
                    marketplace: optionalMerchbaseFilterSchema,
                })
                .strict()
                .default({}),
        })
        .strict(),
    z
        .object({
            action: z.literal('products.catalog.get'),
            input: merchbaseEmptyInputSchema.default({}),
        })
        .strict(),
    z
        .object({
            action: z.literal('products.catalog.options'),
            input: z
                .object({
                    productType: optionalMerchbaseFilterSchema,
                })
                .strict()
                .default({}),
        })
        .strict(),
    z
        .object({
            action: z.literal('products.catalog.product'),
            input: z
                .object({
                    productType: z.string().trim().min(1).max(160),
                })
                .strict(),
        })
        .strict(),
    z
        .object({
            action: z.literal('designs.list'),
            input: merchbasePaginationSchema
                .extend({
                    facet: optionalMerchbaseFilterSchema,
                    facetName: optionalMerchbaseFilterSchema,
                    query: optionalMerchbaseFilterSchema,
                })
                .default(merchbasePaginationDefaults),
        })
        .strict(),
    z
        .object({
            action: z.literal('designs.get'),
            input: z
                .object({
                    designId: z.string().trim().min(1).max(160),
                })
                .strict(),
        })
        .strict(),
    z
        .object({
            action: z.literal('designs.facets.get'),
            input: z
                .object({
                    designId: z.string().trim().min(1).max(160),
                })
                .strict(),
        })
        .strict(),
    z
        .object({
            action: z.literal('designs.facets.status'),
            input: z
                .object({
                    jobId: z.string().trim().min(1).max(160),
                })
                .strict(),
        })
        .strict(),
    z
        .object({
            action: z.literal('sales.summary'),
            input: merchbaseSalesFiltersSchema.default(merchbaseSalesFilterDefaults),
        })
        .strict(),
    z
        .object({
            action: z.literal('sales.records'),
            input: merchbaseSalesFiltersSchema
                .merge(merchbasePaginationSchema)
                .default(merchbasePaginatedSalesDefaults),
        })
        .strict(),
    z
        .object({
            action: z.literal('sales.series'),
            input: agentRuntimeMerchbaseSalesSeriesInputSchema.default(
                merchbaseSalesSeriesInputDefault
            ),
        })
        .strict(),
    z
        .object({
            action: z.literal('sales.breakdown'),
            input: merchbaseSalesFiltersSchema.merge(merchbasePaginationSchema).extend({
                direction: z.enum(['asc', 'desc']).default('desc'),
                groupBy: merchbaseSalesBreakdownGroupBySchema,
                sort: optionalMerchbaseFilterSchema,
            }),
        })
        .strict(),
]);

export const agentRuntimeMerchbaseActionResultSchema = z
    .object({
        action: agentRuntimeMerchbaseActionNameSchema,
        result: z.unknown(),
    })
    .strict();

export const agentRuntimeAgentEngineConfigSchema = z.record(z.string(), z.unknown());

export const agentRuntimeAgentEngineConfigSnapshotSchema = z.object({
    config: agentRuntimeAgentEngineConfigSchema,
    hash: z.string().trim().min(1),
    issues: z.array(z.unknown()).default([]),
    raw: z.string().nullable(),
    valid: z.boolean().nullable(),
});

export const agentRuntimeApplyAgentEngineConfigSchema = z.object({
    baseHash: z.string().trim().min(1),
    config: agentRuntimeAgentEngineConfigSchema,
});

const agentRuntimeAgentEngineConfigMutationSchema = z.object({});

export const agentRuntimeUpdateAgentNameSchema = agentRuntimeAgentEngineConfigMutationSchema.extend(
    {
        name: z.string().trim().min(1),
    }
);

export const agentRuntimeUpdateAgentModelSchema =
    agentRuntimeAgentEngineConfigMutationSchema.extend({
        model: agentRuntimeModelNameSchema,
    });

export const agentRuntimeUpdateAgentThinkingDefaultSchema =
    agentRuntimeAgentEngineConfigMutationSchema.extend({
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

export const agentRuntimeSaveDiscordBindingSchema =
    agentRuntimeAgentEngineConfigMutationSchema.extend({
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
    });

export const agentRuntimeDeleteDiscordBindingSchema = agentRuntimeAgentEngineConfigMutationSchema;

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
    enabledPluginIds: z.array(agentRuntimePluginIdSchema).optional(),
    enabledSkillIds: z.array(z.string().trim().min(1)),
    id: z.string().trim().min(1),
    isAdmin: z.boolean(),
    name: z.string().trim().min(1),
    modelName: agentRuntimeModelNameSchema.nullable().optional(),
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
    enabledPluginIds: z.array(agentRuntimePluginIdSchema).optional(),
    enabledSkillIds: z.array(z.string().trim().min(1)).optional(),
    id: z.string().trim().min(1),
    isAdmin: z.boolean().optional(),
    name: z.string().trim().min(1),
    primaryColor: z.string().trim().min(1).nullable().optional(),
    workspaceFolder: z.string().trim().min(1).optional(),
});

export const agentRuntimeUpdateAgentSchema = z.object({
    enabledPluginIds: z.array(agentRuntimePluginIdSchema).optional(),
    enabledSkillIds: z.array(z.string().trim().min(1)).optional(),
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
    renderedAt: z.string().datetime().nullable(),
    sha256: z.string().trim().min(1).nullable(),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeWorkspaceFilePathSchema = z
    .string()
    .trim()
    .refine((value) => value.length === 0 || !value.startsWith('/'), {
        message: 'Workspace path must be relative.',
    })
    .refine((value) => !value.includes('\\'), {
        message: 'Workspace path must use forward slashes.',
    })
    .refine(
        (value) =>
            value.length === 0 ||
            value
                .split('/')
                .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
        {
            message: 'Workspace path must stay inside the workspace.',
        }
    );

export const agentRuntimeWorkspaceFileKindSchema = z.enum(['directory', 'file']);

export const agentRuntimeWorkspaceFileEntrySchema = z.object({
    kind: agentRuntimeWorkspaceFileKindSchema,
    mediaType: z.string().trim().min(1).nullable(),
    name: z.string().trim().min(1),
    path: z.string().trim().min(1),
    sizeBytes: z.number().int().nonnegative().nullable(),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeWorkspaceFileListInputSchema = z.object({
    path: agentRuntimeWorkspaceFilePathSchema.default(''),
});

export const agentRuntimeWorkspaceFileListSchema = z.object({
    entries: z.array(agentRuntimeWorkspaceFileEntrySchema),
    path: agentRuntimeWorkspaceFilePathSchema,
    workspaceRoot: z.string().trim().min(1),
});

export const agentRuntimeWorkspaceFileContentSchema = z.object({
    binary: z.boolean(),
    content: z.string(),
    encoding: z.enum(['base64', 'utf8']),
    language: z.string().trim().min(1).nullable(),
    mediaType: z.string().trim().min(1),
    path: z.string().trim().min(1),
    sizeBytes: z.number().int().nonnegative(),
    truncated: z.boolean(),
    updatedAt: z.string().datetime().nullable(),
    workspaceRoot: z.string().trim().min(1),
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
    // Local content differs from the last Tavern-written version.
    edited: z.boolean().optional(),
    eligible: z.boolean().optional(),
    filePath: z.string().trim().min(1).nullable().optional(),
    id: z.string().trim().min(1),
    install: z.array(agentRuntimeSkillInstallOptionSchema).default([]),
    // Managed source with a Tavern default that can be restored.
    managedSource: z.enum(['seeded', 'hub', 'plugin']).nullable().optional(),
    missing: agentRuntimeSkillRequirementsSchema,
    modelVisible: z.boolean().optional(),
    name: z.string().trim().min(1),
    primaryEnv: z.string().trim().min(1).nullable().optional(),
    requirements: agentRuntimeSkillRequirementsSchema,
    runtimeSource: z.string().trim().min(1).nullable().optional(),
    skillKey: z.string().trim().min(1).nullable().optional(),
    source: agentRuntimeSkillSourceSchema,
    // The current Tavern version differs from the last written version.
    updateAvailable: z.boolean().optional(),
    updatedAt: z.string().datetime().nullable(),
    userInvocable: z.boolean().optional(),
});

export const agentRuntimeSkillListSchema = z.object({
    skills: z.array(agentRuntimeSkillSummarySchema),
});

export const agentRuntimeToolSchema = z.object({
    configured: z.boolean(),
    description: z.string().nullable(),
    enabled: z.boolean(),
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    name: z.string().trim().min(1),
    readOnly: z.boolean().default(false),
    tools: z.array(z.string().trim().min(1)).default([]),
});

export const agentRuntimeToolListSchema = z.object({
    tools: z.array(agentRuntimeToolSchema),
});

export const agentRuntimeUpdateToolEnabledSchema = z.object({
    enabled: z.boolean(),
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

export const agentRuntimeUpdateSkillEnabledSchema = z.object({
    enabled: z.boolean(),
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
    activeTurnParticipantIds: z.array(z.string()),
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

export const agentRuntimeModelExecutionKindSchema = z.literal('harness');

export const agentRuntimeModelAvailabilitySchema = z.enum(['available', 'degraded', 'unavailable']);

export const agentRuntimeModelSourceKindSchema = z.enum(['curated', 'live', 'merged']);

export const agentRuntimeModelRouteSchema = z.object({
    baseUrl: z.string().trim().url().nullable().default(null),
    model: z.string().trim().min(1),
    provider: z.string().trim().min(1),
});

export const agentRuntimeModelCatalogEntrySchema = z.object({
    availability: agentRuntimeModelAvailabilitySchema.default('available'),
    executionKind: agentRuntimeModelExecutionKindSchema.default('harness'),
    id: z.string().trim().min(1),
    label: z.string().trim().min(1).nullable(),
    metadata: agentRuntimeJsonRecordSchema.default({}),
    provider: z.string().trim().min(1).nullable(),
    route: agentRuntimeModelRouteSchema,
    sourceKind: agentRuntimeModelSourceKindSchema.default('curated'),
});

export const agentRuntimeModelProviderAuthTypeSchema = z.enum([
    'api_key',
    'aws_sdk',
    'external_process',
    'oauth_device_code',
    'oauth_external',
    'oauth_minimax',
]);

export const agentRuntimeModelProviderOAuthFlowSchema = z.enum([
    'device_code',
    'external',
    'loopback',
    'pkce',
]);

export const agentRuntimeModelProviderEntrySchema = z.object({
    authenticated: z.boolean(),
    authType: agentRuntimeModelProviderAuthTypeSchema.nullable(),
    id: z.string().trim().min(1),
    keyEnv: z.string().trim().min(1).nullable(),
    label: z.string().trim().min(1),
    modelCount: z.number().int().nonnegative(),
    oauthFlow: agentRuntimeModelProviderOAuthFlowSchema.nullable().default(null),
    warning: z.string().trim().min(1).nullable(),
});

export const agentRuntimeModelProviderAccessStateSchema = z.enum([
    'error',
    'live',
    'needs-auth',
    'unavailable',
]);

export const agentRuntimeModelProviderSetupActionSchema = z.enum([
    'api-key',
    'external',
    'manual',
    'oauth',
    'system',
]);

export const agentRuntimeModelProviderCatalogEntrySchema = z.object({
    accessDescription: z.string().trim().min(1),
    accessState: agentRuntimeModelProviderAccessStateSchema,
    authType: agentRuntimeModelProviderAuthTypeSchema.nullable(),
    enabled: z.boolean(),
    id: z.string().trim().min(1),
    keyEnv: z.string().trim().min(1).nullable(),
    label: z.string().trim().min(1),
    oauthFlow: agentRuntimeModelProviderOAuthFlowSchema.nullable().default(null),
    setupAction: agentRuntimeModelProviderSetupActionSchema,
    setupCommand: z.string().trim().min(1).nullable(),
});

export const agentRuntimeModelProviderCatalogSchema = z.object({
    providers: z.array(agentRuntimeModelProviderCatalogEntrySchema),
    updatedAt: z.string().datetime(),
});

export const agentRuntimeModelProviderEnabledSchema = z.object({
    providers: z.array(agentRuntimeModelProviderCatalogEntrySchema),
    updatedAt: z.string().datetime(),
});

export const agentRuntimeUpdateModelProviderSchema = z.object({
    enabled: z.boolean().default(true),
});

export const agentRuntimeModelProviderApiKeyOptionSchema = z.object({
    description: z.string().trim().min(1).nullable(),
    docsUrl: z.string().url().nullable(),
    envKey: z.string().trim().min(1),
    isSet: z.boolean(),
    label: z.string().trim().min(1),
    providerHint: z.string().trim().min(1).nullable(),
});

export const agentRuntimeModelsSchema = z.object({
    apiKeyOptions: z.array(agentRuntimeModelProviderApiKeyOptionSchema).default([]),
    models: z.array(agentRuntimeModelCatalogEntrySchema),
    providers: z.array(agentRuntimeModelProviderEntrySchema).default([]),
    updatedAt: z.string().datetime().nullable(),
});

export const wikiConfigSourceSchema = z.enum(['default', 'environment', 'settings']);

export const wikiPageLinkSchema = z.object({
    label: z.string().trim().min(1).nullable(),
    target: z.string().trim().min(1),
});

export const wikiPageSummarySchema = z.object({
    path: z.string().trim().min(1),
    title: z.string().trim().min(1),
    updatedAt: z.string().datetime(),
});

export const wikiPageSchema = wikiPageSummarySchema.extend({
    body: z.string(),
    frontmatter: z.record(z.string(), z.unknown()).default({}),
    links: z.array(wikiPageLinkSchema).default([]),
    size: z.number().int().nonnegative(),
    wikiPath: z.string().trim().min(1),
});

export const wikiPageListSchema = z.object({
    folders: z.array(z.string().trim().min(1)).default([]),
    pages: z.array(wikiPageSummarySchema),
});

export const wikiPathKindSchema = z.enum(['folder', 'page']);

export const wikiCreatePageSchema = z.object({
    body: z.string().optional(),
    path: z.string().trim().min(1, 'Enter a page path.'),
});

export const wikiSavePageSchema = z.object({
    body: z.string(),
    path: z.string().trim().min(1, 'Enter a page path.'),
});

export const wikiPathInputSchema = z.object({
    path: z.string().trim().min(1, 'Enter a Wiki path.'),
});

export const wikiMovePathSchema = z.object({
    fromPath: z.string().trim().min(1, 'Enter the current path.'),
    kind: wikiPathKindSchema,
    toPath: z.string().trim().min(1, 'Enter the new path.'),
});

export const wikiPathMutationResultSchema = z.object({
    kind: wikiPathKindSchema,
    page: wikiPageSchema.nullable().default(null),
    path: z.string().trim().min(1),
});

export const wikiSearchInputSchema = z.object({
    limit: z.number().int().positive().max(100).default(20),
    offset: z.number().int().nonnegative().default(0),
    query: z.string().trim().min(1),
});

export const wikiSearchHitSchema = z.object({
    page: wikiPageSummarySchema,
    score: z.number().nonnegative(),
    snippet: z.string().default(''),
});

export const wikiSearchResultSchema = z.object({
    hits: z.array(wikiSearchHitSchema),
    limit: z.number().int().positive().default(20),
    offset: z.number().int().nonnegative().default(0),
    query: z.string().trim().min(1),
    totalHitCount: z.number().int().nonnegative(),
});

export const wikiBacklinkSchema = z.object({
    fromPath: z.string().trim().min(1),
    fromTitle: z.string().trim().min(1),
    label: z.string().trim().min(1).nullable(),
    targetPath: z.string().trim().min(1),
});

export const wikiBacklinkListSchema = z.object({
    links: z.array(wikiBacklinkSchema),
    targetPath: z.string().trim().min(1),
});

export const wikiFreshnessStateSchema = z.enum(['idle', 'watching', 'degraded']);

export const wikiFreshnessSchema = z.object({
    live: z.boolean(),
    reason: z.string().trim().min(1).nullable(),
    state: wikiFreshnessStateSchema,
});

export const wikiStatusSchema = z.object({
    configSource: wikiConfigSourceSchema,
    freshness: wikiFreshnessSchema.default({
        live: false,
        reason: 'Wiki live updates have not started.',
        state: 'idle',
    }),
    indexExists: z.boolean(),
    pageCount: z.number().int().nonnegative(),
    readable: z.boolean(),
    wikiPath: z.string().trim().min(1),
    writable: z.boolean(),
});

export const agentRuntimeWikiSettingsSchema = z.object({
    configSource: wikiConfigSourceSchema,
    configuredPath: z.string().trim().min(1).nullable(),
    environmentPath: z.string().trim().min(1).nullable(),
    effectivePath: z.string().trim().min(1),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeSaveWikiSettingsSchema = z.object({
    wikiPath: z.string().trim().min(1, 'Enter a Wiki path.'),
});

export const agentRuntimeSaveWikiSettingsResultSchema = agentRuntimeWikiSettingsSchema.extend({
    restartScheduled: z.boolean(),
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
    lastDurationMs: z.number().int().nonnegative().optional(),
    lastErrorCode: agentRuntimeExecutionErrorSchema.shape.code.optional(),
    lastErrorMessage: agentRuntimeExecutionErrorSchema.shape.message.optional(),
    lastRunAtMs: z.number().int().nonnegative().optional(),
    lastRunStatus: agentRuntimeExecutionStatusSchema.optional(),
    nextRunAtMs: z.number().int().nonnegative().optional(),
    runningAtMs: z.number().int().nonnegative().optional(),
});

export const agentRuntimeCronPayloadSchema = z.union([
    z.object({
        kind: z.literal('systemEvent'),
        text: z.string().trim().min(1),
    }),
    z.object({
        kind: z.literal('agentTurn'),
        message: z.string().trim().min(1),
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

export const agentRuntimeCronSummarySchema = z.object({
    agentId: z.string().trim().min(1),
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
    delivery: agentRuntimeCronDeliverySchema,
    payload: agentRuntimeCronPayloadSchema,
});

export const agentRuntimeCronListSchema = z.object({
    jobs: z.array(agentRuntimeCronSummarySchema),
});

export const agentRuntimeCreateCronSchema = z.object({
    agentId: z.string().trim().min(1),
    deleteAfterRun: z.boolean().optional(),
    delivery: agentRuntimeCronDeliverySchema,
    description: z.string().trim().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    payload: agentRuntimeCronPayloadSchema,
    schedule: agentRuntimeCronScheduleSchema,
});

export const agentRuntimeUpdateCronSchema = z.object({
    agentId: z.string().trim().min(1).optional(),
    deleteAfterRun: z.boolean().optional(),
    delivery: agentRuntimeCronDeliverySchema.optional(),
    description: z.string().trim().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    name: z.string().trim().min(1).optional(),
    payload: agentRuntimeCronPayloadSchema.optional(),
    schedule: agentRuntimeCronScheduleSchema.optional(),
});

export const agentRuntimeArchiveCronSchema = z.object({
    archived: z.literal(true),
    id: z.string().trim().min(1),
});

export const agentRuntimeCronRunStatusSchema = agentRuntimeExecutionStatusSchema;

export const agentRuntimeCronRunTriggerSchema = z.enum(['manual', 'recovery', 'schedule']);

export const agentRuntimeCronRunSchema = z.object({
    chatId: z.string().trim().min(1).nullable(),
    executionErrorCode: agentRuntimeExecutionErrorSchema.shape.code.nullable(),
    executionErrorMessage: agentRuntimeExecutionErrorSchema.shape.message.nullable(),
    finishedAt: z.string().datetime().nullable(),
    id: z.string().trim().min(1),
    jobId: z.string().trim().min(1),
    scheduledFor: z.string().datetime(),
    startedAt: z.string().datetime().nullable(),
    status: agentRuntimeCronRunStatusSchema,
    trigger: agentRuntimeCronRunTriggerSchema,
    turnId: z.string().trim().min(1).nullable(),
});

export const agentRuntimeCronRunListSchema = z.object({
    runs: z.array(agentRuntimeCronRunSchema),
});

export const agentRuntimeTaskKindSchema = z.enum(['task', 'epic']);

export const agentRuntimeTaskStatusSchema = z.enum([
    'backlog',
    'todo',
    'in_progress',
    'done',
    'canceled',
]);

export const agentRuntimeTaskPrioritySchema = z.enum(['none', 'urgent', 'high', 'medium', 'low']);

export const agentRuntimeTaskAssigneeSchema = z.union([
    z.object({
        kind: z.literal('user'),
    }),
    z.object({
        agentId: z.string().trim().min(1),
        kind: z.literal('agent'),
    }),
]);

export const agentRuntimeTaskSchema = z.object({
    assignee: agentRuntimeTaskAssigneeSchema.nullable(),
    createdAt: z.string().datetime(),
    description: z.string().nullable(),
    epicId: z.string().trim().min(1).nullable(),
    id: z.string().trim().min(1),
    kind: agentRuntimeTaskKindSchema,
    labels: z.array(z.string().trim().min(1)),
    number: z.number().int().positive(),
    priority: agentRuntimeTaskPrioritySchema,
    status: agentRuntimeTaskStatusSchema,
    title: z.string().trim().min(1),
    updatedAt: z.string().datetime(),
});

export const agentRuntimeTaskListSchema = z.object({
    tasks: z.array(agentRuntimeTaskSchema),
});

export const agentRuntimeCreateTaskSchema = z.object({
    assignee: agentRuntimeTaskAssigneeSchema.nullable().optional(),
    description: z.string().trim().min(1).nullable().optional(),
    epicId: z.string().trim().min(1).nullable().optional(),
    id: z.string().trim().min(1),
    kind: agentRuntimeTaskKindSchema.optional(),
    labels: z.array(z.string().trim().min(1)).optional(),
    priority: agentRuntimeTaskPrioritySchema.optional(),
    status: agentRuntimeTaskStatusSchema.optional(),
    title: z.string().trim().min(1),
});

export const agentRuntimeUpdateTaskSchema = z.object({
    assignee: agentRuntimeTaskAssigneeSchema.nullable().optional(),
    description: z.string().trim().min(1).nullable().optional(),
    epicId: z.string().trim().min(1).nullable().optional(),
    labels: z.array(z.string().trim().min(1)).optional(),
    priority: agentRuntimeTaskPrioritySchema.optional(),
    status: agentRuntimeTaskStatusSchema.optional(),
    title: z.string().trim().min(1).optional(),
});

export const agentRuntimeFrontendSchema = z.enum(['cli', 'discord', 'sdk', 'tavern', 'telegram']);

export const agentRuntimeAgentSessionStatusSchema = z.enum(['active', 'archived', 'stopped']);

export const agentRuntimeAgentSessionSchema = z.object({
    agentId: z.string().trim().min(1),
    agentParticipantId: z.string().trim().min(1),
    archivedAt: z.string().datetime().nullable(),
    chatId: z.string().trim().min(1),
    createdAt: z.string().datetime(),
    effectiveModel: agentRuntimeModelNameSchema,
    generation: z.number().int().positive(),
    id: z.string().trim().min(1),
    promptContextSequence: z.number().int().nonnegative().default(0),
    resumeState: agentRuntimeJsonRecordSchema.nullable(),
    runtimeSessionId: z.string().trim().min(1).nullable(),
    status: agentRuntimeAgentSessionStatusSchema,
    updatedAt: z.string().datetime(),
});

export const agentRuntimeProfileSchema = z.object({
    agentId: z.string().trim().min(1),
    defaultModel: agentRuntimeModelNameSchema,
    sandboxMode: z.enum(['docker', 'none', 'podman']).default('none'),
    updatedAt: z.string().datetime(),
});

// Aggregated from the session's durable turn evidence. Null when there is no
// current session.
export const agentRuntimeAgentSessionStatsSchema = z.object({
    contextTokens: z.number().int().nonnegative().nullable(),
    turnCount: z.number().int().nonnegative(),
});

// High-level history entry for a seat's earlier sessions: enough for a list
// row, never the session's resume state.
export const agentRuntimeAgentSessionSummarySchema = z.object({
    archivedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    effectiveModel: agentRuntimeModelNameSchema,
    id: z.string().trim().min(1),
    status: agentRuntimeAgentSessionStatusSchema,
    turnCount: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
});

export const agentRuntimeCurrentAgentSessionResultSchema = z.object({
    // Newest first, excluding the current session.
    pastSessions: z.array(agentRuntimeAgentSessionSummarySchema),
    session: agentRuntimeAgentSessionSchema.nullable(),
    stats: agentRuntimeAgentSessionStatsSchema.nullable(),
});

// Rotates the agent seat's current session so the chat's next message opens a
// brand-new engine session. Timeline stays untouched; the reset lands as a
// durable new-session notice row.
export const agentRuntimeResetAgentSessionSchema = z.object({
    agentId: z.string().trim().min(1),
});

export const agentRuntimeResetAgentSessionResultSchema = z.object({
    session: agentRuntimeAgentSessionSchema,
});

export const agentRuntimeRunCronSchema = z.object({
    // 'force' executes inline and holds the request open for the whole agent
    // turn; manual runs default to the queue so the app gets its run row fast.
    mode: z.enum(['enqueue', 'force']).default('enqueue'),
});

export const agentRuntimeJobSlugSchema = z.enum(['refresh-runtime-capabilities']);

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

export const agentRuntimeTavernMessageMetadataSchema = z.object({}).passthrough();

export const agentRuntimeMessageMetadataSchema = z
    .object({
        api: z.string().trim().min(1).nullable().optional(),
        tavern: agentRuntimeTavernMessageMetadataSchema.optional(),
        cacheReadTokens: z.number().int().nonnegative().nullable().optional(),
        cacheWriteTokens: z.number().int().nonnegative().nullable().optional(),
        inputTokens: z.number().int().nonnegative().nullable().optional(),
        isError: z.boolean().nullable().optional(),
        model: z.string().trim().min(1).optional(),
        agentApi: z.string().trim().min(1).optional(),
        agentModel: z.string().trim().min(1).optional(),
        agentProvider: z.string().trim().min(1).optional(),
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
    target: z.string().trim().min(1),
    type: z.string().trim().min(1),
});

export const agentRuntimeCreateMessageSchema = z.object({
    agent: agentRuntimeAgentBindingSchema,
    message: z
        .object({
            attachments: z.array(agentRuntimeSessionMessageAttachmentSchema).optional(),
            content: z.string().trim(),
            id: z.string().trim().min(1),
            metadata: agentRuntimeMessageMetadataSchema.optional(),
            modelRef: z.string().trim().min(1).optional(),
            nonce: z.string().trim().min(1).optional(),
            parentMessageId: z.string().trim().min(1).nullable().optional(),
            threadRootId: z.string().trim().min(1).nullable().optional(),
        })
        .refine(
            (message) => message.content.trim().length > 0 || Boolean(message.attachments?.length),
            {
                message: 'A runtime message requires text or attachments.',
                path: ['content'],
            }
        ),
    target: chatTargetSchema,
});

export const agentRuntimeMessageAcceptedSchema = z.object({
    acceptedAt: z.string().datetime(),
    cursor: z.number().int().positive().optional(),
    messageId: z.string().trim().min(1).optional(),
    nonce: z.string().trim().min(1).optional(),
    runId: z.string().trim().min(1),
    sequence: z.number().int().positive().optional(),
    status: z.literal('accepted'),
});

export const agentRuntimeStopTurnSchema = z.object({
    runId: z.string().trim().min(1),
});

export const agentRuntimeStopTurnResultSchema = z.object({
    runId: z.string().trim().min(1),
    stopped: z.boolean(),
});

export const agentRuntimeSteerTurnSchema = z.object({
    content: z.string().trim().min(1),
    metadata: agentRuntimeMessageMetadataSchema.optional(),
    runId: z.string().trim().min(1),
});

export const agentRuntimeSteerTurnResultSchema = z.object({
    runId: z.string().trim().min(1),
    steered: z.boolean(),
});

export const agentRuntimeClarificationDispositionSchema = z.enum([
    'answered',
    'skipped',
    'timeout',
]);

export const agentRuntimeClarificationPromptSchema = z.object({
    answer: z.string().nullable().optional(),
    choices: z.array(z.string().trim().min(1)).default([]),
    deadlineAt: z.string().datetime().nullable().optional(),
    disposition: agentRuntimeClarificationDispositionSchema.nullable().optional(),
    question: z.string().trim().min(1),
    requestId: z.string().trim().min(1),
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

export const agentRuntimeTurnSchema = z.object({
    agentId: z.string().trim().min(1),
    chatId: z.string().trim().min(1),
    runId: z.string().trim().min(1),
    sessionKey: z.string().trim().min(1),
    startedAt: z.string().datetime(),
});

export const agentRuntimeTurnProgressStatusSchema = z.enum(['active', 'completed', 'failed']);
export const agentRuntimeMessagePhaseSchema = z.enum(['commentary', 'final_answer']);

export const agentRuntimeWidgetProgressSchema = z.object({
    component: z.string().trim().min(1).nullable(),
    fallbackText: z.string().trim().min(1),
    id: z.string().trim().min(1),
    props: z.unknown().nullable(),
    target: z.string().trim().min(1).nullable(),
    validationError: z.string().trim().min(1).nullable(),
});

export const agentRuntimeTurnProgressStepSchema = z.object({
    detail: z.string().trim().min(1).nullable().optional(),
    id: z.string().trim().min(1),
    kind: z.enum([
        'artifact',
        'command',
        'message',
        'notice',
        'reasoning',
        'tool',
        'widget',
        'worker',
    ]),
    label: z.string().trim().min(1),
    messagePhase: agentRuntimeMessagePhaseSchema.optional(),
    status: agentRuntimeTurnProgressStatusSchema,
    clarification: agentRuntimeClarificationPromptSchema.optional(),
    toolCallId: z.string().trim().min(1).nullable().optional(),
    toolName: z.string().trim().min(1).nullable().optional(),
    widget: agentRuntimeWidgetProgressSchema.optional(),
});

export const agentRuntimeEventTypeSchema = z.enum([
    'agent.updated',
    'chat.historyChanged',
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
    'task.updated',
    'task.deleted',
    'memoryJob.updated',
    'wiki.changed',
    'turn.started',
    'turn.progress',
    'turn.replyUpdated',
    'turn.statusUpdated',
    'turn.steered',
    'turn.completed',
    'turn.cancelled',
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
    timestamp: z.string().datetime(),
    type: z.literal('chat.messageAccepted'),
});

// Durable rows were dismissed or cleared; clients refetch the chat log
// instead of patching caches row by row.
export const agentRuntimeChatHistoryChangedEventSchema = z.object({
    chatId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('chat.historyChanged'),
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

export const agentRuntimeTaskUpdatedEventSchema = z.object({
    taskId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('task.updated'),
});

export const agentRuntimeTaskDeletedEventSchema = z.object({
    taskId: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: z.literal('task.deleted'),
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

export const agentRuntimeMemoryJobUpdatedEventSchema = z.object({
    jobId: z.string().trim().min(1).optional(),
    timestamp: z.string().datetime(),
    type: z.literal('memoryJob.updated'),
});

export const agentRuntimeWikiChangedScopeSchema = z.enum(['content', 'root']);
export const agentRuntimeWikiChangedReasonSchema = z.enum(['watch', 'bulk', 'settings']);

export const agentRuntimeWikiChangedEventSchema = z.object({
    paths: z.array(z.string().trim().min(1)).default([]),
    reason: agentRuntimeWikiChangedReasonSchema.optional(),
    scope: agentRuntimeWikiChangedScopeSchema,
    timestamp: z.string().datetime(),
    type: z.literal('wiki.changed'),
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

export const agentRuntimeTurnStatusUpdatedEventSchema = z.object({
    sequence: z.number().int().positive(),
    timestamp: z.string().datetime(),
    turn: agentRuntimeTurnSchema,
    type: z.literal('turn.statusUpdated'),
});

export const agentRuntimeTurnCompletedEventSchema = z.object({
    timestamp: z.string().datetime(),
    turn: agentRuntimeTurnSchema,
    type: z.literal('turn.completed'),
});

export const agentRuntimeTurnCancelledEventSchema = z.object({
    timestamp: z.string().datetime(),
    turn: agentRuntimeTurnSchema,
    type: z.literal('turn.cancelled'),
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

export const agentRuntimeEngineRestartPhaseSchema = z.enum([
    'scheduled',
    'restarting',
    'completed',
]);

export const agentRuntimeEngineRestartEventSchema = z.object({
    phase: agentRuntimeEngineRestartPhaseSchema,
    timestamp: z.string().datetime(),
    type: z.literal('engine.restart'),
});

export const agentRuntimeEventSchema = z.discriminatedUnion('type', [
    agentRuntimeAgentUpdatedEventSchema,
    agentRuntimeEngineRestartEventSchema,
    agentRuntimeChatHistoryChangedEventSchema,
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
    agentRuntimeTaskUpdatedEventSchema,
    agentRuntimeTaskDeletedEventSchema,
    agentRuntimeMemoryJobUpdatedEventSchema,
    agentRuntimeWikiChangedEventSchema,
    agentRuntimeCapabilityUpdatedEventSchema,
    agentRuntimeTurnStartedEventSchema,
    agentRuntimeTurnProgressEventSchema,
    agentRuntimeTurnReplyUpdatedEventSchema,
    agentRuntimeTurnStatusUpdatedEventSchema,
    agentRuntimeTurnSteeredEventSchema,
    agentRuntimeTurnCompletedEventSchema,
    agentRuntimeTurnCancelledEventSchema,
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
export type AgentRuntimeMemoryJobUpdatedEvent = z.infer<
    typeof agentRuntimeMemoryJobUpdatedEventSchema
>;
export type AgentRuntimeExecutionError = z.infer<typeof agentRuntimeExecutionErrorSchema>;
export type AgentRuntimeExecutionErrorCode = z.infer<typeof agentRuntimeExecutionErrorCodeSchema>;
export type AgentRuntimeExecutionStatus = z.infer<typeof agentRuntimeExecutionStatusSchema>;
export type AgentRuntimeEvent = z.infer<typeof agentRuntimeEventSchema>;
export type AgentRuntimeEngineRestartPhase = z.infer<typeof agentRuntimeEngineRestartPhaseSchema>;
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
export type AgentRuntimePlugin = z.infer<typeof agentRuntimePluginSchema>;
export type AgentRuntimeAgentPluginGrant = z.infer<typeof agentRuntimeAgentPluginGrantSchema>;
export type AgentRuntimeAgentPluginGrantList = z.infer<
    typeof agentRuntimeAgentPluginGrantListSchema
>;
export type AgentRuntimePluginId = z.infer<typeof agentRuntimePluginIdSchema>;
export type AgentRuntimePluginList = z.infer<typeof agentRuntimePluginListSchema>;
export type AgentRuntimeUpdateAgentPluginGrant = z.infer<
    typeof agentRuntimeUpdateAgentPluginGrantSchema
>;
export type AgentRuntimeMerchbaseSalesSeries = z.infer<
    typeof agentRuntimeMerchbaseSalesSeriesSchema
>;
export type AgentRuntimeMerchbaseSalesSeriesInput = z.input<
    typeof agentRuntimeMerchbaseSalesSeriesInputSchema
>;
export type AgentRuntimeMerchbaseActionInput = z.input<
    typeof agentRuntimeMerchbaseActionInputSchema
>;
export type AgentRuntimeMerchbaseActionResult = z.infer<
    typeof agentRuntimeMerchbaseActionResultSchema
>;
export type AgentRuntimeMerchbaseSettings = z.infer<typeof agentRuntimeMerchbaseSettingsSchema>;
export type AgentRuntimeSaveMerchbaseSettings = z.infer<
    typeof agentRuntimeSaveMerchbaseSettingsSchema
>;
export type AgentRuntimeGoogleSettings = z.infer<typeof agentRuntimeGoogleSettingsSchema>;
export type AgentRuntimeSaveGoogleSettings = z.infer<typeof agentRuntimeSaveGoogleSettingsSchema>;
export type AgentRuntimeStartGoogleOAuth = z.infer<typeof agentRuntimeStartGoogleOAuthSchema>;
export type AgentRuntimeGoogleOAuthStart = z.infer<typeof agentRuntimeGoogleOAuthStartSchema>;
export type AgentRuntimeGoogleOAuthPollInput = z.infer<
    typeof agentRuntimeGoogleOAuthPollInputSchema
>;
export type AgentRuntimeCompleteGoogleOAuth = z.infer<typeof agentRuntimeCompleteGoogleOAuthSchema>;
export type AgentRuntimeGoogleOAuthPoll = z.infer<typeof agentRuntimeGoogleOAuthPollSchema>;
export type AgentRuntimeGoogleCalendarEventsListInput = z.input<
    typeof agentRuntimeGoogleCalendarEventsListInputSchema
>;
export type AgentRuntimeGoogleCalendarEventsList = z.infer<
    typeof agentRuntimeGoogleCalendarEventsListSchema
>;
export type AgentRuntimeGoogleCalendarEventCreateInput = z.input<
    typeof agentRuntimeGoogleCalendarEventCreateInputSchema
>;
export type AgentRuntimeGoogleCalendarEventCreate = z.infer<
    typeof agentRuntimeGoogleCalendarEventCreateSchema
>;
export type AgentRuntimeBinding = z.infer<typeof agentRuntimeBindingSchema>;
export type AgentRuntimeBindingList = z.infer<typeof agentRuntimeBindingListSchema>;
export type AgentRuntimeBindingMatch = z.infer<typeof agentRuntimeBindingMatchSchema>;
export type PlatformBindingStatus = z.infer<typeof agentRuntimeBindingStatusSchema>;
export type WikiBacklink = z.infer<typeof wikiBacklinkSchema>;
export type WikiBacklinkList = z.infer<typeof wikiBacklinkListSchema>;
export type WikiConfigSource = z.infer<typeof wikiConfigSourceSchema>;
export type WikiCreatePage = z.infer<typeof wikiCreatePageSchema>;
export type WikiFreshness = z.infer<typeof wikiFreshnessSchema>;
export type WikiFreshnessState = z.infer<typeof wikiFreshnessStateSchema>;
export type WikiMovePath = z.infer<typeof wikiMovePathSchema>;
export type WikiPage = z.infer<typeof wikiPageSchema>;
export type WikiPageList = z.infer<typeof wikiPageListSchema>;
export type WikiPageSummary = z.infer<typeof wikiPageSummarySchema>;
export type WikiPathInput = z.infer<typeof wikiPathInputSchema>;
export type WikiPathKind = z.infer<typeof wikiPathKindSchema>;
export type WikiPathMutationResult = z.infer<typeof wikiPathMutationResultSchema>;
export type WikiSavePage = z.infer<typeof wikiSavePageSchema>;
export type WikiSearchInput = z.input<typeof wikiSearchInputSchema>;
export type WikiSearchResult = z.infer<typeof wikiSearchResultSchema>;
export type WikiStatus = z.infer<typeof wikiStatusSchema>;
export type WikiPageLink = z.infer<typeof wikiPageLinkSchema>;
export type AgentRuntimeWikiSettings = z.infer<typeof agentRuntimeWikiSettingsSchema>;
export type AgentRuntimeSaveWikiSettings = z.infer<typeof agentRuntimeSaveWikiSettingsSchema>;
export type AgentRuntimeSaveWikiSettingsResult = z.infer<
    typeof agentRuntimeSaveWikiSettingsResultSchema
>;
export type AgentRuntimeModelAccess = z.infer<typeof agentRuntimeModelAccessSchema>;
export type AgentRuntimeModelAccessId = z.infer<typeof agentRuntimeModelAccessIdSchema>;
export type AgentRuntimeModelAccessState = z.infer<typeof agentRuntimeModelAccessStateSchema>;
export type AgentRuntimeModelAccessStatus = z.infer<typeof agentRuntimeModelAccessStatusSchema>;
export type AgentRuntimeSaveModelProviderApiKey = z.infer<
    typeof agentRuntimeSaveModelProviderApiKeySchema
>;
export type AgentRuntimeModelProviderAccessState = z.infer<
    typeof agentRuntimeModelProviderAccessStateSchema
>;
export type AgentRuntimeModelProviderCatalog = z.infer<
    typeof agentRuntimeModelProviderCatalogSchema
>;
export type AgentRuntimeModelProviderCatalogEntry = z.infer<
    typeof agentRuntimeModelProviderCatalogEntrySchema
>;
export type AgentRuntimeModelProviderEnabled = z.infer<
    typeof agentRuntimeModelProviderEnabledSchema
>;
export type AgentRuntimeModelProviderSetupAction = z.infer<
    typeof agentRuntimeModelProviderSetupActionSchema
>;
export type AgentRuntimeUpdateModelProvider = z.infer<typeof agentRuntimeUpdateModelProviderSchema>;
export type AgentRuntimeStartModelProviderOAuth = z.infer<
    typeof agentRuntimeStartModelProviderOAuthSchema
>;
export type AgentRuntimePollModelProviderOAuth = z.infer<
    typeof agentRuntimePollModelProviderOAuthSchema
>;
export type AgentRuntimeCancelModelProviderOAuth = z.infer<
    typeof agentRuntimeCancelModelProviderOAuthSchema
>;
export type AgentRuntimeSubmitModelProviderOAuth = z.infer<
    typeof agentRuntimeSubmitModelProviderOAuthSchema
>;
export type AgentRuntimeModelProviderOAuthStart = z.infer<
    typeof agentRuntimeModelProviderOAuthStartSchema
>;
export type AgentRuntimeModelProviderOAuthPoll = z.infer<
    typeof agentRuntimeModelProviderOAuthPollSchema
>;
export type AgentRuntimeModelProviderOAuthCancel = z.infer<
    typeof agentRuntimeModelProviderOAuthCancelSchema
>;
export type AgentRuntimeModelProviderOAuthSubmit = z.infer<
    typeof agentRuntimeModelProviderOAuthSubmitSchema
>;
export type AgentRuntimeOpenAiSettings = z.infer<typeof agentRuntimeOpenAiSettingsSchema>;
export type AgentRuntimeSaveOpenAiSettings = z.infer<typeof agentRuntimeSaveOpenAiSettingsSchema>;
export type AgentRuntimeOpenRouterSettings = z.infer<typeof agentRuntimeOpenRouterSettingsSchema>;
export type AgentRuntimeModelName = z.infer<typeof agentRuntimeModelNameSchema>;
export type AgentRuntimeModelCategory = z.infer<typeof agentRuntimeModelCategorySchema>;
export type AgentRuntimeModelCategorySelection = z.infer<
    typeof agentRuntimeModelCategorySelectionSchema
>;
export type AgentRuntimeModelCategorySettings = z.infer<
    typeof agentRuntimeModelCategorySettingsSchema
>;
export type AgentRuntimeSaveModelCategorySettings = z.infer<
    typeof agentRuntimeSaveModelCategorySettingsSchema
>;
export type AgentRuntimeSaveModelCategorySettingsResult = z.infer<
    typeof agentRuntimeSaveModelCategorySettingsResultSchema
>;
export type AgentRuntimeTimezoneSettings = z.infer<typeof agentRuntimeTimezoneSettingsSchema>;
export type AgentRuntimeSaveTimezoneSettings = z.infer<
    typeof agentRuntimeSaveTimezoneSettingsSchema
>;
export type AgentRuntimeSaveTimezoneSettingsResult = z.infer<
    typeof agentRuntimeSaveTimezoneSettingsResultSchema
>;
export type AgentRuntimeMemorySettings = z.infer<typeof agentRuntimeMemorySettingsSchema>;
export type AgentRuntimeSaveMemorySettings = z.infer<typeof agentRuntimeSaveMemorySettingsSchema>;
export type AgentRuntimeSaveMemorySettingsResult = z.infer<
    typeof agentRuntimeSaveMemorySettingsResultSchema
>;
export type MemoryDreamRequest = z.infer<typeof memoryDreamRequestSchema>;
export type MemoryDreamResult = z.infer<typeof memoryDreamResultSchema>;
export type MemoryJobDetail = z.infer<typeof memoryJobDetailSchema>;
export type MemoryJobFileChange = z.infer<typeof memoryJobFileChangeSchema>;
export type MemoryJobKind = z.infer<typeof memoryJobKindSchema>;
export type MemoryJobList = z.infer<typeof memoryJobListSchema>;
export type MemoryJobStatus = z.infer<typeof memoryJobStatusSchema>;
export type MemoryJobSummary = z.infer<typeof memoryJobSummarySchema>;
export type MemoryActivityNextRun = z.infer<typeof memoryActivityNextRunSchema>;
export type MemoryActivity = z.infer<typeof memoryActivitySchema>;
export type MemoryActivityList = z.infer<typeof memoryActivityListSchema>;
export type AgentRuntimeAgentEnv = z.infer<typeof agentRuntimeAgentEnvSchema>;
export type AgentRuntimeAgentEnvVariable = z.infer<typeof agentRuntimeAgentEnvVariableSchema>;
export type AgentRuntimeSaveAgentEnv = z.infer<typeof agentRuntimeSaveAgentEnvSchema>;
export type AgentRuntimeSaveAgentEnvResult = z.infer<typeof agentRuntimeSaveAgentEnvResultSchema>;
export type AgentRuntimeAgentEngineConfig = z.infer<typeof agentRuntimeAgentEngineConfigSchema>;
export type AgentRuntimeAgentEngineConfigSnapshot = z.infer<
    typeof agentRuntimeAgentEngineConfigSnapshotSchema
>;
export type AgentRuntimeApplyAgentEngineConfig = z.infer<
    typeof agentRuntimeApplyAgentEngineConfigSchema
>;
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
export type AgentRuntimeModelAvailability = z.infer<typeof agentRuntimeModelAvailabilitySchema>;
export type AgentRuntimeModelExecutionKind = z.infer<typeof agentRuntimeModelExecutionKindSchema>;
export type AgentRuntimeModels = z.infer<typeof agentRuntimeModelsSchema>;
export type AgentRuntimeProfile = z.infer<typeof agentRuntimeProfileSchema>;
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
export type AgentRuntimeWorkspaceFileContent = z.infer<
    typeof agentRuntimeWorkspaceFileContentSchema
>;
export type AgentRuntimeWorkspaceFileEntry = z.infer<typeof agentRuntimeWorkspaceFileEntrySchema>;
export type AgentRuntimeWorkspaceFileList = z.infer<typeof agentRuntimeWorkspaceFileListSchema>;
export type AgentRuntimeWorkspaceFileListInput = z.infer<
    typeof agentRuntimeWorkspaceFileListInputSchema
>;
export type AgentRuntimeWorkspaceInstructionsUpdatedEvent = z.infer<
    typeof agentRuntimeWorkspaceInstructionsUpdatedEventSchema
>;
export type AgentRuntimeUpdateSkillEnabled = z.infer<typeof agentRuntimeUpdateSkillEnabledSchema>;
export type AgentRuntimeSkill = z.infer<typeof agentRuntimeSkillSchema>;
export type AgentRuntimeSkillDeletedEvent = z.infer<typeof agentRuntimeSkillDeletedEventSchema>;
export type AgentRuntimeSkillList = z.infer<typeof agentRuntimeSkillListSchema>;
export type AgentRuntimeSkillSummary = z.infer<typeof agentRuntimeSkillSummarySchema>;
export type AgentRuntimeTool = z.infer<typeof agentRuntimeToolSchema>;
export type AgentRuntimeToolList = z.infer<typeof agentRuntimeToolListSchema>;
export type AgentRuntimeUpdateToolEnabled = z.infer<typeof agentRuntimeUpdateToolEnabledSchema>;
export type AgentRuntimeMacApp = z.infer<typeof agentRuntimeMacAppSchema>;
export type AgentRuntimeMacAppList = z.infer<typeof agentRuntimeMacAppListSchema>;
export type AgentRuntimeSkillUpdatedEvent = z.infer<typeof agentRuntimeSkillUpdatedEventSchema>;
export type AgentRuntimeSaveOpenRouterSettings = z.infer<
    typeof agentRuntimeSaveOpenRouterSettingsSchema
>;
export type AgentRuntimeFrontend = z.infer<typeof agentRuntimeFrontendSchema>;
export type AgentRuntimeAgentSession = z.infer<typeof agentRuntimeAgentSessionSchema>;
export type AgentRuntimeAgentSessionStatus = z.infer<typeof agentRuntimeAgentSessionStatusSchema>;
export type AgentRuntimeCurrentAgentSessionResult = z.infer<
    typeof agentRuntimeCurrentAgentSessionResultSchema
>;
export type AgentRuntimeAgentSessionStats = z.infer<typeof agentRuntimeAgentSessionStatsSchema>;
export type AgentRuntimeAgentSessionSummary = z.infer<typeof agentRuntimeAgentSessionSummarySchema>;
export type AgentRuntimeResetAgentSession = z.infer<typeof agentRuntimeResetAgentSessionSchema>;
export type AgentRuntimeResetAgentSessionResult = z.infer<
    typeof agentRuntimeResetAgentSessionResultSchema
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
export type AgentRuntimeStopTurn = z.infer<typeof agentRuntimeStopTurnSchema>;
export type AgentRuntimeStopTurnResult = z.infer<typeof agentRuntimeStopTurnResultSchema>;
export type AgentRuntimeSteerTurn = z.infer<typeof agentRuntimeSteerTurnSchema>;
export type AgentRuntimeSteerTurnResult = z.infer<typeof agentRuntimeSteerTurnResultSchema>;
export type AgentRuntimeClarificationDisposition = z.infer<
    typeof agentRuntimeClarificationDispositionSchema
>;
export type AgentRuntimeClarificationPrompt = z.infer<typeof agentRuntimeClarificationPromptSchema>;
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
export type AgentRuntimeTurn = z.infer<typeof agentRuntimeTurnSchema>;
export type AgentRuntimeWidgetProgress = z.infer<typeof agentRuntimeWidgetProgressSchema>;
export type AgentRuntimeTurnProgressStep = z.infer<typeof agentRuntimeTurnProgressStepSchema>;
export type AgentRuntimeTurnCompletedEvent = z.infer<typeof agentRuntimeTurnCompletedEventSchema>;
export type AgentRuntimeTurnFailedEvent = z.infer<typeof agentRuntimeTurnFailedEventSchema>;
export type AgentRuntimeTurnStartedEvent = z.infer<typeof agentRuntimeTurnStartedEventSchema>;
export type AgentRuntimeUpsertBinding = z.infer<typeof agentRuntimeUpsertBindingSchema>;
export type AgentRuntimeUpdateAgent = z.infer<typeof agentRuntimeUpdateAgentSchema>;
export type AgentRuntimeUpdateCron = z.infer<typeof agentRuntimeUpdateCronSchema>;
export type AgentRuntimeTask = z.infer<typeof agentRuntimeTaskSchema>;
export type AgentRuntimeTaskAssignee = z.infer<typeof agentRuntimeTaskAssigneeSchema>;
export type AgentRuntimeTaskKind = z.infer<typeof agentRuntimeTaskKindSchema>;
export type AgentRuntimeTaskList = z.infer<typeof agentRuntimeTaskListSchema>;
export type AgentRuntimeTaskPriority = z.infer<typeof agentRuntimeTaskPrioritySchema>;
export type AgentRuntimeTaskStatus = z.infer<typeof agentRuntimeTaskStatusSchema>;
export type AgentRuntimeCreateTask = z.infer<typeof agentRuntimeCreateTaskSchema>;
export type AgentRuntimeUpdateTask = z.infer<typeof agentRuntimeUpdateTaskSchema>;
