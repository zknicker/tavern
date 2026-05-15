import { z } from 'zod';
import { sessionTypeSchema } from '../display.ts';
import { sessionMessageSchema } from './messages.ts';

export const sessionDisplaySchema = z.object({
    name: z.string(),
    source: z.string(),
    type: sessionTypeSchema,
});

export const sessionSchema = z.object({
    id: z.string(),
    duration: z.string(),
    messageCount: z.number().int().nonnegative().default(0),
    messages: z.array(sessionMessageSchema).default([]),
    parentSessionKey: z.string().nullable().default(null),
    platform: z.string().nullable().default(null),
    prompt: z.string(),
    result: z.string(),
    spawnedBy: z.string().nullable().default(null),
    startedAt: z.string(),
    state: z.enum(['running', 'idle', 'done', 'failed']),
    toolCalls: z.number().int().nonnegative(),
    title: z.string(),
});

export const sessionInvocationSchema = z.object({
    agentId: z.string().nullable(),
    key: z.string(),
    title: z.string(),
});

export const sessionRelationshipTargetSchema = z.object({
    agentId: z.string().nullable(),
    key: z.string(),
    name: z.string(),
    platform: z.string().nullable(),
    source: z.string(),
    title: z.string(),
    type: sessionTypeSchema,
});

export const sessionRelationshipSchema = z.object({
    direction: z.enum(['incoming', 'outgoing']),
    edgeType: z.literal('session_spawns_session'),
    id: z.string(),
    occurredAt: z.string(),
    relatedSession: sessionRelationshipTargetSchema,
    sourceToolCallId: z.string().nullable(),
});

export const sessionMetadataSchema = sessionSchema.omit({
    messages: true,
    prompt: true,
    result: true,
});

export const sessionListItemSchema = sessionSchema.omit({
    messages: true,
    prompt: true,
    result: true,
    toolCalls: true,
});

export const sessionMessagesPageSchema = z.object({
    limit: z.number().int().positive(),
    messages: sessionSchema.shape.messages,
    offset: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
});

export const globalSessionSchema = sessionSchema.extend({
    agentId: z.string(),
    key: z.string(),
});

export const globalSessionMetadataSchema = sessionMetadataSchema.extend({
    agentId: z.string(),
    invokedBy: sessionInvocationSchema.nullable().default(null),
    key: z.string(),
    name: z.string(),
    source: z.string(),
    type: sessionTypeSchema,
});

export const globalSessionListItemSchema = sessionListItemSchema.extend({
    agentId: z.string(),
    key: z.string(),
    name: z.string(),
    source: z.string(),
    type: sessionTypeSchema,
});

export type SessionInvocation = z.infer<typeof sessionInvocationSchema>;
export type SessionMessagesPage = z.infer<typeof sessionMessagesPageSchema>;
export type SessionRelationship = z.infer<typeof sessionRelationshipSchema>;
export type GlobalSession = z.infer<typeof globalSessionSchema>;
export type GlobalSessionMetadata = z.infer<typeof globalSessionMetadataSchema>;
export type GlobalSessionSummary = z.infer<typeof globalSessionListItemSchema>;
