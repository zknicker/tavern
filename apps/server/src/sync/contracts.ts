import { z } from 'zod';

export const syncPrimitiveKindSchema = z.enum([
    'agent',
    'chat',
    'cron',
    'cronRun',
    'session',
    'skill',
    'task',
]);

function normalizeSyncPrimitiveStatus(value: unknown) {
    switch (value) {
        case 'drifted':
            return 'error';
        case 'localOnly':
            return 'inSync';
        default:
            return value;
    }
}

export const syncPrimitiveStatusSchema = z.preprocess(
    normalizeSyncPrimitiveStatus,
    z.enum(['error', 'inSync'])
);
export const syncPrimitiveStateSchema = z.object({
    hash: z.string().nullable(),
    id: z.string().min(1),
    json: z.string().nullable(),
    kind: syncPrimitiveKindSchema,
    lastAttemptedAt: z.string().datetime().nullable(),
    lastError: z.string().nullable(),
    lastSuccessfulAt: z.string().datetime().nullable(),
    agentRuntimeHash: z.string().nullable(),
    agentRuntimeJson: z.string().nullable(),
    status: syncPrimitiveStatusSchema,
    updatedAt: z.string().datetime(),
});
export type SyncPrimitiveKind = z.infer<typeof syncPrimitiveKindSchema>;
export type SyncPrimitiveState = z.infer<typeof syncPrimitiveStateSchema>;
export type SyncPrimitiveStatus = z.infer<typeof syncPrimitiveStatusSchema>;
