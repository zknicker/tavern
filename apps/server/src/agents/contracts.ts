import { z } from 'zod';
import {
    agentRuntimeConnectionSchema,
    agentRuntimeConnectionStatusSchema,
} from '../agent-runtime-connection/contracts.ts';
import {
    agentActivityStateSchema,
    agentKindSchema,
    cronStateSchema,
    logLevelSchema,
    sessionStateSchema,
} from '../contracts/shared.ts';
import { globalSessionSchema, sessionSchema } from '../sessions/contracts.ts';

const memorySchema = z.object({
    content: z.string(),
    createdAt: z.string(),
    id: z.string(),
    level: z.string(),
});

export const summarySchema = z.object({
    agents: z.number().int().nonnegative(),
    chats: z.number().int().nonnegative(),
    sessions: z.number().int().nonnegative(),
    memories: z.number().int().nonnegative(),
});

export const agentSchema = z.object({
    id: z.string(),
    name: z.string(),
    title: z.string(),
    description: z.string(),
    kind: agentKindSchema,
    accentFrom: z.string(),
    accentTo: z.string(),
    parentId: z.string().nullable(),
    peerIds: z.array(z.string()),
    chatCount: z.number().int().nonnegative(),
    memoryCount: z.number().int().nonnegative(),
    sessionCount: z.number().int().nonnegative(),
    cronCount: z.number().int().nonnegative(),
    layout: z.object({
        x: z.number(),
        y: z.number(),
    }),
});

export const edgeSchema = z.object({
    sourceId: z.string(),
    targetId: z.string(),
    kind: z.enum(['hierarchy', 'peer']),
});

export const logEntrySchema = z.object({
    id: z.string(),
    level: logLevelSchema,
    message: z.string(),
    source: z.string(),
    tags: z.array(z.string()),
    time: z.string(),
});

export const subAgentSchema = z.object({
    id: z.string(),
    logExcerpt: z.string(),
    name: z.string(),
    relationship: z.string(),
    state: sessionStateSchema,
    task: z.string(),
    lastActiveAt: z.string(),
});

export const cronJobSchema = z.object({
    id: z.string(),
    cadence: z.string(),
    description: z.string(),
    lastRunAt: z.string(),
    name: z.string(),
    schedule: z.string(),
    state: cronStateSchema,
    successRate: z.string(),
    target: z.string(),
});

export const agentDetailSchema = z.object({
    agent: agentSchema,
    cronJobs: z.array(cronJobSchema),
    logs: z.array(logEntrySchema),
    memories: z.array(memorySchema),
    sessions: z.array(sessionSchema),
    subAgents: z.array(subAgentSchema),
});

export const globalSubAgentSchema = subAgentSchema.extend({
    parentId: z.string(),
});

export const agentActivitySchema = z.object({
    agentId: z.string(),
    state: agentActivityStateSchema,
    updatedAt: z.string().nullable(),
});

export const globalDashboardSchema = z.object({
    agents: z.array(agentSchema),
    cronJobs: z.array(cronJobSchema),
    logs: z.array(logEntrySchema),
    sessions: z.array(globalSessionSchema),
    subAgents: z.array(globalSubAgentSchema),
});

export const dashboardSchema = z.object({
    connection: agentRuntimeConnectionStatusSchema,
    dataMode: z.enum(['cached', 'live']),
    edges: z.array(edgeSchema),
    featuredAgentId: z.string(),
    agentRuntime: agentRuntimeConnectionSchema.nullable(),
    summary: summarySchema,
    agents: z.array(agentSchema),
});

export type DashboardData = z.infer<typeof dashboardSchema>;
export type AgentDetail = z.infer<typeof agentDetailSchema>;
export type AgentActivity = z.infer<typeof agentActivitySchema>;
export type GlobalDashboardData = z.infer<typeof globalDashboardSchema>;
export type GlobalSubAgent = z.infer<typeof globalSubAgentSchema>;
export type LogEntry = z.infer<typeof logEntrySchema>;
