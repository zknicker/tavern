import {
    agentRuntimeCreateTaskLabelSchema,
    agentRuntimeTaskLabelListSchema,
    agentRuntimeTaskLabelSchema,
    agentRuntimeUpdateTaskLabelSchema,
} from '@tavern/api';
import { z } from 'zod';

export const labelSchema = agentRuntimeTaskLabelSchema;
export const labelListSchema = agentRuntimeTaskLabelListSchema;
export const createLabelInputSchema = agentRuntimeCreateTaskLabelSchema;
export const updateLabelInputSchema = z.object({
    labelId: z.string().trim().min(1),
    patch: agentRuntimeUpdateTaskLabelSchema,
});
export const deleteLabelInputSchema = z.object({
    labelId: z.string().trim().min(1),
});
