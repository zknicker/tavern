import { z } from 'zod';
import { sessionTypeSchema } from '../display.ts';
import {
    globalSessionMetadataSchema,
    sessionMessagesPageSchema,
    sessionRelationshipSchema,
} from './core.ts';
import { sessionMessageSchema, sessionThinkingSchema } from './messages.ts';

export const sessionDeliverySchema = z.object({
    childSessionKey: z.string(),
    childSessionName: z.string(),
    childSessionPlatform: z.string().nullable(),
    childSessionSource: z.string(),
    childSessionTitle: z.string().nullable(),
    childSessionType: sessionTypeSchema,
    deliveredAt: z.string().nullable(),
    id: z.string(),
    messageText: z.string().nullable(),
    mode: z.string().nullable(),
    parentSessionKey: z.string(),
    parentSessionName: z.string(),
    parentSessionPlatform: z.string().nullable(),
    parentSessionSource: z.string(),
    parentSessionTitle: z.string().nullable(),
    parentSessionType: sessionTypeSchema,
    payload: z.unknown().nullable(),
    sourceMessageId: z.string().nullable(),
    status: z.string().nullable(),
    targetMessageId: z.string().nullable(),
});

export const sessionAccessEventSchema = z.object({
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    id: z.string(),
    occurredAt: z.string(),
    status: z.string(),
    targetSessionKey: z.string().nullable(),
    toolName: z.string().nullable(),
});

export const sessionArtifactSchema = z.object({
    artifactType: z.string(),
    createdAt: z.string(),
    id: z.string(),
    mimeType: z.string().nullable(),
    path: z.string().nullable(),
    payload: z.unknown().nullable(),
});

export const sessionLogEntrySchema = z.discriminatedUnion('kind', [
    z.object({
        id: z.string(),
        kind: z.literal('message'),
        message: sessionMessageSchema,
        timestamp: z.string(),
    }),
    z.object({
        delivery: sessionDeliverySchema,
        id: z.string(),
        kind: z.literal('delivery'),
        timestamp: z.string().nullable(),
    }),
    z.object({
        id: z.string(),
        invocation: sessionMessageSchema.nullable(),
        kind: z.literal('toolExecution'),
        result: sessionMessageSchema.nullable(),
        timestamp: z.string(),
    }),
    z.object({
        id: z.string(),
        kind: z.literal('thinking'),
        thinking: sessionThinkingSchema,
        timestamp: z.string(),
    }),
    z.object({
        accessEvent: sessionAccessEventSchema,
        id: z.string(),
        kind: z.literal('accessEvent'),
        timestamp: z.string(),
    }),
    z.object({
        artifact: sessionArtifactSchema,
        id: z.string(),
        kind: z.literal('artifact'),
        timestamp: z.string(),
    }),
]);

export const sessionLogPageSchema = z.object({
    entries: z.array(sessionLogEntrySchema),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
});

export const activityLogPageSchema = sessionLogPageSchema;

export const sessionDetailSchema = z.object({
    deliveries: z.array(sessionDeliverySchema),
    log: sessionLogPageSchema,
    messages: sessionMessagesPageSchema,
    relationships: z.array(sessionRelationshipSchema).default([]),
    session: globalSessionMetadataSchema,
});

export type SessionDelivery = z.infer<typeof sessionDeliverySchema>;
export type ActivityLogPage = z.infer<typeof activityLogPageSchema>;
export type SessionLogPage = z.infer<typeof sessionLogPageSchema>;
export type SessionAccessEvent = z.infer<typeof sessionAccessEventSchema>;
export type SessionArtifact = z.infer<typeof sessionArtifactSchema>;
export type SessionDetail = z.infer<typeof sessionDetailSchema>;
