import { agentRuntimeOpenClawConfigSchema } from '@tavern/agent-runtime-protocol';
import { z } from 'zod';

export const openClawConfigSnapshotSchema = z.object({
    config: agentRuntimeOpenClawConfigSchema,
    hash: z.string().min(1),
    issues: z.array(z.unknown()),
    lastError: z.string().nullable(),
    lastSyncedAt: z.string(),
    raw: z.string(),
    runtimeId: z.string().min(1),
    valid: z.boolean().nullable(),
});

export const openClawConfigStateSchema = z.object({
    runtimeId: z.string().min(1).nullable(),
    snapshot: openClawConfigSnapshotSchema.nullable(),
});

export const applyOpenClawConfigInputSchema = z.object({
    baseHash: z.string().trim().min(1),
    config: agentRuntimeOpenClawConfigSchema,
    runtimeId: z.string().trim().min(1),
});

export type OpenClawConfigSnapshot = z.infer<typeof openClawConfigSnapshotSchema>;
export type OpenClawConfigState = z.infer<typeof openClawConfigStateSchema>;
export type ApplyOpenClawConfigInput = z.infer<typeof applyOpenClawConfigInputSchema>;
