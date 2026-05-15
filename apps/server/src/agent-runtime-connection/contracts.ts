import { z } from 'zod';
import { connectionStateSchema } from '../contracts/shared.ts';

export const agentRuntimeCapabilitySchema = z.enum([
    'tavernPlugin',
    'agents',
    'chats',
    'cron',
    'cronRuns',
    'events',
    'gateway',
    'logs',
    'messages',
    'models',
    'sessions',
    'skills',
    'skillMaterialization',
    'status',
]);

export const agentRuntimeCapabilityStateSchema = z.enum([
    'degraded',
    'healthy',
    'unauthorized',
    'unavailable',
    'unknown',
]);

export const agentRuntimeCapabilityStatusSchema = z.object({
    capability: agentRuntimeCapabilitySchema,
    checkedAt: z.string().datetime(),
    errorCode: z.string().nullable(),
    lastHealthyAt: z.string().datetime().nullable(),
    metadataJson: z.string().nullable(),
    method: z.string().nullable(),
    reason: z.string().nullable(),
    runtimeId: z.string().trim().min(1),
    state: agentRuntimeCapabilityStateSchema,
    technicalMessage: z.string().nullable(),
    updatedAt: z.string().datetime(),
});

export const agentRuntimeConnectionAuthSchema = z
    .object({
        deviceToken: z.string().trim().min(1).optional(),
        password: z.string().trim().min(1).optional(),
        token: z.string().trim().min(1).optional(),
    })
    .optional();

export const agentRuntimeConnectionInputSchema = z.object({
    auth: agentRuntimeConnectionAuthSchema,
    baseUrl: z.string().url(),
    enabled: z.boolean().optional(),
    id: z.string().trim().min(1).optional(),
});

export const agentRuntimeConnectionSchema = z.object({
    authConfigured: z.boolean(),
    baseUrl: z.string().url(),
    capabilities: z.array(agentRuntimeCapabilityStatusSchema).default([]),
    enabled: z.boolean(),
    id: z.string().trim().min(1),
    isActive: z.boolean(),
    lastCheckedAt: z.string().nullable(),
    lastError: z.string().nullable(),
    lastSyncedAt: z.string().nullable(),
    name: z.string().trim().min(1),
    openClawCapabilities: z.array(agentRuntimeCapabilityStatusSchema).default([]),
    runtimeCapabilities: z.array(agentRuntimeCapabilityStatusSchema).default([]),
    source: z.enum(['environment', 'saved']),
});

export const agentRuntimeConnectionStatusSchema = z.object({
    capabilities: z.array(agentRuntimeCapabilityStatusSchema).default([]),
    lastCheckedAt: z.string().nullable(),
    lastError: z.string().nullable(),
    state: connectionStateSchema,
    url: z.string().url().nullable(),
});

export type AgentRuntimeConnection = z.infer<typeof agentRuntimeConnectionSchema>;
export type AgentRuntimeConnectionAuth = z.infer<typeof agentRuntimeConnectionAuthSchema>;
export type AgentRuntimeCapability = z.infer<typeof agentRuntimeCapabilitySchema>;
export type AgentRuntimeCapabilityState = z.infer<typeof agentRuntimeCapabilityStateSchema>;
export type AgentRuntimeCapabilityStatus = z.infer<typeof agentRuntimeCapabilityStatusSchema>;
export type AgentRuntimeConnectionInput = z.infer<typeof agentRuntimeConnectionInputSchema>;
export type AgentRuntimeConnectionStatus = z.infer<typeof agentRuntimeConnectionStatusSchema>;
