import { z } from 'zod';

export const workerSourceSchema = z.enum(['agentRuntime']);

export const workerKindSchema = z.enum(['acp', 'subagent', 'cron', 'cli']);

export const workerExecutionModeSchema = z.enum(['main_session', 'detached_session', 'unknown']);

export const workerStatusSchema = z.enum([
    'queued',
    'running',
    'waiting',
    'blocked',
    'succeeded',
    'failed',
    'timed_out',
    'cancelled',
    'lost',
]);

export const workerNotifyPolicySchema = z.enum(['done_only', 'state_changes', 'silent']);

export const workerDeliveryStatusSchema = z.enum([
    'pending',
    'delivered',
    'session_queued',
    'failed',
    'parent_missing',
    'not_applicable',
]);

export const workerSchema = z.object({
    agentId: z.string().nullable(),
    agentName: z.string().min(1),
    chatTitle: z.string().nullable(),
    childSessionKey: z.string().nullable(),
    cleanupAfter: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    description: z.string().nullable(),
    detail: z.string().nullable(),
    deliveryStatus: workerDeliveryStatusSchema.nullable(),
    endedAt: z.string().datetime().nullable(),
    error: z.string().nullable(),
    executionMode: workerExecutionModeSchema,
    id: z.string().min(1),
    kind: workerKindSchema,
    lastEventAt: z.string().datetime().nullable(),
    notifyPolicy: workerNotifyPolicySchema.nullable(),
    parentWorkerId: z.string().nullable(),
    progressSummary: z.string().nullable(),
    requesterSessionKey: z.string().nullable(),
    runId: z.string().nullable(),
    sessionKey: z.string().nullable(),
    source: workerSourceSchema,
    sourceFlowId: z.string().nullable(),
    sourceId: z.string().min(1),
    startedAt: z.string().datetime().nullable(),
    status: workerStatusSchema,
    syncedAt: z.string().datetime(),
    terminalSummary: z.string().nullable(),
    title: z.string().min(1),
});

export const workerSyncStateSchema = z.object({
    lastAttemptedAt: z.string().datetime().nullable(),
    lastError: z.string().nullable(),
    lastSuccessfulAt: z.string().datetime().nullable(),
});

export const workerListOutputSchema = z.object({
    sync: workerSyncStateSchema,
    workers: z.array(workerSchema),
});

export type Worker = z.infer<typeof workerSchema>;
export type WorkerExecutionMode = z.infer<typeof workerExecutionModeSchema>;
export type WorkerListOutput = z.infer<typeof workerListOutputSchema>;
export type WorkerStatus = z.infer<typeof workerStatusSchema>;
