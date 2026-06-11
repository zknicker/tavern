import { agentRuntimeExecutionErrorSchema, agentRuntimeExecutionStatusSchema } from '@tavern/api';
import { z } from 'zod';
import { cronScheduleConfigSchema } from './schedule-config.ts';

export const cronDeliverySchema = z.object({
    chatId: z.string().trim().min(1),
});

export const cronDeliveryStatusSchema = z.enum([
    'pending',
    'delivered',
    'session_queued',
    'failed',
    'parent_missing',
    'not_applicable',
]);

export const cronJobStateSchema = z.object({
    lastDelivered: z.boolean().optional(),
    lastDeliveryError: z.string().optional(),
    lastDeliveryStatus: cronDeliveryStatusSchema.optional(),
    lastDurationMs: z.number().int().nonnegative().optional(),
    lastErrorCode: agentRuntimeExecutionErrorSchema.shape.code.optional(),
    lastErrorMessage: agentRuntimeExecutionErrorSchema.shape.message.optional(),
    lastRunAtMs: z.number().int().nonnegative().optional(),
    lastRunStatus: agentRuntimeExecutionStatusSchema.optional(),
    lastStatus: agentRuntimeExecutionStatusSchema.optional(),
    nextRunAtMs: z.number().int().nonnegative().optional(),
    runningAtMs: z.number().int().nonnegative().optional(),
});

export const cronPayloadSchema = z.union([
    z.object({
        kind: z.literal('systemEvent'),
        text: z.string().min(1),
    }),
    z.object({
        fallbacks: z.array(z.string().min(1)).optional(),
        kind: z.literal('agentTurn'),
        lightContext: z.boolean().optional(),
        message: z.string().min(1),
        model: z.string().min(1).optional(),
        thinking: z.string().nullable().optional(),
        timeoutSeconds: z.number().nonnegative().optional(),
    }),
]);

export const cronRunStatusSchema = agentRuntimeExecutionStatusSchema;

export const cronScheduleSchema = z.union([
    z.object({
        at: z.string().min(1),
        kind: z.literal('at'),
    }),
    z.object({
        everyMs: z.number().int().positive(),
        kind: z.literal('every'),
    }),
    z.object({
        expr: z.string().min(1),
        kind: z.literal('cron'),
        tz: z.string().min(1).optional(),
    }),
]);

export const cronWakeModeSchema = z.enum(['next-heartbeat', 'now']);

export const addCronJobParamsSchema = z.object({
    agentId: z.string().trim().min(1).optional(),
    deleteAfterRun: z.boolean().optional(),
    delivery: cronDeliverySchema.nullable().optional(),
    description: z.string().trim().min(1).optional(),
    enabled: z.boolean().optional(),
    name: z.string().trim().min(1),
    payload: cronPayloadSchema,
    scheduleConfig: cronScheduleConfigSchema,
    wakeMode: cronWakeModeSchema,
});

export const updateCronJobPatchSchema = z.object({
    agentId: z.string().trim().min(1).nullable().optional(),
    deleteAfterRun: z.boolean().optional(),
    delivery: cronDeliverySchema.nullable().optional(),
    description: z.string().trim().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    name: z.string().trim().min(1).optional(),
    payload: cronPayloadSchema.optional(),
    scheduleConfig: cronScheduleConfigSchema.optional(),
    state: cronJobStateSchema.partial().optional(),
    wakeMode: cronWakeModeSchema.optional(),
});

export const runCronJobParamsSchema = z.object({
    mode: z.enum(['force', 'enqueue']).default('force'),
});

export const cronJobSummarySchema = z.object({
    agentId: z.string().nullable(),
    description: z.string().nullable(),
    enabled: z.boolean(),
    id: z.string().min(1),
    managed: z.boolean(),
    name: z.string().min(1),
    schedule: cronScheduleSchema,
    state: cronJobStateSchema,
    updatedAt: z.string().datetime(),
});

export const cronJobSchema = cronJobSummarySchema.extend({
    createdAt: z.string().datetime(),
    deleteAfterRun: z.boolean(),
    delivery: cronDeliverySchema.nullable(),
    payload: cronPayloadSchema,
    syncedAt: z.string().datetime(),
    wakeMode: cronWakeModeSchema,
});

