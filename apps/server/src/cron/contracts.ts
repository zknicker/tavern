import { agentRuntimeExecutionErrorSchema, agentRuntimeExecutionStatusSchema } from '@tavern/api';
import * as z from 'zod';
import { cronScheduleConfigSchema } from './schedule-config.ts';

export const cronDeliverySchema = z.object({
    chatId: z.string().trim().min(1),
});

export const cronJobStateSchema = z.object({
    lastDurationMs: z.number().int().nonnegative().optional(),
    lastErrorCode: agentRuntimeExecutionErrorSchema.shape.code.optional(),
    lastErrorMessage: agentRuntimeExecutionErrorSchema.shape.message.optional(),
    lastRunAtMs: z.number().int().nonnegative().optional(),
    lastRunStatus: agentRuntimeExecutionStatusSchema.optional(),
    nextRunAtMs: z.number().int().nonnegative().optional(),
    runningAtMs: z.number().int().nonnegative().optional(),
});

export const cronPayloadSchema = z.union([
    z.object({
        kind: z.literal('systemEvent'),
        text: z.string().min(1),
    }),
    z.object({
        kind: z.literal('agentTurn'),
        message: z.string().min(1),
    }),
    z.object({
        command: z.string().min(1),
        kind: z.literal('script'),
        workingDir: z.string().min(1).optional(),
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

export const addCronJobParamsSchema = z.object({
    agentId: z.string().trim().min(1),
    deleteAfterRun: z.boolean().optional(),
    delivery: cronDeliverySchema,
    description: z.string().trim().min(1).optional(),
    enabled: z.boolean().optional(),
    name: z.string().trim().min(1),
    payload: cronPayloadSchema,
    scheduleConfig: cronScheduleConfigSchema,
});

export const updateCronJobPatchSchema = z.object({
    agentId: z.string().trim().min(1).optional(),
    deleteAfterRun: z.boolean().optional(),
    delivery: cronDeliverySchema.optional(),
    description: z.string().trim().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    name: z.string().trim().min(1).optional(),
    payload: cronPayloadSchema.optional(),
    scheduleConfig: cronScheduleConfigSchema.optional(),
});

export const runCronJobParamsSchema = z.object({
    mode: z.enum(['force', 'enqueue']).default('enqueue'),
});

export const cronModeSchema = z.enum(['agentTurn', 'script', 'systemEvent']);

export const cronJobSummarySchema = z.object({
    agentId: z.string(),
    description: z.string().nullable(),
    enabled: z.boolean(),
    id: z.string().min(1),
    mode: cronModeSchema,
    name: z.string().min(1),
    schedule: cronScheduleSchema,
    state: cronJobStateSchema,
    updatedAt: z.string().datetime(),
});

export const cronJobSchema = cronJobSummarySchema.extend({
    createdAt: z.string().datetime(),
    deleteAfterRun: z.boolean(),
    delivery: cronDeliverySchema,
    payload: cronPayloadSchema,
    syncedAt: z.string().datetime(),
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

export const cronJobRunTriggerSchema = z.enum(['manual', 'recovery', 'schedule']);

export const cronJobRunSchema = z.object({
    chatId: z.string().min(1).nullable(),
    executionErrorCode: agentRuntimeExecutionErrorSchema.shape.code.nullable(),
    executionErrorMessage: agentRuntimeExecutionErrorSchema.shape.message.nullable(),
    finishedAt: z.string().datetime().nullable(),
    id: z.string().min(1),
    jobId: z.string().min(1),
    quiet: z.boolean().default(false),
    scheduledFor: z.string().datetime(),
    scriptExitCode: z.number().int().nullable().default(null),
    scriptStderr: z.string().nullable().default(null),
    startedAt: z.string().datetime().nullable(),
    status: cronJobRunStatusSchema,
    trigger: cronJobRunTriggerSchema,
    turnId: z.string().min(1).nullable(),
});

export const cronJobRunListSchema = z.object({
    runs: z.array(cronJobRunSchema),
});

export const cronRunSchema = z.object({
    chatId: z.string().min(1).nullable(),
    executionErrorCode: agentRuntimeExecutionErrorSchema.shape.code.nullable(),
    executionErrorMessage: agentRuntimeExecutionErrorSchema.shape.message.nullable(),
    finishedAt: z.string().datetime().nullable(),
    id: z.string().min(1),
    jobId: z.string().min(1),
    quiet: z.boolean().nullable().default(false),
    runtimeId: z.string().min(1).nullable(),
    scheduledFor: z.string().datetime(),
    scriptExitCode: z.number().int().nullable().default(null),
    scriptStderr: z.string().nullable().default(null),
    startedAt: z.string().datetime().nullable(),
    status: cronRunStatusSchema,
    syncedAt: z.string().datetime(),
    trigger: cronJobRunTriggerSchema.default('schedule'),
    turnId: z.string().min(1).nullable(),
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

export const listCronDeliveryTargetsInputSchema = z.object({
    agentId: z.string().trim().min(1),
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
    mode: runCronJobParamsSchema.shape.mode.default('enqueue'),
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
export type ListCronDeliveryTargetsInput = z.infer<typeof listCronDeliveryTargetsInputSchema>;
export type CronJobRun = z.infer<typeof cronJobRunSchema>;
export type CronRun = z.infer<typeof cronRunSchema>;
export type CronSyncState = z.infer<typeof cronSyncStateSchema>;
