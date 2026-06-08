import { agentRuntimeHermesConfigSchema } from '@tavern/api';
import { z } from 'zod';

export const hermesConfigSnapshotSchema = z.object({
    config: agentRuntimeHermesConfigSchema,
    hash: z.string().min(1),
    issues: z.array(z.unknown()),
    lastError: z.string().nullable(),
    lastSyncedAt: z.string(),
    raw: z.string(),
    runtimeId: z.string().min(1),
    valid: z.boolean().nullable(),
});

export const hermesConfigStateSchema = z.object({
    runtimeId: z.string().min(1).nullable(),
    snapshot: hermesConfigSnapshotSchema.nullable(),
});

export const applyHermesConfigInputSchema = z.object({
    baseHash: z.string().trim().min(1),
    config: agentRuntimeHermesConfigSchema,
    runtimeId: z.string().trim().min(1),
});

export type HermesConfigSnapshot = z.infer<typeof hermesConfigSnapshotSchema>;
export type HermesConfigState = z.infer<typeof hermesConfigStateSchema>;
export type ApplyHermesConfigInput = z.infer<typeof applyHermesConfigInputSchema>;
