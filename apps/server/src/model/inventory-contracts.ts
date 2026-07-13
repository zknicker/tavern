import { agentRuntimeModelCapabilitySchema } from '@tavern/api';
import { z } from 'zod';

export const modelProviderStateSchema = z.enum(['connected', 'not-configured']);
export const modelProviderAuthActionSchema = z.enum(['api-key', 'oauth', 'external', 'system']);
export const modelCapabilitySchema = z.enum([
    'audio-transcription',
    'embedding',
    'general',
    'vision',
]);

export const modelInventorySnapshotRecordSchema = z.object({
    capability: agentRuntimeModelCapabilitySchema,
    capabilities: z.array(modelCapabilitySchema).default(['general']),
    contextWindow: z.number().int().positive().nullable(),
    description: z.string().trim().min(1).nullable(),
    displayName: z.string().trim().min(1),
    modelId: z.string().trim().min(1),
    provider: z.string().trim().min(1),
    ref: z.string().trim().min(1),
});

export const modelInventoryRecordSchema = modelInventorySnapshotRecordSchema.extend({
    usageLabels: z.array(z.string().trim().min(1)),
});

export const modelInventorySnapshotSchema = z.object({
    models: z.array(modelInventorySnapshotRecordSchema),
    provider: z.string().trim().min(1),
    syncedAt: z.string().datetime(),
});

export const modelInventoryProviderSchema = z.object({
    authAction: modelProviderAuthActionSchema.nullable(),
    authType: z.string().trim().min(1).nullable(),
    connectionDetail: z.string().trim().min(1).nullable(),
    displayName: z.string().trim().min(1),
    isConnected: z.boolean(),
    keyEnv: z.string().trim().min(1).nullable(),
    models: z.array(
        modelInventoryRecordSchema.extend({
            canDelete: z.boolean(),
            inUse: z.boolean(),
        })
    ),
    provider: z.string().trim().min(1),
    state: modelProviderStateSchema,
    stateMessage: z.string().trim().min(1),
});

export const modelInventoryApiKeyOptionSchema = z.object({
    description: z.string().trim().min(1).nullable(),
    docsUrl: z.string().url().nullable(),
    envKey: z.string().trim().min(1),
    isSet: z.boolean(),
    label: z.string().trim().min(1),
    providerHint: z.string().trim().min(1).nullable(),
});

export const modelInventorySchema = z.object({
    apiKeyOptions: z.array(modelInventoryApiKeyOptionSchema).default([]),
    catalogProviders: z.array(modelInventoryProviderSchema).default([]),
    providers: z.array(modelInventoryProviderSchema),
});

export type ModelInventory = z.infer<typeof modelInventorySchema>;
export type ModelInventoryProvider = z.infer<typeof modelInventoryProviderSchema>;
export type ModelInventoryRecord = z.infer<typeof modelInventoryRecordSchema>;
export type ModelInventorySnapshotRecord = z.infer<typeof modelInventorySnapshotRecordSchema>;
export type ModelInventorySnapshot = z.infer<typeof modelInventorySnapshotSchema>;
export type ModelCapability = z.infer<typeof modelCapabilitySchema>;
export type ModelProviderAuthAction = z.infer<typeof modelProviderAuthActionSchema>;
export type ModelInventoryApiKeyOption = z.infer<typeof modelInventoryApiKeyOptionSchema>;
