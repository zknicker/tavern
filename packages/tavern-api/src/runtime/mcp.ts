import { z } from 'zod';

/**
 * MCP server contracts.
 *
 * MCP servers are engine-owned tool sources: a curated catalog with one-click
 * install plus custom HTTP/stdio servers. Runtime proxies the engine surface;
 * env values never leave the engine unredacted.
 */

export const agentRuntimeMcpTransportSchema = z.enum(['http', 'stdio', 'unknown']);

export const agentRuntimeMcpServerSchema = z.object({
    args: z.array(z.string()).default([]),
    command: z.string().nullable(),
    enabled: z.boolean(),
    name: z.string().trim().min(1),
    transport: agentRuntimeMcpTransportSchema,
    url: z.string().nullable(),
});

export const agentRuntimeMcpServerListSchema = z.object({
    servers: z.array(agentRuntimeMcpServerSchema),
});

export const agentRuntimeMcpServerCreateSchema = z
    .object({
        args: z.array(z.string().trim().min(1)).max(50).optional(),
        command: z.string().trim().min(1).max(500).optional(),
        env: z.record(z.string().trim().min(1), z.string().max(4000)).optional(),
        name: z.string().trim().min(1).max(100),
        url: z.string().trim().min(1).max(2000).optional(),
    })
    .refine((value) => Boolean(value.url) !== Boolean(value.command), {
        message: 'Provide either a URL or a command, not both.',
    });

export const agentRuntimeMcpServerTestResultSchema = z.object({
    error: z.string().nullable(),
    ok: z.boolean(),
    tools: z.array(
        z.object({
            description: z.string(),
            name: z.string(),
        })
    ),
});

export const agentRuntimeMcpServerEnabledSchema = z.object({
    enabled: z.boolean(),
});

export const agentRuntimeMcpCatalogEntrySchema = z.object({
    authType: z.string(),
    description: z.string(),
    enabled: z.boolean(),
    installed: z.boolean(),
    name: z.string().trim().min(1),
    needsInstall: z.boolean(),
    requiredEnv: z.array(
        z.object({
            name: z.string().trim().min(1),
            prompt: z.string(),
            required: z.boolean(),
        })
    ),
    source: z.string(),
    transport: z.string(),
});

export const agentRuntimeMcpCatalogSchema = z.object({
    entries: z.array(agentRuntimeMcpCatalogEntrySchema),
});

export const agentRuntimeMcpCatalogInstallSchema = z.object({
    enable: z.boolean().default(true),
    env: z.record(z.string().trim().min(1), z.string().max(4000)).optional(),
    name: z.string().trim().min(1).max(100),
});

export type AgentRuntimeMcpCatalog = z.infer<typeof agentRuntimeMcpCatalogSchema>;
export type AgentRuntimeMcpCatalogEntry = z.infer<typeof agentRuntimeMcpCatalogEntrySchema>;
export type AgentRuntimeMcpCatalogInstall = z.infer<typeof agentRuntimeMcpCatalogInstallSchema>;
export type AgentRuntimeMcpServer = z.infer<typeof agentRuntimeMcpServerSchema>;
export type AgentRuntimeMcpServerCreate = z.infer<typeof agentRuntimeMcpServerCreateSchema>;
export type AgentRuntimeMcpServerEnabled = z.infer<typeof agentRuntimeMcpServerEnabledSchema>;
export type AgentRuntimeMcpServerList = z.infer<typeof agentRuntimeMcpServerListSchema>;
export type AgentRuntimeMcpServerTestResult = z.infer<typeof agentRuntimeMcpServerTestResultSchema>;
