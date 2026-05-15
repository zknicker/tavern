import {
    type AgentRuntimeModelProviderId,
    agentRuntimeModelProviderIdSchema,
} from '@tavern/agent-runtime-protocol';
import { z } from 'zod';

export const modelProviderIdSchema = agentRuntimeModelProviderIdSchema;
export const modelProviderStateSchema = z.enum(['connected', 'not-configured']);

export const modelInventorySnapshotRecordSchema = z.object({
    contextWindow: z.number().int().positive().nullable(),
    description: z.string().trim().min(1).nullable(),
    displayName: z.string().trim().min(1),
    modelId: z.string().trim().min(1),
    provider: modelProviderIdSchema,
    ref: z.string().trim().min(1),
});

export const modelInventoryRecordSchema = modelInventorySnapshotRecordSchema.extend({
    usageLabels: z.array(z.string().trim().min(1)),
});

export const modelInventorySnapshotSchema = z.object({
    models: z.array(modelInventorySnapshotRecordSchema),
    provider: modelProviderIdSchema,
    syncedAt: z.string().datetime(),
});

export const modelInventoryProviderSchema = z.object({
    displayName: z.string().trim().min(1),
    isConnected: z.boolean(),
    models: z.array(
        modelInventoryRecordSchema.extend({
            canDelete: z.boolean(),
            inUse: z.boolean(),
        })
    ),
    provider: modelProviderIdSchema,
    state: modelProviderStateSchema,
    stateMessage: z.string().trim().min(1),
});

export const modelInventorySchema = z.object({
    providers: z.array(modelInventoryProviderSchema),
});

export const addCatalogModelInputSchema = z.object({
    modelId: z.string().trim().min(1),
    provider: modelProviderIdSchema,
});

export const deleteCatalogModelInputSchema = z.object({
    modelRef: z.string().trim().min(1),
});

export type ModelInventory = z.infer<typeof modelInventorySchema>;
export type ModelInventoryProvider = z.infer<typeof modelInventoryProviderSchema>;
export type ModelInventoryRecord = z.infer<typeof modelInventoryRecordSchema>;
export type ModelInventorySnapshotRecord = z.infer<typeof modelInventorySnapshotRecordSchema>;
export type ModelInventorySnapshot = z.infer<typeof modelInventorySnapshotSchema>;
export type ModelProviderId = AgentRuntimeModelProviderId;
export type AddCatalogModelInput = z.infer<typeof addCatalogModelInputSchema>;
export type DeleteCatalogModelInput = z.infer<typeof deleteCatalogModelInputSchema>;
