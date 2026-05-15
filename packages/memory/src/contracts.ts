import { z } from 'zod';

export const memoryActorSchema = z.object({
    id: z.string().trim().min(1),
    kind: z.enum(['agent', 'user', 'system']),
});

export const memoryScopeSchema = z.object({
    agentId: z.string().trim().min(1).optional(),
    chatId: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
});

export const memoryRecordSchema = z.object({
    confidence: z.number().min(0).max(1).optional(),
    content: z.string().trim().min(1),
    createdAt: z.string().trim().min(1),
    id: z.string().trim().min(1),
    metadata: z.record(z.string(), z.unknown()).default({}),
    scope: memoryScopeSchema,
    source: z.object({
        actor: memoryActorSchema,
        sessionId: z.string().trim().min(1).optional(),
        turnId: z.string().trim().min(1).optional(),
    }),
    updatedAt: z.string().trim().min(1),
});

export const memoryWriteInputSchema = z.object({
    content: z.string().trim().min(1),
    metadata: z.record(z.string(), z.unknown()).default({}),
    scope: memoryScopeSchema,
    source: z.object({
        actor: memoryActorSchema,
        sessionId: z.string().trim().min(1).optional(),
        turnId: z.string().trim().min(1).optional(),
    }),
});

export const memoryRecallInputSchema = z.object({
    limit: z.number().int().positive().max(50).default(10),
    query: z.string().trim().min(1),
    scope: memoryScopeSchema,
});

export const memoryRecallResultSchema = z.object({
    records: z.array(memoryRecordSchema),
});

export type MemoryActor = z.infer<typeof memoryActorSchema>;
export type MemoryRecallInput = z.infer<typeof memoryRecallInputSchema>;
export type MemoryRecallResult = z.infer<typeof memoryRecallResultSchema>;
export type MemoryRecord = z.infer<typeof memoryRecordSchema>;
export type MemoryScope = z.infer<typeof memoryScopeSchema>;
export type MemoryWriteInput = z.infer<typeof memoryWriteInputSchema>;
