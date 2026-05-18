import * as z from 'zod';

export const agentRuntimeModelProviderIdSchema = z.enum(['claude', 'codex', 'openrouter']);
export const modelExecutionProviderSchema = z.enum(['claude', 'codex', 'opencode']);
export const agentRuntimeModelProviderIds = agentRuntimeModelProviderIdSchema.options;

export const agentRuntimeModelProviderCapabilitySchema = z.object({
    executionProvider: modelExecutionProviderSchema.nullable(),
    supportsChatRouting: z.boolean(),
    supportsMemory: z.boolean(),
    supportsSubAgentRouting: z.boolean(),
});

export type AgentRuntimeModelProviderId = z.infer<typeof agentRuntimeModelProviderIdSchema>;
export type ModelExecutionProvider = z.infer<typeof modelExecutionProviderSchema>;
export type AgentRuntimeModelProviderCapability = z.infer<
    typeof agentRuntimeModelProviderCapabilitySchema
>;

export const agentRuntimeModelProviderCapabilities = {
    claude: {
        executionProvider: 'claude',
        supportsChatRouting: true,
        supportsMemory: true,
        supportsSubAgentRouting: true,
    },
    codex: {
        executionProvider: 'codex',
        supportsChatRouting: true,
        supportsMemory: true,
        supportsSubAgentRouting: true,
    },
    openrouter: {
        executionProvider: null,
        supportsChatRouting: false,
        supportsMemory: true,
        supportsSubAgentRouting: false,
    },
} as const satisfies Record<AgentRuntimeModelProviderId, AgentRuntimeModelProviderCapability>;
