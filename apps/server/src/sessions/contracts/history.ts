import { z } from 'zod';
import {
    type HistoryRow,
    historyRowSchema,
    messageRowSchema,
    systemRowSchema,
    toolCallRowSchema,
    toolFactRowSchema,
    toolRowSchema,
    workerRowSchema,
} from '../../rows/contracts.ts';
import { globalSessionMetadataSchema, sessionRelationshipSchema } from './core.ts';

export const sessionHistoryToolFactSchema = toolFactRowSchema;
export const sessionHistoryToolCallSchema = toolCallRowSchema;
export const sessionHistoryMessageRowSchema = messageRowSchema;
export const sessionHistoryToolRowSchema = toolRowSchema;
export const sessionHistoryWorkerRowSchema = workerRowSchema;
export const sessionHistorySystemRowSchema = systemRowSchema;
export const sessionHistoryRowSchema = historyRowSchema;

export const sessionHistorySchema = z.object({
    offset: z.number().int().nonnegative(),
    parentRelationship: sessionRelationshipSchema.nullable(),
    rows: z.array(sessionHistoryRowSchema),
    session: globalSessionMetadataSchema,
    total: z.number().int().nonnegative(),
});

export type SessionHistory = z.infer<typeof sessionHistorySchema>;
export type SessionHistoryRow = HistoryRow;
