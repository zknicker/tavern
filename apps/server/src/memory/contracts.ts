import type { AgentRuntimeMemoryStatus } from '@tavern/api';
import { z } from 'zod';
import { modelRefSchema } from '../model/contracts.ts';

const memoryModelSchema = modelRefSchema.nullable();

export const memorySettingsSchema = z.object({
    dreamModel: memoryModelSchema,
    knowledgeModel: memoryModelSchema,
    memoryEnabled: z.boolean(),
    persistenceModel: memoryModelSchema,
    updatedAt: z.string().datetime().nullable(),
    workingModel: memoryModelSchema,
});

export const saveMemorySettingsInputSchema = memorySettingsSchema
    .omit({
        updatedAt: true,
    })
    .superRefine((input, context) => {
        if (!input.memoryEnabled) {
            return;
        }

        for (const [slot, value] of Object.entries({
            dreamModel: input.dreamModel,
            knowledgeModel: input.knowledgeModel,
            persistenceModel: input.persistenceModel,
            workingModel: input.workingModel,
        })) {
            if (value) {
                continue;
            }

            context.addIssue({
                code: 'custom',
                message: `Select a ${slot.replace('Model', '')} model before enabling memory.`,
                path: [slot],
            });
        }
    });

export type MemorySettings = z.infer<typeof memorySettingsSchema>;
export type MemoryStatus = AgentRuntimeMemoryStatus;
export type SaveMemorySettingsInput = z.infer<typeof saveMemorySettingsInputSchema>;
