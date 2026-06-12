import { z } from 'zod';
import { actorRefSchema } from '../actors/contracts.ts';
import { sessionRelationshipSchema } from '../sessions/contracts/core.ts';
import {
    sessionAccessEventSchema,
    sessionArtifactSchema,
    sessionDeliverySchema,
} from '../sessions/contracts/log.ts';
import { sessionMessageSchema, sessionThinkingSchema } from '../sessions/contracts/messages.ts';
import { toolCallSchema, toolFactSchema } from '../tools/contracts.ts';
import { workerSchema } from '../workers/contracts.ts';

export const toolFactRowSchema = toolFactSchema;
export const toolCallRowSchema = toolCallSchema;

export const clarificationRowSchema = z.object({
    answer: z.string().nullable(),
    choices: z.array(z.string()),
    deadlineAt: z.string().nullable(),
    disposition: z.enum(['answered', 'skipped', 'timeout']).nullable(),
    question: z.string(),
    requestId: z.string(),
});

export const messageRowMessageSchema = sessionMessageSchema.extend({
    sourceSessionId: z.string().nullable(),
    sourceSessionKey: z.string(),
});

export const messageRowSchema = z.object({
    actor: actorRefSchema.nullable(),
    connectsToNext: z.boolean(),
    connectsToPrevious: z.boolean(),
    id: z.string(),
    isFirstInGroup: z.boolean(),
    kind: z.literal('message'),
    message: messageRowMessageSchema,
});

export const toolRowSchema = z.object({
    actor: actorRefSchema.nullable(),
    completedAt: z.string().nullable(),
    clarification: clarificationRowSchema.nullable().optional(),
    connectsToNext: z.boolean(),
    connectsToPrevious: z.boolean(),
    id: z.string(),
    isFirstInGroup: z.boolean(),
    kind: z.literal('tool'),
    sessionKey: z.string().nullable(),
    startedAt: z.string().nullable(),
    spawnedRelationships: z.array(sessionRelationshipSchema).default([]),
    toolCall: toolCallRowSchema,
});

export const workerRowSchema = z.object({
    actor: actorRefSchema.nullable(),
    completedAt: z.string().nullable(),
    connectsToNext: z.boolean(),
    connectsToPrevious: z.boolean(),
    id: z.string(),
    isFirstInGroup: z.boolean(),
    kind: z.literal('worker'),
    sessionKey: z.string().nullable(),
    startedAt: z.string().nullable(),
    worker: workerSchema,
});

export const runtimeNoticeSchema = z.object({
    compactionCount: z.number().int().nonnegative().nullable().optional(),
    detail: z.string().nullable(),
    kind: z.enum(['new_session', 'auto_compaction', 'status']),
    sessionId: z.string().nullable(),
    text: z.string(),
    title: z.string(),
});

export const systemRowSchema = z.discriminatedUnion('systemKind', [
    z.object({
        accessEvent: sessionAccessEventSchema,
        id: z.string(),
        kind: z.literal('system'),
        systemKind: z.literal('accessEvent'),
        timestamp: z.string(),
    }),
    z.object({
        artifact: sessionArtifactSchema,
        id: z.string(),
        kind: z.literal('system'),
        systemKind: z.literal('artifact'),
        timestamp: z.string(),
    }),
    z.object({
        delivery: sessionDeliverySchema,
        id: z.string(),
        kind: z.literal('system'),
        systemKind: z.literal('delivery'),
        timestamp: z.string().nullable(),
    }),
    z.object({
        id: z.string(),
        kind: z.literal('system'),
        runtimeNotice: runtimeNoticeSchema,
        systemKind: z.literal('runtimeNotice'),
        timestamp: z.string(),
    }),
    z.object({
        id: z.string(),
        kind: z.literal('system'),
        systemKind: z.literal('thinking'),
        thinking: sessionThinkingSchema,
        timestamp: z.string(),
    }),
]);

export const historyRowSchema = z.discriminatedUnion('kind', [
    messageRowSchema,
    toolRowSchema,
    workerRowSchema,
    systemRowSchema,
]);

export type MessageRowMessage = z.infer<typeof messageRowMessageSchema>;
export type HistoryRow = z.infer<typeof historyRowSchema>;