export const cronSyncStateSchema = z.object({
    lastAttemptedAt: z.string().datetime().nullable(),
    lastError: z.string().nullable(),
    lastSuccessfulAt: z.string().datetime().nullable(),
});

export const cronListSchema = z.object({
    jobs: z.array(cronJobSummarySchema),
    sync: cronSyncStateSchema,
});

export const getCronJobInputSchema = z.object({
    jobId: z.string().trim().min(1),
});

export const listCronRunsInputSchema = z
    .object({
        jobId: z.string().trim().min(1).optional(),
        limit: z.number().int().positive().max(50).optional(),
    })
    .optional();

export const cronGetSchema = z.object({
    job: cronJobSchema.nullable(),
});

export const cronJobRunStatusSchema = agentRuntimeExecutionStatusSchema;

export const cronJobRunTriggerSchema = z.enum(['manual', 'recovery', 'retry', 'schedule']);

export const cronJobRunSchema = z.object({
    deliveryError: z.string().nullable(),
    deliveryStatus: cronDeliveryStatusSchema.nullable(),
    executionErrorCode: agentRuntimeExecutionErrorSchema.shape.code.nullable(),
    executionErrorMessage: agentRuntimeExecutionErrorSchema.shape.message.nullable(),
    finishedAt: z.string().datetime().nullable(),
    id: z.string().min(1),
    jobId: z.string().min(1),
    scheduledFor: z.string().datetime(),
    sessionId: z.string().min(1).nullable(),
    sessionKey: z.string().min(1).nullable(),
    startedAt: z.string().datetime().nullable(),
    status: cronJobRunStatusSchema,
    summary: z.string().nullable(),
    trigger: cronJobRunTriggerSchema,
});

export const cronJobRunListSchema = z.object({
    runs: z.array(cronJobRunSchema),
});

export const cronRunSchema = z.object({
    agentId: z.string().nullable(),
    deliveryStatus: cronDeliveryStatusSchema.nullable(),
    durationMs: z.number().int().min(0).nullable(),
    error: z.string().nullable(),
    jobId: z.string().min(1),
    providerJobId: z.string().min(1).nullable().default(null),
    runAt: z.string().datetime(),
    runtimeSessionKey: z.string().min(1).nullable(),
    sessionId: z.string().min(1),
    sessionKey: z.string().min(1),
    status: cronRunStatusSchema.nullable(),
    summary: z.string().nullable(),
    syncedAt: z.string().datetime(),
    trigger: cronJobRunTriggerSchema.default('schedule'),
});

export const cronDeliveryTargetSchema = z.object({
    chatId: z.string().trim().min(1),
    label: z.string().min(1),
    platform: z.string().trim().min(1),
    scope: z.enum(['channel', 'dm', 'group', 'topic']).nullable(),
});

export const cronDeliveryTargetListSchema = z.object({
    targets: z.array(cronDeliveryTargetSchema),
});

export const createCronJobInputSchema = addCronJobParamsSchema;

export const updateCronJobInputSchema = z.object({
    jobId: z.string().trim().min(1),
    patch: updateCronJobPatchSchema,
});

export const deleteCronJobInputSchema = z.object({
    jobId: z.string().trim().min(1),
});

export const runCronJobInputSchema = z.object({
    jobId: z.string().trim().min(1),
    mode: runCronJobParamsSchema.shape.mode.default('force'),
});

export const toggleCronJobInputSchema = z.object({
    enabled: z.boolean(),
    jobId: z.string().trim().min(1),
});

export const cronMutationResultSchema = z.object({
    success: z.literal(true),
    synced: z.boolean(),
});

export type CronJob = z.infer<typeof cronJobSchema>;
export type CronList = z.infer<typeof cronListSchema>;
export type CronJobSummary = z.infer<typeof cronJobSummarySchema>;
export type CronDeliveryTarget = z.infer<typeof cronDeliveryTargetSchema>;
export type CronDeliveryTargetList = z.infer<typeof cronDeliveryTargetListSchema>;
export type CronJobRun = z.infer<typeof cronJobRunSchema>;
export type CronRun = z.infer<typeof cronRunSchema>;
export type CronSyncState = z.infer<typeof cronSyncStateSchema>;
