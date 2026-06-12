import { z } from 'zod';

/**
 * Toolset setup contracts.
 *
 * A toolset that reports "needs setup" is configured through the engine's
 * provider matrix: pick a provider, save its env keys, and optionally run the
 * provider's post-setup install action. Runtime proxies these surfaces.
 */

export const agentRuntimeToolsetEnvVarSchema = z.object({
    defaultValue: z.string().nullable(),
    isSet: z.boolean(),
    key: z.string().trim().min(1),
    prompt: z.string(),
    url: z.string().nullable(),
});

export const agentRuntimeToolsetProviderSchema = z.object({
    badge: z.string(),
    envVars: z.array(agentRuntimeToolsetEnvVarSchema),
    isActive: z.boolean(),
    name: z.string().trim().min(1),
    postSetup: z.string().nullable(),
    requiresEngineAuth: z.boolean(),
    tag: z.string(),
});

export const agentRuntimeToolsetConfigSchema = z.object({
    activeProvider: z.string().nullable(),
    hasCategory: z.boolean(),
    name: z.string().trim().min(1),
    providers: z.array(agentRuntimeToolsetProviderSchema),
});

export const agentRuntimeToolsetProviderSelectSchema = z.object({
    provider: z.string().trim().min(1).max(100),
});

export const agentRuntimeToolsetProviderSelectResultSchema = z.object({
    name: z.string(),
    ok: z.boolean(),
    provider: z.string(),
});

export const agentRuntimeToolsetEnvUpdateSchema = z.object({
    env: z.record(z.string().trim().min(1), z.string().max(4000)),
});

export const agentRuntimeToolsetEnvUpdateResultSchema = z.object({
    isSet: z.record(z.string(), z.boolean()),
    name: z.string(),
    ok: z.boolean(),
    saved: z.array(z.string()),
    skipped: z.array(z.string()),
});

export const agentRuntimeToolsetPostSetupSchema = z.object({
    key: z.string().trim().min(1).max(100),
});

export type AgentRuntimeToolsetConfig = z.infer<typeof agentRuntimeToolsetConfigSchema>;
export type AgentRuntimeToolsetEnvUpdate = z.infer<typeof agentRuntimeToolsetEnvUpdateSchema>;
export type AgentRuntimeToolsetEnvUpdateResult = z.infer<
    typeof agentRuntimeToolsetEnvUpdateResultSchema
>;
export type AgentRuntimeToolsetEnvVar = z.infer<typeof agentRuntimeToolsetEnvVarSchema>;
export type AgentRuntimeToolsetPostSetup = z.infer<typeof agentRuntimeToolsetPostSetupSchema>;
export type AgentRuntimeToolsetProvider = z.infer<typeof agentRuntimeToolsetProviderSchema>;
export type AgentRuntimeToolsetProviderSelect = z.infer<
    typeof agentRuntimeToolsetProviderSelectSchema
>;
export type AgentRuntimeToolsetProviderSelectResult = z.infer<
    typeof agentRuntimeToolsetProviderSelectResultSchema
>;
